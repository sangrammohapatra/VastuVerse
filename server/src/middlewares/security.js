/**
 * Security middleware bundle.
 *
 *   security.baseMiddleware  — apply once, app-wide
 *   security.uploadImage     — multer middleware: jpeg/png/webp, 10 MB max
 *   security.uploadPdf       — multer middleware: pdf, 20 MB max
 *   security.uploadAny       — combined: images OR pdf
 *
 * MIME enforcement is two-stage:
 *   1. multer's fileFilter — fast, declared-MIME check
 *   2. magic-bytes inspection via file-type — runs AFTER multer parsed
 *      memory storage, in a separate middleware (validateUploadedBytes)
 *
 * The two-stage approach catches both rookies (renaming a .exe → .jpg) and
 * naïve forgeries (correct extension + wrong content-type).
 */

const helmet = require('helmet');
const cors = require('cors');
const express = require('express');
const multer = require('multer');
const logger = require('../utils/logger');

/* ─── helmet + CSP ────────────────────────────────────────────────── */

/**
 * CSP tailored to VastuVerse:
 *   - self-hosted JS + CSS (vite build)
 *   - data: URIs for SVG dataURLs from canvas exports
 *   - blob: URIs for Three.js + PDF.js
 *   - Razorpay checkout widget (api.razorpay.com + checkout.razorpay.com)
 *   - Pollinations / OpenAI / Hugging Face image CDNs (img-src)
 *   - WebSocket for socket.io (ws:// dev, wss:// prod)
 *
 * Production CSP is enforced; dev mode relaxes it via report-only.
 */
const isProd = process.env.NODE_ENV === 'production';

const cspDirectives = {
  defaultSrc: ["'self'"],
  scriptSrc: [
    "'self'",
    "'unsafe-inline'",        // Vite inline runtime; tighten with nonces once SSR lands
    'https://checkout.razorpay.com',
    'https://*.razorpay.com',
  ],
  styleSrc: [
    "'self'",
    "'unsafe-inline'",        // MUI's emotion uses inline styles
    'https://fonts.googleapis.com',
  ],
  fontSrc: [
    "'self'",
    'data:',
    'https://fonts.gstatic.com',
  ],
  imgSrc: [
    "'self'",
    'data:',
    'blob:',
    'https:',                 // wide allow — AI-generated images can come from many CDNs
  ],
  connectSrc: [
    "'self'",
    'https://*.razorpay.com',
    'wss:', 'ws:',            // socket.io (browsers strip ws: in https contexts)
    'https://api.openai.com',
    'https://image.pollinations.ai',
  ],
  frameSrc: [
    "'self'",
    'https://*.razorpay.com', // Razorpay checkout iframe
    'blob:',                  // PDF.js previews + contractor view PDF embed
  ],
  workerSrc: ["'self'", 'blob:'],   // PDF.js / Three.js workers
  objectSrc: ["'none'"],
  baseUri: ["'self'"],
  formAction: ["'self'"],
  frameAncestors: ["'none'"],       // anti-clickjacking
  upgradeInsecureRequests: isProd ? [] : null,
};

// Drop null directives
Object.keys(cspDirectives).forEach((k) => {
  if (cspDirectives[k] === null) delete cspDirectives[k];
});

const helmetConfig = helmet({
  contentSecurityPolicy: {
    directives: cspDirectives,
    reportOnly: !isProd,           // dev gets warnings; prod blocks
  },
  crossOriginEmbedderPolicy: false, // would block third-party images
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  hsts: isProd ? { maxAge: 31536000, includeSubDomains: true, preload: true } : false,
});

/* ─── CORS ────────────────────────────────────────────────────────── */

function corsMiddleware() {
  const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:3000';
  // Allow a comma-separated list (staging + prod from same backend)
  const allowList = CLIENT_URL.split(',').map((s) => s.trim()).filter(Boolean);

  return cors({
    origin: (origin, callback) => {
      // Allow same-origin / curl / server-to-server (no Origin header)
      if (!origin) return callback(null, true);
      if (allowList.includes(origin)) return callback(null, true);
      logger.warn('[cors] origin rejected', { origin, allowList });
      return callback(new Error('not_allowed_by_cors'));
    },
    credentials: true,    // refresh token cookie travels here
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
    exposedHeaders: ['RateLimit-Limit', 'RateLimit-Remaining', 'RateLimit-Reset'],
    maxAge: 86400, // cache preflight 24h
  });
}

/* ─── Body parsers ────────────────────────────────────────────────── */

