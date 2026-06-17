/**
 * AI controller.
 *
 *   POST /api/v1/ai/shape-recognition                       (multipart; step 1)
 *   POST /api/v1/ai/room-suggestions                        (cached 5 min; step 2)
 *   POST /api/v1/plans/:planId/generate/floor-plan          (enqueue; step 3)
 *   POST /api/v1/ai/color-palettes                          (cached 5 min; step 4)
 *   POST /api/v1/plans/:planId/generate/interior            (enqueue N; step 4)
 *   POST /api/v1/plans/:planId/generate/exterior            (enqueue 1-3; step 5)
 *   GET  /api/v1/ai/jobs/:jobId                             (polling fallback)
 */

const crypto = require("crypto");

const AIServiceFactory = require("../services/ai");
const redis = require("../config/redis");
const {
  enqueueGeneration,
  getJobSnapshot,
  TIER_LIMITS,
} = require("../queues/aiGenerationQueue");
const { buildInteriorPrompt, buildExteriorPrompt, buildBirdEyePrompt } = require("../utils/buildImagePrompt");

const ROOM_SUGGESTION_TTL = 300;          // 5 min
const PALETTE_TTL = 300;                  // 5 min
const DAILY_LIMIT_TTL = 86400;            // 24 h

/* ── 1. Shape recognition ───────────────────────────────────────────── */

exports.shapeRecognition = async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: "image_required" });
    const service = AIServiceFactory.getShapeService();
    const result = await service.recognizeShape(req.file.buffer, req.file.mimetype);
    res.json({
      polygon: Array.isArray(result.polygon) ? result.polygon : [],
      confidence: typeof result.confidence === "number" ? result.confidence : 0,
      provider: result.provider || "unknown",
      mock: !!result.mock,
    });
  } catch (e) {
    if (e.status) return res.status(e.status).json({ error: e.message });
    next(e);
  }
};

/* ── 2. Room suggestions ───────────────────────────────────────────── */

function canonicaliseForHash({ roomConfig = {}, landDetails = {}, vastuEnabled = false }) {
  const stable = (o) =>
    o && typeof o === "object" && !Array.isArray(o)
      ? Object.keys(o).sort().reduce((acc, k) => { acc[k] = stable(o[k]); return acc; }, {})
      : Array.isArray(o) ? o.map(stable) : o;
  return JSON.stringify({
    roomConfig: stable(roomConfig),
    landDetails: stable(landDetails),
    vastuEnabled: !!vastuEnabled,
  });
}

exports.roomSuggestions = async (req, res, next) => {
  try {
    const { roomConfig = {}, landDetails = {}, vastuEnabled = false } = req.body || {};
    const canonical = canonicaliseForHash({ roomConfig, landDetails, vastuEnabled });
    const hash = crypto.createHash("sha256").update(canonical).digest("hex").slice(0, 16);
    const cacheKey = `room-sug:${hash}`;

    try {
      const cached = await redis.get(cacheKey);
      if (cached) return res.json({ ...JSON.parse(cached), cached: true });
    } catch (e) { console.warn("[ai] redis read failed:", e.message); }

    const service = AIServiceFactory.getRoomSuggestionService();
    const result = await service.roomSuggestions({ roomConfig, landDetails, vastuEnabled });

    try { await redis.set(cacheKey, JSON.stringify(result), "EX", ROOM_SUGGESTION_TTL); }
    catch (e) { console.warn("[ai] redis write failed:", e.message); }

    res.json({ ...result, cached: false });
  } catch (e) { next(e); }
};

/* ── 3. Floor plan generation (queued) ──────────────────────────────── */

function todayKey() {
  // YYYY-MM-DD in UTC — cheap, no timezone library
  return new Date().toISOString().slice(0, 10);
}

/**
 * POST /api/v1/plans/:planId/generate/floor-plan
 *
 * 1. Atomically INCR ai_gen_limit:{userId}:{date} (TTL 86400)
 * 2. If post-INCR count > tier limit → decrement and 429 with upgrade prompt
 * 3. Enqueue job, return { jobId, position, eta }
 */
