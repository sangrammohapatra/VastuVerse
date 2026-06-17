/**
 * Plan-finalisation controller: versions, status, contractor share links,
 * and the master "Full Plan" PDF export.
 *
 *   GET  /api/v1/plans/:planId/versions                       (list, newest-first)
 *   PUT  /api/v1/plans/:planId/versions/:versionId/rollback   (snapshot → live plan)
 *   PUT  /api/v1/plans/:planId/status                         (DRAFT→IN_PROGRESS→COMPLETED→ARCHIVED)
 *   POST /api/v1/plans/:planId/contractor-links               (SHA-256 hashed token)
 *   GET  /api/v1/plans/:planId/export/full-pdf                (watermark FREE tier)
 */

const crypto = require('crypto');

const Plan = require('../models/Plan');
const PlanVersion = require('../models/PlanVersion');
const ContractorLink = require('../models/ContractorLink');
const ActivityLog = require('../models/ActivityLog');
const { getIO } = require('../config/socket');
const { buildFullPlanPdf } = require('../utils/fullPlanPdfBuilder');

/* ── helper ────────────────────────────────────────────────────────── */

async function loadOwnedPlan(req, res) {
  const plan = await Plan.findOne({ _id: req.params.planId, userId: req.user.userId });
  if (!plan) { res.status(404).json({ error: 'plan_not_found' }); return null; }
  return plan;
}

/* ── 1. Versions: list ────────────────────────────────────────────── */

exports.listVersions = async (req, res, next) => {
  try {
    const plan = await loadOwnedPlan(req, res);
    if (!plan) return;

    const versions = await PlanVersion.find({ planId: plan._id })
      .populate('createdBy', 'fullName email avatarUrl')
      .sort({ versionNumber: -1 })
      .limit(50)
      .lean();

    res.json({
      versions: versions.map((v) => ({
        id: v._id,
        versionNumber: v.versionNumber,
        stepName: v.stepName,
        label: v.label,
        thumbnailUrl: v.thumbnailUrl,
        isRollbackPoint: v.isRollbackPoint,
        createdAt: v.createdAt,
        createdBy: v.createdBy
          ? { id: v.createdBy._id, fullName: v.createdBy.fullName, email: v.createdBy.email, avatarUrl: v.createdBy.avatarUrl }
          : null,
      })),
    });
  } catch (e) { next(e); }
};

/* ── 2. Versions: rollback ────────────────────────────────────────── */

exports.rollback = async (req, res, next) => {
  try {
    const plan = await loadOwnedPlan(req, res);
    if (!plan) return;

    const { versionId } = req.params;
    const target = await PlanVersion.findOne({ _id: versionId, planId: plan._id });
    if (!target) return res.status(404).json({ error: 'version_not_found' });
    if (!target.snapshotData) return res.status(422).json({ error: 'version_has_no_snapshot' });

    // Snapshot the CURRENT state into a fresh version (so the rollback itself is undoable)
    const lastVersion = await PlanVersion.findOne({ planId: plan._id })
      .sort({ versionNumber: -1 }).select('versionNumber').lean();
    const nextNumber = (lastVersion?.versionNumber || 0) + 1;

    await PlanVersion.create({
      planId: plan._id,
      versionNumber: nextNumber,
      stepName: 'manual',
      label: `Pre-rollback snapshot (before v${target.versionNumber})`,
      snapshotData: serialisePlanSnapshot(plan),
      createdBy: req.user.userId,
      isRollbackPoint: true,
    });

    // Apply the target snapshot to the plan (overwrite the step-data subtrees only)
    const snap = target.snapshotData || {};
    [
      'title', 'vastuEnabled', 'cityState', 'landDetails', 'roomConfig',
      'floorPlan', 'interior', 'exterior', 'utilities', 'costEstimate', 'municipalReport',
    ].forEach((k) => {
      if (snap[k] !== undefined) {
        plan[k] = snap[k];
        plan.markModified(k);
      }
    });
    await plan.save();

    await ActivityLog.create({
      userId: req.user.userId, planId: plan._id,
      action: 'version_rolled_back',
      metadata: { restoredVersionId: target._id, restoredVersionNumber: target.versionNumber },
    }).catch((e) => console.warn('[activity-log]', e.message));

    res.json({
      ok: true,
      restoredVersion: { id: target._id, versionNumber: target.versionNumber, label: target.label },
      preRollbackVersionNumber: nextNumber,
    });
  } catch (e) { next(e); }
};

function serialisePlanSnapshot(plan) {
  return {
    title: plan.title,
    vastuEnabled: plan.vastuEnabled,
    cityState: plan.cityState,
    landDetails: plan.landDetails,
    roomConfig: plan.roomConfig,
    floorPlan: plan.floorPlan,
    interior: plan.interior,
    exterior: plan.exterior,
    utilities: plan.utilities,
    costEstimate: plan.costEstimate,
    municipalReport: plan.municipalReport,
  };
}

