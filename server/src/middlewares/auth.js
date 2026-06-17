/**
 * Auth + authorization middlewares.
 *
 * Usage:
 *   router.get('/me', authenticateToken, controller.me);
 *   router.post('/admin/x', authenticateToken, requireRole('admin'), controller.x);
 *   router.get('/plans/:id/3d', authenticateToken, requireFeature('3d_view'), controller.3d);
 *   router.put('/projects/:id', authenticateToken, requireTeamRole('admin','editor'), controller.update);
 */

const jwt = require('jsonwebtoken');
const { FeatureFlag } = require('../models');

/** Verify Bearer JWT, attach decoded payload to req.user. */
function authenticateToken(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : null;
  if (!token) return res.status(401).json({ error: 'missing_token' });

  jwt.verify(token, process.env.JWT_ACCESS_SECRET, (err, decoded) => {
    if (err) {
      const code = err.name === 'TokenExpiredError' ? 'token_expired' : 'invalid_token';
      return res.status(401).json({ error: code });
    }
    req.user = decoded; // { userId, role, tier, teamRole, iat, exp }
    next();
  });
}

/** Allow only the given roles (homeowner|developer|architect|admin). */
function requireRole(...roles) {
  return function (req, res, next) {
    if (!req.user) return res.status(401).json({ error: 'unauthenticated' });
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'forbidden_role', required: roles });
    }
    next();
  };
}

/** Allow only the given developer team roles (admin|editor|reviewer|viewer). */
function requireTeamRole(...teamRoles) {
  return function (req, res, next) {
    if (!req.user) return res.status(401).json({ error: 'unauthenticated' });
    const role = req.user.teamRole;
    if (!role || !teamRoles.includes(role)) {
      return res.status(403).json({ error: 'forbidden_team_role', required: teamRoles });
    }
    next();
  };
}

/**
 * Gate a route behind a FeatureFlag.
 * Precedence:
 *   admin role           → always allowed
 *   flag.globalOverride  → allowed
 *   user-specific override → wins over tier
 *   flag.enabledForTiers → tier check
 *
 * (A Redis cache layer can be added later; the doc spec is 5-minute TTL.)
 */
function requireFeature(featureName) {
  return async function (req, res, next) {
    try {
      if (!req.user) return res.status(401).json({ error: 'unauthenticated' });
      if (req.user.role === 'admin') return next();

      const flag = await FeatureFlag.findOne({ featureName }).lean();
      if (!flag) {
        return res.status(403).json({ error: 'feature_not_configured', feature: featureName });
      }
      if (flag.globalOverride === true) return next();

      const override = (flag.userOverrides || []).find(
        (u) => String(u.userId) === String(req.user.userId)
      );
      if (override) {
        return override.enabled
          ? next()
          : res.status(403).json({ error: 'feature_disabled_for_user', feature: featureName });
      }

      if ((flag.enabledForTiers || []).includes(req.user.tier)) return next();
      return res.status(403).json({ error: 'feature_requires_upgrade', feature: featureName });
    } catch (e) {
      next(e);
    }
  };
}

module.exports = {
  authenticateToken,
  requireRole,
  requireTeamRole,
  requireFeature,
};
