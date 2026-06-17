/**
 * Admin user management.
 *
 *   GET  /admin/users                                 (paginated, filter by role/tier/search)
 *   PUT  /admin/users/:userId                         (role/tier/isActive)
 *   POST /admin/users/:userId/grant-tier              (manual tier grant w/ reason)
 *
 *   GET  /admin/architect-verifications               (pending architect profiles + portfolio)
 *   PUT  /admin/architects/:userId/verify             (approve/reject with reason)
 */

const User = require('../../models/User');
const Subscription = require('../../models/Subscription');
const ArchitectProfile = require('../../models/ArchitectProfile');
const ActivityLog = require('../../models/ActivityLog');
const Notification = require('../../models/Notification');
const { notify } = require('../../services/notifications');

async function pushNotif(userId, { event, title, body, actionUrl, data }) {
  try {
    const doc = await Notification.create({
      userId, event, title,
      body: body || '',
      actionUrl: actionUrl || null,
      data: data || {},
    });
    await notify({
      socket: {
        room: `user:${userId}`,
        event: 'notification',
        payload: {
          id: doc._id,
          event: doc.event,
          title: doc.title,
          body: doc.body,
          actionUrl: doc.actionUrl,
          data: doc.data,
          read: false,
          createdAt: doc.createdAt,
        },
      },
    });
  } catch (e) {
    console.warn('[admin] pushNotif failed:', e.message);
  }
}

const PAGE_DEFAULT = 25;
const PAGE_MAX = 100;

/* ── 1. Users list ─────────────────────────────────────────────────── */

exports.listUsers = async (req, res, next) => {
  try {
    const page  = Math.max(parseInt(req.query.page, 10) || 0, 0);
    const limit = Math.min(parseInt(req.query.limit, 10) || PAGE_DEFAULT, PAGE_MAX);

    const q = {};
    if (req.query.role && ['homeowner', 'developer', 'architect', 'admin'].includes(req.query.role)) {
      q.role = req.query.role;
    }
    if (req.query.tier && ['FREE', 'BASIC', 'PRO', 'ENTERPRISE'].includes(req.query.tier)) {
      q.subscriptionTier = req.query.tier;
    }
    if (req.query.isActive !== undefined) {
      q.isActive = req.query.isActive === 'true';
    }
    if (req.query.search) {
      const re = new RegExp(String(req.query.search).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      q.$or = [{ email: re }, { fullName: re }];
    }

    const [rows, total] = await Promise.all([
      User.find(q)
        .select('email fullName role subscriptionTier isActive createdAt avatarUrl phone preferredLanguage')
        .sort({ createdAt: -1 })
        .skip(page * limit)
        .limit(limit)
        .lean(),
      User.countDocuments(q),
    ]);

    res.json({ rows, total, page, limit });
  } catch (e) { next(e); }
};

/* ── 2. Update user role / tier / active ──────────────────────────── */

exports.updateUser = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const { role, tier, isActive } = req.body || {};

    const set = {};
    if (role !== undefined) {
      if (!['homeowner', 'developer', 'architect', 'admin'].includes(role)) {
        return res.status(400).json({ error: 'invalid_role' });
      }
      set.role = role;
    }
    if (tier !== undefined) {
      if (!['FREE', 'BASIC', 'PRO', 'ENTERPRISE'].includes(tier)) {
        return res.status(400).json({ error: 'invalid_tier' });
      }
      set.subscriptionTier = tier;
    }
    if (isActive !== undefined) set.isActive = !!isActive;

    if (Object.keys(set).length === 0) {
      return res.status(400).json({ error: 'nothing_to_update' });
    }

    // Guard: prevent admin demoting the last remaining admin
    if (set.role && set.role !== 'admin') {
      const target = await User.findById(userId).select('role').lean();
      if (target?.role === 'admin') {
        const adminCount = await User.countDocuments({ role: 'admin', isActive: true });
        if (adminCount <= 1) return res.status(409).json({ error: 'cannot_demote_last_admin' });
      }
    }

    const before = await User.findById(userId).select('role subscriptionTier').lean();
    const updated = await User.findByIdAndUpdate(
      userId, { $set: set }, { new: true, runValidators: true }
    ).select('email fullName role subscriptionTier isActive');
    if (!updated) return res.status(404).json({ error: 'user_not_found' });

    // Mirror tier change to Subscription doc if present
    if (set.tier !== undefined) {
      await Subscription.findOneAndUpdate(
        { userId },
        { $set: { tier: set.tier } },
        { upsert: true, setDefaultsOnInsert: true }
      ).catch(() => null);
    }

    await ActivityLog.create({
      userId: req.user.userId,
      action: 'subscription_changed',
      metadata: { adminEditedUserId: userId, changes: set },
    }).catch(() => null);

    if (set.subscriptionTier && before?.subscriptionTier !== set.subscriptionTier) {
      pushNotif(userId, {
        event: 'subscription_changed',
        title: `Your plan has been updated to ${set.subscriptionTier}`,
        body: 'An administrator has updated your subscription plan.',
        actionUrl: '/profile',
        data: { tier: set.subscriptionTier },
      }).catch(() => null);
    }
    if (set.role && before?.role !== set.role) {
      pushNotif(userId, {
        event: 'role_changed',
        title: 'Your account role has been updated',
        body: `Your role has been changed to ${set.role} by an administrator.`,
        actionUrl: '/dashboard',
        data: { role: set.role },
      }).catch(() => null);
    }

    res.json({ user: updated });
  } catch (e) { next(e); }
};

