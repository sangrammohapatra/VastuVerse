/**
 * Mongoose connection with production-grade pooling + auto-reconnect.
 *
 *   const { connectDB } = require('./config/db');
 *   await connectDB();
 *
 * Pool size:
 *   dev   → 10
 *   prod  → 50 (override with MONGO_POOL_SIZE)
 *
 * Reconnect: exponential backoff capped at 30s, infinite retries.
 * Mongoose drivers auto-reconnect on transient failures (heartbeat loss,
 * primary step-down) — our retry loop only handles the *initial* connect
 * failing, which Mongoose does NOT retry on its own.
 */

const mongoose = require('mongoose');
const logger = require('../utils/logger');

const isProd = process.env.NODE_ENV === 'production';
const POOL_SIZE = Number(process.env.MONGO_POOL_SIZE) || (isProd ? 50 : 10);
const MIN_POOL_SIZE = Math.max(2, Math.floor(POOL_SIZE / 10));

const BASE_BACKOFF_MS = 1000;     // 1s
const MAX_BACKOFF_MS  = 30 * 1000; // 30s

let attempt = 0;

async function attemptConnect(uri) {
  attempt += 1;
  try {
    await mongoose.connect(uri, {
      // Pool sizing
      maxPoolSize: POOL_SIZE,
      minPoolSize: MIN_POOL_SIZE,
      // Selection + heartbeat — fail fast if primary is gone
      serverSelectionTimeoutMS: 10_000,
      heartbeatFrequencyMS: 10_000,
      // Socket
      socketTimeoutMS: 45_000,
      // App identity (shows up in MongoDB Atlas profiler)
      appName: 'vastuverse-api',
      // Wait until the write reaches a majority of replica members
      retryWrites: true,
      writeConcern: { w: 'majority' },
    });
    attempt = 0;
    logger.info('[mongo] connected', {
      host: mongoose.connection.host,
      name: mongoose.connection.name,
      poolSize: POOL_SIZE,
    });
  } catch (err) {
    const delay = Math.min(BASE_BACKOFF_MS * 2 ** (attempt - 1), MAX_BACKOFF_MS);
    logger.error('[mongo] initial connect failed', {
      attempt,
      retryInMs: delay,
      err: err.message,
    });
    await sleep(delay);
    return attemptConnect(uri);   // tail-recurse via async stack
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/* ─── Connection lifecycle event logging ──────────────────────────── */

mongoose.connection.on('connected', () => {
  logger.info('[mongo] connection event: connected');
});
mongoose.connection.on('disconnected', () => {
  logger.warn('[mongo] connection event: disconnected — driver will auto-reconnect');
});
mongoose.connection.on('reconnected', () => {
  logger.info('[mongo] connection event: reconnected');
});
mongoose.connection.on('error', (err) => {
  logger.error('[mongo] connection event: error', { err: err.message });
});

/* ─── Graceful shutdown ───────────────────────────────────────────── */

function registerShutdown() {
  const shutdown = async (signal) => {
    logger.info(`[mongo] received ${signal} — closing connection…`);
    try {
      await mongoose.connection.close();
      logger.info('[mongo] connection closed cleanly');
      process.exit(0);
    } catch (err) {
      logger.error('[mongo] error during shutdown', { err: err.message });
      process.exit(1);
    }
  };
  process.once('SIGINT',  () => shutdown('SIGINT'));
  process.once('SIGTERM', () => shutdown('SIGTERM'));
}

/* ─── Public API ──────────────────────────────────────────────────── */

async function connectDB() {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    logger.warn('[mongo] MONGO_URI not set — server starting without DB');
    return null;
  }
  registerShutdown();
  await attemptConnect(uri);
  return mongoose.connection;
}

module.exports = { connectDB };
