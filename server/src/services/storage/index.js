/**
 * StorageFactory — provider-agnostic image persistence layer.
 *
 * Configuration priority (first wins):
 *   1. SystemSettings DB document (key: 'storage') — editable by admin at runtime
 *   2. Environment variables (CLOUDINARY_URL / AWS_S3_BUCKET)
 *   3. Passthrough — returns original URL unchanged (dev default)
 *
 * DB settings are cached in-memory for 60 s. Call invalidateCache() after
 * a PUT to /admin/storage-settings so the next job picks up the new config.
 *
 * Public API:
 *   StorageFactory.persistImage(sourceUrl, storageKey) → Promise<string>
 *   StorageFactory.invalidateCache()
 */

const axios = require('axios');

/* ── In-memory settings cache ─────────────────────────────────────────── */

let _cache = null;
let _cacheExpiry = 0;
const CACHE_TTL_MS = 60_000;

async function loadDbSettings() {
  if (_cache !== undefined && Date.now() < _cacheExpiry) return _cache;
  try {
    // Lazy require to avoid circular dependency at module load
    const SystemSettings = require('../../models/SystemSettings');
    const doc = await SystemSettings.findOne({ key: 'storage' }).lean();
    _cache = doc?.value || null;
  } catch {
    _cache = null;
  }
  _cacheExpiry = Date.now() + CACHE_TTL_MS;
  return _cache;
}

/* ── Provider resolution ──────────────────────────────────────────────── */

async function resolveConfig() {
  const db = await loadDbSettings();

  // DB takes precedence when provider is explicitly set to something other than 'none'
  if (db?.provider && db.provider !== 'none') return db;

  // Fall back to env vars
  if (process.env.CLOUDINARY_URL) {
    return { provider: 'cloudinary', cloudinaryUrl: process.env.CLOUDINARY_URL };
  }
  if (process.env.AWS_S3_BUCKET) {
    return {
      provider: 's3',
      s3Bucket: process.env.AWS_S3_BUCKET,
      s3Region: process.env.AWS_REGION,
      s3AccessKeyId: process.env.AWS_ACCESS_KEY_ID,
      s3SecretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    };
  }

  return { provider: 'none' };
}

/* ── Buffer download ──────────────────────────────────────────────────── */

async function downloadBuffer(url) {
  const res = await axios.get(url, {
    responseType: 'arraybuffer',
    timeout: 30_000,
    maxContentLength: 20 * 1024 * 1024,
  });
  return {
    buffer: Buffer.from(res.data),
    contentType: res.headers['content-type'] || 'image/jpeg',
  };
}

/* ── Public API ───────────────────────────────────────────────────────── */

class StorageFactory {
  /**
   * Download sourceUrl and upload to the configured storage provider.
   * Returns the persistent CDN URL, or sourceUrl if storage is not configured.
   * Never throws — falls back to sourceUrl on any error.
   */
  static async persistImage(sourceUrl, storageKey) {
    let cfg;
    try {
      cfg = await resolveConfig();
    } catch {
      return sourceUrl;
    }

    if (cfg.provider === 'none') return sourceUrl;

    try {
      const { buffer, contentType } = await downloadBuffer(sourceUrl);

      if (cfg.provider === 'cloudinary') {
        const { uploadImage } = require('./cloudinary');
        const { url } = await uploadImage(buffer, {
          key: storageKey,
          contentType,
          cloudinaryUrl: cfg.cloudinaryUrl,
        });
        return url;
      }

      if (cfg.provider === 's3') {
        const { uploadImage } = require('./s3');
        const { url } = await uploadImage(buffer, {
          key: storageKey,
          contentType,
          s3Bucket: cfg.s3Bucket,
          s3Region: cfg.s3Region,
          s3AccessKeyId: cfg.s3AccessKeyId,
          s3SecretAccessKey: cfg.s3SecretAccessKey,
        });
        return url;
      }
    } catch (err) {
      console.warn(`[storage] upload failed for "${storageKey}", using source URL:`, err.message);
    }

    return sourceUrl;
  }

  /** Force the next persistImage() call to re-read settings from DB. */
  static invalidateCache() {
    _cache = null;
    _cacheExpiry = 0;
  }

  /** Resolve and return the active provider name ('none' | 'cloudinary' | 's3'). */
  static async getActiveProvider() {
    const cfg = await resolveConfig();
    return cfg.provider;
  }
}

module.exports = StorageFactory;
