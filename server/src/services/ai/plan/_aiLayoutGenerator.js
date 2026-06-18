/**
 * AI-based floor plan geometry generator.
 *
 * When floorPlanMode === 'ai' this module calls the configured LLM with
 * FLOOR_PLAN_SYSTEM_PROMPT to produce ground-floor room coordinates.
 * The output is validated and post-processed with the same pipeline used by
 * the constraint solver (_layoutMock). Upper floors (if any) are always
 * handled by the solver with ground-floor anchors, so vertical stacks remain
 * structurally aligned.
 *
 * Returns { feasible, options } in the same shape as generateFloorPlans(), or
 * null if the LLM returned unusable geometry — the caller falls back to the
 * constraint solver in that case.
 */

const axios = require('axios');

const { FLOOR_PLAN_SYSTEM_PROMPT, buildFloorPlanUserPrompt } = require('../../../prompts/floorPlanPrompt');
const { detectOverlaps, solveFloor } = require('./_layoutSolver');
const { computeVastuScore }          = require('./_vastuScore');
const { validatePostPlacement }      = require('./_postPlacementValidator');
const { expandToFillPlot }           = require('./_layoutMock');

// NBC minimum sizes — same constants as _floorPlanValidator (duplicated to avoid
// a circular dependency between generator ↔ mock ↔ validator).
const NBC_MIN_SQFT = {
  bedroom: 80, bathroomAttached: 20, bathroomCommon: 25, kitchen: 50,
  living: 100, dining: 80, pooja: 25, study: 70, garage: 130,
  servant: 70, storage: 30, balcony: 25, staircase: 45, terrace: 50,
  utility: 50, serviceYard: 30,
};
const NBC_MIN_WIDTH = {
  bedroom: 8, bathroomAttached: 4, bathroomCommon: 5, kitchen: 7,
  living: 10, dining: 8, pooja: 4, study: 7, garage: 9,
  servant: 6, storage: 4, balcony: 3, staircase: 4, terrace: 6,
  utility: 5, serviceYard: 3,
};

const VARIANT_META = [
  { id: 'opt-1', labelVastu: 'Vastu Optimised', labelFallback: 'Traditional' },
  { id: 'opt-2', labelVastu: 'Modern Open',     labelFallback: 'Modern Open' },
  { id: 'opt-3', labelVastu: 'Space Maximised', labelFallback: 'Space Maximised' },
];

/* ── validation ──────────────────────────────────────────────────────────── */

/**
 * Validate a single AI-generated option.
 * Returns an array of error strings; empty means valid.
 */
function validateAiOption(option, expectedIds, plotW, plotH) {
  const errors = [];

  if (!option || !Array.isArray(option.rooms)) {
    return ['Option missing rooms array'];
  }

  // Every requested room must be present
  const presentIds = new Set(option.rooms.map((r) => r.id));
  for (const id of expectedIds) {
    if (!presentIds.has(id)) errors.push(`Room "${id}" missing from option ${option.id}`);
  }

  for (const r of option.rooms) {
    const { id, kind, x, y, w, h } = r;

    // Numeric coordinates
    if ([x, y, w, h].some((v) => typeof v !== 'number' || !Number.isFinite(v) || v < 0)) {
      errors.push(`Room "${id}" has non-numeric or negative coords`);
      continue;
    }

    // Within plot bounds
    if (x + w > plotW + 0.5) errors.push(`Room "${id}" exceeds plotW (x+w=${x + w} > ${plotW})`);
    if (y + h > plotH + 0.5) errors.push(`Room "${id}" exceeds plotH (y+h=${y + h} > ${plotH})`);

    // Minimum size
    const minSqft  = NBC_MIN_SQFT[kind]  || 0;
    const minWidth = NBC_MIN_WIDTH[kind] || 0;
    if (w * h < minSqft * 0.75) {
      // Allow 25% grace for AI rounding; hard failure only if grossly undersized
      errors.push(`Room "${id}" (${kind}) area ${Math.round(w * h)} sqft < NBC min ${minSqft} sqft`);
    }
    if (w < minWidth * 0.75) {
      errors.push(`Room "${id}" (${kind}) width ${w} ft < NBC min ${minWidth} ft`);
    }
  }

  // No overlaps
  const overlaps = detectOverlaps(option.rooms);
  if (overlaps.length > 0) {
    // Only fail on severe overlaps — small 1 ft rounding is acceptable
    const severe = overlaps.filter(([aId, bId]) => {
      const a = option.rooms.find((r) => r.id === aId);
      const b = option.rooms.find((r) => r.id === bId);
      if (!a || !b) return false;
      const ox = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
      const oy = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
      return ox > 2 && oy > 2;  // overlap > 2 ft in both axes = severe
    });
    if (severe.length > 0) {
      errors.push(`${severe.length} severe room overlap(s) detected`);
    }
  }

  return errors;
}

