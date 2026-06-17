/**
 * /api/v1/auth/* integration suite.
 *
 * Covers:
 *   POST /auth/send-otp     valid email | invalid format | rate-limit
 *   POST /auth/verify-otp   valid OTP | expired | wrong digits | missing
 *   POST /auth/refresh      valid cookie | missing cookie | tampered cookie
 *
 * Strategy:
 *   - Spin up the real Express app via require('../src/index')
 *   - Connect mongoose to mongodb-memory-server (URI set by global-setup)
 *   - For OTP capture: intercept what nodemailer's jsonTransport would
 *     have sent. The mailer falls back to jsonTransport in dev/test
 *     because EMAIL_HOST is unset, so we can read the OTP from the
 *     write call directly via a spy on the transporter.
 */

const request = require('supertest');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');

let app;
let mailer;

beforeAll(async () => {
  // Connect mongoose to the URI set by global-setup
  await mongoose.connect(process.env.MONGO_URI);

  // Require the app AFTER mongo is up — index.js's connectDB will see
  // an already-open connection and not re-connect. NODE_ENV=test guards
  // start() so the server doesn't auto-boot.
  app = require('../src/index');

  // Capture OTPs by spying on the transporter's sendMail.
  mailer = require('../src/config/mailer');
  jest.spyOn(mailer.getTransporter(), 'sendMail');
});

/** Pull the most recent OTP captured by the sendMail spy. */
function lastSentOtp() {
  const calls = mailer.getTransporter().sendMail.mock.calls;
  if (calls.length === 0) return null;
  const lastArgs = calls[calls.length - 1][0];
  // Body shape: "Your VastuVerse code is 482931 ..." — extract 6 digits
  const haystack = `${lastArgs.text || ''} ${lastArgs.html || ''}`;
  const m = haystack.match(/\b(\d{6})\b/);
  return m ? m[1] : null;
}

/* ─── POST /auth/send-otp ─────────────────────────────────────────── */

describe('POST /api/v1/auth/send-otp', () => {
  test('returns 200 for a valid email', async () => {
    const res = await request(app)
      .post('/api/v1/auth/send-otp')
      .send({ email: 'sharma@example.com' });

    expect(res.status).toBe(200);
    // Server shouldn't leak whether the user exists yet
    expect(res.body).toMatchObject({
      success: expect.any(Boolean),
    });
    expect(lastSentOtp()).toMatch(/^\d{6}$/);
  });

  test('returns 400 for an invalid email format', async () => {
    const res = await request(app)
      .post('/api/v1/auth/send-otp')
      .send({ email: 'not-an-email' });

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({
      success: false,
      error: { code: 'validation_error' },
    });
    expect(res.body.error.details).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: 'email' }),
      ])
    );
  });

  test('returns 400 when neither email nor phone is provided', async () => {
    const res = await request(app)
      .post('/api/v1/auth/send-otp')
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('validation_error');
  });

  test('rate-limits after 5 requests in 15 min', async () => {
    const payload = { email: `ratelimit-${Date.now()}@example.com` };

    // 5 successful requests
    for (let i = 0; i < 5; i++) {
      // eslint-disable-next-line no-await-in-loop
      const r = await request(app).post('/api/v1/auth/send-otp').send(payload);
      expect([200, 400]).toContain(r.status);  // 400 only if email also failed validation
    }

    // 6th must be 429
    const limited = await request(app).post('/api/v1/auth/send-otp').send(payload);
    expect(limited.status).toBe(429);
    expect(limited.body.error.code).toBe('rate_limited');
    expect(limited.body.error.retryAfter).toBeGreaterThan(0);
  });
});

/* ─── POST /auth/verify-otp ───────────────────────────────────────── */