/* ── 3. Status change ─────────────────────────────────────────────── */

const VALID_STATUSES = ['DRAFT', 'IN_PROGRESS', 'COMPLETED', 'ARCHIVED'];

exports.updateStatus = async (req, res, next) => {
  try {
    const plan = await loadOwnedPlan(req, res);
    if (!plan) return;

    const { status } = req.body || {};
    if (!VALID_STATUSES.includes(status)) {
      return res.status(400).json({ error: 'invalid_status' });
    }

    const previous = plan.status;
    plan.status = status;
    if (status === 'COMPLETED' && !plan.completedAt) plan.completedAt = new Date();
    if (status === 'ARCHIVED' && !plan.archivedAt) plan.archivedAt = new Date();
    await plan.save();

    await ActivityLog.create({
      userId: req.user.userId, planId: plan._id,
      action: 'plan_status_changed',
      metadata: { from: previous, to: status },
    }).catch((e) => console.warn('[activity-log]', e.message));

    try {
      const io = getIO();
      if (io) {
        io.to(`plan:${plan._id}:status`).emit('plan:status', {
          planId: plan._id, status, previous, completedAt: plan.completedAt,
        });
        io.to(`user:${plan.userId}`).emit('plan:status', {
          planId: plan._id, status, previous, completedAt: plan.completedAt,
        });
      }
    } catch (_) { /* non-fatal */ }

    res.json({
      ok: true,
      status,
      previous,
      completedAt: plan.completedAt,
      // Convenience flag for the UI so it can reveal the marketplace banner
      marketplaceUnlocked: status === 'COMPLETED',
    });
  } catch (e) { next(e); }
};

/* ── 4. Contractor share links ────────────────────────────────────── */

const EXPIRY_MS = {
  '24h': 24 * 3600 * 1000,
  '7d':  7 * 24 * 3600 * 1000,
  permanent: null,
};

exports.createContractorLink = async (req, res, next) => {
  try {
    const plan = await loadOwnedPlan(req, res);
    if (!plan) return;

    const { expiryType = '7d' } = req.body || {};
    if (!Object.prototype.hasOwnProperty.call(EXPIRY_MS, expiryType)) {
      return res.status(400).json({ error: 'invalid_expiry_type' });
    }

    const rawToken = crypto.randomBytes(24).toString('base64url');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = EXPIRY_MS[expiryType] ? new Date(Date.now() + EXPIRY_MS[expiryType]) : null;

    const link = await ContractorLink.create({
      planId: plan._id,
      createdBy: req.user.userId,
      tokenHash,
      expiryType,
      expiresAt,
    });

    const baseUrl = (process.env.CLIENT_URL || 'http://localhost:3000').replace(/\/$/, '');
    const url = `${baseUrl}/contractor/${rawToken}`;

    await ActivityLog.create({
      userId: req.user.userId, planId: plan._id,
      action: 'contractor_link_created',
      metadata: { contractorLinkId: link._id, expiryType },
    }).catch((e) => console.warn('[activity-log]', e.message));

    res.status(201).json({
      id: link._id,
      url,                              // shown once
      expiryType,
      expiresAt,
      tokenHashPreview: tokenHash.slice(0, 12), // helps the UI identify the row later
    });
  } catch (e) { next(e); }
};

exports.listContractorLinks = async (req, res, next) => {
  try {
    const plan = await loadOwnedPlan(req, res);
    if (!plan) return;

    const rows = await ContractorLink.find({ planId: plan._id })
      .sort({ createdAt: -1 })
      .limit(20)
      .lean();

    res.json({
      links: rows.map((r) => ({
        id: r._id,
        expiryType: r.expiryType,
        expiresAt: r.expiresAt,
        accessCount: (r.accessLog || []).length,
        isRevoked: r.isRevoked,
        createdAt: r.createdAt,
        tokenHashPreview: r.tokenHash?.slice(0, 12),
      })),
    });
  } catch (e) { next(e); }
};

/* ── 5. Full-plan PDF (with watermark for FREE) ───────────────────── */

exports.exportFullPdf = async (req, res, next) => {
  try {
    const plan = await loadOwnedPlan(req, res);
    if (!plan) return;

    const tier = (req.user.tier || 'FREE').toUpperCase();
    const watermark = tier === 'FREE';

    const safeTitle = (plan.title || 'plan').toLowerCase().replace(/[^a-z0-9-]+/g, '-');
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${safeTitle}-full-plan${watermark ? '-preview' : ''}.pdf"`
    );

    buildFullPlanPdf({ res, plan: plan.toObject(), watermark, tier });

    await ActivityLog.create({
      userId: req.user.userId, planId: plan._id,
      action: 'pdf_exported',
      metadata: { kind: 'full_plan', watermark, tier },
    }).catch((e) => console.warn('[activity-log]', e.message));
  } catch (e) { next(e); }
};
