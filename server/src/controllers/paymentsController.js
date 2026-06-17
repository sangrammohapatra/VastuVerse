/**
 * Payments controller.
 *
 *   POST /api/v1/payments/create-order   { planId, type }                        (authed)
 *   POST /api/v1/payments/verify         { razorpay_order_id, razorpay_payment_id, razorpay_signature }
 *   POST /api/v1/payments/webhook        (raw body — Razorpay server-to-server)
 *
 * On a successful capture the controller mutates the relevant entitlement
 * (e.g. plan.is3DUnlocked = true) and writes an ActivityLog row so downstream
 * analytics + the user's history reflect the action.
 *
 * Signature verification is HMAC-SHA256 with the key secret (for /verify) or
 * the webhook secret (for /webhook). Both flows fail closed: any mismatch
 * results in a 400 with no entitlement change.
 */

const crypto = require('crypto');

const Payment = require('../models/Payment');
const Plan = require('../models/Plan');
const ActivityLog = require('../models/ActivityLog');
const User = require('../models/User');
const Subscription = require('../models/Subscription');

const { razorpay, configured, KEY_ID, KEY_SECRET, WEBHOOK_SECRET } = require('../config/razorpay');
const { getPricing } = require('../services/payments/PRICING');

/* ── helpers ───────────────────────────────────────────────────────── */

function requireConfigured(res) {
  if (!configured) {
    res.status(503).json({ error: 'payments_not_configured' });
    return false;
  }
  return true;
}

function verifyHmac(secret, payload, signature) {
  if (!signature || typeof signature !== 'string') return false;
  const expected = crypto.createHmac('sha256', secret).update(payload).digest('hex');
  if (expected.length !== signature.length) return false;
  // timingSafeEqual requires equal-length Buffers
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}

async function applyEntitlement(payment) {
  // Switch on payment.type. Returns a short description for the ActivityLog entry.
  switch (payment.type) {
    case '3d_unlock': {
      await Plan.updateOne(
        { _id: payment.planId, userId: payment.userId },
        { $set: { is3DUnlocked: true } }
      );
      return '3D view unlocked';
    }
    case 'pay_per_plan': {
      await Plan.updateOne(
        { _id: payment.planId, userId: payment.userId },
        { $set: { 'metadata.premiumExportUnlocked': true } }
      );
      return 'Premium export unlocked';
    }
    case 'subscription_basic':
    case 'subscription_pro':
    case 'subscription_enterprise': {
      const { tier } = getPricing(payment.type);
      await User.updateOne({ _id: payment.userId }, { $set: { subscriptionTier: tier } });
      await Subscription.findOneAndUpdate(
        { userId: payment.userId },
        {
          $set: {
            tier,
            status: 'active',
            currentPeriodStart: new Date(),
            currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          },
        },
        { upsert: true, setDefaultsOnInsert: true }
      );
      return `Upgraded to ${tier} plan`;
    }
    default:
      return 'Entitlement applied';
  }
}

/* ── 1. Create order ──────────────────────────────────────────────── */

exports.createOrder = async (req, res, next) => {
  try {
    if (!requireConfigured(res)) return;

    const userId = req.user.userId;
    const { planId, type } = req.body || {};
    const pricing = getPricing(type);
    if (!pricing) return res.status(400).json({ error: 'invalid_payment_type' });
    if (pricing.requiresPlan && !planId) return res.status(400).json({ error: 'plan_id_required' });

    // For plan-scoped items: confirm the plan belongs to the caller AND not
    // already entitled (avoids the user paying twice).
    if (pricing.requiresPlan) {
      const plan = await Plan.findOne({ _id: planId, userId }).select('is3DUnlocked').lean();
      if (!plan) return res.status(404).json({ error: 'plan_not_found' });
      if (type === '3d_unlock' && plan.is3DUnlocked) {
        return res.status(409).json({ error: 'already_unlocked' });
      }
    }

    const order = await razorpay.orders.create({
      amount: pricing.amount,
      currency: pricing.currency,
      receipt: `${pricing.receiptPrefix}${String(planId || userId).slice(-12)}-${Date.now().toString(36)}`,
      notes: {
        userId: String(userId),
        planId: planId ? String(planId) : '',
        type,
      },
    });

    // Persist a Payment record in 'created' state so we can later reconcile.
    await Payment.create({
      userId,
      planId: planId || null,
      type,
      amount: pricing.amount,
      currency: pricing.currency,
      razorpayOrderId: order.id,
      status: 'created',
      metadata: { receipt: order.receipt },
    });

    return res.status(201).json({
      orderId: order.id,
      amount: pricing.amount,
      currency: pricing.currency,
      key: KEY_ID,
      label: pricing.label,
      description: pricing.description,
    });
  } catch (e) {
    if (e.status === 503) return res.status(503).json({ error: 'payments_not_configured' });
    next(e);
  }
};

/* ── 2. Verify payment (client → server after Razorpay handler) ──── */

