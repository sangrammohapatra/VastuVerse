/**
 * Razorpay SDK initialiser.
 *
 * In development the keys are often absent — instead of crashing we expose a
 * stubbed instance so the rest of the server still boots. The stub throws on
 * any actual API call so failures surface clearly when payments are needed.
 */

const KEY_ID = process.env.RAZORPAY_KEY_ID || '';
const KEY_SECRET = process.env.RAZORPAY_KEY_SECRET || '';
const WEBHOOK_SECRET = process.env.RAZORPAY_WEBHOOK_SECRET || '';

let instance = null;
let configured = false;

if (KEY_ID && KEY_SECRET) {
  try {
    const Razorpay = require('razorpay');
    instance = new Razorpay({ key_id: KEY_ID, key_secret: KEY_SECRET });
    configured = true;
  } catch (e) {
    console.warn('[razorpay] SDK init failed:', e.message);
  }
} else {
  console.warn('[razorpay] RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET not set — payment endpoints will 503');
}

// Stub that surfaces a meaningful 503 instead of TypeError
function notConfigured() {
  const err = new Error('payments_not_configured');
  err.status = 503;
  throw err;
}

const safeInstance = instance || {
  orders: {
    create: notConfigured,
    fetch: notConfigured,
  },
  payments: {
    fetch: notConfigured,
    capture: notConfigured,
  },
};

module.exports = {
  razorpay: safeInstance,
  configured,
  KEY_ID,
  KEY_SECRET,
  WEBHOOK_SECRET,
};
