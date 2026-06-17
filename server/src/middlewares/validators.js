/**
 * Express-validator rule sets + the `validate()` runner that flushes
 * accumulated errors into a 400.
 *
 *   const { validate, authValidators, planValidators, paymentValidators } = require('../middlewares/validators');
 *
 *   router.post('/send-otp',
 *     authValidators.sendOtp,
 *     validate,
 *     controller.sendOtp);
 *
 * The runner returns a 400 with the standard error shape:
 *   { success: false, error: { code: 'validation_error', message, details: [{field, message, value}] } }
 *
 * Use it once at the end of each chain — it's cheaper than wiring it inside
 * every controller.
 */

const { body, param, query, validationResult } = require('express-validator');

/* ─── Shared runner ──────────────────────────────────────────────── */

function validate(req, res, next) {
  const errors = validationResult(req);
  if (errors.isEmpty()) return next();
  const details = errors.array({ onlyFirstError: true }).map((e) => ({
    field: e.path || e.param || 'unknown',
    message: e.msg,
    value: e.value,
  }));
  return res.status(400).json({
    success: false,
    error: {
      code: 'validation_error',
      message: 'Request validation failed.',
      details,
    },
  });
}

/* ─── Reusable atomic rules ──────────────────────────────────────── */

const isObjectId = (field, location = 'body') => {
  const fn = location === 'param' ? param : location === 'query' ? query : body;
  return fn(field).isMongoId().withMessage(`${field} must be a valid id`);
};

const isInrPaise = (field) =>
  body(field)
    .isInt({ min: 1, max: 1_000_00_000 * 100 })   // up to ₹100 crore in paise
    .withMessage(`${field} must be a positive integer (paise)`);

const isOptionalString = (field, max = 1000) =>
  body(field).optional({ nullable: true }).isString().isLength({ max })
    .withMessage(`${field} must be a string under ${max} chars`);

const trimEverything = (field, max = 200) =>
  body(field).optional().trim().isLength({ max });

/* ─── Auth ───────────────────────────────────────────────────────── */

const authValidators = {
  // POST /auth/send-otp — { email } OR { phone }
  sendOtp: [
    body('email')
      .optional()
      .isEmail().withMessage('Invalid email format')
      .normalizeEmail()
      .isLength({ max: 254 }),
    body('phone')
      .optional()
      .matches(/^\+91[6-9]\d{9}$/)
      .withMessage('Phone must be in the format +91XXXXXXXXXX (10 digits starting with 6-9)'),
    body().custom((value, { req }) => {
      if (!req.body.email && !req.body.phone) {
        throw new Error('Provide either email or phone');
      }
      if (req.body.email && req.body.phone) {
        throw new Error('Provide only one of email or phone');
      }
      return true;
    }),
  ],

  // POST /auth/verify-otp — { email|phone, otp }
  verifyOtp: [
    body('email')
      .optional()
      .isEmail().normalizeEmail().isLength({ max: 254 }),
    body('phone')
      .optional()
      .matches(/^\+91[6-9]\d{9}$/),
    body('otp')
      .exists().withMessage('OTP is required')
      .bail()
      .isString()
      .matches(/^\d{6}$/).withMessage('OTP must be exactly 6 digits'),
    body().custom((value, { req }) => {
      if (!req.body.email && !req.body.phone) {
        throw new Error('Provide either email or phone');
      }
      return true;
    }),
  ],
};

/* ─── User profile ───────────────────────────────────────────────── */

const userValidators = {
  // PUT /users/me
  updateMe: [
    trimEverything('fullName', 120),
    body('phone').optional().matches(/^\+91[6-9]\d{9}$/)
      .withMessage('Phone must be in the format +91XXXXXXXXXX'),
    body('avatarUrl').optional().isURL({ protocols: ['http', 'https'] })
      .withMessage('avatarUrl must be a valid http(s) URL'),
    body('preferredLanguage').optional()
      .isIn(['en', 'hi', 'bn', 'ta', 'te', 'mr', 'gu', 'kn'])
      .withMessage('preferredLanguage must be a supported language code'),
    body('notificationPreferences').optional().isObject(),
    body('gender').optional({ nullable: true })
      .isIn(['male', 'female', 'other', 'prefer_not_to_say', null])
      .withMessage('gender must be male, female, other, or prefer_not_to_say'),
    body('dateOfBirth').optional({ nullable: true })
      .isISO8601().withMessage('dateOfBirth must be a valid ISO date'),
    body('address').optional({ nullable: true }).isObject(),
    trimEverything('address.line1', 200),
    trimEverything('address.line2', 200),
    trimEverything('address.city', 100),
    trimEverything('address.state', 100),
    body('address.pincode').optional().trim()
      .matches(/^\d{6}$/).withMessage('pincode must be a 6-digit number'),
    trimEverything('address.country', 100),
  ],
};