/* ── post-processing (mirrors _layoutMock pipeline) ─────────────────────── */

function postProcessOption(meta, groundRooms, upperFloorBuckets, plotW, plotH, vastuEnabled, floors) {
  const allPlaced    = [];
  const allConflicts = [];
  const floorsMeta   = [];

  // Tag ground floor rooms
  groundRooms.forEach((r) => allPlaced.push({ ...r, floor: 1 }));
  floorsMeta.push({ w: plotW, h: plotH });

  // Build vertical anchors from ground floor (staircase / bathrooms / kitchen / utility)
  const verticalAnchor = new Map();
  const STACK_KINDS    = new Set(['staircase', 'bathroomAttached', 'bathroomCommon', 'kitchen', 'utility']);
  for (const r of groundRooms) {
    if (STACK_KINDS.has(r.kind) && !verticalAnchor.has(r.kind)) {
      verticalAnchor.set(r.kind, { x: r.x, y: r.y, w: r.w, h: r.h });
    }
  }

  // Upper floors — use constraint solver with ground-floor anchors
  for (let fIdx = 0; fIdx < upperFloorBuckets.length; fIdx++) {
    const floorRooms = upperFloorBuckets[fIdx];
    const prePlaced  = [];

    for (const room of floorRooms) {
      const anchor = verticalAnchor.get(room.kind);
      if (anchor) prePlaced.push({ ...room, x: anchor.x, y: anchor.y, w: anchor.w, h: anchor.h });
    }

    const variantIdx = VARIANT_META.findIndex((m) => m.id === meta.id);
    const { placed } = solveFloor(floorRooms, plotW, plotH, variantIdx, vastuEnabled, prePlaced);

    placed.forEach((r) => allPlaced.push({ ...r, floor: fIdx + 2 }));
    const conflicts = detectOverlaps(placed);
    if (conflicts.length) allConflicts.push(...conflicts.map((pair) => ({ floor: fIdx + 2, pair })));
    floorsMeta.push({ w: plotW, h: plotH });
  }

  // Vastu score on ground floor (pre-expand positions)
  const vastuScore = vastuEnabled
    ? computeVastuScore(allPlaced.filter((r) => r.floor === 1), plotW, plotH)
    : undefined;

  // Expand + post-placement validation per floor
  const postPlacementWarnings = [];
  const expandedRooms = Array.from({ length: floors }, (_, fIdx) => {
    const floorRooms = expandToFillPlot(
      allPlaced.filter((r) => r.floor === fIdx + 1),
      plotW, plotH
    );
    validatePostPlacement(floorRooms, plotW, plotH)
      .forEach((w) => postPlacementWarnings.push({ ...w, floor: fIdx + 1 }));
    return floorRooms;
  }).flat();

  const totalArea = expandedRooms.reduce((s, r) => s + r.w * r.h, 0);
  const isVastu   = meta.id === 'opt-1' && vastuEnabled;

  const complianceNotes = ['NBC §10 minimum room sizes', 'NBC §5 ventilation setbacks'];
  if (floors > 1) complianceNotes.push('Staircase aligned at same position on all floors');
  if (floors > 1) complianceNotes.push('Wet areas stacked vertically for shared plumbing');
  if (isVastu)    complianceNotes.push('Vastu directional zones enforced (NE→pooja, SE→kitchen, SW→master BR)');

  return {
    id:      meta.id,
    variant: isVastu ? meta.labelVastu : meta.labelFallback,
    summary: isVastu
      ? 'Kitchen SE, Pooja NE, Master SW — directionally placed per Vastu Shastra.'
      : 'AI-optimised layout balancing natural light, flow, and usable area.',
    rooms:   expandedRooms,
    floors:  floorsMeta,
    plotDimensions: {},  // filled by caller
    totalArea: Math.round(totalArea),
    complianceNotes,
    aiGenerated: true,
    ...(vastuScore   !== undefined && { vastuScore }),
    ...(allConflicts.length        && { layoutWarnings: allConflicts }),
    ...(postPlacementWarnings.length && { postPlacementWarnings }),
  };
}

