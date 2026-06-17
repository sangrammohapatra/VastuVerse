/**
 * Cost-estimate controller.
 *
 *   GET /api/v1/plans/:planId/cost-estimate          (?finishTier=standard)
 *   GET /api/v1/plans/:planId/export/cost-pdf        (?finishTier=...)
 *
 * The compute step reuses the same rule engine as the AI provider so the
 * PDF and the JSON view always agree. The JSON response is cached in Redis
 * for 6 hours, keyed by (planId, finishTier, planUpdatedAt) so any change
 * to the plan invalidates automatically.
 */

const Plan = require('../models/Plan');
const CostDataset = require('../models/CostDataset');
const redis = require('../config/redis');
const { estimateCost } = require('../services/ai/plan/_costEstimate');
const { buildCostPdf } = require('../utils/costPdfBuilder');

const CACHE_TTL = 6 * 3600; // 6 hours

function pickTier(q) {
  const t = String(q?.finishTier || q?.tier || 'standard').toLowerCase();
  return ['economy', 'standard', 'premium'].includes(t) ? t : 'standard';
}

async function loadPlan(req, res) {
  const plan = await Plan.findOne({ _id: req.params.planId, userId: req.user.userId }).lean();
  if (!plan) {
    res.status(404).json({ error: 'plan_not_found' });
    return null;
  }
  return plan;
}

/* ── GET /cost-estimate ─────────────────────────────────────────────── */

exports.getCostEstimate = async (req, res, next) => {
  try {
    const plan = await loadPlan(req, res);
    if (!plan) return;

    const tier = pickTier(req.query);
    const stamp = plan.updatedAt ? new Date(plan.updatedAt).getTime() : 0;
    const cacheKey = `cost:${plan._id}:${tier}:${stamp}`;

    try {
      const cached = await redis.get(cacheKey);
      if (cached) return res.json({ ...JSON.parse(cached), cached: true });
    } catch (e) { /* fall through */ }

    const estimate = await estimateCost({ plan, finishTier: tier, CostDataset });

    try { await redis.set(cacheKey, JSON.stringify(estimate), 'EX', CACHE_TTL); }
    catch (e) { /* non-fatal */ }

    return res.json({ ...estimate, cached: false });
  } catch (e) { next(e); }
};

/* ── GET /export/cost-pdf ──────────────────────────────────────────── */

exports.exportCostPdf = async (req, res, next) => {
  try {
    const plan = await loadPlan(req, res);
    if (!plan) return;

    const tier = pickTier(req.query);
    const estimate = await estimateCost({ plan, finishTier: tier, CostDataset });

    const safeTitle = (plan.title || 'cost-estimate').toLowerCase().replace(/[^a-z0-9-]+/g, '-');
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${safeTitle}-${tier}-cost.pdf"`
    );

    buildCostPdf({ res, plan, estimate });
  } catch (e) { next(e); }
};
