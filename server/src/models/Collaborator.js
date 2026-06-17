const mongoose = require('mongoose');

const { Schema } = mongoose;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const CollaboratorSchema = new Schema(
  {
    planId: { type: Schema.Types.ObjectId, ref: 'Plan', required: true, index: true },
    invitedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', default: null }, // set after accept

    email: { type: String, required: true, lowercase: true, trim: true, match: [EMAIL_RE, 'Invalid email address'] },

    permission: { type: String, enum: ['view', 'comment', 'edit'], default: 'view', required: true },
    inviteStatus: { type: String, enum: ['pending', 'accepted', 'declined', 'revoked'], default: 'pending', index: true },

    inviteToken: { type: String, select: false }, // hashed token; raw only emailed
    expiresAt: { type: Date },
    acceptedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

// Prevent duplicate invites to the same email on a plan
CollaboratorSchema.index({ planId: 1, email: 1 }, { unique: true });
CollaboratorSchema.index({ planId: 1, inviteStatus: 1 });
CollaboratorSchema.index({ userId: 1 });
CollaboratorSchema.index({ inviteToken: 1 }, { sparse: true });

module.exports = mongoose.models.Collaborator || mongoose.model('Collaborator', CollaboratorSchema);