/* ── Retry helper ────────────────────────────────────────────────────────── */

const MAX_RETRIES    = 2;
const MAX_WAIT_MS    = 30_000;  // never wait more than 30 s for a rate-limit retry

/**
 * Extract the wait duration from a 429 response.
 * OpenAI sends a `retry-after` header (seconds) and/or an `x-ratelimit-reset-requests`
 * header like "23ms" / "6s".  Fall back to 10 s if neither is present.
 */
function retryDelayMs(err) {
  const headers = err?.response?.headers || {};

  // Standard `Retry-After` header (seconds)
  const retryAfter = headers['retry-after'];
  if (retryAfter && !isNaN(Number(retryAfter))) {
    return Math.min(Number(retryAfter) * 1000, MAX_WAIT_MS);
  }

  // OpenAI `x-ratelimit-reset-requests: 6s` or `23ms`
  const reset = headers['x-ratelimit-reset-requests'] || headers['x-ratelimit-reset-tokens'] || '';
  if (reset) {
    if (reset.endsWith('ms')) return Math.min(parseInt(reset, 10), MAX_WAIT_MS);
    if (reset.endsWith('s'))  return Math.min(parseInt(reset, 10) * 1000, MAX_WAIT_MS);
  }

  return 10_000;  // safe default
}

/**
 * OpenAI returns 429 for two completely different reasons:
 *   - rate_limit_exceeded → transient; retrying after a delay helps
 *   - insufficient_quota  → billing issue; retrying never helps
 *
 * Check the error body code before deciding to retry.
 */
function openAiErrorCode(err) {
  return err?.response?.data?.error?.code || err?.response?.data?.error?.type || '';
}

function isRetryable429(err) {
  if (err?.response?.status !== 429) return false;
  const code = openAiErrorCode(err);
  // Only retry actual rate limits — quota / billing errors must not be retried
  return code !== 'insufficient_quota' && code !== 'billing_hard_limit_reached';
}

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

async function withRetry(fn) {
  let lastErr;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (isRetryable429(err) && attempt < MAX_RETRIES) {
        const wait = retryDelayMs(err);
        console.warn(`[AI layout] Rate limited (429). Retrying in ${Math.round(wait / 1000)}s… (attempt ${attempt + 1}/${MAX_RETRIES})`);
        await sleep(wait);
      } else {
        throw err;
      }
    }
  }
  throw lastErr;
}

/* ── OpenAI call ─────────────────────────────────────────────────────────── */

async function callOpenAI({ apiKey, model, systemPrompt, userPrompt }) {
  const { data } = await withRetry(() =>
    axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user',   content: userPrompt   },
        ],
      },
      {
        timeout: 60_000,
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      }
    )
  );
  return safeParse(data?.choices?.[0]?.message?.content || '');
}

/* ── Ollama call ─────────────────────────────────────────────────────────── */

async function callOllama({ ollamaUrl, ollamaModel, systemPrompt, userPrompt }) {
  const { data } = await withRetry(() =>
    axios.post(
      `${ollamaUrl}/api/generate`,
      {
        model:  ollamaModel,
        system: systemPrompt,
        prompt: userPrompt,
        format: 'json',
        stream: false,
      },
      { timeout: 120_000 }
    )
  );
  return safeParse(data?.response || '');
}

/* ── Public API ──────────────────────────────────────────────────────────── */

/**
 * Generate floor plan geometry using an LLM.
 *
 * @param {object} payload           - Same shape as generateFloorPlans() payload
 * @param {object} cfg               - AI config (from getAiConfig())
 * @param {number} plotW
 * @param {number} plotH
 * @param {number} floors
 * @param {number} side
 * @param {number} setbackFront
 * @param {number} setbackSide
 * @param {Array}  groundFloorRooms  - Pre-scaled rooms for the ground floor
 * @param {Array}  upperFloorBuckets - Pre-scaled rooms per upper floor [[floor2], [floor3], …]
 * @param {Array}  allBaseRooms      - Full base room list (for id set validation)
 * @returns {object|null}  { feasible: true, options } or null on failure
 */
