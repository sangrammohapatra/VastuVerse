/**
 * Rate limiters (express-rate-limit).
 *
 *   global      200 req / 15min / IP            — every public API
 *   otp           5 req / 15min / IP            — /auth/send-otp + /auth/verify-otp
 *   ai           10 req /   1min / userId       — /ai/* generation endpoints
 *   admin        30 req /   1min / userId       — /admin/* endpoints
 *
 * Usage:
 *   const { global, otp, ai, admin } = require('../middlewares/rateLimiter');
 *   app.use(global);
 *   router.post('/send-otp', otp, ...);
 *
 * When a Redis client is available we use rate-limit-redis so quotas survive
 * a server restart and are shared across replicas. Falls back to in-memory
 * if Redis is missing.
 */

const rateLimit = require('express-rate-limit');
const logger = require('../utils/logger');

let RedisStore;
let getRedis;
try {
  RedisStore = require('rate-limit-redis');
  ({ getRedis } = require('../config/redis'));
} catch (_) {
  // optional; if rate-limit-redis or config/redis isn't available we fall back
  RedisStore = null;
}

/* ─── Shared utilities ────────────────────────────────────────────── */

function buildStore(prefix) {
  if (!RedisStore || !getRedis) return undefined;
  try {
    const client = getRedis();
    if (!client) return undefined;
    return new RedisStore({
      sendCommand: (...args) => client.call(...args),
      prefix: `rl:${prefix}:`,
    });
  } catch (e) {
    logger.warn('[rateLimiter] Redis store unavailable, falling back to memory', { err: e.message });
    return undefined;
  }
}

function ipKey(req) {
  return req.ip || req.socket?.remoteAddress || 'unknown';
}

function userKey(req) {
  // Prefer authenticated user id; otherwise fall back to IP. The IP is taken
  // from req.ip which respects 'trust proxy' (configured in security.js).
  return req.user?.userId ? `u:${req.user.userId}` : ipKey(req);
}

function buildLimiterResponse(message) {
  return (req, res, _next, options) => {
    logger.warn('[rateLimit] exceeded', {
      key: req.rateLimit?.key,
      path: req.path,
      method: req.method,
      limit: options.max,
      windowMs: options.windowMs,
      ip: req.ip,
      userId: req.user?.userId,
    });
    res.status(options.statusCode || 429).json({
      success: false,
      error: {
        code: 'rate_limited',
        message,
        retryAfter: Math.ceil(options.windowMs / 1000),
      },
    });
  };
}

/* ─── Limiters ────────────────────────────────────────────────────── */

/**
 * Global throttle — applied app-wide before route mounting. The default of
 * 200 req per 15 min comfortably accommodates the auto-save wizard cadence
 * (~1 save / 1.5s = 600/15min) only if the auto-saves go through a path that
 * skips this limiter — mount this on /api/v1 and add /api/v1/plans/[^/]+/steps/*
 * to skip(), or raise the cap.
 */
const global = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  keyGenerator: ipKey,
  store: buildStore('global'),
  handler: buildLimiterResponse('Too many requests, please try again in a few minutes.'),
  skip: (req) => {
    // Health checks + webhook endpoints shouldn't burn the budget
    if (req.path === '/health' || req.path === '/api/v1/payments/webhook') return true;
    // The wizard's debounced auto-save (every 1.5s while typing) would chew
    // through 200/15min in 5 min. Skip step-save endpoints here and rely on
    // tighter per-resource auth checks instead.
    if (/^\/api\/v1\/plans\/[^/]+\/steps\//.test(req.path)) return true;
    return false;
  },
});

/**
 * OTP throttle — protects /auth/send-otp and /auth/verify-otp from abuse.
 * 5/15min/IP is tight on purpose; brute-forcing a 6-digit OTP needs ~1M
 * attempts so this gives ~30 years even with multiple attacking IPs.
 */
const otp = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  keyGenerator: ipKey,
  store: buildStore('otp'),
  handler: buildLimiterResponse('Too many OTP requests. Please wait 15 minutes before trying again.'),
});

/**
 * AI generation throttle — applied after authenticateToken so req.user is set.
 * 10 req/min/userId is generous: the wizard generates 3 floor-plan variants
 * per click, 6 interior styles in parallel, etc. — but caps abuse.
 *
 * Note: this is per *minute*, not per 15min, intentionally. AI calls are
 * expensive; a misconfigured client retry loop should hit this fast.
 */
const ai = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  keyGenerator: userKey,
  store: buildStore('ai'),
  handler: buildLimiterResponse('AI request limit reached. Please wait a moment before requesting more generations.'),
});

/**
 * Admin throttle — protects /admin/* from a compromised admin token being
 * used for bulk scraping. 30/min lets a real admin click around briskly
 * (page through users, filter, export CSV) without throttling them.
 */
const admin = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  keyGenerator: userKey,
  store: buildStore('admin'),
  handler: buildLimiterResponse('Admin request limit reached. Please slow down.'),
});

module.exports = { global, otp, ai, admin };
