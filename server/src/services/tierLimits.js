/**
 * Tier generation limits — single source of truth.
 *
 * Values are stored in SystemSettings (key: 'ai-generation-limits') so an
 * admin can change them at runtime without a deploy.  The document is cached
 * in-process for 60 s to avoid a DB round-trip on every API call.
 *
 * A limit of 0 (or absent) means UNLIMITED for that tier.
 *
 * Default values (from design doc):
 *   FREE=5, BASIC=20, PRO=0 (unlimited), ENTERPRISE=0 (unlimited)
 *
 * Call invalidateCache() immediately after any admin PUT so that the next
 * request picks up the new values without waiting for the TTL to expire.
 */

const DEFAULTS = Object.freeze({ FREE: 5, BASIC: 20, PRO: 0, ENTERPRISE: 0 });

let _cache = null;
let _cacheExpiry = 0;
const CACHE_TTL_MS = 60_000;

async function getTierLimits() {
  if (_cache && Date.now() < _cacheExpiry) return _cache;

  try {
    const SystemSettings = require('../models/SystemSettings');
    const doc = await SystemSettings.findOne({ key: 'ai-generation-limits' }).lean();
    _cache = doc?.value ? { ...DEFAULTS, ...doc.value } : { ...DEFAULTS };
  } catch {
    // DB unavailable — fall back to defaults rather than crashing.
    _cache = { ...DEFAULTS };
  }

  _cacheExpiry = Date.now() + CACHE_TTL_MS;
  return _cache;
}

/** Limit for a single tier. Returns 0 when the tier is unlimited. */
async function getLimitForTier(tier) {
  const limits = await getTierLimits();
  return limits[tier] ?? limits.FREE;
}

/** Returns true when the tier has no daily cap. */
function isUnlimited(limit) {
  return !limit || limit <= 0;
}

/** Force the next getTierLimits() call to re-read from DB. */
function invalidateCache() {
  _cache = null;
  _cacheExpiry = 0;
}

module.exports = { getTierLimits, getLimitForTier, isUnlimited, invalidateCache, DEFAULTS };
