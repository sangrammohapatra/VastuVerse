/**
 * authController — HTTP layer for the auth service.
 *
 * Refresh token transport:
 *   - httpOnly + Secure (prod) + SameSite=Strict cookie named "vv_refresh".
 *   - SameSite=Strict means the cookie won't be sent on cross-site requests.
 *     In dev with client on :3000 and API on :5000, modern browsers treat
 *     "same site" by registrable domain (localhost), so the cookie still
 *     flows — but if you change origins, switch to SameSite=Lax (or proxy
 *     /api through the Vite dev server).
 *
 * OAuth callback:
 *   The new access token is appended as a URL fragment (`#token=...`) on
 *   the redirect. Fragments aren't sent to servers, so it won't leak into
 *   access logs. The client reads & strips it on mount.
 */

const jwt = require('jsonwebtoken');
const { validationResult } = require('express-validator');

const { User } = require('../models');
const authService = require('../services/authService');
const { sendOtpEmail } = require('../config/mailer');

const REFRESH_COOKIE = 'vv_refresh';
const REFRESH_COOKIE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:3000';
const isProd = process.env.NODE_ENV === 'production';

const REFRESH_COOKIE_OPTS = {
  httpOnly: true,
  secure: isProd,
  sameSite: 'strict',
  path: '/',
  maxAge: REFRESH_COOKIE_MAX_AGE_MS,
};

/* ---------- helpers ---------- */

function setRefreshCookie(res, token) {
  res.cookie(REFRESH_COOKIE, token, REFRESH_COOKIE_OPTS);
}
function clearRefreshCookie(res) {
  res.clearCookie(REFRESH_COOKIE, { ...REFRESH_COOKIE_OPTS, maxAge: undefined });
}

// Tiny cookie parser so we don't pull in cookie-parser as a dep.
function parseCookies(header = '') {
  if (!header) return {};
  return Object.fromEntries(
    header
      .split(';')
      .map((p) => p.trim())
      .filter(Boolean)
      .map((p) => {
        const i = p.indexOf('=');
        return i < 0 ? [p, ''] : [p.slice(0, i), decodeURIComponent(p.slice(i + 1))];
      })
  );
}
function getRefreshCookie(req) {
  return parseCookies(req.headers.cookie || '')[REFRESH_COOKIE];
}

function publicUser(u) {
  return {
    id: String(u._id),
    email: u.email,
    fullName: u.fullName || null,
    role: u.role,
    subscriptionTier: u.subscriptionTier,
    preferredLanguage: u.preferredLanguage,
    isVerified: u.isVerified,
    cityState: u.cityState || null,
    onboardingComplete: u.onboardingComplete || !!(u.cityState?.city),
  };
}
function needsOnboarding(u) {
  return !u.onboardingComplete && !u.cityState?.city;
}

function rejectValidation(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ error: 'invalid_input', details: errors.array() });
    return true;
  }
  return false;
}

/* ---------- handlers ---------- */

// POST /auth/send-otp
exports.sendOtp = async (req, res, next) => {
  try {
    if (rejectValidation(req, res)) return;
    const email = String(req.body.email || '').toLowerCase().trim();
    const otp = await authService.generateOTP(email);
    await sendOtpEmail(email, otp);
    res.json({ ok: true, ttlSeconds: authService.OTP_TTL_SEC, maxAttempts: authService.OTP_MAX_ATTEMPTS });
  } catch (e) { next(e); }
};

// POST /auth/verify-otp  — creates the user if new, returns access + sets refresh cookie
exports.verifyOtp = async (req, res, next) => {
  try {
    if (rejectValidation(req, res)) return;
    const email = String(req.body.email || '').toLowerCase().trim();
    const otp = String(req.body.otp || '').trim();

    const result = await authService.verifyOTP(email, otp);
    if (!result.ok) {
      return res.status(401).json({ error: result.reason, attemptsLeft: result.attemptsLeft });
    }

    let user = await User.findOne({ email });
    let isNew = false;
    if (!user) {
      isNew = true;
      user = await User.create({
        email,
        authProvider: 'email',
        role: 'homeowner',
        isActive: true,
        isVerified: true,
        subscriptionTier: 'FREE',
        preferredLanguage: 'en',
      });
    } else {
      if (!user.isActive) return res.status(403).json({ error: 'account_deactivated' });
      if (!user.isVerified) { user.isVerified = true; await user.save(); }
    }

    const { accessToken, refreshToken } = authService.generateTokens(user);
    await authService.storeRefreshToken(user._id, refreshToken);
    setRefreshCookie(res, refreshToken);
    res.json({ accessToken, isNew, user: publicUser(user) });
  } catch (e) { next(e); }
};

// POST /auth/refresh
exports.refresh = async (req, res, next) => {
  try {
    const token = getRefreshCookie(req);
    const { accessToken, user } = await authService.refreshAccessToken(token);
    res.json({ accessToken, user: publicUser(user) });
  } catch (e) {
    if (e.status) return res.status(e.status).json({ error: e.code });
    next(e);
  }
};

// POST /auth/logout
exports.logout = async (req, res, next) => {
  try {
    const token = getRefreshCookie(req);
    if (token && process.env.JWT_REFRESH_SECRET) {
      try {
        const decoded = jwt.verify(token, process.env.JWT_REFRESH_SECRET);
        await authService.revokeRefreshToken(decoded.userId);
      } catch (_) {
        // ignore invalid / expired tokens on logout
      }
    }
    clearRefreshCookie(res);
    res.json({ ok: true });
  } catch (e) { next(e); }
};

// GET /auth/{google,facebook}/callback  (runs after passport.authenticate)
exports.oauthCallback = async (req, res, next) => {
  try {
    const user = req.user;
    if (!user) return res.redirect(`${CLIENT_URL}/login?error=oauth_failed`);

    const { accessToken, refreshToken } = authService.generateTokens(user);
    await authService.storeRefreshToken(user._id, refreshToken);
    setRefreshCookie(res, refreshToken);

    const dest = user.__isNew || needsOnboarding(user) ? '/onboarding' : '/dashboard';
    return res.redirect(`${CLIENT_URL}${dest}#token=${encodeURIComponent(accessToken)}`);
  } catch (e) { next(e); }
};