/* ── 3. Grant tier (manual override w/ reason) ────────────────────── */

exports.grantTier = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const { tier, reason } = req.body || {};
    if (!['FREE', 'BASIC', 'PRO', 'ENTERPRISE'].includes(tier)) {
      return res.status(400).json({ error: 'invalid_tier' });
    }

    await User.updateOne({ _id: userId }, { $set: { subscriptionTier: tier } });

    const sub = await Subscription.findOneAndUpdate(
      { userId },
      {
        $set: {
          tier,
          status: 'active',
          adminOverride: {
            isOverride: true, grantedBy: req.user.userId,
            reason: String(reason || '').trim().slice(0, 500),
          },
        },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    await ActivityLog.create({
      userId: req.user.userId,
      action: 'subscription_changed',
      metadata: { adminEditedUserId: userId, grantedTier: tier, reason },
    }).catch(() => null);

    const grantedUser = await User.findById(userId).select('email fullName').lean();
    pushNotif(userId, {
      event: 'subscription_changed',
      title: `Your plan has been upgraded to ${tier}!`,
      body: reason ? `"${reason}" — VastuVerse Team` : 'Enjoy your new plan benefits.',
      actionUrl: '/profile',
      data: { tier, reason },
    }).catch(() => null);
    if (grantedUser?.email) {
      notify({
        email: {
          to: grantedUser.email,
          subject: `Your VastuVerse plan has been upgraded to ${tier}`,
          text: `Hi ${grantedUser.fullName || 'there'},\n\nYour account has been upgraded to the ${tier} plan.${reason ? `\nReason: "${reason}"` : ''}\n\nLog in to explore your new features.\n\nThe VastuVerse Team`,
        },
      }).catch(() => null);
    }

    res.json({ ok: true, tier, subscription: sub });
  } catch (e) { next(e); }
};

/* ── 4. Architect verification queue ──────────────────────────────── */

