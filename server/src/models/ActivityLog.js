const mongoose = require('mongoose');

const { Schema } = mongoose;

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

const ACTIONS = [
  'plan_created',
  'step_completed',
  'plan_status_changed',
  'version_created',
  'version_rolled_back',
  'collaborator_invited',
  'collaborator_joined',
  'comment_added',
  'comment_resolved',
  'contractor_link_created',
  'contractor_link_accessed',
  'pdf_exported',
  '3d_unlocked',
  'marketplace_request_posted',
  'bid_placed',
  'bid_accepted',
  'review_submitted',
  'review_accepted',
  'payment_captured',
  'subscription_changed',
];

const ActivityLogSchema = new Schema(
  {
    planId: { type: Schema.Types.ObjectId, ref: 'Plan', index: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', index: true },
    action: { type: String, enum: ACTIONS, required: true },
    metadata: { type: Schema.Types.Mixed, default: {} },
    ipAddress: { type: String },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

// TTL: auto-expire entries after 365 days.
// NOTE: a plain TTL deletes ALL entries past the threshold. If you need to
// retain "critical" actions indefinitely, drop this index and instead set an
// `expiresAt` field only on non-critical writes with { expireAfterSeconds: 0 }.
ActivityLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: ONE_YEAR_SECONDS });

// Query paths
ActivityLogSchema.index({ planId: 1, createdAt: -1 });
ActivityLogSchema.index({ userId: 1, createdAt: -1 });
ActivityLogSchema.index({ action: 1, createdAt: -1 });

module.exports = mongoose.models.ActivityLog || mongoose.model('ActivityLog', ActivityLogSchema);
module.exports.ACTIONS = ACTIONS;
