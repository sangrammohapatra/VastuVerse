/**
 * Subscriptions + payments admin.
 *
 *   GET  /admin/subscriptions                 (filter by tier/status)
 *   POST /admin/subscriptions/:userId/revoke  (admin revoke → set to FREE)
 *
 *   GET  /admin/payments                      (filter by type/status, date range, paginated)
 */

const Subscription = require('../../models/Subscription');
const Payment = require('../../models/Payment');
const User = require('../../models/User');

exports.listSubscriptions = async (req, res, next) => {
  try {
    const q = {};
    if (req.query.tier)   q.tier   = req.query.tier;
    if (req.query.status) q.status = req.query.status;

    const rows = await Subscription.find(q)
      .populate('userId', 'email fullName')
      .populate('adminOverride.grantedBy', 'email')
      .sort({ updatedAt: -1 })
      .limit(200).lean();

    res.json({ rows: rows.map((s) => ({
      id: s._id,
      userId: s.userId?._id,
      email: s.userId?.email,
      fullName: s.userId?.fullName,
      tier: s.tier,
      status: s.status,
      razorpaySubscriptionId: s.razorpaySubscriptionId,
      razorpayCustomerId: s.razorpayCustomerId,
      currentPeriodStart: s.currentPeriodStart,
      currentPeriodEnd: s.currentPeriodEnd,
      plansUsedThisMonth: s.plansUsedThisMonth,
      adminOverride: s.adminOverride?.isOverride ? {
        grantedBy: s.adminOverride.grantedBy?.email,
        reason: s.adminOverride.reason,
      } : null,
      updatedAt: s.updatedAt,
    })) });
  } catch (e) { next(e); }
};

exports.revokeSubscription = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const { reason } = req.body || {};

    await User.updateOne({ _id: userId }, { $set: { tier: 'FREE' } });
    const sub = await Subscription.findOneAndUpdate(
      { userId },
      {
        $set: {
          tier: 'FREE',
          status: 'cancelled',
          cancelledAt: new Date(),
          adminOverride: {
            isOverride: true, grantedBy: req.user.userId,
            reason: `Revoked: ${String(reason || '').slice(0, 400)}`,
          },
        },
      },
      { new: true }
    );
    if (!sub) return res.status(404).json({ error: 'subscription_not_found' });
    res.json({ ok: true, subscription: sub });
  } catch (e) { next(e); }
};

exports.listPayments = async (req, res, next) => {
  try {
    const page  = Math.max(parseInt(req.query.page, 10) || 0, 0);
    const limit = Math.min(parseInt(req.query.limit, 10) || 50, 200);

    const q = {};
    if (req.query.type)   q.type   = req.query.type;
    if (req.query.status) q.status = req.query.status;
    if (req.query.from || req.query.to) {
      q.createdAt = {};
      if (req.query.from) q.createdAt.$gte = new Date(req.query.from);
      if (req.query.to)   q.createdAt.$lte = new Date(req.query.to);
    }

    const [rows, total] = await Promise.all([
      Payment.find(q)
        .populate('userId', 'email fullName')
        .sort({ createdAt: -1 })
        .skip(page * limit).limit(limit).lean(),
      Payment.countDocuments(q),
    ]);

    res.json({
      rows: rows.map((p) => ({
        id: p._id,
        userId: p.userId?._id,
        email: p.userId?.email,
        type: p.type,
        amount: p.amount,
        currency: p.currency,
        status: p.status,
        razorpayOrderId: p.razorpayOrderId,
        razorpayPaymentId: p.razorpayPaymentId,
        createdAt: p.createdAt,
      })),
      total, page, limit,
    });
  } catch (e) { next(e); }
};

/* ── Marketplace moderation (lightweight overview) ────────────────── */

exports.listMarketplaceOverview = async (req, res, next) => {
  try {
    const ReviewRequest = require('../../models/ReviewRequest');
    const Bid = require('../../models/Bid');

    const [requests, bids] = await Promise.all([
      ReviewRequest.find({}).populate('homeownerId', 'email fullName').sort({ createdAt: -1 }).limit(100).lean(),
      Bid.find({}).populate('architectId', 'email fullName').sort({ createdAt: -1 }).limit(100).lean(),
    ]);

    res.json({
      requests: requests.map((r) => ({
        id: r._id,
        title: r.title,
        status: r.status,
        homeownerEmail: r.homeownerId?.email,
        homeownerName: r.homeownerId?.fullName,
        maxBudgetInr: r.maxBudgetInr,
        cityState: r.cityState,
        bidCount: r.bidCount,
        createdAt: r.createdAt,
      })),
      bids: bids.map((b) => ({
        id: b._id,
        architectEmail: b.architectId?.email,
        architectName: b.architectId?.fullName,
        proposedFee: b.proposedFee,
        status: b.status,
        createdAt: b.createdAt,
      })),
    });
  } catch (e) { next(e); }
};

/* ── Commission rate config (held in-process as the source of truth
       is COMMISSION_PCT in marketplaceController; admin endpoint reads
       it and offers an env-driven hint for changes) ─────────────────── */

exports.getCommissionConfig = async (req, res, next) => {
  try {
    res.json({
      commissionPct: 15,
      payoutRatio: 0.85,
      note: 'Defined as COMMISSION_PCT in /controllers/marketplaceController.js. Change requires a deploy.',
    });
  } catch (e) { next(e); }
};