exports.verifyPayment = async (req, res, next) => {
  try {
    if (!requireConfigured(res)) return;

    const userId = req.user.userId;
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
    } = req.body || {};

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({ error: 'missing_fields' });
    }

    const ok = verifyHmac(
      KEY_SECRET,
      `${razorpay_order_id}|${razorpay_payment_id}`,
      razorpay_signature
    );
    if (!ok) {
      return res.status(400).json({ error: 'signature_mismatch' });
    }

    // Find the payment record we created at order time
    const payment = await Payment.findOne({ razorpayOrderId: razorpay_order_id, userId });
    if (!payment) return res.status(404).json({ error: 'payment_not_found' });

    if (payment.status === 'captured') {
      return res.json({ ok: true, alreadyVerified: true, type: payment.type, planId: payment.planId });
    }

    payment.razorpayPaymentId = razorpay_payment_id;
    payment.razorpaySignature = razorpay_signature;
    payment.status = 'captured';
    payment.metadata = { ...(payment.metadata || {}), verifiedAt: new Date() };
    await payment.save();

    const description = await applyEntitlement(payment);

    // Two log rows: a generic capture and (if applicable) the entitlement-specific one
    await ActivityLog.create({
      userId,
      planId: payment.planId || undefined,
      action: 'payment_captured',
      metadata: {
        type: payment.type,
        amount: payment.amount,
        razorpayPaymentId: razorpay_payment_id,
        source: 'client_verify',
      },
    }).catch((e) => console.warn('[activity-log]', e.message));

    if (payment.type === '3d_unlock') {
      await ActivityLog.create({
        userId,
        planId: payment.planId || undefined,
        action: '3d_unlocked',
        metadata: { paymentId: payment._id, source: 'client_verify' },
      }).catch((e) => console.warn('[activity-log]', e.message));
    }

    return res.json({
      ok: true,
      type: payment.type,
      planId: payment.planId,
      description,
    });
  } catch (e) {
    if (e.status === 503) return res.status(503).json({ error: 'payments_not_configured' });
    next(e);
  }
};

/* ── 3. Webhook (server-to-server; raw body required) ────────────── */

/**
 * Mounted with `express.raw({ type: 'application/json' })` so req.body is a
 * Buffer. Razorpay signs the raw bytes with our webhook secret.
 */
exports.webhook = async (req, res) => {
  try {
    if (!WEBHOOK_SECRET) {
      return res.status(503).json({ error: 'webhook_not_configured' });
    }

    const raw = Buffer.isBuffer(req.body) ? req.body : Buffer.from(JSON.stringify(req.body));
    const signature = req.get('x-razorpay-signature') || '';

    if (!verifyHmac(WEBHOOK_SECRET, raw, signature)) {
      return res.status(400).json({ error: 'invalid_signature' });
    }

    let event;
    try { event = JSON.parse(raw.toString('utf8')); }
    catch { return res.status(400).json({ error: 'malformed_json' }); }

    const eventType = event.event || '';
    const paymentEntity = event.payload?.payment?.entity;
    const orderEntity = event.payload?.order?.entity;
    const orderId = paymentEntity?.order_id || orderEntity?.id;

    if (!orderId) {
      // Respond 200 — Razorpay retries indefinitely on non-2xx, and there's
      // nothing actionable here. We still log for investigation.
      console.warn('[webhook] ignored event with no order id:', eventType);
      return res.status(200).json({ ok: true, ignored: true });
    }

    const payment = await Payment.findOne({ razorpayOrderId: orderId });
    if (!payment) {
      console.warn('[webhook] payment record not found for order:', orderId);
      return res.status(200).json({ ok: true, ignored: true });
    }

    let entitlementApplied = false;

    if (eventType === 'payment.captured' && payment.status !== 'captured') {
      payment.status = 'captured';
      payment.razorpayPaymentId = paymentEntity.id;
      payment.metadata = { ...(payment.metadata || {}), webhookCapturedAt: new Date() };
      await payment.save();

      const description = await applyEntitlement(payment);
      entitlementApplied = true;

      await ActivityLog.create({
        userId: payment.userId,
        planId: payment.planId || undefined,
        action: 'payment_captured',
        metadata: { type: payment.type, source: 'webhook', eventType },
      }).catch((e) => console.warn('[activity-log]', e.message));

      if (payment.type === '3d_unlock') {
        await ActivityLog.create({
          userId: payment.userId,
          planId: payment.planId || undefined,
          action: '3d_unlocked',
          metadata: { paymentId: payment._id, source: 'webhook' },
        }).catch((e) => console.warn('[activity-log]', e.message));
      }
    } else if (eventType === 'payment.failed') {
      payment.status = 'failed';
      payment.metadata = {
        ...(payment.metadata || {}),
        webhookFailedAt: new Date(),
        failureReason: paymentEntity?.error_description,
      };
      await payment.save();
    } else if (eventType === 'refund.created') {
      payment.status = 'refunded';
      payment.metadata = { ...(payment.metadata || {}), webhookRefundedAt: new Date() };
      await payment.save();
    }

    return res.status(200).json({ ok: true, entitlementApplied });
  } catch (e) {
    console.error('[webhook] error:', e);
    // 200 to prevent Razorpay retries when the failure is on our side
    return res.status(200).json({ ok: false, error: e.message });
  }
};
