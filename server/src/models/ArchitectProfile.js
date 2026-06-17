const mongoose = require('mongoose');

const { Schema } = mongoose;

const CityStateSchema = new Schema(
  {
    city: { type: String, trim: true },
    state: { type: String, trim: true },
  },
  { _id: false }
);

const RatingSchema = new Schema(
  {
    average: { type: Number, default: 0, min: 0, max: 5 },
    count: { type: Number, default: 0, min: 0 },
  },
  { _id: false }
);

const ArchitectProfileSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },

    coaRegistrationNo: { type: String, required: true, trim: true },
    yearsExperience: { type: Number, min: 0 },
    portfolioUrls: { type: [String], default: [] },
    certifications: { type: [String], default: [] },
    specializations: { type: [String], default: [] }, // e.g. ['residential','vastu','sustainable']
    cityState: { type: CityStateSchema, default: () => ({}) },

    verificationStatus: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending', index: true },
    verifiedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    verifiedAt: { type: Date, default: null },
    rejectionReason: { type: String, trim: true },

    rating: { type: RatingSchema, default: () => ({ average: 0, count: 0 }) },
    totalReviewsCompleted: { type: Number, default: 0, min: 0 },
    totalEarnings: { type: Number, default: 0, min: 0 }, // in paise

    razorpayContactId: { type: String, trim: true, default: null },
    razorpayFundAccountId: { type: String, trim: true, default: null },

    isSuspended: { type: Boolean, default: false },
    suspensionReason: { type: String, trim: true },
  },
  { timestamps: true }
);

ArchitectProfileSchema.index({ verificationStatus: 1, isSuspended: 1 });
ArchitectProfileSchema.index({ specializations: 1 });
ArchitectProfileSchema.index({ 'cityState.state': 1, 'cityState.city': 1 });
ArchitectProfileSchema.index({ 'rating.average': -1 });

module.exports = mongoose.models.ArchitectProfile || mongoose.model('ArchitectProfile', ArchitectProfileSchema);
