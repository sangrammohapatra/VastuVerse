/**
 * Public contractor view (no auth).
 *
 *   GET /api/v1/contractor/:token
 *     → SHA-256(token) → find ContractorLink (active, not revoked, not expired)
 *     → log access (IP + userAgent)
 *     → return sanitized plan (no userId, email, phone, financial admin overrides…)
 */

const crypto = require('crypto');

const ContractorLink = require('../models/ContractorLink');
const Plan = require('../models/Plan');

/** Strip everything personal/admin from the plan before serving it. */
function sanitizePlan(plan, linkExpiresAt) {
  if (!plan) return null;

  const p = plan.toObject ? plan.toObject() : plan;

  return {
    title: p.title,
    status: p.status,
    cityState: p.cityState,
    landDetails: p.landDetails,
    rooms: p.rooms || [],
    selectedFloorPlanIndex: p.selectedFloorPlanIndex,
    floorPlans: p.floorPlans || [],

    // Interior + exterior renderings — URLs only, no editor metadata
    interior: p.interior ? {
      selectedStyle: p.interior.selectedStyle,
      activePaletteIndex: p.interior.activePaletteIndex,
      palettes: p.interior.palettes,
      renderings: p.interior.renderings,
    } : null,
    exterior: p.exterior ? {
      selectedFacadeIndex: p.exterior.selectedFacadeIndex,
      facades: p.exterior.facades,
      roofType: p.exterior.roofType,
      boundaryWall: p.exterior.boundaryWall,
      mainGate: p.exterior.mainGate,
      drivewayMaterial: p.exterior.drivewayMaterial,
    } : null,

    utilities: p.utilities || null,

    // Cost only if owner included it (some owners may strip this before sharing)
    costEstimate: p.costEstimate ? {
      tier: p.costEstimate.tier,
      breakdown: p.costEstimate.breakdown,
      totalCost: p.costEstimate.totalCost,
      currency: p.costEstimate.currency || 'INR',
      generatedAt: p.costEstimate.generatedAt,
    } : null,

    // Step images & 3D preview link (read-only)
    birdEyeView: p.birdEyeView ? {
      modelUrl: p.birdEyeView.modelUrl,
      thumbnail: p.birdEyeView.thumbnail,
    } : null,

    // Municipal compliance summary
    municipalReport: p.municipalReport ? {
      checks: p.municipalReport.checks,
      passedCount: p.municipalReport.passedCount,
      failedCount: p.municipalReport.failedCount,
      generatedAt: p.municipalReport.generatedAt,
    } : null,

    // Audit metadata about the link itself (so the page can show "expires in 4 days")
    linkInfo: {
      expiresAt: linkExpiresAt || null,
      isPermanent: !linkExpiresAt,
    },

    // Explicitly NOT included:
    //   userId, _id, owner email/phone, share tokens, collaborators,
    //   billing info, AI provider metadata, admin overrides, payment ids
  };
}

exports.getContractorPlan = async (req, res, next) => {
  try {
    const { token } = req.params;
    if (!token || typeof token !== 'string' || token.length < 8) {
      return res.status(400).json({ error: 'invalid_token' });
    }

    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    const link = await ContractorLink.findOne({ tokenHash, isRevoked: false });
    if (!link) return res.status(404).json({ error: 'link_not_found_or_revoked' });

    // Expiry check
    if (link.expiresAt && link.expiresAt.getTime() < Date.now()) {
      return res.status(410).json({ error: 'link_expired', expiredAt: link.expiresAt });
    }

    // Resolve the plan with minimal projection — sanitizePlan trims further
    const plan = await Plan.findById(link.planId);
    if (!plan) return res.status(404).json({ error: 'plan_not_found' });

    // Access log — best-effort. We push the entry but cap stored history at 100.
    try {
      const ip = (req.headers['x-forwarded-for'] || req.ip || '').toString().split(',')[0].trim();
      const userAgent = (req.headers['user-agent'] || '').slice(0, 240);
      await ContractorLink.updateOne(
        { _id: link._id },
        {
          $push: {
            accessLog: {
              $each: [{ ip, userAgent, accessedAt: new Date() }],
              $slice: -100,
            },
          },
        }
      );
    } catch (_) { /* never block on logging */ }

    res.set('Cache-Control', 'private, max-age=60'); // contractors may refresh a lot
    res.json({
      plan: sanitizePlan(plan, link.expiresAt),
    });
  } catch (e) { next(e); }
};
