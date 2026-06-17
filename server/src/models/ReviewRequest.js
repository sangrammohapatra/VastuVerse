const mongoose = require('mongoose');

const { Schema } = mongoose;

const CityStateSchema = new Schema(
  { city: { type: String, trim: true }, state: { type: String, trim: true } },
  { _id: false }
);

const ReviewRequestSchema = new Schema(
  {
    planId: { type: Schema.Types.ObjectId, ref: 'Plan', required: true, index: true },
    homeownerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },

    title: { type: String, trim: true, maxlength: 160, required: true },
    description: { type: String, trim: true, maxlength: 4000 },

    preferredTimelineDays: { type: Number, min: 1, max: 365 },
    maxBudgetInr: { type: Number, required: true, min: 0 }, // in paise

    // Denormalised from plan.cityState for fast architect-feed filtering
    cityState: { type: CityStateSchema, default: () => ({}) },

    status: {
      type: String,
      enum: ['OPEN', 'IN_REVIEW', 'COMPLETED', 'CANCELLED', 'EXPIRED'],
      default: 'OPEN',
      index: true,
    },

    acceptedBidId: { type: Schema.Types.ObjectId, ref: 'Bid', default: null },
    bidCount: { type: Number, default: 0, min: 0 },         // denormalised for sort + display
    expiresAt: { type: Date, default: null },
  },
  { timestamps: true }
);

ReviewRequestSchema.index({ status: 1, createdAt: -1 });
ReviewRequestSchema.index({ 'cityState.state': 1, status: 1 });
ReviewRequestSchema.index({ maxBudgetInr: 1, status: 1 });

module.exports = mongoose.models.ReviewRequest || mongoose.model('ReviewRequest', ReviewRequestSchema);