/* ─── Plans ──────────────────────────────────────────────────────── */

const VALID_FACINGS = ['north', 'south', 'east', 'west',
  'northeast', 'northwest', 'southeast', 'southwest'];
const VALID_UNITS = ['sqft', 'sqm', 'sqyard', 'gunta', 'acre', 'hectare'];

const planValidators = {
  // POST /plans
  createPlan: [
    body('title').exists().withMessage('title is required')
      .bail().isString().trim()
      .isLength({ min: 1, max: 200 }).withMessage('title must be 1–200 chars'),
    body('landDetails').exists().withMessage('landDetails is required').bail().isObject(),
    body('landDetails.area')
      .exists().withMessage('landDetails.area is required')
      .bail()
      .isFloat({ gt: 0, max: 1_000_000 })
      .withMessage('landDetails.area must be > 0'),
    body('landDetails.unit')
      .optional()
      .isIn(VALID_UNITS).withMessage(`unit must be one of ${VALID_UNITS.join(', ')}`),
    body('landDetails.facing')
      .optional()
      .isIn(VALID_FACINGS).withMessage(`facing must be one of ${VALID_FACINGS.join(', ')}`),
    body('cityState').exists().withMessage('cityState is required').bail().isObject(),
    body('cityState.city')
      .exists().withMessage('cityState.city is required')
      .bail().isString().trim().isLength({ min: 1, max: 100 }),
    body('cityState.state')
      .exists().withMessage('cityState.state is required')
      .bail().isString().trim().isLength({ min: 1, max: 100 }),
    body('totalFloors')
      .optional()
      .isInt({ min: 1, max: 5 })
      .withMessage('totalFloors must be an integer between 1 and 5'),
  ],

  // PUT /plans/:planId/steps/:stepName
  saveStep: [
    isObjectId('planId', 'param'),
    param('stepName').isIn(['step1', 'step2', 'step3', 'step4', 'step5',
      'step6', 'step7', 'step8', 'step9', 'step10'])
      .withMessage('stepName must be step1…step10'),
    body('data').exists().withMessage('data is required').bail().isObject(),
  ],

  // GET /plans/:planId
  getPlan: [isObjectId('planId', 'param')],

  // GET /plans (list)
  listPlans: [
    query('status').optional()
      .matches(/^(DRAFT|IN_PROGRESS|COMPLETED|ARCHIVED)(,(DRAFT|IN_PROGRESS|COMPLETED|ARCHIVED))*$/)
      .withMessage('status must be a comma-separated list of valid statuses'),
    query('limit').optional().isInt({ min: 1, max: 50 }),
  ],
};

/* ─── Payments ───────────────────────────────────────────────────── */

const VALID_PAYMENT_TYPES = ['subscription', 'pay_per_plan', '3d_unlock', 'marketplace_bid'];

const paymentValidators = {
  // POST /payments/order
  createOrder: [
    body('type').exists().isIn(VALID_PAYMENT_TYPES)
      .withMessage(`type must be one of ${VALID_PAYMENT_TYPES.join(', ')}`),
    body('amount')
      .exists().withMessage('amount is required (paise)')
      .bail()
      .isInt({ min: 1 })
      .withMessage('amount must be a positive integer (paise)'),
    body('planId').optional().isMongoId().withMessage('planId must be a valid id'),
    body('currency').optional().isIn(['INR']).withMessage('currency must be INR'),
  ],

  // POST /payments/verify
  verifyPayment: [
    body('razorpay_order_id').exists().isString().isLength({ min: 6, max: 80 }),
    body('razorpay_payment_id').exists().isString().isLength({ min: 6, max: 80 }),
    body('razorpay_signature').exists().isString().isLength({ min: 30, max: 200 }),
  ],

  // POST /marketplace/bids
  placeBid: [
    body('reviewRequestId').isMongoId(),
    body('proposedFee').isInt({ min: 1 })
      .withMessage('proposedFee must be a positive integer (paise)'),
    body('proposedTimeline').optional().isInt({ min: 1, max: 365 }),
    body('coverNote').optional().isString().isLength({ max: 2000 }),
  ],
};

/* ─── Contractor + share ─────────────────────────────────────────── */

const contractorValidators = {
  // GET /contractor/:token
  getByToken: [
    param('token').isString()
      .isLength({ min: 16, max: 200 })
      .matches(/^[a-zA-Z0-9_\-]+$/)
      .withMessage('token must be a URL-safe string'),
  ],
};

/* ─── Notifications ──────────────────────────────────────────────── */

const notificationValidators = {
  list: [
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('before').optional().isISO8601().withMessage('before must be an ISO date'),
    query('unreadOnly').optional().isBoolean(),
  ],
  markRead: [isObjectId('id', 'param')],
};

module.exports = {
  validate,
  authValidators,
  userValidators,
  planValidators,
  paymentValidators,
  contractorValidators,
  notificationValidators,
};
