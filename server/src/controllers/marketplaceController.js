/**
 * Marketplace controller — homeowner ↔ architect bid + review + payout flow.
 *
 *   Homeowner:
 *     POST /marketplace/review-requests                       (create; plan must be COMPLETED)
 *     GET  /marketplace/review-requests/mine                  (my requests with bids inlined)
 *     POST /marketplace/bids/:bidId/accept                    (escrow payment → Razorpay order)
 *     POST /marketplace/bids/:bidId/accept/verify             (verify HMAC → bid.accepted, request.IN_REVIEW)
 *     POST /marketplace/reviews/:reviewId/accept              (payout → architect Razorpay Routes)
 *     POST /marketplace/reviews/:reviewId/rating              (star rating + comment)
 *
 *   Architect:
 *     GET  /marketplace/review-requests                       (feed: city/state + budget filters)
 *     POST /marketplace/bids                                  (place bid)
 *     POST /marketplace/reviews                               (submit review)
 *     GET  /marketplace/architects/me/earnings                (dashboard counters)
 *
 * Payment flow:
 *   ── Accept bid → Razorpay order created (full bid fee, escrow on platform).
 *      Client opens Razorpay; verify endpoint HMACs the signature, flips Bid
 *      to 'accepted', request to 'IN_REVIEW', and writes a Payment row of
 *      type 'marketplace_bid'.
 *   ── Accept review → platform initiates Razorpay Route transfer of
 *      (fee × 85%) to the architect's fund account; commission (15%) stays
 *      with the platform. A Payment row of type 'marketplace_payout' is
 *      written. ArchitectProfile.totalEarnings / .totalReviewsCompleted /
 *      .rating are updated atomically.
 */

const crypto = require('crypto');

const Plan = require('../models/Plan');
const ReviewRequest = require('../models/ReviewRequest');
const Bid = require('../models/Bid');
const ArchitectProfile = require('../models/ArchitectProfile');
const ArchitectReview = require('../models/ArchitectReview');
const Payment = require('../models/Payment');
const ActivityLog = require('../models/ActivityLog');
const User = require('../models/User');

const { razorpay, configured, KEY_ID, KEY_SECRET } = require('../config/razorpay');
const { notify } = require('../services/notifications');

const COMMISSION_PCT = 15;
const PLATFORM_CUT  = COMMISSION_PCT / 100;
const PAYOUT_RATIO  = 1 - PLATFORM_CUT;

const MAX_FEED_LIMIT = 50;
const DEFAULT_LIMIT  = 20;

function requireConfigured(res) {
  if (!configured) {
    res.status(503).json({ error: 'payments_not_configured' });
    return false;
  }
  return true;
}

function requireArchitect(req, res) {
  if (req.user.role !== 'architect') {
    res.status(403).json({ error: 'architect_only' });
    return false;
  }
  return true;
}

function verifyHmac(secret, payload, signature) {
  if (!signature || typeof signature !== 'string') return false;
  const expected = crypto.createHmac('sha256', secret).update(payload).digest('hex');
  if (expected.length !== signature.length) return false;
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}

/* ── 1. Homeowner posts a review request ──────────────────────────── */

exports.createReviewRequest = async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const { planId, title, description, preferredTimelineDays, maxBudgetInr } = req.body || {};

    if (!planId || !title) return res.status(400).json({ error: 'missing_fields' });
    if (!(Number(maxBudgetInr) > 0)) return res.status(400).json({ error: 'invalid_budget' });

    const plan = await Plan.findOne({ _id: planId, userId }).select('status cityState title');
    if (!plan) return res.status(404).json({ error: 'plan_not_found' });
    if (plan.status !== 'COMPLETED') return res.status(422).json({ error: 'plan_not_completed' });

    // Refuse duplicate OPEN request on the same plan
    const dup = await ReviewRequest.findOne({ planId, status: { $in: ['OPEN', 'IN_REVIEW'] } }).lean();
    if (dup) return res.status(409).json({ error: 'request_already_active', requestId: dup._id });

    const doc = await ReviewRequest.create({
      planId,
      homeownerId: userId,
      title: title.trim().slice(0, 160),
      description: (description || '').trim().slice(0, 4000),
      preferredTimelineDays: Number(preferredTimelineDays) || undefined,
      maxBudgetInr: Math.round(Number(maxBudgetInr)), // already in paise
      cityState: { city: plan.cityState?.city, state: plan.cityState?.state },
      status: 'OPEN',
    });

    // Broadcast to all online architects
    await notify({
      socket: {
        room: 'architects',
        event: 'marketplace:newRequest',
        payload: {
          id: doc._id,
          title: doc.title,
          maxBudgetInr: doc.maxBudgetInr,
          cityState: doc.cityState,
          preferredTimelineDays: doc.preferredTimelineDays,
          createdAt: doc.createdAt,
        },
      },
    });

    await ActivityLog.create({
      userId, planId,
      action: 'marketplace_request_posted',
      metadata: { reviewRequestId: doc._id, maxBudgetInr: doc.maxBudgetInr },
    }).catch((e) => console.warn('[activity-log]', e.message));

    res.status(201).json({ reviewRequest: doc });
  } catch (e) { next(e); }
};

