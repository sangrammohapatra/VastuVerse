/**
 * Municipal rules controller.
 *
 *   GET  /api/v1/municipal/rules                                 (city/state lookup, 1h cache)
 *   POST /api/v1/plans/:planId/generate/municipal-checklist      (24h cache per plan+updatedAt)
 *   GET  /api/v1/plans/:planId/export/municipal-pdf              (streamed pdfkit)
 *
 * The compliance + draft data come from the deterministic rule engine in
 * `_municipal.js`. We layer Redis caching on top so subsequent step-9 visits
 * are instant; the cache key includes the plan's `updatedAt` so any wizard
 * edit invalidates automatically.
 */

const { MunicipalRule, Plan } = require('../models');
const redis = require('../config/redis');
const { generateMunicipalReport } = require('../services/ai/plan/_municipal');
const { buildMunicipalPdf } = require('../utils/municipalPdfBuilder');

const RULES_CACHE_TTL = 60 * 60;            // 1 hour
const REPORT_CACHE_TTL = 24 * 60 * 60;      // 24 hours

/* ── 1. City rules lookup (unchanged) ──────────────────────────────── */

function rulesCacheKey(state, city, zone) {
  return `municipal:${state.toLowerCase()}:${city.toLowerCase()}:${zone.toLowerCase()}`;
}

exports.getRules = async (req, res, next) => {
  try {
    const city = String(req.query.city || '').trim();
    const state = String(req.query.state || '').trim();
    const zone = String(req.query.zone || 'default').trim() || 'default';
    if (!city || !state) return res.status(400).json({ error: 'city_and_state_required' });

    const key = rulesCacheKey(state, city, zone);

    try {
      const cached = await redis.get(key);
      if (cached !== null && cached !== undefined) {
        return res.json({ rules: JSON.parse(cached), cached: true });
      }
    } catch (e) {
      console.warn('[municipal] redis lookup failed:', e.message);
    }

    let rules = await MunicipalRule.findOne({ state, city, zone }).lean();
    if (!rules && zone !== 'default') {
      rules = await MunicipalRule.findOne({ state, city, zone: 'default' }).lean();
    }

    try { await redis.set(key, JSON.stringify(rules || null), 'EX', RULES_CACHE_TTL); }
    catch (e) { console.warn('[municipal] redis write failed:', e.message); }

    res.json({ rules: rules || null, cached: false });
  } catch (e) { next(e); }
};

/* ── Helpers ────────────────────────────────────────────────────────── */

async function loadPlan(req, res) {
  const plan = await Plan.findOne({ _id: req.params.planId, userId: req.user.userId }).lean();
  if (!plan) { res.status(404).json({ error: 'plan_not_found' }); return null; }
  return plan;
}

async function lookupRulesFor(plan) {
  if (!plan.cityState?.city || !plan.cityState?.state) return null;
  const { city, state } = plan.cityState;
  // Reuse the cache layer to avoid hitting the DB on every report regen
  const key = rulesCacheKey(state, city, 'default');
  try {
    const cached = await redis.get(key);
    if (cached !== null && cached !== undefined) return JSON.parse(cached);
  } catch (e) { /* fall through */ }

  const rules = await MunicipalRule.findOne({ state, city, zone: 'default' }).lean();
  try { await redis.set(key, JSON.stringify(rules || null), 'EX', RULES_CACHE_TTL); }
  catch (e) { /* non-fatal */ }
  return rules || null;
}

function reportCacheKey(planId, stamp) {
  return `municipal-report:${planId}:${stamp}`;
}

/* ── 2. Generate compliance report ────────────────────────────────── */

/**
 * The endpoint is "POST /plans/:planId/generate/municipal-checklist" per the
 * brief — POST because we may persist user-fill fields from the request body
 * even when we serve the report from cache.
 *
 * Body (optional): { userFields: { plotNumber, surveyNumber, localAuthority, ownerName } }
 */
exports.generateMunicipalChecklist = async (req, res, next) => {
  try {
    const plan = await loadPlan(req, res);
    if (!plan) return;

    // Persist any user-supplied draft fields (Plot No, Khasra, etc.) right away,
    // so the next /export-pdf call sees them even if the user closes the tab.
    const userFields = req.body?.userFields;
    if (userFields && typeof userFields === 'object') {
      await Plan.updateOne(
        { _id: plan._id, userId: plan.userId },
        { $set: { 'municipalReport.userFields': sanitiseUserFields(userFields) } }
      );
    }

    const stamp = plan.updatedAt ? new Date(plan.updatedAt).getTime() : Date.now();
    const cacheKey = reportCacheKey(plan._id, stamp);

    // Cache lookup
    try {
      const cached = await redis.get(cacheKey);
      if (cached) {
        const parsed = JSON.parse(cached);
        return res.json({ ...parsed, cached: true });
      }
    } catch (e) { /* fall through */ }

    const rules = await lookupRulesFor(plan);
    const report = generateMunicipalReport({ plan, rules });

    // Persist the report on the Plan doc so subsequent step-loads have it,
    // and ALSO write to Redis for the next 24h.
    await Plan.updateOne(
      { _id: plan._id, userId: plan.userId },
      { $set: { municipalReport: { ...(plan.municipalReport || {}), ...report } } }
    );
    try { await redis.set(cacheKey, JSON.stringify(report), 'EX', REPORT_CACHE_TTL); }
    catch (e) { /* non-fatal */ }

    return res.json({ ...report, cached: false });
  } catch (e) { next(e); }
};

function sanitiseUserFields(uf) {
  const clean = {};
  ['plotNumber', 'surveyNumber', 'localAuthority', 'ownerName'].forEach((k) => {
    if (typeof uf[k] === 'string') clean[k] = uf[k].trim().slice(0, 200);
  });
  return clean;
}

/* ── 3. PDF export ────────────────────────────────────────────────── */

exports.exportMunicipalPdf = async (req, res, next) => {
  try {
    const plan = await loadPlan(req, res);
    if (!plan) return;

    // Reuse persisted report if it exists; otherwise regenerate on the fly.
    let report = plan.municipalReport;
    if (!report || !report.items) {
      const rules = await lookupRulesFor(plan);
      report = generateMunicipalReport({ plan, rules });
    }

    const safeTitle = (plan.title || 'municipal').toLowerCase().replace(/[^a-z0-9-]+/g, '-');
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${safeTitle}-municipal-draft.pdf"`
    );

    buildMunicipalPdf({ res, plan, report });
  } catch (e) { next(e); }
};
