/**
 * Passport configuration for VastuVerse.
 *
 * Strategies:
 *   - Google OAuth2  (passport-google-oauth20)
 *   - Facebook OAuth (passport-facebook)
 *
 * Both run in `session: false` mode — we issue our own JWT pair from the
 * controller and rely on an httpOnly refresh cookie. The strategies only
 * need to find-or-create the user.
 *
 * Account linkage: if a user already exists with the same (verified) email
 * via another provider, we let them in. The schema currently stores a single
 * `authProvider` / `socialId` pair, so the primary provider stays as the
 * one that registered first; the new login is accepted but not "merged"
 * structurally. (Extending to a `linkedAccounts[]` array is a later step.)
 */

const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const FacebookStrategy = require('passport-facebook').Strategy;

const { User } = require('../models');

const SERVER_URL = process.env.SERVER_URL || `http://localhost:${process.env.PORT || 5000}`;

async function findOrLinkUser({ provider, profile }) {
  const email = (
    profile.emails && profile.emails[0] && profile.emails[0].value
  ) ? profile.emails[0].value.toLowerCase().trim() : null;

  if (!email) {
    const err = new Error(`No email returned by ${provider}`);
    err.code = 'NO_EMAIL';
    throw err;
  }

  let user = await User.findOne({ email });
  if (user) {
    if (!user.isActive) {
      const err = new Error('Account deactivated');
      err.code = 'ACCOUNT_DEACTIVATED';
      throw err;
    }
    // Social providers verify the email — trust it and mark verified.
    if (!user.isVerified) {
      user.isVerified = true;
      await user.save();
    }
    return { user, isNew: false };
  }

  user = await User.create({
    email,
    authProvider: provider,
    socialId: profile.id,
    role: 'homeowner',
    isActive: true,
    isVerified: true,
    subscriptionTier: 'FREE',
    preferredLanguage: 'en',
  });
  return { user, isNew: true };
}

// ---- Google ------------------------------------------------------------
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  passport.use(
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: `${SERVER_URL}/api/v1/auth/google/callback`,
      },
      async (_accessToken, _refreshToken, profile, done) => {
        try {
          const { user, isNew } = await findOrLinkUser({ provider: 'google', profile });
          // Non-persistent marker the controller uses to decide redirect target.
          user.__isNew = isNew;
          done(null, user);
        } catch (err) {
          done(err);
        }
      }
    )
  );
} else {
  console.warn('[passport] Google OAuth not configured (GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET missing)');
}

// ---- Facebook ----------------------------------------------------------
if (process.env.FACEBOOK_APP_ID && process.env.FACEBOOK_APP_SECRET) {
  passport.use(
    new FacebookStrategy(
      {
        clientID: process.env.FACEBOOK_APP_ID,
        clientSecret: process.env.FACEBOOK_APP_SECRET,
        callbackURL: `${SERVER_URL}/api/v1/auth/facebook/callback`,
        profileFields: ['id', 'displayName', 'emails'],
      },
      async (_accessToken, _refreshToken, profile, done) => {
        try {
          const { user, isNew } = await findOrLinkUser({ provider: 'facebook', profile });
          user.__isNew = isNew;
          done(null, user);
        } catch (err) {
          done(err);
        }
      }
    )
  );
} else {
  console.warn('[passport] Facebook OAuth not configured (FACEBOOK_APP_ID / FACEBOOK_APP_SECRET missing)');
}

// Stateless mode — no serialize/deserialize needed.

module.exports = passport;