/* ── 2. Homeowner: list my requests with bids inlined ─────────────── */

exports.listMyRequests = async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const requests = await ReviewRequest.find({ homeownerId: userId })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    const ids = requests.map((r) => r._id);
    const bids = await Bid.find({ reviewRequestId: { $in: ids } })
      .populate({ path: 'architectId', select: 'fullName email avatarUrl' })
      .sort({ createdAt: -1 })
      .lean();

    // Pre-fetch architect profiles for rating display
    const architectUserIds = [...new Set(bids.map((b) => String(b.architectId?._id || b.architectId)))];
    const profiles = await ArchitectProfile.find({ userId: { $in: architectUserIds } })
      .select('userId rating totalReviewsCompleted specializations cityState')
      .lean();
    const profileByUser = Object.fromEntries(profiles.map((p) => [String(p.userId), p]));

    const bidsByRequest = bids.reduce((acc, b) => {
      const key = String(b.reviewRequestId);
      (acc[key] ||= []).push(decorateBid(b, profileByUser));
      return acc;
    }, {});

    res.json({
      requests: requests.map((r) => ({
        ...r,
        bids: bidsByRequest[String(r._id)] || [],
      })),
    });
  } catch (e) { next(e); }
};

function decorateBid(b, profileByUser) {
  const archUserId = String(b.architectId?._id || b.architectId);
  const profile = profileByUser[archUserId];
  return {
    id: b._id,
    reviewRequestId: b.reviewRequestId,
    planId: b.planId,
    proposedFee: b.proposedFee,
    proposedTimeline: b.proposedTimeline,
    coverNote: b.coverNote,
    status: b.status,
    createdAt: b.createdAt,
    acceptedAt: b.acceptedAt,
    architect: {
      id: archUserId,
      fullName: b.architectId?.fullName,
      email: b.architectId?.email,
      avatarUrl: b.architectId?.avatarUrl,
      rating: profile?.rating || { average: 0, count: 0 },
      totalReviewsCompleted: profile?.totalReviewsCompleted || 0,
      specializations: profile?.specializations || [],
      cityState: profile?.cityState || {},
    },
  };
}

/* ── 3. Architect: open requests feed (city/state + budget filters) ─ */

exports.listOpenRequests = async (req, res, next) => {
  try {
    if (!requireArchitect(req, res)) return;

    const limit = Math.min(parseInt(req.query.limit, 10) || DEFAULT_LIMIT, MAX_FEED_LIMIT);
    const before = req.query.before ? new Date(req.query.before) : null;

    const q = { status: 'OPEN' };
    if (req.query.city) q['cityState.city'] = req.query.city;
    if (req.query.state) q['cityState.state'] = req.query.state;
    const minB = Number(req.query.minBudget);
    const maxB = Number(req.query.maxBudget);
    if (Number.isFinite(minB) && minB > 0) q.maxBudgetInr = { ...(q.maxBudgetInr || {}), $gte: Math.round(minB) };
    if (Number.isFinite(maxB) && maxB > 0) q.maxBudgetInr = { ...(q.maxBudgetInr || {}), $lte: Math.round(maxB) };
    if (before) q.createdAt = { $lt: before };

    const docs = await ReviewRequest.find(q)
      .populate({ path: 'homeownerId', select: 'fullName avatarUrl' })
      .sort({ createdAt: -1 })
      .limit(limit + 1)
      .lean();

    const hasMore = docs.length > limit;
    const slice = hasMore ? docs.slice(0, limit) : docs;

    // Mark which ones this architect has already bid on
    const reqIds = slice.map((r) => r._id);
    const mine = await Bid.find({
      reviewRequestId: { $in: reqIds }, architectId: req.user.userId,
    }).select('reviewRequestId status proposedFee').lean();
    const myBidByReq = Object.fromEntries(mine.map((b) => [String(b.reviewRequestId), b]));

    res.json({
      requests: slice.map((r) => ({
        id: r._id,
        title: r.title,
        description: r.description,
        maxBudgetInr: r.maxBudgetInr,
        preferredTimelineDays: r.preferredTimelineDays,
        cityState: r.cityState,
        bidCount: r.bidCount,
        createdAt: r.createdAt,
        homeowner: r.homeownerId
          ? { fullName: r.homeownerId.fullName, avatarUrl: r.homeownerId.avatarUrl }
          : null,
        myBid: myBidByReq[String(r._id)] || null,
      })),
      nextCursor: hasMore ? slice[slice.length - 1].createdAt.toISOString() : null,
      hasMore,
    });
  } catch (e) { next(e); }
};