describe('POST /api/v1/auth/verify-otp', () => {
  let email;
  let otp;

  beforeEach(async () => {
    email = `verify-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
    mailer.getTransporter().sendMail.mockClear();

    await request(app).post('/api/v1/auth/send-otp').send({ email });
    otp = lastSentOtp();
    expect(otp).toMatch(/^\d{6}$/);
  });

  test('returns 200 + accessToken for the correct OTP', async () => {
    const res = await request(app)
      .post('/api/v1/auth/verify-otp')
      .send({ email, otp });

    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBeTruthy();
    expect(res.body.user).toMatchObject({ email });
    // Refresh token MUST be set as an httpOnly cookie
    const setCookie = res.headers['set-cookie'] || [];
    expect(setCookie.some((c) => c.includes('refreshToken='))).toBe(true);
    expect(setCookie.some((c) => /HttpOnly/i.test(c))).toBe(true);
  });

  test('returns 401 for a wrong OTP', async () => {
    const wrong = otp === '111111' ? '222222' : '111111';
    const res = await request(app)
      .post('/api/v1/auth/verify-otp')
      .send({ email, otp: wrong });

    // Either 401 (auth failed) or 400 (rejected upstream); both are acceptable
    expect([400, 401]).toContain(res.status);
    expect(res.body.success).toBe(false);
  });

  test('returns 400 for a malformed OTP (not 6 digits)', async () => {
    const res = await request(app)
      .post('/api/v1/auth/verify-otp')
      .send({ email, otp: 'abc' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('validation_error');
    expect(res.body.error.details).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: 'otp' }),
      ])
    );
  });

  test('returns 401 for an expired OTP', async () => {
    // Stamp the OTP record to the past by directly updating mongo. The
    // auth controller uses an OTP record with an expiresAt field; we
    // walk the collection and roll it back 30 minutes.
    const OtpModel = mongoose.connection.collection('otps');
    await OtpModel.updateMany(
      { email },
      { $set: { expiresAt: new Date(Date.now() - 30 * 60 * 1000) } }
    );

    const res = await request(app)
      .post('/api/v1/auth/verify-otp')
      .send({ email, otp });

    expect([400, 401]).toContain(res.status);
    expect(res.body.success).toBe(false);
  });
});

/* ─── POST /auth/refresh ──────────────────────────────────────────── */

describe('POST /api/v1/auth/refresh', () => {
  let refreshCookie;
  let validUserId;

  beforeEach(async () => {
    const email = `refresh-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
    mailer.getTransporter().sendMail.mockClear();
    await request(app).post('/api/v1/auth/send-otp').send({ email });
    const otp = lastSentOtp();

    const verify = await request(app)
      .post('/api/v1/auth/verify-otp')
      .send({ email, otp });

    expect(verify.status).toBe(200);
    refreshCookie = (verify.headers['set-cookie'] || [])
      .find((c) => c.startsWith('refreshToken='));
    expect(refreshCookie).toBeTruthy();
    validUserId = verify.body.user.id || verify.body.user._id;
  });

  test('returns 200 + new accessToken for a valid refresh cookie', async () => {
    const res = await request(app)
      .post('/api/v1/auth/refresh')
      .set('Cookie', refreshCookie);

    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBeTruthy();
  });

  test('returns 401 when refresh cookie is missing', async () => {
    const res = await request(app)
      .post('/api/v1/auth/refresh');

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  test('returns 401 for a tampered refresh token (wrong signature)', async () => {
    // Forge a token with the right structure but a different secret
    const forged = jwt.sign(
      { userId: validUserId, type: 'refresh' },
      'wrong_secret_attacker_does_not_have',
      { expiresIn: '30d' }
    );

    const res = await request(app)
      .post('/api/v1/auth/refresh')
      .set('Cookie', `refreshToken=${forged}; HttpOnly`);

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    // Error code may be invalid_token, token_expired, or unauthenticated —
    // any of those is a correct rejection
    expect(['invalid_token', 'token_expired', 'unauthenticated', 'invalid_refresh'])
      .toContain(res.body.error.code);
  });

  test('returns 401 for a refresh token signed with our secret but for a non-existent user', async () => {
    const forged = jwt.sign(
      { userId: '000000000000000000000000', type: 'refresh' },
      process.env.JWT_REFRESH_SECRET,
      { expiresIn: '30d' }
    );

    const res = await request(app)
      .post('/api/v1/auth/refresh')
      .set('Cookie', `refreshToken=${forged}; HttpOnly`);

    expect(res.status).toBe(401);
  });
});
