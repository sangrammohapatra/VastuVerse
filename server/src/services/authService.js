/**
 * authService — pure auth primitives, no HTTP concerns.
 *
 *   generateOTP(email)            → string OTP, stores hash+attempts in Redis (TTL 600s)
 *   verifyOTP(email, otp)         → { ok, reason?, attemptsLeft? }
 *   generateTokens(user)          → { accessToken (15m), refreshToken (7d) }
 *   storeRefreshToken(userId, t)  → persists SHA-256 hash on User.refreshTokenHash
 *   refreshAccessToken(refresh)   → { accessToken, user }
 *   revokeRefreshToken(userId)    → clears User.refreshTokenHash
 *
 * Notes:
 *   - The refresh token's SHA-256 hash is what we persist (raw token only
 *     lives in the httpOnly cookie). Comparing hashes lets us revoke by
 *     simply clearing the field.
 *   - bcryptjs (rounds: 12) is reserved for password-based login when it
 *     lands. OTPs are short-lived 6-digit codes — SHA-256 in Redis is the
 *     right primitive there (bcrypt would be overkill and slow).
 */

const crypto = require('crypto');
const jwt = require('jsonwebtoken');

const { User } = require('../models');
const redis = require('../config/redis');

const ACCESS_TTL = '15m';
const REFRESH_TTL = '7d';
const OTP_TTL_SEC = 600;          // 10 minutes
const OTP_MAX_ATTEMPTS = 3;

const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');
const otpKey = (email) => `otp:${email.toLowerCase().trim()}`;

function httpError(status, code) {
  const e = new Error(code);
  e.status = status;
  e.code = code;
  return e;
}

/**
 * Generate a 6-digit OTP, store its hash + attempts counter in Redis.
 * Returns the raw OTP — caller is responsible for emailing it (it must
 * never be returned to the client over the wire).
 */
async function generateOTP(email) {
  if (!email) throw httpError(400, 'email_required');
  const otp = String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
  const payload = JSON.stringify({ hash: sha256(otp), attempts: 0 });
  await redis.set(otpKey(email), payload, 'EX', OTP_TTL_SEC);
  return otp;
}

/**
 * Verify an OTP. On success: deletes the key. On failure: increments
 * attempts and deletes once attempts >= OTP_MAX_ATTEMPTS.
 */
async function verifyOTP(email, otp) {
  if (!email || !otp) return { ok: false, reason: 'missing_input' };
  const key = otpKey(email);
  const raw = await redis.get(key);
  if (!raw) return { ok: false, reason: 'expired_or_not_sent' };

  let parsed;
  try { parsed = JSON.parse(raw); } catch { return { ok: false, reason: 'corrupt_record' }; }
  const { hash, attempts } = parsed;

  if (sha256(String(otp)) === hash) {
    await redis.del(key);
    return { ok: true };
  }

  const nextAttempts = (attempts || 0) + 1;
  if (nextAttempts >= OTP_MAX_ATTEMPTS) {
    await redis.del(key);
    return { ok: false, reason: 'max_attempts' };
  }
  // Preserve the original TTL so attempts can't be used to extend lifetime.
  const ttl = await redis.ttl(key);
  await redis.set(
    key,
    JSON.stringify({ hash, attempts: nextAttempts }),
    'EX',
    Math.max(ttl, 1)
  );
  return { ok: false, reason: 'invalid', attemptsLeft: OTP_MAX_ATTEMPTS - nextAttempts };
}

function _accessPayload(user) {
  return {
    userId: String(user._id),
    role: user.role,
    tier: user.subscriptionTier,
    // teamRole is per-project for developer teams; populated when a request
    // is scoped to a project (controllers can re-sign or augment if needed).
    teamRole: user.teamRole || null,
  };
}

/** Issue a fresh access+refresh JWT pair for a user. */
function generateTokens(user) {
  if (!process.env.JWT_ACCESS_SECRET || !process.env.JWT_REFRESH_SECRET) {
    throw new Error('JWT secrets are not configured');
  }
  const accessToken = jwt.sign(_accessPayload(user), process.env.JWT_ACCESS_SECRET, {
    expiresIn: ACCESS_TTL,
  });
  const refreshToken = jwt.sign(
    { userId: String(user._id), jti: crypto.randomBytes(16).toString('hex') },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: REFRESH_TTL }
  );
  return { accessToken, refreshToken };
}

/** Persist the refresh token's hash on the user document. */
async function storeRefreshToken(userId, refreshToken) {
  await User.updateOne(
    { _id: userId },
    { $set: { refreshTokenHash: sha256(refreshToken) } }
  );
}

/**
 * Validate a refresh token against the stored hash and issue a new access
 * token. Throws an http-style error (status + code) on failure.
 */
async function refreshAccessToken(refreshToken) {
  if (!refreshToken) throw httpError(401, 'missing_refresh_token');

  let decoded;
  try {
    decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
  } catch {
    throw httpError(401, 'invalid_refresh_token');
  }

  const user = await User.findById(decoded.userId).select('+refreshTokenHash');
  if (!user || !user.isActive) throw httpError(401, 'user_not_found');
  if (!user.refreshTokenHash || user.refreshTokenHash !== sha256(refreshToken)) {
    throw httpError(401, 'refresh_token_revoked');
  }

  const accessToken = jwt.sign(_accessPayload(user), process.env.JWT_ACCESS_SECRET, {
    expiresIn: ACCESS_TTL,
  });
  return { accessToken, user };
}

/** Wipe the stored refresh token hash (logout / revoke-all). */
async function revokeRefreshToken(userId) {
  await User.updateOne({ _id: userId }, { $unset: { refreshTokenHash: 1 } });
}

module.exports = {
  generateOTP,
  verifyOTP,
  generateTokens,
  storeRefreshToken,
  refreshAccessToken,
  revokeRefreshToken,
  // exposed for clients/tests
  OTP_TTL_SEC,
  OTP_MAX_ATTEMPTS,
  ACCESS_TTL,
  REFRESH_TTL,
};