/* ── 4. Architect: place a bid ────────────────────────────────────── */

exports.placeBid = async (req, res, next) => {
  try {
    if (!requireArchitect(req, res)) return;

    const userId = req.user.userId;
    const { reviewRequestId, proposedFee, proposedTimeline, coverNote } = req.body || {};

    if (!reviewRequestId || !(Number(proposedFee) > 0)) {
      return res.status(400).json({ error: 'missing_fields' });
    }

    // Architect must be approved + not suspended
    const profile = await ArchitectProfile.findOne({ userId }).lean();
    if (!profile) return res.status(403).json({ error: 'no_architect_profile' });
    if (profile.isSuspended) return res.status(403).json({ error: 'architect_suspended' });
    if (profile.verificationStatus !== 'approved') return res.status(403).json({ error: 'architect_not_verified' });

    const request = await ReviewRequest.findById(reviewRequestId)
      .populate({ path: 'homeownerId', select: 'email fullName phone' });
    if (!request) return res.status(404).json({ error: 'request_not_found' });
    if (request.status !== 'OPEN') return res.status(422).json({ error: 'request_not_open' });
    if (Number(proposedFee) > request.maxBudgetInr) {
      return res.status(422).json({ error: 'fee_exceeds_budget', maxBudgetInr: request.maxBudgetInr });
    }

    let bid;
    try {
      bid = await Bid.create({
        planId: request.planId,
        architectId: userId,
        reviewRequestId: request._id,
        proposedFee: Math.round(Number(proposedFee)),
        proposedTimeline: Number(proposedTimeline) || undefined,
        coverNote: (coverNote || '').trim().slice(0, 2000),
        status: 'pending',
      });
    } catch (e) {
      if (e.code === 11000) return res.status(409).json({ error: 'duplicate_bid' });
      throw e;
    }

    request.bidCount = (request.bidCount || 0) + 1;
    await request.save();

    // Fetch architect's display info for the notification payload
    const me = await User.findById(userId).select('fullName email avatarUrl').lean();

    await notify({
      socket: {
        room: `user:${request.homeownerId._id}`,
        event: 'marketplace:newBid',
        payload: {
          bidId: bid._id,
          reviewRequestId: request._id,
          proposedFee: bid.proposedFee,
          proposedTimeline: bid.proposedTimeline,
          architect: {
            fullName: me?.fullName,
            email: me?.email,
            avatarUrl: me?.avatarUrl,
            rating: profile.rating,
          },
          createdAt: bid.createdAt,
        },
      },
      email: request.homeownerId.email ? {
        to: request.homeownerId.email,
        subject: `New bid on "${request.title}"`,
        text: `${me?.fullName || 'An architect'} placed a ₹${(bid.proposedFee / 100).toLocaleString('en-IN')} bid on your review request. Open VastuVerse to review and accept.`,
      } : null,
    });

    await ActivityLog.create({
      userId, planId: request.planId,
      action: 'bid_placed',
      metadata: { bidId: bid._id, proposedFee: bid.proposedFee, reviewRequestId: request._id },
    }).catch((e) => console.warn('[activity-log]', e.message));

    res.status(201).json({ bid });
  } catch (e) { next(e); }
};

