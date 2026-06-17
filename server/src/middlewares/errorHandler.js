/**
 * Global error handler — must be the LAST middleware mounted.
 *
 *   app.use((req, res) => res.status(404).json(...));   // 404 fallback
 *   app.use(errorHandler);                              // <- here
 *
 * Response shape:
 *   {
 *     success: false,
 *     error: {
 *       code:    machine-readable string  (e.g. 'validation_error', 'rate_limited')
 *       message: human-readable text
 *       details: optional payload (e.g. field-level validation errors)
 *       stack:   ONLY in non-production (NODE_ENV !== 'production')
 *     }
 *   }
 *
 * Status codes:
 *   400 validation, body parse, mime mismatch
 *   401 missing / invalid token
 *   403 wrong role
 *   404 not found
 *   409 conflict (duplicate key)
 *   413 payload too large (multer fileSize)
 *   429 rate limited (handled by rateLimiter middleware, but caught here too)
 *   500 unhandled / unknown
 */

const logger = require('../utils/logger');

const isProd = process.env.NODE_ENV === 'production';

/**
 * Map well-known error shapes to { status, code, message }.
 * Each entry inspects an incoming err and either returns a triple or null.
 */
const MAPPERS = [
  // express-validator (when called via .throw() inside a handler)
  (err) => err.errors && Array.isArray(err.errors) && err.array ? {
    status: 400, code: 'validation_error',
    message: 'Request validation failed.',
    details: err.array().map((e) => ({ field: e.path, message: e.msg, value: e.value })),
  } : null,

  // express-validator passing through validationResult().throw()
  (err) => err.name === 'ValidationError' && err.array ? {
    status: 400, code: 'validation_error',
    message: 'Request validation failed.',
    details: err.array(),
  } : null,

  // Mongoose validation
  (err) => err.name === 'ValidationError' && err.errors ? {
    status: 400, code: 'validation_error',
    message: 'Data validation failed.',
    details: Object.fromEntries(
      Object.entries(err.errors).map(([k, v]) => [k, v.message])
    ),
  } : null,

  // Mongoose duplicate key
  (err) => err.code === 11000 ? {
    status: 409, code: 'duplicate_key',
    message: 'A record with these unique fields already exists.',
    details: err.keyValue,
  } : null,

  // Mongoose CastError (bad ObjectId)
  (err) => err.name === 'CastError' ? {
    status: 400, code: 'invalid_id',
    message: `Invalid ${err.path || 'identifier'} format.`,
  } : null,

  // JSON parse error from express.json()
  (err) => err.type === 'entity.parse.failed' ? {
    status: 400, code: 'invalid_json',
    message: 'Request body is not valid JSON.',
  } : null,

  // express.json() payload too large
  (err) => err.type === 'entity.too.large' ? {
    status: 413, code: 'payload_too_large',
    message: 'Request body exceeds the maximum allowed size.',
  } : null,

  // multer file size + multer custom MIME reject
  (err) => err.code === 'LIMIT_FILE_SIZE' ? {
    status: 413, code: 'file_too_large',
    message: 'Uploaded file exceeds the maximum allowed size.',
  } : null,
  (err) => err.code === 'LIMIT_FILE_COUNT' ? {
    status: 400, code: 'too_many_files',
    message: 'Too many files in this upload.',
  } : null,
  (err) => err.code === 'LIMIT_UNEXPECTED_FILE' ? {
    status: 400, code: 'unexpected_file_field',
    message: 'Unexpected file field in upload.',
  } : null,
  (err) => err.name === 'MimeRejectError' ? {
    status: 400, code: err.code || 'mime_not_allowed',
    message: 'File type is not allowed.',
    details: err.details,
  } : null,

  // jsonwebtoken
  (err) => err.name === 'JsonWebTokenError' ? {
    status: 401, code: 'invalid_token',
    message: 'Authentication token is invalid.',
  } : null,
  (err) => err.name === 'TokenExpiredError' ? {
    status: 401, code: 'token_expired',
    message: 'Authentication token has expired.',
  } : null,

  // CORS
  (err) => err.message === 'not_allowed_by_cors' ? {
    status: 403, code: 'cors_blocked',
    message: 'Origin is not allowed.',
  } : null,

  // Explicit { status, code, message } error thrown by our controllers
  (err) => (err.status && err.code) ? {
    status: err.status, code: err.code,
    message: err.message,
    details: err.details,
  } : null,

  // String status without a code
  (err) => (typeof err.status === 'number' && err.status !== 500) ? {
    status: err.status, code: codeForStatus(err.status),
    message: err.message || statusMessage(err.status),
  } : null,
];

function codeForStatus(status) {
  return {
    400: 'bad_request',
    401: 'unauthenticated',
    403: 'forbidden',
    404: 'not_found',
    409: 'conflict',
    413: 'payload_too_large',
    429: 'rate_limited',
    500: 'internal_error',
  }[status] || 'error';
}

function statusMessage(status) {
  return {
    400: 'Bad request.',
    401: 'You must be signed in to do that.',
    403: 'You do not have permission for that action.',
    404: 'Not found.',
    409: 'Conflict.',
    413: 'Payload too large.',
    429: 'Too many requests.',
    500: 'Internal server error.',
  }[status] || 'An error occurred.';
}

function mapError(err) {
  for (const m of MAPPERS) {
    const hit = m(err);
    if (hit) return hit;
  }
  return {
    status: 500, code: 'internal_error',
    message: isProd ? 'An unexpected error occurred.' : (err.message || 'Unknown error'),
  };
}

/* ─── 4-param Express error middleware ────────────────────────────── */

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, _next) {
  const { status, code, message, details } = mapError(err);

  // Structured log line — error level for 5xx, warn for 4xx
  const logFn = status >= 500 ? logger.error : logger.warn;
  logFn.call(logger, `[http] ${req.method} ${req.originalUrl} → ${status} ${code}`, {
    status, code, message,
    path: req.path,
    method: req.method,
    userId: req.user?.userId,
    ip: req.ip,
    userAgent: req.headers['user-agent']?.slice(0, 120),
    err: err.message,
    stack: status >= 500 ? err.stack : undefined,
  });

  if (res.headersSent) {
    // Connection probably already torn down; just let Express close it.
    return;
  }

  const body = {
    success: false,
    error: { code, message },
  };
  if (details !== undefined) body.error.details = details;
  if (!isProd && err.stack && status >= 500) body.error.stack = err.stack;

  res.status(status).json(body);
}

module.exports = errorHandler;
module.exports.mapError = mapError;
