/**
 * Single ioredis client, shared across the server (OTP storage, cache, queues).
 *
 * We use ioredis (not node-redis) because BullMQ requires it, and a single
 * client per process is the recommended pattern.
 */

const Redis = require('ioredis');

const url = process.env.REDIS_URL || 'redis://localhost:6379';

// Warn early if a hosted-Redis URL is used without TLS — the most common cause
// of connect→immediate-disconnect loops (server expects rediss://, got redis://).
if (url.startsWith('redis://') && !url.includes('localhost') && !url.includes('127.0.0.1')) {
  console.warn('[redis] WARNING: REDIS_URL uses redis:// against a non-local host. If your provider requires TLS, change it to rediss://');
}

const client = new Redis(url, {
  // BullMQ requires maxRetriesPerRequest: null on its connections; safe value
  // for general usage too — long-lived commands won't be aborted mid-flight.
  maxRetriesPerRequest: null,
  enableReadyCheck: true,
  lazyConnect: false,
  retryStrategy: (times) => Math.min(times * 200, 10_000),
});

client.on('connect', () => console.log('[redis] connected'));
client.on('ready', () => console.log('[redis] ready'));
client.on('close', () => console.error('[redis] connection closed by server'));
client.on('reconnecting', (delay) => console.log(`[redis] reconnecting in ${delay}ms`));
client.on('error', (err) => console.error('[redis] error:', err.message));

// Attach getRedis so callers that destructure { getRedis } still work.
client.getRedis = () => client;

module.exports = client;