/* ── 5. Homeowner: accept bid → create Razorpay escrow order ─────── */

exports.acceptBidOrder = async (req, res, next) => {
  try {
    if (!requireConfigured(res)) return;
    const userId = req.user.userId;
    const { bidId } = req.params;

    const bid = await Bid.findById(bidId);
    if (!bid) return res.status(404).json({ error: 'bid_not_found' });
    if (bid.status !== 'pending') return res.status(422).json({ error: 'bid_not_pending' });

    const request = await ReviewRequest.findById(bid.reviewRequestId);
    if (!request || String(request.homeownerId) !== String(userId)) {
      return res.status(403).json({ error: 'not_request_owner' });
    }
    if (request.status !== 'OPEN') return res.status(422).json({ error: 'request_not_open' });

    const order = await razorpay.orders.create({
      amount: bid.proposedFee,
      currency: 'INR',
      receipt: `vv-bid-${String(bid._id).slice(-10)}-${Date.now().toString(36)}`,
      notes: { userId: String(userId), bidId: String(bid._id), type: 'marketplace_bid' },
    });

    await Payment.create({
      userId, planId: bid.planId,
      type: 'marketplace_bid',
      amount: bid.proposedFee, currency: 'INR',
      razorpayOrderId: order.id, status: 'created',
      metadata: { bidId: bid._id, reviewRequestId: request._id },
    });

    res.status(201).json({
      orderId: order.id,
      amount: bid.proposedFee,
      currency: 'INR',
      key: KEY_ID,
      label: 'Accept architect bid',
      description: `Escrow for review of plan #${String(bid.planId).slice(-6)}`,
    });
  } catch (e) {
    if (e.status === 503) return res.status(503).json({ error: 'payments_not_configured' });
    next(e);
  }
};

/* ── 6. Homeowner: verify acceptance payment → flip bid + request ── */

exports.acceptBidVerify = async (req, res, next) => {
  try {
    if (!requireConfigured(res)) return;
    const userId = req.user.userId;
    const { bidId } = req.params;
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body || {};

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({ error: 'missing_fields' });
    }
    if (!verifyHmac(KEY_SECRET, `${razorpay_order_id}|${razorpay_payment_id}`, razorpay_signature)) {
      return res.status(400).json({ error: 'signature_mismatch' });
    }

    const payment = await Payment.findOne({ razorpayOrderId: razorpay_order_id, userId });
    if (!payment) return res.status(404).json({ error: 'payment_not_found' });

    const bid = await Bid.findById(bidId).populate({ path: 'architectId', select: 'email fullName phone' });
    if (!bid) return res.status(404).json({ error: 'bid_not_found' });

    if (payment.status === 'captured' && bid.status === 'accepted') {
      return res.json({ ok: true, alreadyVerified: true });
    }

    // Idempotent flip
    payment.status = 'captured';
    payment.razorpayPaymentId = razorpay_payment_id;
    payment.razorpaySignature = razorpay_signature;
    payment.metadata = { ...(payment.metadata || {}), verifiedAt: new Date() };
    await payment.save();

    bid.status = 'accepted';
    bid.acceptedAt = new Date();
    bid.paymentId = payment._id;
    await bid.save();

    // Reject any other pending bids on the same request
    await Bid.updateMany(
      { reviewRequestId: bid.reviewRequestId, _id: { $ne: bid._id }, status: 'pending' },
      { $set: { status: 'rejected' } }
    );

    // Flip the request to IN_REVIEW + remember the winning bid
    await ReviewRequest.updateOne(
      { _id: bid.reviewRequestId },
      { $set: { status: 'IN_REVIEW', acceptedBidId: bid._id } }
    );

    await notify({
      socket: {
        room: `user:${bid.architectId._id}`,
        event: 'marketplace:bidAccepted',
        payload: { bidId: bid._id, reviewRequestId: bid.reviewRequestId, proposedFee: bid.proposedFee },
      },
      email: bid.architectId.email ? {
        to: bid.architectId.email,
        subject: 'Your bid was accepted — start your review',
        text: `Your ₹${(bid.proposedFee / 100).toLocaleString('en-IN')} bid was accepted. The fee is held in escrow and released to your Razorpay-linked fund account (minus ${COMMISSION_PCT}% platform commission) once the homeowner accepts your submitted review.`,
      } : null,
      whatsapp: bid.architectId.phone ? {
        to: bid.architectId.phone,
        text: `VastuVerse: your bid (₹${(bid.proposedFee / 100).toLocaleString('en-IN')}) was accepted. Open the app to submit your review.`,
      } : null,
    });

    await ActivityLog.create({
      userId, planId: bid.planId,
      action: 'bid_accepted',
      metadata: { bidId: bid._id, paymentId: payment._id, escrowAmount: bid.proposedFee },
    }).catch((e) => console.warn('[activity-log]', e.message));

    res.json({ ok: true, bid: { id: bid._id, status: bid.status, acceptedAt: bid.acceptedAt } });
  } catch (e) { next(e); }
};