exports.enqueueFloorPlanGeneration = async (req, res, next) => {
  try {
    const { planId } = req.params;
    const userId = req.user.userId;
    const tier = req.user.tier || "FREE";
    const limit = TIER_LIMITS[tier] ?? TIER_LIMITS.FREE;

    /* ── Daily rate limit ── */
    const key = `ai_gen_limit:${userId}:${todayKey()}`;
    let count;
    try {
      count = await redis.incr(key);
      if (count === 1) await redis.expire(key, DAILY_LIMIT_TTL);
    } catch (e) {
      console.warn("[ai] limit counter unavailable:", e.message);
      count = 0; // allow the job through if Redis is down
    }

    if (count > limit) {
      try { await redis.decr(key); } catch (_) {}
      return res.status(429).json({
        error: "ai_limit_reached",
        tier,
        used: count - 1,
        limit,
        upgradePrompt: {
          title: "Daily AI generation limit reached",
          message: `Your ${tier} plan allows ${limit} AI generations per day. Upgrade for more.`,
          tiers: [
            { id: "FREE", label: "Free", daily: TIER_LIMITS.FREE, priceInr: 0 },
            { id: "BASIC", label: "Basic", daily: TIER_LIMITS.BASIC, priceInr: 99 },
            { id: "PRO", label: "Pro", daily: TIER_LIMITS.PRO, priceInr: 499, recommended: true },
            { id: "ENTERPRISE", label: "Enterprise", daily: "Unlimited", priceInr: 1999 },
          ],
        },
      });
    }

    /* ── Body validation ── */
    const { payload = {} } = req.body || {};
    if (!payload || typeof payload !== "object") {
      return res.status(400).json({ error: "payload_required" });
    }

    /* ── Enqueue ── */
    const job = await enqueueGeneration({
      type: "floor-plan",
      planId,
      userId,
      userTier: tier,
      payload,
    });

    return res.status(202).json({
      jobId: job.id,
      tier,
      remainingToday: Math.max(0, limit - count),
    });
  } catch (e) { next(e); }
};

/* ── 4. Polling fallback ───────────────────────────────────────────── */

exports.getJobStatus = async (req, res, next) => {
  try {
    const snap = await getJobSnapshot(req.params.jobId);
    if (!snap) return res.status(404).json({ error: "job_not_found" });
    res.json({ jobId: req.params.jobId, ...snap });
  } catch (e) { next(e); }
};

/* ── 5. Colour palettes (cached) ───────────────────────────────────── */

exports.colorPalettes = async (req, res, next) => {
  try {
    const { style = "modern", vastuEnabled = false } = req.body || {};
    const hash = crypto.createHash("sha256")
      .update(JSON.stringify({ style, vastuEnabled: !!vastuEnabled }))
      .digest("hex").slice(0, 16);
    const cacheKey = `palette:${hash}`;

    try {
      const cached = await redis.get(cacheKey);
      if (cached) return res.json({ ...JSON.parse(cached), cached: true });
    } catch (e) { /* fall through */ }

    const service = AIServiceFactory.getRoomSuggestionService(); // re-uses AI_PLAN_PROVIDER
    const result = await service.colorPalettes({ style, vastuEnabled });

    try { await redis.set(cacheKey, JSON.stringify(result), "EX", PALETTE_TTL); }
    catch (e) { /* non-fatal */ }

    res.json({ ...result, cached: false });
  } catch (e) { next(e); }
};

/* ── 6. Multi-job rate-limit helper ────────────────────────────────── */

/**
 * Atomic check + reservation of N generation credits.
 * Returns { ok: true, used, limit } on success, or { ok: false, used, limit, upgradePrompt }.
 */
