const mongoose = require('mongoose');

const { Schema } = mongoose;

const NINETY_DAYS_SECONDS = 60 * 60 * 24 * 90;

const NOTIFICATION_EVENTS = [
  'generation_complete',
  'collaborator_invited',
  'bid_placed',
  'bid_accepted',
  'review_submitted',
  'review_accepted',
  'payment_captured',
  'plan_status_changed',
  'comment_added',
  'subscription_changed',
  // Admin-triggered
  'role_changed',
  'architect_approved',
  'architect_rejected',
  'architect_suspended',
];

const NotificationSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    event: { type: String, enum: NOTIFICATION_EVENTS, required: true },

    /** Short human-readable title — rendered as the bell-item primary line. */
    title: { type: String, required: true, trim: true },

    /** Body — rendered as the secondary line. Keep short; under ~140 chars. */
    body: { type: String, default: '', trim: true },

    /** Optional click-through path. e.g. /plans/:id/step/8 or /marketplace */
    actionUrl: { type: String, default: null, trim: true },

    /** Event-specific structured data, e.g. { planId, bidId } */
    data: { type: Schema.Types.Mixed, default: {} },

    read: { type: Boolean, default: false, index: true },
    readAt: { type: Date, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

// TTL: notifications auto-expire after 90 days.
NotificationSchema.index({ createdAt: 1 }, { expireAfterSeconds: NINETY_DAYS_SECONDS });
NotificationSchema.index({ userId: 1, read: 1, createdAt: -1 });
NotificationSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.models.Notification || mongoose.model('Notification', NotificationSchema);
module.exports.NOTIFICATION_EVENTS = NOTIFICATION_EVENTS;