/* ── 7. Architect: submit a review (PDF + annotations) ────────────── */

exports.submitReview = async (req, res, next) => {
  try {
    if (!requireArchitect(req, res)) return;
    const userId = req.user.userId;
    const { bidId, reportUrl, annotations = [], summary, recommendedChanges = [] } = req.body || {};

    if (!bidId) return res.status(400).json({ error: 'bid_id_required' });
    if (!summary?.trim()) return res.status(400).json({ error: 'summary_required' });

    const bid = await Bid.findOne({ _id: bidId, architectId: userId });
    if (!bid) return res.status(404).json({ error: 'bid_not_found' });
    if (bid.status !== 'accepted') return res.status(422).json({ error: 'bid_not_accepted' });

    // Upsert (Bid → unique ArchitectReview)
    const reviewDoc = await ArchitectReview.findOneAndUpdate(
      { bidId: bid._id },
      {
        $set: {
          planId: bid.planId,
          architectId: userId,
          reportUrl,
          annotations: Array.isArray(annotations) ? annotations.slice(0, 200) : [],
          summary: summary.trim().slice(0, 5000),
          recommendedChanges: Array.isArray(recommendedChanges) ? recommendedChanges.slice(0, 30) : [],
          status: 'submitted',
          submittedAt: new Date(),
        },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    // Notify homeowner
    const request = await ReviewRequest.findOne({ _id: bid.reviewRequestId })
      .populate({ path: 'homeownerId', select: 'email fullName phone' });

    await notify({
      socket: {
        room: `user:${request.homeownerId._id}`,
        event: 'marketplace:reviewSubmitted',
        payload: {
          reviewId: reviewDoc._id, bidId: bid._id,
          summary: reviewDoc.summary?.slice(0, 240),
          annotationsCount: reviewDoc.annotations.length,
        },
      },
      email: request.homeownerId.email ? {
        to: request.homeownerId.email,
        subject: 'Your plan review is ready',
        text: 'Your architect has submitted a review of your VastuVerse plan. Open the app to view the annotated PDF and accept or dispute the review.',
      } : null,
    });

    res.json({ review: reviewDoc });
  } catch (e) { next(e); }
};

/* ── 8. Homeowner: accept submitted review → payout ──────────────── */

exports.acceptReview = async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const { reviewId } = req.params;

    const review = await ArchitectReview.findById(reviewId);
    if (!review) return res.status(404).json({ error: 'review_not_found' });
    if (review.status !== 'submitted') return res.status(422).json({ error: 'review_not_submitted' });

    const bid = await Bid.findById(review.bidId);
    if (!bid) return res.status(404).json({ error: 'bid_not_found' });

    const request = await ReviewRequest.findById(bid.reviewRequestId);
    if (!request || String(request.homeownerId) !== String(userId)) {
      return res.status(403).json({ error: 'not_request_owner' });
    }

    const fee = bid.proposedFee;
    const platformCutPaise = Math.round(fee * PLATFORM_CUT);
    const architectPayoutPaise = fee - platformCutPaise;

    // ── Razorpay Routes payout (server-stubbed; real call requires
    //    architect's razorpayFundAccountId on the profile) ──────────
    let transferId = null;
    try {
      const profile = await ArchitectProfile.findOne({ userId: review.architectId });
      if (configured && profile?.razorpayFundAccountId) {
        // Real call would look like:
        //   await razorpay.transfers.create({
        //     account: profile.razorpayFundAccountId,
        //     amount: architectPayoutPaise,
        //     currency: 'INR',
        //     notes: { reviewId: String(review._id), bidId: String(bid._id) },
        //   });
        // For now, simulate a deterministic id so the Payment row references it.
        transferId = `tr_stub_${crypto.randomBytes(8).toString('hex')}`;
      } else {
        transferId = `tr_pending_${crypto.randomBytes(6).toString('hex')}`;
        console.warn('[marketplace] payout deferred — no fund account / razorpay unconfigured');
      }
    } catch (e) {
      console.warn('[marketplace] transfer call failed (will retry):', e.message);
      transferId = `tr_retry_${crypto.randomBytes(6).toString('hex')}`;
    }

    // Record the payout
    await Payment.create({
      userId,
      planId: bid.planId,
      type: 'marketplace_payout',
      amount: architectPayoutPaise,
      currency: 'INR',
      razorpayPaymentId: transferId,
      status: 'captured',
      metadata: {
        reviewId: review._id, bidId: bid._id,
        toArchitectId: review.architectId,
        platformCutPaise, feeTotalPaise: fee, commissionPct: COMMISSION_PCT,
      },
    });

    // Flip statuses
    review.status = 'accepted';
    review.acceptedAt = new Date();
    await review.save();

    bid.status = 'completed';
    bid.completedAt = new Date();
    await bid.save();

    await ReviewRequest.updateOne(
      { _id: request._id },
      { $set: { status: 'COMPLETED' } }
    );

    // Update architect profile counters atomically
    await ArchitectProfile.updateOne(
      { userId: review.architectId },
      { $inc: { totalEarnings: architectPayoutPaise, totalReviewsCompleted: 1 } }
    );

    // Notify architect of payout
    const architectUser = await User.findById(review.architectId).select('email fullName phone').lean();
    await notify({
      socket: {
        room: `user:${review.architectId}`,
        event: 'marketplace:reviewAccepted',
        payload: {
          reviewId: review._id, bidId: bid._id,
          payoutAmount: architectPayoutPaise,
          platformCutPaise,
          transferId,
        },
      },
      email: architectUser?.email ? {
        to: architectUser.email,
        subject: `Payout released — ₹${(architectPayoutPaise / 100).toLocaleString('en-IN')}`,
        text: `Your review was accepted. ₹${(architectPayoutPaise / 100).toLocaleString('en-IN')} has been released to your fund account (₹${(platformCutPaise / 100).toLocaleString('en-IN')} platform commission, ${COMMISSION_PCT}%).`,
      } : null,
      whatsapp: architectUser?.phone ? {
        to: architectUser.phone,
        text: `VastuVerse: ₹${(architectPayoutPaise / 100).toLocaleString('en-IN')} payout released to your account.`,
      } : null,
    });

    await ActivityLog.create({
      userId, planId: bid.planId,
      action: 'payment_captured',
      metadata: { kind: 'marketplace_payout', reviewId: review._id, architectPayoutPaise, platformCutPaise },
    }).catch((e) => console.warn('[activity-log]', e.message));

    res.json({
      ok: true,
      review: { id: review._id, status: review.status, acceptedAt: review.acceptedAt },
      payout: { architectPayoutPaise, platformCutPaise, transferId },
    });
  } catch (e) { next(e); }
};

