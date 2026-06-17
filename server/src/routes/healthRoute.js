/**
 * GET /api/v1/health — deep health check.
 *
 * Returns 200 if everything is reachable, 503 otherwise. Each subsystem
 * gets ≤ 1.5s to respond — exceeding that marks it 'unhealthy' but doesn't
 * block the response.
 *
 * Used by:
 *   - docker-compose healthcheck (30s interval, 3 retries, 8s timeout)
 *   - GitHub Actions post-deploy verification
 *   - external uptime monitors (UptimeRobot, Pingdom)
 *
 * Body shape:
 *   {
 *     status:   'ok' | 'degraded',
 *     db:       'connected' | 'disconnected' | 'error',
 *     redis:    'connected' | 'disconnected' | 'error' | 'not_configured',
 *     queue:    'reachable' | 'unreachable' | 'not_configured',
 *     uptime:   seconds since process start,
 *     version:  npm_package_version,
 *     time:     ISO timestamp,
 *     latencyMs: { db, redis, queue }
 *   }
 *
 * Anti-cache headers prevent intermediate proxies from caching the
 * health response (defeating the point of probing).
 */

const express = require('express');
const mongoose = require('mongoose');
const logger = require('../utils/logger');

const router = express.Router();

const CHECK_TIMEOUT_MS = 1500;

/* ─── Per-subsystem probes ────────────────────────────────────────── */

async function probeMongo() {
  if (mongoose.connection.readyState !== 1) {
    return { status: 'disconnected', latencyMs: null };
  }
  const t0 = Date.now();
  try {
    await withTimeout(
      mongoose.connection.db.admin().ping(),
      CHECK_TIMEOUT_MS,
      'mongo_timeout'
    );
    return { status: 'connected', latencyMs: Date.now() - t0 };
  } catch (e) {
    return { status: 'error', latencyMs: Date.now() - t0, error: e.message };
  }
}

async function probeRedis() {
  let getRedis;
  try { ({ getRedis } = require('../config/redis')); }
  catch (_) { return { status: 'not_configured', latencyMs: null }; }

  let client;
  try { client = getRedis && getRedis(); }
  catch (_) { return { status: 'not_configured', latencyMs: null }; }

  if (!client) return { status: 'not_configured', latencyMs: null };

  const t0 = Date.now();
  try {
    const result = await withTimeout(client.ping(), CHECK_TIMEOUT_MS, 'redis_timeout');
    return {
      status: result === 'PONG' ? 'connected' : 'error',
      latencyMs: Date.now() - t0,
    };
  } catch (e) {
    return { status: 'error', latencyMs: Date.now() - t0, error: e.message };
  }
}

async function probeQueue() {
  let queue;
  try { ({ queue } = require('../queues/aiGenerationQueue')); }
  catch (_) { return { status: 'not_configured', latencyMs: null }; }

  if (!queue) return { status: 'not_configured', latencyMs: null };

  const t0 = Date.now();
  try {
    // getJobCounts roundtrips through Redis so it doubles as a queue ping.
    await withTimeout(queue.getJobCounts('waiting'), CHECK_TIMEOUT_MS, 'queue_timeout');
    return { status: 'reachable', latencyMs: Date.now() - t0 };
  } catch (e) {
    return { status: 'unreachable', latencyMs: Date.now() - t0, error: e.message };
  }
}

function withTimeout(promise, ms, label) {
  return Promise.race([
    promise,
    new Promise((_, rej) => setTimeout(() => rej(new Error(label)), ms)),
  ]);
}

/* ─── Route ──────────────────────────────────────────────────────── */

router.get('/', async (req, res) => {
  const [db, redis, queue] = await Promise.all([
    probeMongo(),
    probeRedis(),
    probeQueue(),
  ]);

  // 'ok' only if mongo is connected. Redis/queue being unconfigured is fine
  // for dev; being misconfigured (status:'error') is not.
  const dbOk     = db.status === 'connected';
  const redisOk  = redis.status === 'connected' || redis.status === 'not_configured';
  const queueOk  = queue.status === 'reachable' || queue.status === 'not_configured';
  const overall  = (dbOk && redisOk && queueOk) ? 'ok' : 'degraded';
  const httpCode = overall === 'ok' ? 200 : 503;

  // Log degraded responses for alerting downstream
  if (overall !== 'ok') {
    logger.warn('[health] degraded', { db: db.status, redis: redis.status, queue: queue.status });
  }

  res.set({
    'Cache-Control': 'no-store, no-cache, must-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0',
  }).status(httpCode).json({
    status:    overall,
    db:        db.status,
    redis:     redis.status,
    queue:     queue.status,
    uptime:    Math.floor(process.uptime()),
    version:   process.env.npm_package_version || 'dev',
    time:      new Date().toISOString(),
    latencyMs: {
      db:    db.latencyMs,
      redis: redis.latencyMs,
      queue: queue.latencyMs,
    },
    // Helpful in a 4-worker PM2 cluster: tells you which worker answered
    pid:       process.pid,
    workerId:  process.env.NODE_APP_INSTANCE || '0',
  });
});

/* ─── Liveness ────────────────────────────────────────────────────── */

/**
 * GET /api/v1/health/live — process-is-alive check.
 * No DB/Redis dependency; only verifies the event loop is responsive.
 * Use this in k8s livenessProbe (restart pod if it fails); use /health
 * as the readinessProbe (mark pod NOT ready, but don't restart).
 */
router.get('/live', (req, res) => {
  res.status(200).json({ status: 'alive', pid: process.pid });
});

module.exports = router;
