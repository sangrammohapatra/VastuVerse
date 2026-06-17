/**
 * Payable items catalogue. All amounts in **paise** (₹1 = 100 paise) so they
 * pass directly to Razorpay's orders.create.
 *
 * Adding a new payable surface means adding a row here AND wiring the
 * `applyEntitlement` switch in paymentsController.
 */

const PRICING = {
  '3d_unlock': {
    amount: 49900,            // ₹499
    currency: 'INR',
    label: 'Unlock 3D walkthrough',
    description: 'One-time unlock of the interactive 3D view + AI bird\'s-eye render for this plan.',
    receiptPrefix: 'vv-3d-',
    requiresPlan: true,
  },
  'pay_per_plan': {
    amount: 19900,            // ₹199
    currency: 'INR',
    label: 'Premium plan export',
    description: 'Export this plan as a polished PDF with municipal docs and contractor handoff sheet.',
    receiptPrefix: 'vv-ppp-',
    requiresPlan: true,
  },
  'subscription_basic': {
    amount: 49900,            // ₹499/month
    currency: 'INR',
    label: 'BASIC Plan – 1 month',
    description: '10 AI generations/day, 20 active plans, PDF export.',
    receiptPrefix: 'vv-sub-b-',
    requiresPlan: false,
    tier: 'BASIC',
  },
  'subscription_pro': {
    amount: 99900,            // ₹999/month
    currency: 'INR',
    label: 'PRO Plan – 1 month',
    description: '50 AI generations/day, unlimited plans, 3D view included, priority queue.',
    receiptPrefix: 'vv-sub-p-',
    requiresPlan: false,
    tier: 'PRO',
  },
  'subscription_enterprise': {
    amount: 299900,           // ₹2,999/month
    currency: 'INR',
    label: 'ENTERPRISE Plan – 1 month',
    description: 'Unlimited AI generations, dedicated support, white-label exports.',
    receiptPrefix: 'vv-sub-e-',
    requiresPlan: false,
    tier: 'ENTERPRISE',
  },
};

function getPricing(type) {
  return PRICING[type];
}

module.exports = { PRICING, getPricing };