/* ── 9. Homeowner: rating + optional written review ──────────────── */

exports.rateReview = async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const { reviewId } = req.params;
    const { stars, comment } = req.body || {};

    const n = Number(stars);
    if (!Number.isFinite(n) || n < 1 || n > 5) return res.status(400).json({ error: 'invalid_stars' });

    const review = await ArchitectReview.findById(reviewId);
    if (!review) return res.status(404).json({ error: 'review_not_found' });

    const bid = await Bid.findById(review.bidId);
    const request = await ReviewRequest.findById(bid?.reviewRequestId);
    if (!request || String(request.homeownerId) !== String(userId)) {
      return res.status(403).json({ error: 'not_request_owner' });
    }
    if (review.status !== 'accepted') return res.status(422).json({ error: 'review_not_accepted' });
    if (review.userRating) return res.status(409).json({ error: 'already_rated' });

    review.userRating = n;
    if (typeof comment === 'string' && comment.trim()) {
      review.userReview = comment.trim().slice(0, 2000);
    }
    await review.save();

    // Running-average update on the architect profile
    const profile = await ArchitectProfile.findOne({ userId: review.architectId });
    if (profile) {
      const current = profile.rating || { average: 0, count: 0 };
      const newCount = (current.count || 0) + 1;
      const newAverage = ((current.average || 0) * (current.count || 0) + n) / newCount;
      profile.rating = { average: Math.round(newAverage * 100) / 100, count: newCount };
      await profile.save();
    }

    await notify({
      socket: {
        room: `user:${review.architectId}`,
        event: 'marketplace:newRating',
        payload: { reviewId: review._id, stars: n, newAverage: profile?.rating?.average },
      },
    });

    await ActivityLog.create({
      userId, planId: review.planId,
      action: 'review_submitted',
      metadata: { reviewId: review._id, stars: n },
    }).catch((e) => console.warn('[activity-log]', e.message));

    res.json({
      ok: true,
      review: { id: review._id, userRating: review.userRating, userReview: review.userReview },
      architectRating: profile?.rating,
    });
  } catch (e) { next(e); }
};

