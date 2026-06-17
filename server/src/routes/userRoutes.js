/**
 * User self-service routes.
 *
 *   PUT /api/v1/users/me   update fullName, phone, preferredLanguage,
 *                          avatarUrl, notificationPreferences
 */

const express = require('express');
const router = express.Router();

const { authenticateToken } = require('../middlewares/auth');
const User             = require('../models/User');
const Plan             = require('../models/Plan');
const PlanVersion      = require('../models/PlanVersion');
const Subscription     = require('../models/Subscription');
const ArchitectProfile = require('../models/ArchitectProfile');
const ArchitectReview  = require('../models/ArchitectReview');
const ReviewRequest    = require('../models/ReviewRequest');
const Bid              = require('../models/Bid');
const Payment          = require('../models/Payment');
const Collaborator     = require('../models/Collaborator');
const Comment          = require('../models/Comment');
const ContractorLink   = require('../models/ContractorLink');
const Notification     = require('../models/Notification');
const ActivityLog      = require('../models/ActivityLog');
const FeatureFlag      = require('../models/FeatureFlag');
const Project          = require('../models/Project');
const authService      = require('../services/authService');
const { uploadMiddleware, completeOnboarding } = require('../controllers/onboardingController');

router.use(authenticateToken);

const ALLOWED_LANGS = ['en', 'hi', 'bn', 'ta', 'te', 'mr', 'gu', 'kn'];
const ME_SELECT = 'email fullName phone avatarUrl role subscriptionTier preferredLanguage notificationPreferences cityState authProvider onboardingComplete gender dateOfBirth address createdAt';

router.post('/onboarding', uploadMiddleware, completeOnboarding);

router.get('/me', async (req, res, next) => {
  try {
    const user = await User.findById(req.user.userId).select(ME_SELECT);
    if (!user) return res.status(404).json({ error: 'user_not_found' });
    res.json({ user });
  } catch (e) { next(e); }
});

router.put('/me', async (req, res, next) => {
  try {
    const set = {};

    if (typeof req.body.fullName === 'string') {
      set.fullName = req.body.fullName.trim().slice(0, 120);
    }
    if (typeof req.body.phone === 'string') {
      set.phone = req.body.phone.trim().slice(0, 20);
    }
    if (typeof req.body.avatarUrl === 'string') {
      set.avatarUrl = req.body.avatarUrl.trim().slice(0, 500);
    }
    if (typeof req.body.preferredLanguage === 'string'
        && ALLOWED_LANGS.includes(req.body.preferredLanguage)) {
      set.preferredLanguage = req.body.preferredLanguage;
    }
    if (req.body.notificationPreferences && typeof req.body.notificationPreferences === 'object') {
      // Shallow merge — admin should never pass through the full doc
      set.notificationPreferences = req.body.notificationPreferences;
    }
    const ALLOWED_GENDERS = ['male', 'female', 'other', 'prefer_not_to_say'];
    if (req.body.gender === null || ALLOWED_GENDERS.includes(req.body.gender)) {
      set.gender = req.body.gender ?? null;
    }
    if (req.body.dateOfBirth !== undefined) {
      const d = req.body.dateOfBirth ? new Date(req.body.dateOfBirth) : null;
      if (d === null || !isNaN(d.getTime())) set.dateOfBirth = d;
    }
    if (req.body.address && typeof req.body.address === 'object') {
      const a = req.body.address;
      const addr = {};
      if (typeof a.line1   === 'string') addr.line1   = a.line1.trim().slice(0, 200);
      if (typeof a.line2   === 'string') addr.line2   = a.line2.trim().slice(0, 200);
      if (typeof a.city    === 'string') addr.city    = a.city.trim().slice(0, 100);
      if (typeof a.state   === 'string') addr.state   = a.state.trim().slice(0, 100);
      if (typeof a.pincode === 'string') addr.pincode = a.pincode.trim().slice(0, 10);
      if (typeof a.country === 'string') addr.country = a.country.trim().slice(0, 100);
      if (Object.keys(addr).length > 0) set.address = addr;
    }

    if (Object.keys(set).length === 0) {
      return res.status(400).json({ error: 'nothing_to_update' });
    }

    const updated = await User.findByIdAndUpdate(
      req.user.userId, { $set: set },
      { new: true, runValidators: true }
    ).select(ME_SELECT);

    if (!updated) return res.status(404).json({ error: 'user_not_found' });
    res.json({ user: updated });
  } catch (e) { next(e); }
});

router.delete('/me', async (req, res, next) => {
  try {
    const userId = req.user.userId;

    // 1. Load user and verify typed-email confirmation
    const user = await User.findById(userId).select('email role');
    if (!user) return res.status(404).json({ error: 'user_not_found' });

    const typedEmail = String(req.body.email || '').toLowerCase().trim();
    if (!typedEmail || typedEmail !== user.email) {
      return res.status(400).json({ error: 'email_mismatch' });
    }

    // 2. Guard: prevent deleting the last admin account
    if (user.role === 'admin') {
      const adminCount = await User.countDocuments({ role: 'admin', isActive: true });
      if (adminCount <= 1) {
        return res.status(409).json({ error: 'cannot_delete_last_admin' });
      }
    }

    // 3. Cascade delete — collect plan IDs first so PlanVersions can be removed
    const planIds = (await Plan.find({ userId }).select('_id').lean()).map(p => p._id);

    await Promise.all([
      ActivityLog.deleteMany({ userId }),
      Notification.deleteMany({ userId }),
      FeatureFlag.deleteMany({ userId }),
      Comment.deleteMany({ userId }),
      Collaborator.deleteMany({ $or: [{ userId }, { invitedBy: userId }] }),
      Bid.deleteMany({ architectId: userId }),
      ArchitectReview.deleteMany({ architectId: userId }),
      ReviewRequest.deleteMany({ homeownerId: userId }),
      ContractorLink.deleteMany({ createdBy: userId }),
      Project.deleteMany({ $or: [{ userId }, { developerId: userId }] }),
      Subscription.deleteMany({ userId }),
      ArchitectProfile.deleteOne({ userId }),
      Payment.deleteMany({ userId }),
      ...(planIds.length ? [PlanVersion.deleteMany({ planId: { $in: planIds } })] : []),
    ]);

    await Plan.deleteMany({ userId });

    // 4. Revoke refresh token, delete user doc
    await authService.revokeRefreshToken(userId).catch(() => null);
    await User.deleteOne({ _id: userId });

    // 5. Clear session cookie and respond
    const isProd = process.env.NODE_ENV === 'production';
    res.clearCookie('vv_refresh', { httpOnly: true, secure: isProd, sameSite: 'strict', path: '/' });
    res.json({ ok: true });
  } catch (e) { next(e); }
});

module.exports = router;
