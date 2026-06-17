/**
 * Admin: AI Generation Tier Limits
 *
 * GET  /admin/tier-limits   — return current limits (DB values or defaults)
 * PUT  /admin/tier-limits   — save new limits, invalidate in-process cache
 *
 * A limit of 0 means UNLIMITED for that tier.
 */

const SystemSettings = require('../../models/SystemSettings');
const { getTierLimits, invalidateCache, DEFAULTS } = require('../../services/tierLimits');

const SETTINGS_KEY = 'ai-generation-limits';

/* ── GET /admin/tier-limits ───────────────────────────────────────────── */

async function getLimits(req, res) {
  try {
    const limits = await getTierLimits();
    res.json({ limits, defaults: DEFAULTS });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}

/* ── PUT /admin/tier-limits ───────────────────────────────────────────── */

async function saveLimits(req, res) {
  try {
    const { FREE, BASIC, PRO, ENTERPRISE } = req.body || {};

    const coerce = (v, fallback) => {
      const n = Number(v);
      return Number.isFinite(n) && n >= 0 ? Math.floor(n) : fallback;
    };

    const next = {
      FREE:       coerce(FREE,       DEFAULTS.FREE),
      BASIC:      coerce(BASIC,      DEFAULTS.BASIC),
      PRO:        coerce(PRO,        DEFAULTS.PRO),
      ENTERPRISE: coerce(ENTERPRISE, DEFAULTS.ENTERPRISE),
    };

    await SystemSettings.findOneAndUpdate(
      { key: SETTINGS_KEY },
      { $set: { value: next, updatedBy: req.user.userId } },
      { upsert: true, new: true }
    );

    invalidateCache();

    res.json({ ok: true, limits: next });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}

module.exports = { getLimits, saveLimits };
