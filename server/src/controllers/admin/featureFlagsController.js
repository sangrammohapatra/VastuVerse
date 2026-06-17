/**
 * Feature flags admin.
 *
 *   GET  /admin/feature-flags                              (list all)
 *   PUT  /admin/feature-flags                              ({ featureName, enabledForTiers[], globalOverride, description })
 *   POST /admin/feature-flags/:featureName/user-override   ({ userId, enabled })
 *   DELETE /admin/feature-flags/:featureName/user-override ({ userId })
 *
 *   GET  /admin/users/search?q=...                         (helper for user-override autocomplete)
 */

const FeatureFlag = require('../../models/FeatureFlag');
const User = require('../../models/User');

const TIERS = ['FREE', 'BASIC', 'PRO', 'ENTERPRISE'];

exports.listFlags = async (req, res, next) => {
  try {
    const flags = await FeatureFlag.find({})
      .populate({ path: 'userOverrides.userId', select: 'email fullName' })
      .populate({ path: 'userOverrides.grantedBy', select: 'email fullName' })
      .sort({ featureName: 1 })
      .lean();

    res.json({
      flags: flags.map((f) => ({
        ...f,
        userOverrides: (f.userOverrides || []).map((o) => ({
          enabled: o.enabled,
          user: o.userId ? { id: o.userId._id, email: o.userId.email, fullName: o.userId.fullName } : null,
          grantedBy: o.grantedBy
            ? { id: o.grantedBy._id, email: o.grantedBy.email, fullName: o.grantedBy.fullName }
            : null,
        })),
      })),
    });
  } catch (e) { next(e); }
};

exports.upsertFlag = async (req, res, next) => {
  try {
    const { featureName, enabledForTiers, globalOverride, description } = req.body || {};
    if (!featureName || typeof featureName !== 'string') {
      return res.status(400).json({ error: 'featureName_required' });
    }

    const set = { featureName: featureName.trim() };
    if (Array.isArray(enabledForTiers)) {
      set.enabledForTiers = enabledForTiers.filter((t) => TIERS.includes(t));
    }
    if (typeof globalOverride === 'boolean') set.globalOverride = globalOverride;
    if (typeof description === 'string')     set.description = description.trim().slice(0, 500);

    const flag = await FeatureFlag.findOneAndUpdate(
      { featureName: set.featureName },
      { $set: set },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );
    res.json({ flag });
  } catch (e) { next(e); }
};

exports.setUserOverride = async (req, res, next) => {
  try {
    const { featureName } = req.params;
    const { userId, enabled } = req.body || {};
    if (!userId || typeof enabled !== 'boolean') {
      return res.status(400).json({ error: 'userId_and_enabled_required' });
    }
    const userExists = await User.exists({ _id: userId });
    if (!userExists) return res.status(404).json({ error: 'user_not_found' });

    // Upsert behaviour: replace existing override for this user (no duplicates)
    const flag = await FeatureFlag.findOne({ featureName });
    if (!flag) return res.status(404).json({ error: 'flag_not_found' });

    const existingIdx = (flag.userOverrides || []).findIndex(
      (o) => String(o.userId) === String(userId)
    );
    if (existingIdx >= 0) {
      flag.userOverrides[existingIdx].enabled = enabled;
      flag.userOverrides[existingIdx].grantedBy = req.user.userId;
    } else {
      flag.userOverrides.push({ userId, enabled, grantedBy: req.user.userId });
    }
    await flag.save();
    res.json({ ok: true });
  } catch (e) { next(e); }
};

exports.removeUserOverride = async (req, res, next) => {
  try {
    const { featureName } = req.params;
    const { userId } = req.body || {};
    if (!userId) return res.status(400).json({ error: 'userId_required' });

    const flag = await FeatureFlag.findOneAndUpdate(
      { featureName },
      { $pull: { userOverrides: { userId } } },
      { new: true }
    );
    if (!flag) return res.status(404).json({ error: 'flag_not_found' });
    res.json({ ok: true });
  } catch (e) { next(e); }
};

/* ── Quick user search for the override autocomplete ─────────────── */

exports.searchUsers = async (req, res, next) => {
  try {
    const q = String(req.query.q || '').trim();
    if (q.length < 2) return res.json({ users: [] });
    const re = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    const users = await User.find({ $or: [{ email: re }, { fullName: re }] })
      .select('email fullName tier role')
      .limit(10).lean();
    res.json({ users });
  } catch (e) { next(e); }
};
