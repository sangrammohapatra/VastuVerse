const mongoose = require('mongoose');

const { Schema } = mongoose;

const AccessLogEntrySchema = new Schema(
  {
    ip: { type: String },
    userAgent: { type: String },
    accessedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const ContractorLinkSchema = new Schema(
  {
    planId: { type: Schema.Types.ObjectId, ref: 'Plan', required: true, index: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },

    // Raw token is never persisted; only the SHA-256 hash is stored for lookup.
    // `token` is kept select:false for transient use during creation only.
    token: { type: String, select: false },
    tokenHash: { type: String, required: true, unique: true },

    expiryType: { type: String, enum: ['24h', '7d', 'permanent'], default: '7d', required: true },
    expiresAt: { type: Date, default: null }, // null when permanent

    accessLog: { type: [AccessLogEntrySchema], default: [] },
    isRevoked: { type: Boolean, default: false },
  },
  { timestamps: true }
);

ContractorLinkSchema.index({ planId: 1, isRevoked: 1 });

module.exports = mongoose.models.ContractorLink || mongoose.model('ContractorLink', ContractorLinkSchema);
