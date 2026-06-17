/**
 * Plan controller — owns the wizard's persistence surface.
 *
 *   POST /api/v1/plans                          createPlan  (status: DRAFT)
 *   GET  /api/v1/plans/:planId                  getPlan
 *   PUT  /api/v1/plans/:planId/steps/:stepName  saveStep   (DRAFT → IN_PROGRESS)
 *
 * Ownership: every call checks plan.userId against req.user.userId.
 * (Developer-team membership checks are added once the project scaffold lands.)
 */

const { Plan } = require('../models');

const VALID_STEPS = [
  'step1', 'step2', 'step3', 'step4', 'step5',
  'step6', 'step7', 'step8', 'step9', 'step10',
];

exports.createPlan = async (req, res, next) => {
  try {
    const { title, projectId } = req.body || {};
    const plan = await Plan.create({
      userId: req.user.userId,
      projectId: projectId || null,
      title: (title && String(title).trim()) || 'Untitled Plan',
      status: 'DRAFT',
    });
    res.status(201).json({ plan });
  } catch (e) {
    next(e);
  }
};

exports.getPlan = async (req, res, next) => {
  try {
    const plan = await Plan.findOne({
      _id: req.params.planId,
      userId: req.user.userId,
    });
    if (!plan) return res.status(404).json({ error: 'plan_not_found' });
    res.json({ plan });
  } catch (e) {
    if (e.name === 'CastError') return res.status(400).json({ error: 'invalid_plan_id' });
    next(e);
  }
};

exports.saveStep = async (req, res, next) => {
  try {
    const { planId, stepName } = req.params;

    if (!VALID_STEPS.includes(stepName)) {
      return res.status(400).json({ error: 'invalid_step' });
    }

    const plan = await Plan.findOne({ _id: planId, userId: req.user.userId });
    if (!plan) return res.status(404).json({ error: 'plan_not_found' });

    const { title, vastuEnabled, cityState, landDetails, roomConfig, floorPlan, interior, exterior, utilities, costEstimate, municipalReport } = req.body || {};

    if (typeof title === 'string' && title.trim()) plan.title = title.trim();
    if (typeof vastuEnabled === 'boolean') plan.vastuEnabled = vastuEnabled;
    if (cityState && typeof cityState === 'object') {
      plan.cityState = {
        city: cityState.city || plan.cityState?.city,
        state: cityState.state || plan.cityState?.state,
      };
    }
    if (landDetails && typeof landDetails === 'object') {
      // Merge so partial updates from later auto-saves don't drop earlier fields.
      const current = plan.landDetails ? plan.landDetails.toObject() : {};
      plan.landDetails = { ...current, ...landDetails };
    }
    if (roomConfig && typeof roomConfig === 'object') {
      const current = plan.roomConfig ? plan.roomConfig.toObject() : {};
      plan.roomConfig = { ...current, ...roomConfig };
      plan.markModified('roomConfig'); // floorAssignments is Mixed
    }
    if (floorPlan && typeof floorPlan === 'object') {
      // Merge: never overwrite the existing options array with an empty one
      const current = plan.floorPlan || {};
      const next = { ...current };
      if (typeof floorPlan.selectedOptionId === 'string') next.selectedOptionId = floorPlan.selectedOptionId;
      if (Array.isArray(floorPlan.options) && floorPlan.options.length > 0) next.options = floorPlan.options;
      if (floorPlan.generatedAt) next.generatedAt = floorPlan.generatedAt;
      if (floorPlan.jobId) next.jobId = floorPlan.jobId;
      plan.floorPlan = next;
      plan.markModified('floorPlan');
    }
    if (interior && typeof interior === 'object') {
      const current = plan.interior || {};
      // Shallow-merge top-level keys; never overwrite the rooms map with empty.
      const next = { ...current };
      ['globalStyle', 'selectedPaletteId', 'kitchenConfig'].forEach((k) => {
        if (interior[k] !== undefined) next[k] = interior[k];
      });
      if (interior.perRoomStyles && typeof interior.perRoomStyles === 'object') {
        next.perRoomStyles = { ...(current.perRoomStyles || {}), ...interior.perRoomStyles };
      }
      if (Array.isArray(interior.palettes) && interior.palettes.length > 0) next.palettes = interior.palettes;
      // rooms map: persisted by the worker directly — don't accept full overwrite from client
      plan.interior = next;
      plan.markModified('interior');
    }
    if (exterior && typeof exterior === 'object') {
      const current = plan.exterior || {};
      const next = { ...current };
      ['facadeStyle', 'roofType', 'boundaryWall', 'mainGate', 'driveway'].forEach((k) => {
        if (exterior[k] !== undefined) next[k] = exterior[k];
      });
      if (Array.isArray(exterior.landscaping)) next.landscaping = exterior.landscaping;
      // sides: persisted by the worker directly
      plan.exterior = next;
      plan.markModified('exterior');
    }
    if (utilities && typeof utilities === 'object') {
      // The worker writes the heavy layers/summary directly; the client just
      // echoes back metadata bits (jobId, generatedAt) plus the toggles it
      // wants persisted (e.g., activeLayers preference if you store one).
      const current = plan.utilities || {};
      const next = { ...current };
      if (utilities.jobId) next.jobId = utilities.jobId;
      if (utilities.generatedAt) next.generatedAt = utilities.generatedAt;
      if (Array.isArray(utilities.activeLayers)) next.activeLayers = utilities.activeLayers;
      plan.utilities = next;
      plan.markModified('utilities');
    }
    if (costEstimate && typeof costEstimate === 'object') {
      // Cost estimate is recomputable; we still store the last-viewed tier
      // so the user lands on the same view when they return to the step.
      const current = plan.costEstimate || {};
      const next = { ...current };
      if (typeof costEstimate.finishTier === 'string') next.finishTier = costEstimate.finishTier;
      if (Number.isFinite(Number(costEstimate.totalInr))) next.totalInr = Number(costEstimate.totalInr);
      if (costEstimate.asOf) next.asOf = costEstimate.asOf;
      if (costEstimate.generatedAt) next.generatedAt = costEstimate.generatedAt;
      plan.costEstimate = next;
      plan.markModified('costEstimate');
    }
    if (municipalReport && typeof municipalReport === 'object') {
      // Only the user-fillable form bits are accepted; items[]/summary/draft are
      // computed by the rule engine and persisted by the generator endpoint.
      const current = plan.municipalReport || {};
      const next = { ...current };
      if (municipalReport.userFields && typeof municipalReport.userFields === 'object') {
        const uf = {};
        ['plotNumber', 'surveyNumber', 'localAuthority', 'ownerName'].forEach((k) => {
          if (typeof municipalReport.userFields[k] === 'string') {
            uf[k] = municipalReport.userFields[k].trim().slice(0, 200);
          }
        });
        next.userFields = { ...(current.userFields || {}), ...uf };
      }
      plan.municipalReport = next;
      plan.markModified('municipalReport');
    }

    // Mark step completed (does not unmark if already true).
    plan.stepProgress = plan.stepProgress || {};
    plan.stepProgress[stepName] = {
      completed: true,
      completedAt: new Date(),
    };
    plan.markModified('stepProgress');

    // First save advances DRAFT → IN_PROGRESS.
    if (plan.status === 'DRAFT') plan.status = 'IN_PROGRESS';

    await plan.save();
    res.json({ plan });
  } catch (e) {
    if (e.name === 'CastError') return res.status(400).json({ error: 'invalid_plan_id' });
    if (e.name === 'ValidationError') {
      return res.status(400).json({ error: 'validation_failed', details: e.errors });
    }
    next(e);
  }
};

