const mongoose = require('mongoose');

const { Schema } = mongoose;

const BidSchema = new Schema(
  {
    planId: { type: Schema.Types.ObjectId, ref: 'Plan', required: true, index: true },
    architectId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    reviewRequestId: { type: Schema.Types.ObjectId, ref: 'ReviewRequest', default: null },

    proposedFee: { type: Number, required: true, min: 0 }, // in paise
    proposedTimeline: { type: Number, min: 0 }, // in days
    coverNote: { type: String, trim: true, maxlength: 2000 },

    status: {
      type: String,
      enum: ['pending', 'accepted', 'rejected', 'completed', 'disputed'],
      default: 'pending',
    },

    acceptedAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },
    paymentId: { type: Schema.Types.ObjectId, ref: 'Payment', default: null },
  },
  { timestamps: true }
);

// Prevent the same architect bidding twice on a plan
BidSchema.index({ planId: 1, architectId: 1 }, { unique: true });
BidSchema.index({ planId: 1, status: 1 });
BidSchema.index({ architectId: 1, status: 1 });
BidSchema.index({ reviewRequestId: 1 });

module.exports = mongoose.models.Bid || mongoose.model('Bid', BidSchema);
