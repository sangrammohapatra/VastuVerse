/**
 * Centralized logger (winston).
 *
 *   logger.info('plan created', { planId, userId });
 *   logger.warn('queue depth high', { waiting });
 *   logger.error('payment verify failed', { orderId, err: err.message });
 *
 *   // request-scoped (HTTP access log line, attached via morgan):
 *   logger.http(message);
 *
 * Sinks:
 *   - Console        (always; pretty colored in dev, JSON in prod)
 *   - logs/error.log (errors only, rotated at 5MB × 5 files)
 *   - logs/combined.log (everything, rotated at 5MB × 5 files)
 *
 * Set LOG_LEVEL env var to override default (info in prod / debug in dev).
 */

const path = require('path');
const fs = require('fs');
const winston = require('winston');

const LOG_DIR = path.join(process.cwd(), 'logs');

// Ensure the log directory exists. Failing silently is intentional —
// some environments (read-only fs, containers without volumes) won't allow
// writes; we fall back to console-only.
let canWriteFiles = true;
try {
  if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });
} catch (_) {
  canWriteFiles = false;
  // eslint-disable-next-line no-console
  console.warn('[logger] could not create logs/ — file sinks disabled');
}

const isProd = process.env.NODE_ENV === 'production';
const defaultLevel = isProd ? 'info' : 'debug';

/* ─── Formats ─────────────────────────────────────────────────────── */

const baseFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
  winston.format.errors({ stack: true }),
  winston.format.splat()
);

const prettyConsole = winston.format.combine(
  baseFormat,
  winston.format.colorize({ all: true }),
  winston.format.printf((info) => {
    const { timestamp, level, message, stack, ...meta } = info;
    const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
    const stackStr = stack ? `\n${stack}` : '';
    return `${timestamp} ${level} ${message}${metaStr}${stackStr}`;
  })
);

const jsonFormat = winston.format.combine(
  baseFormat,
  winston.format.json()
);

/* ─── Transports ──────────────────────────────────────────────────── */

const transports = [
  new winston.transports.Console({
    format: isProd ? jsonFormat : prettyConsole,
    handleExceptions: true,
    handleRejections: true,
  }),
];

if (canWriteFiles) {
  transports.push(
    new winston.transports.File({
      filename: path.join(LOG_DIR, 'error.log'),
      level: 'error',
      format: jsonFormat,
      maxsize: 5 * 1024 * 1024,   // 5 MB
      maxFiles: 5,
      tailable: true,
      handleExceptions: true,
      handleRejections: true,
    }),
    new winston.transports.File({
      filename: path.join(LOG_DIR, 'combined.log'),
      format: jsonFormat,
      maxsize: 5 * 1024 * 1024,
      maxFiles: 5,
      tailable: true,
    })
  );
}

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || defaultLevel,
  defaultMeta: {
    service: 'vastuverse-api',
    env: process.env.NODE_ENV || 'development',
  },
  transports,
  exitOnError: false,
});

/**
 * morgan-compatible stream so `morgan('combined', { stream: logger.stream })`
 * routes HTTP access lines through winston instead of stdout.
 */
logger.stream = {
  write: (message) => logger.http
    ? logger.http(message.trim())
    : logger.info(message.trim()),
};

module.exports = logger;