async function generateFloorPlanWithAI({
  payload,
  cfg,
  plotW,
  plotH,
  floors,
  side,
  setbackFront,
  setbackSide,
  groundFloorRooms,
  upperFloorBuckets,
}) {
  const { vastuEnabled = false, landDetails = {} } = payload;
  const facing = landDetails.facing || '';

  const systemPrompt = FLOOR_PLAN_SYSTEM_PROMPT;
  const userPrompt   = buildFloorPlanUserPrompt({
    plotW,
    plotH,
    floors,
    vastuEnabled,
    facing,
    rooms: groundFloorRooms,
  });

  let parsed = null;

  try {
    if (cfg.planProvider === 'gpt4o' && cfg.openaiApiKey) {
      parsed = await callOpenAI({
        apiKey:       cfg.openaiApiKey,
        model:        cfg.openaiPlanModel || 'gpt-4o',
        systemPrompt,
        userPrompt,
      });
    } else if (cfg.planProvider === 'ollama' && cfg.ollamaUrl) {
      parsed = await callOllama({
        ollamaUrl:   cfg.ollamaUrl,
        ollamaModel: cfg.ollamaModel || 'llama3',
        systemPrompt,
        userPrompt,
      });
    }
  } catch (err) {
    const status  = err?.response?.status;
    const apiMsg  = err?.response?.data?.error?.message || err.message;
    const errCode = openAiErrorCode(err);

    if (errCode === 'insufficient_quota' || errCode === 'billing_hard_limit_reached') {
      console.error(`[AI layout] OpenAI quota/billing error (${errCode}): ${apiMsg} — falling back to constraint solver.`);
    } else if (status === 429) {
      console.warn(`[AI layout] Rate limit exhausted after retries — falling back to constraint solver.`);
    } else {
      console.error(`[AI layout] LLM call failed (HTTP ${status || 'network'}): ${apiMsg} — falling back to constraint solver.`);
    }
    return null;
  }

  if (!parsed || !Array.isArray(parsed.options) || parsed.options.length < 3) {
    console.warn('[AI layout] LLM returned invalid/incomplete JSON');
    return null;
  }

  // Validate each option; reject if any has critical geometry errors
  const expectedIds = groundFloorRooms.map((r) => r.id);
  const validOptions = [];

  for (const aiOpt of parsed.options.slice(0, 3)) {
    // Clamp coordinates to plot bounds (catch minor off-by-one)
    const clampedRooms = (aiOpt.rooms || []).map((r) => ({
      ...r,
      x: Math.max(0, Math.min(r.x || 0, plotW - (r.w || 1))),
      y: Math.max(0, Math.min(r.y || 0, plotH - (r.h || 1))),
      w: Math.max(r.w || 0, 1),
      h: Math.max(r.h || 0, 1),
    }));

    const errors = validateAiOption({ ...aiOpt, rooms: clampedRooms }, expectedIds, plotW, plotH);
    if (errors.length > 0) {
      console.warn('[AI layout] Option', aiOpt.id, 'invalid:', errors.join('; '));
      return null;  // Any invalid option → whole generation falls back to solver
    }

    validOptions.push({ ...aiOpt, rooms: clampedRooms });
  }

  // Post-process each validated option
  const plotDimensions = { side, plotW, plotH, setbackFront, setbackSide };
  const options = validOptions.map((aiOpt) => {
    const meta = VARIANT_META.find((m) => m.id === aiOpt.id) || VARIANT_META[0];
    const result = postProcessOption(
      meta,
      aiOpt.rooms,
      upperFloorBuckets,
      plotW,
      plotH,
      vastuEnabled,
      floors
    );
    return { ...result, plotDimensions, summary: aiOpt.summary || result.summary };
  });

  return { feasible: true, options };
}

function safeParse(s) { try { return JSON.parse(s); } catch { return null; } }

module.exports = { generateFloorPlanWithAI };
