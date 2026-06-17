/**
 * Payment routes.
 *
 * Note: the webhook is NOT defined here — it needs the raw request body for
 * HMAC verification, so it's mounted directly in index.js BEFORE the global
 * express.json() parser.
 */

const express = require('express');

const { authenticateToken } = require('../middlewares/auth');
const c = require('../controllers/paymentsController');

const router = express.Router();
router.use(authenticateToken);

router.post('/create-order', c.createOrder);
router.post('/verify',       c.verifyPayment);

module.exports = router;
