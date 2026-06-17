const mongoose = require('mongoose');

const { Schema } = mongoose;

const AdminOverrideSchema = new Schema(
  {
    isOverride: { type: Boolean, default: false },
    grantedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    reason: { type: String, trim: true },
  },
  { _id: false }
);

const SubscriptionSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },

    tier: { type: String, enum: ['FREE', 'BASIC', 'PRO', 'ENTERPRISE'], default: 'FREE', required: true },

    razorpaySubscriptionId: { type: String, trim: true, default: null },
    razorpayCustomerId: { type: String, trim: true, default: null },

    status: {
      type: String,
      enum: ['active', 'authenticated', 'pending', 'halted', 'cancelled', 'completed', 'expired', 'paused'],
      default: 'active',
      index: true,
    },

    plansUsedThisMonth: { type: Number, default: 0, min: 0 },

    currentPeriodStart: { type: Date },
    currentPeriodEnd: { type: Date },
    cancelledAt: { type: Date, default: null },

    adminOverride: { type: AdminOverrideSchema, default: () => ({}) },
  },
  { timestamps: true }
);

SubscriptionSchema.index({ razorpaySubscriptionId: 1 }, { sparse: true });
SubscriptionSchema.index({ tier: 1, status: 1 });

module.exports = mongoose.models.Subscription || mongoose.model('Subscription', SubscriptionSchema);