exports.listArchitectVerifications = async (req, res, next) => {
  try {
    const status = req.query.status || 'pending';
    if (!['pending', 'approved', 'rejected'].includes(status)) {
      return res.status(400).json({ error: 'invalid_status' });
    }
    const profiles = await ArchitectProfile.find({ verificationStatus: status })
      .populate('userId', 'fullName email avatarUrl phone createdAt')
      .sort({ createdAt: status === 'pending' ? 1 : -1 })   // pending: oldest first (FIFO queue)
      .limit(100)
      .lean();

    res.json({
      profiles: profiles.map((p) => ({
        id: p._id,
        userId: p.userId?._id,
        coaRegistrationNo: p.coaRegistrationNo,
        yearsExperience: p.yearsExperience,
        portfolioUrls: p.portfolioUrls || [],
        certifications: p.certifications || [],
        specializations: p.specializations || [],
        cityState: p.cityState,
        verificationStatus: p.verificationStatus,
        rejectionReason: p.rejectionReason,
        isSuspended: p.isSuspended,
        rating: p.rating,
        totalReviewsCompleted: p.totalReviewsCompleted,
        createdAt: p.createdAt,
        user: p.userId,
      })),
    });
  } catch (e) { next(e); }
};

exports.verifyArchitect = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const { decision, rejectionReason } = req.body || {};
    if (!['approve', 'reject'].includes(decision)) {
      return res.status(400).json({ error: 'invalid_decision' });
    }

    const set = {
      verificationStatus: decision === 'approve' ? 'approved' : 'rejected',
      verifiedBy: req.user.userId,
      verifiedAt: new Date(),
      rejectionReason: decision === 'reject' ? String(rejectionReason || '').trim().slice(0, 500) : null,
    };

    const profile = await ArchitectProfile.findOneAndUpdate(
      { userId }, { $set: set }, { new: true }
    );
    if (!profile) return res.status(404).json({ error: 'profile_not_found' });

    const verifiedUser = await User.findById(userId).select('email fullName').lean();
    if (decision === 'approve') {
      pushNotif(userId, {
        event: 'architect_approved',
        title: 'Your architect profile has been approved!',
        body: 'You can now receive bid requests from homeowners on the marketplace.',
        actionUrl: '/architect',
      }).catch(() => null);
      if (verifiedUser?.email) {
        notify({
          email: {
            to: verifiedUser.email,
            subject: 'Your VastuVerse architect profile is approved',
            text: `Hi ${verifiedUser.fullName || 'there'},\n\nYour architect profile has been verified and approved.\n\nYou can now browse homeowner bid requests from your marketplace dashboard.\n\nThe VastuVerse Team`,
          },
        }).catch(() => null);
      }
    } else {
      pushNotif(userId, {
        event: 'architect_rejected',
        title: 'Your architect profile was not approved',
        body: rejectionReason || 'Please update your profile and reapply.',
        actionUrl: '/profile',
        data: { reason: rejectionReason },
      }).catch(() => null);
      if (verifiedUser?.email) {
        notify({
          email: {
            to: verifiedUser.email,
            subject: 'Update needed on your VastuVerse architect profile',
            text: `Hi ${verifiedUser.fullName || 'there'},\n\nYour architect profile was not approved at this time.\n\nFeedback: ${rejectionReason || 'No specific reason provided.'}\n\nPlease update your profile and resubmit for review.\n\nThe VastuVerse Team`,
          },
        }).catch(() => null);
      }
    }

    res.json({ ok: true, profile });
  } catch (e) { next(e); }
};

exports.suspendArchitect = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const { suspend, reason } = req.body || {};
    const profile = await ArchitectProfile.findOneAndUpdate(
      { userId },
      { $set: { isSuspended: !!suspend, suspensionReason: suspend ? String(reason || '').slice(0, 500) : undefined } },
      { new: true }
    );
    if (!profile) return res.status(404).json({ error: 'profile_not_found' });

    pushNotif(userId, suspend ? {
      event: 'architect_suspended',
      title: 'Your architect account has been suspended',
      body: reason || 'Contact support to appeal this decision.',
      data: { reason },
    } : {
      event: 'architect_approved',
      title: 'Your architect account has been reinstated',
      body: 'Your profile is active again on the VastuVerse marketplace.',
      actionUrl: '/architect',
    }).catch(() => null);

    res.json({ ok: true, isSuspended: profile.isSuspended });
  } catch (e) { next(e); }
};