/* ─────────────────────────────────────────────────────────────────── */
/* Share the 3D view: generates a 30-day URL-safe token. Returns the   */
/* token + the absolute share URL the client should copy/paste.        */
/* ─────────────────────────────────────────────────────────────────── */

const crypto = require('crypto');

exports.shareThreeDView = async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const { planId } = req.params;

    const plan = await Plan.findOne({ _id: planId, userId });
    if (!plan) return res.status(404).json({ error: 'plan_not_found' });
    if (!plan.is3DUnlocked) return res.status(402).json({ error: '3d_locked' });

    // Reuse an existing token if it hasn't expired
    const existing = plan.shareTokens?.threeD;
    let token = existing?.token;
    let expiresAt = existing?.expiresAt;

    if (!token || !expiresAt || new Date(expiresAt).getTime() < Date.now()) {
      token = crypto.randomBytes(18).toString('base64url');
      expiresAt = new Date(Date.now() + 30 * 24 * 3600 * 1000); // 30 days
      plan.shareTokens = {
        ...(plan.shareTokens || {}),
        threeD: { token, createdAt: new Date(), expiresAt },
      };
      plan.markModified('shareTokens');
      await plan.save();
    }

    const clientUrl = (process.env.CLIENT_URL || 'http://localhost:3000').replace(/\/$/, '');
    const url = `${clientUrl}/shared/3d/${token}`;

    res.json({ token, url, expiresAt });
  } catch (e) {
    if (e.name === 'CastError') return res.status(400).json({ error: 'invalid_plan_id' });
    next(e);
  }
};

/**
 * GET /api/v1/plans
 *   ?status=COMPLETED,IN_PROGRESS    optional comma-separated status filter
 *   ?limit=20                        cap at 50
 *
 * Returns a lightweight list (no Mixed fields beyond cityState) for use by
 * the dashboard, plans list, and marketplace's "select completed plan"
 * dropdown. Newest-first.
 */
exports.listPlans = async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const Plan = require('../models/Plan');

    const limit = Math.min(parseInt(req.query.limit, 10) || 20, 50);
    const q = { userId };
    if (req.query.status) {
      const statuses = String(req.query.status).split(',')
        .map((s) => s.trim().toUpperCase())
        .filter((s) => ['DRAFT', 'IN_PROGRESS', 'COMPLETED', 'ARCHIVED'].includes(s));
      if (statuses.length > 0) q.status = { $in: statuses };
    }

    const plans = await Plan.find(q)
      .select('title status cityState landDetails.area landDetails.unit completedAt createdAt updatedAt')
      .sort({ updatedAt: -1 })
      .limit(limit)
      .lean();

    res.json({ plans });
  } catch (e) { next(e); }
};