async function reserveCredits(userId, tier, count) {
  const limit = TIER_LIMITS[tier] ?? TIER_LIMITS.FREE;
  const key = `ai_gen_limit:${userId}:${new Date().toISOString().slice(0, 10)}`;
  let used = 0;

  try {
    used = await redis.incrby(key, count);
    if (used === count) await redis.expire(key, DAILY_LIMIT_TTL);
  } catch (e) {
    // Redis unavailable — let through; counter is best-effort.
    return { ok: true, used: 0, limit };
  }

  if (used > limit) {
    try { await redis.decrby(key, count); } catch (_) {}
    return {
      ok: false,
      used: used - count,
      limit,
      upgradePrompt: {
        title: "Daily AI generation limit reached",
        message: `Your ${tier} plan allows ${limit} AI generations per day. Upgrade for more.`,
        tiers: [
          { id: "FREE", label: "Free", daily: TIER_LIMITS.FREE, priceInr: 0 },
          { id: "BASIC", label: "Basic", daily: TIER_LIMITS.BASIC, priceInr: 99 },
          { id: "PRO", label: "Pro", daily: TIER_LIMITS.PRO, priceInr: 499, recommended: true },
          { id: "ENTERPRISE", label: "Enterprise", daily: "Unlimited", priceInr: 1999 },
        ],
      },
    };
  }

  return { ok: true, used, limit };
}

/* ── 7. Interior generation (N rooms) ──────────────────────────────── */

/**
 * Body: { rooms: [{ id, kind, w?, h? }], style, palette, vastuEnabled, cityState }
 * Each room gets its own job. Returns { jobs: [{ roomId, jobId }] }.
 */
exports.enqueueInteriorGeneration = async (req, res, next) => {
  try {
    const { planId } = req.params;
    const userId = req.user.userId;
    const tier = req.user.tier || "FREE";

    const {
      rooms = [],
      style = "modern",
      palette,
      vastuEnabled = false,
      cityState,
    } = req.body || {};

    if (!Array.isArray(rooms) || rooms.length === 0) {
      return res.status(400).json({ error: "rooms_required" });
    }
    if (rooms.length > 20) {
      return res.status(400).json({ error: "too_many_rooms" });
    }

    const reservation = await reserveCredits(userId, tier, rooms.length);
    if (!reservation.ok) {
      return res.status(429).json({
        error: "ai_limit_reached",
        tier,
        used: reservation.used,
        limit: reservation.limit,
        upgradePrompt: reservation.upgradePrompt,
      });
    }

    const jobs = [];
    for (const room of rooms) {
      const prompt = buildInteriorPrompt({ room, style, palette, vastuEnabled, cityState });
      const job = await enqueueGeneration({
        type: "interior-render",
        planId,
        userId,
        userTier: tier,
        payload: { roomId: room.id, prompt, seed: room.seed },
      });
      jobs.push({ roomId: room.id, jobId: job.id });
    }

    return res.status(202).json({
      jobs,
      tier,
      remainingToday: Math.max(0, reservation.limit - reservation.used),
    });
  } catch (e) { next(e); }
};

/* ── 8. Exterior generation (front + sides) ────────────────────────── */

/**
 * Body: { sides: ['front','left','right'], facadeStyle, roofType, boundaryWall,
 *         mainGate, driveway, landscaping, vastuEnabled, cityState }
 */
exports.enqueueExteriorGeneration = async (req, res, next) => {
  try {
    const { planId } = req.params;
    const userId = req.user.userId;
    const tier = req.user.tier || "FREE";

    const {
      sides = ["front", "left"],
      facadeStyle = "contemporary",
      roofType,
      boundaryWall,
      mainGate,
      driveway,
      landscaping = [],
      vastuEnabled = false,
      cityState,
    } = req.body || {};

    const validSides = ["front", "left", "right"];
    const cleanSides = sides.filter((s) => validSides.includes(s));
    if (cleanSides.length === 0) {
      return res.status(400).json({ error: "sides_required" });
    }

    const reservation = await reserveCredits(userId, tier, cleanSides.length);
    if (!reservation.ok) {
      return res.status(429).json({
        error: "ai_limit_reached",
        tier,
        used: reservation.used,
        limit: reservation.limit,
        upgradePrompt: reservation.upgradePrompt,
      });
    }

    const jobs = [];
    for (const side of cleanSides) {
      const prompt = buildExteriorPrompt({
        side, facadeStyle, roofType, boundaryWall, mainGate,
        driveway, landscaping, vastuEnabled, cityState,
      });
      const job = await enqueueGeneration({
        type: "exterior-render",
        planId,
        userId,
        userTier: tier,
        payload: { side, prompt },
      });
      jobs.push({ side, jobId: job.id });
    }

    return res.status(202).json({
      jobs,
      tier,
      remainingToday: Math.max(0, reservation.limit - reservation.used),
    });
  } catch (e) { next(e); }
};