const jsonBody = express.json({ limit: '10mb' });
const urlEncoded = express.urlencoded({ extended: true, limit: '10mb' });

/* ─── Multer (memory storage; file bytes go through validateUploadedBytes) ─ */

const IMAGE_MIMES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const PDF_MIMES = new Set(['application/pdf']);

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;     // 10 MB
const MAX_PDF_BYTES   = 20 * 1024 * 1024;     // 20 MB
const MAX_ANY_BYTES   = MAX_PDF_BYTES;        // the union upload uses the larger cap

function makeFileFilter(allowedMimes) {
  return (req, file, cb) => {
    if (!allowedMimes.has(file.mimetype)) {
      logger.warn('[upload] rejected MIME', {
        mime: file.mimetype, name: file.originalname, ip: req.ip,
      });
      return cb(new MimeRejectError(file.mimetype, [...allowedMimes]));
    }
    cb(null, true);
  };
}

class MimeRejectError extends Error {
  constructor(actual, allowed) {
    super(`mime_not_allowed: ${actual}`);
    this.name = 'MimeRejectError';
    this.status = 400;
    this.code = 'mime_not_allowed';
    this.details = { actual, allowed };
  }
}

const uploadImage = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_IMAGE_BYTES, files: 5 },
  fileFilter: makeFileFilter(IMAGE_MIMES),
});

const uploadPdf = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_PDF_BYTES, files: 3 },
  fileFilter: makeFileFilter(PDF_MIMES),
});

const uploadAny = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_ANY_BYTES, files: 5 },
  fileFilter: makeFileFilter(new Set([...IMAGE_MIMES, ...PDF_MIMES])),
});

/* ─── Magic-byte content validation ───────────────────────────────── */

/**
 * Validates that the *actual file bytes* match the declared MIME, not just
 * the Content-Type header.
 *
 *   router.post('/upload',
 *     security.uploadImage.single('file'),
 *     security.validateUploadedBytes('image'),
 *     handler);
 *
 *   mode = 'image' | 'pdf' | 'any'
 *
 * Uses `file-type` v16 (CommonJS). For v19+ which is ESM-only, swap to:
 *   const { fileTypeFromBuffer } = await import('file-type');
 */
function validateUploadedBytes(mode = 'any') {
  return async (req, res, next) => {
    try {
      const files = req.files || (req.file ? [req.file] : []);
      if (files.length === 0) return next();

      // Lazy-load file-type; works with both v16 (CJS) and v19+ (ESM dynamic)
      let fromBuffer;
      try {
        const ft = require('file-type');
        fromBuffer = ft.fileTypeFromBuffer || ft.fromBuffer;
      } catch (_) {
        const ft = await import('file-type');
        fromBuffer = ft.fileTypeFromBuffer;
      }

      const allowed = mode === 'image' ? IMAGE_MIMES
                    : mode === 'pdf'   ? PDF_MIMES
                    : new Set([...IMAGE_MIMES, ...PDF_MIMES]);

      for (const f of files) {
        const detected = await fromBuffer(f.buffer);
        const detectedMime = detected?.mime;

        // No signature recognized → reject (no SVG/HTML smuggling)
        if (!detectedMime) {
          logger.warn('[upload] no magic-byte signature', {
            declared: f.mimetype, name: f.originalname, ip: req.ip,
          });
          return next(new MimeRejectError('unknown', [...allowed]));
        }

        // Declared MIME ≠ actual content → reject
        if (!allowed.has(detectedMime)) {
          logger.warn('[upload] magic-bytes mismatch', {
            declared: f.mimetype, detected: detectedMime, name: f.originalname, ip: req.ip,
          });
          return next(new MimeRejectError(detectedMime, [...allowed]));
        }

        // Trust the detected MIME over the declared one (defence-in-depth)
        f.mimetype = detectedMime;
      }
      next();
    } catch (e) {
      logger.error('[upload] validateUploadedBytes failed', { err: e.message });
      next(e);
    }
  };
}

/* ─── Combined base middleware ────────────────────────────────────── */

function baseMiddleware() {
  return [
    helmetConfig,
    corsMiddleware(),
    // jsonBody + urlEncoded are returned separately so callers can mount
    // express.raw() BEFORE express.json() for the Razorpay webhook.
  ];
}

module.exports = {
  baseMiddleware,
  helmet: helmetConfig,
  cors: corsMiddleware,
  jsonBody,
  urlEncoded,
  uploadImage,
  uploadPdf,
  uploadAny,
  validateUploadedBytes,
  MimeRejectError,
  MAX_IMAGE_BYTES,
  MAX_PDF_BYTES,
};
