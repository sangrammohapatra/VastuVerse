/**
 * /api/v1/auth/* — wire-up for the auth controller.
 *
 * OTP flow:
 *   POST /send-otp     { email }
 *   POST /verify-otp   { email, otp }           → { accessToken, isNew, user }
 *
 * Session lifecycle:
 *   POST /refresh                               → { accessToken }
 *   POST /logout                                → 200
 *
 * OAuth:
 *   GET  /google          → 302 → Google consent
 *   GET  /google/callback → 302 → ${CLIENT_URL}/{onboarding|dashboard}#token=...
 *   GET  /facebook,  /facebook/callback        (same shape)
 */

const express = require('express');

const passport = require('../config/passport');
const authController = require('../controllers/authController');
const rateLimiter = require('../middlewares/rateLimiter');
const { authValidators, validate } = require('../middlewares/validators');

const router = express.Router();
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:3000';
const OAUTH_FAILURE_REDIRECT = `${CLIENT_URL}/login?error=oauth_failed`;

// ---- Email/OTP (rate limited: 5/15min/IP) -----------------------------
router.post('/send-otp',   rateLimiter.otp, authValidators.sendOtp,   validate, authController.sendOtp);
router.post('/verify-otp', rateLimiter.otp, authValidators.verifyOtp, validate, authController.verifyOtp);

// ---- Session -----------------------------------------------------------
router.post('/refresh', authController.refresh);
router.post('/logout', authController.logout);

// ---- Google ------------------------------------------------------------
router.get(
  '/google',
  passport.authenticate('google', { scope: ['profile', 'email'], session: false })
);
router.get(
  '/google/callback',
  passport.authenticate('google', { session: false, failureRedirect: OAUTH_FAILURE_REDIRECT }),
  authController.oauthCallback
);

// ---- Facebook ----------------------------------------------------------
router.get(
  '/facebook',
  passport.authenticate('facebook', { scope: ['email'], session: false })
);
router.get(
  '/facebook/callback',
  passport.authenticate('facebook', { session: false, failureRedirect: OAUTH_FAILURE_REDIRECT }),
  authController.oauthCallback
);

module.exports = router;