/* ── 9. Utilities generation ───────────────────────────────────────── */

/**
 * Body: { floorPlan, roomConfig, landDetails }
 * (Payload is forwarded straight to the rule engine.)
 */
exports.enqueueUtilitiesGeneration = async (req, res, next) => {
  try {
    const { planId } = req.params;
    const userId = req.user.userId;
    const tier = req.user.tier || "FREE";

    const reservation = await reserveCredits(userId, tier, 1);
    if (!reservation.ok) {
      return res.status(429).json({
        error: "ai_limit_reached",
        tier,
        used: reservation.used,
        limit: reservation.limit,
        upgradePrompt: reservation.upgradePrompt,
      });
    }

    const payload = req.body?.payload || {};
    if (!payload.floorPlan || !payload.floorPlan.options) {
      // refund the credit
      try { await redis.decr(`ai_gen_limit:${userId}:${new Date().toISOString().slice(0, 10)}`); } catch (_) {}
      return res.status(422).json({ error: "no_floor_plan_selected" });
    }

    const job = await enqueueGeneration({
      type: "utilities",
      planId,
      userId,
      userTier: tier,
      payload,
    });

    return res.status(202).json({
      jobId: job.id,
      tier,
      remainingToday: Math.max(0, reservation.limit - reservation.used),
    });
  } catch (e) { next(e); }
};

/* ── 10. Bird's-eye 3D render (paywall-gated) ──────────────────────── */

/**
 * Body: { plotW, plotH, floors, facadeStyle, roofType, boundaryWall, mainGate,
 *         driveway, landscaping, vastuEnabled, cityState, seed? }
 *
 * Requires plan.is3DUnlocked === true (the paywall is enforced both here AND
 * client-side, so a determined caller can't bypass with a curl).
 */
exports.enqueueBirdEyeGeneration = async (req, res, next) => {
  try {
    const { planId } = req.params;
    const userId = req.user.userId;
    const tier = req.user.tier || "FREE";

    // Gate check
    const Plan = require("../models/Plan");
    const plan = await Plan.findOne({ _id: planId, userId }).select("is3DUnlocked").lean();
    if (!plan) return res.status(404).json({ error: "plan_not_found" });
    if (!plan.is3DUnlocked) return res.status(402).json({ error: "3d_locked" });

    const reservation = await reserveCredits(userId, tier, 1);
    if (!reservation.ok) {
      return res.status(429).json({
        error: "ai_limit_reached",
        tier,
        used: reservation.used,
        limit: reservation.limit,
        upgradePrompt: reservation.upgradePrompt,
      });
    }

    const {
      facadeStyle, roofType, boundaryWall, mainGate, driveway,
      landscaping, vastuEnabled, cityState, plotW, plotH, floors, seed,
    } = req.body || {};

    const prompt = buildBirdEyePrompt({
      facadeStyle, roofType, boundaryWall, mainGate, driveway,
      landscaping, plotW, plotH, floors, vastuEnabled, cityState,
    });

    const job = await enqueueGeneration({
      type: "bird-eye-3d",
      planId,
      userId,
      userTier: tier,
      payload: { prompt, seed },
    });

    return res.status(202).json({
      jobId: job.id,
      tier,
      remainingToday: Math.max(0, reservation.limit - reservation.used),
    });
  } catch (e) { next(e); }
};

/* ── 11. Usage summary ──────────────────────────────────────────────── */

exports.getUsage = async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const tier = req.user.tier || "FREE";
    const limit = TIER_LIMITS[tier] ?? TIER_LIMITS.FREE;
    const key = `ai_gen_limit:${userId}:${todayKey()}`;
    let used = 0;
    try {
      const raw = await redis.get(key);
      used = raw ? parseInt(raw, 10) : 0;
    } catch (_) {}
    res.json({ used, limit, tier });
  } catch (e) { next(e); }
};
