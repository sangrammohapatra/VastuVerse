/**
 * Admin plans listing.
 *
 *   GET /admin/plans
 *     ?page=0&limit=25&status=COMPLETED&search=...
 */

const Plan = require('../../models/Plan');

exports.listPlans = async (req, res, next) => {
  try {
    const page  = Math.max(parseInt(req.query.page, 10) || 0, 0);
    const limit = Math.min(parseInt(req.query.limit, 10) || 25, 100);

    const q = {};
    if (req.query.status && ['DRAFT', 'IN_PROGRESS', 'COMPLETED', 'ARCHIVED'].includes(req.query.status)) {
      q.status = req.query.status;
    }
    if (req.query.search) {
      const re = new RegExp(String(req.query.search).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      q.$or = [{ title: re }, { 'cityState.city': re }, { 'cityState.state': re }];
    }

    const [rows, total] = await Promise.all([
      Plan.find(q)
        .populate('userId', 'email fullName')
        .select('title status cityState createdAt completedAt updatedAt currentStep landDetails.area')
        .sort({ updatedAt: -1 })
        .skip(page * limit).limit(limit).lean(),
      Plan.countDocuments(q),
    ]);

    res.json({
      rows: rows.map((p) => ({
        id: p._id,
        title: p.title,
        status: p.status,
        ownerEmail: p.userId?.email,
        ownerName: p.userId?.fullName,
        city: p.cityState?.city,
        state: p.cityState?.state,
        area: p.landDetails?.area,
        currentStep: p.currentStep,
        createdAt: p.createdAt,
        completedAt: p.completedAt,
        updatedAt: p.updatedAt,
      })),
      total, page, limit,
    });
  } catch (e) { next(e); }
};

exports.archivePlan = async (req, res, next) => {
  try {
    const plan = await Plan.findByIdAndUpdate(
      req.params.planId,
      { $set: { status: 'ARCHIVED' } },
      { new: true }
    );
    if (!plan) return res.status(404).json({ error: 'plan_not_found' });
    res.json({ ok: true });
  } catch (e) { next(e); }
};
