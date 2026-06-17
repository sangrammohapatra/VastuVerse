const mongoose = require('mongoose');

const { Schema } = mongoose;

const PaymentSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    planId: { type: Schema.Types.ObjectId, ref: 'Plan', default: null },

    type: {
      type: String,
      enum: ['subscription', 'subscription_basic', 'subscription_pro', 'subscription_enterprise', 'pay_per_plan', '3d_unlock', 'marketplace_bid', 'marketplace_payout'],
      required: true,
    },

    amount: { type: Number, required: true, min: 0 }, // stored in paise
    currency: { type: String, default: 'INR', uppercase: true },

    razorpayOrderId: { type: String, trim: true, index: true },
    razorpayPaymentId: { type: String, trim: true, index: true },
    razorpaySignature: { type: String, trim: true, select: false },

    status: {
      type: String,
      enum: ['created', 'attempted', 'authorized', 'captured', 'refunded', 'failed'],
      default: 'created',
    },

    metadata: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

PaymentSchema.index({ userId: 1, status: 1, createdAt: -1 });
PaymentSchema.index({ type: 1, status: 1 });

module.exports = mongoose.models.Payment || mongoose.model('Payment', PaymentSchema);