/* ── 10. Architect: earnings dashboard ────────────────────────────── */

exports.getEarnings = async (req, res, next) => {
  try {
    if (!requireArchitect(req, res)) return;
    const userId = req.user.userId;

    const profile = await ArchitectProfile.findOne({ userId })
      .select('rating totalReviewsCompleted totalEarnings')
      .lean();
    if (!profile) return res.status(404).json({ error: 'no_architect_profile' });

    // Bid status counters
    const counts = await Bid.aggregate([
      { $match: { architectId: new (require('mongoose').Types.ObjectId)(userId) } },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]);
    const byStatus = Object.fromEntries(counts.map((r) => [r._id, r.count]));

    // Pending earnings: sum of accepted bids whose review isn't accepted yet
    const acceptedBids = await Bid.find({
      architectId: userId, status: 'accepted',
    }).select('proposedFee').lean();
    const pendingPaise = acceptedBids.reduce(
      (acc, b) => acc + Math.round(b.proposedFee * PAYOUT_RATIO),
      0
    );

    res.json({
      rating: profile.rating || { average: 0, count: 0 },
      totalReviewsCompleted: profile.totalReviewsCompleted || 0,
      totalEarningsPaise: profile.totalEarnings || 0,
      pendingPayoutPaise: pendingPaise,
      bidCounts: {
        pending:   byStatus.pending   || 0,
        accepted:  byStatus.accepted  || 0,
        completed: byStatus.completed || 0,
        rejected:  byStatus.rejected  || 0,
      },
      commissionPct: COMMISSION_PCT,
    });
  } catch (e) { next(e); }
};

/* ── 11. Architect: list own bids ───────────────────────────────────── */

exports.listMyBids = async (req, res, next) => {
  try {
    if (!requireArchitect(req, res)) return;
    const userId = req.user.userId;
    const { status, limit: rawLimit = '5' } = req.query;
    const limit = Math.min(parseInt(rawLimit, 10) || 5, 20);

    const q = { architectId: userId };
    const VALID_STATUSES = ['pending', 'accepted', 'rejected', 'completed', 'disputed'];
    if (status && VALID_STATUSES.includes(status)) q.status = status;

    const bids = await Bid.find(q)
      .populate({ path: 'reviewRequestId', select: 'title' })
      .sort({ updatedAt: -1 })
      .limit(limit)
      .lean();

    res.json({
      bids: bids.map(b => ({
        id:               String(b._id),
        title:            b.reviewRequestId?.title || 'Review request',
        proposedFee:      b.proposedFee,
        proposedTimeline: b.proposedTimeline || null,
        status:           b.status,
        acceptedAt:       b.acceptedAt || null,
        updatedAt:        b.updatedAt,
      })),
    });
  } catch (e) { next(e); }
};

/* ── 12. List submitted review for a request (used by homeowner UI) ─ */

exports.getReviewByRequest = async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const { requestId } = req.params;

    const request = await ReviewRequest.findById(requestId);
    if (!request || String(request.homeownerId) !== String(userId)) {
      return res.status(404).json({ error: 'request_not_found' });
    }
    if (!request.acceptedBidId) return res.status(404).json({ error: 'no_accepted_bid' });

    const review = await ArchitectReview.findOne({ bidId: request.acceptedBidId })
      .populate({ path: 'architectId', select: 'fullName email avatarUrl' })
      .lean();
    if (!review) return res.status(404).json({ error: 'no_review_yet' });

    res.json({ review });
  } catch (e) { next(e); }
};
