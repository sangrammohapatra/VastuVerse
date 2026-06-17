const mongoose = require('mongoose');

const { Schema } = mongoose;

const UserOverrideSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    enabled: { type: Boolean, required: true },
    grantedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { _id: false }
);

const FeatureFlagSchema = new Schema(
  {
    featureName: { type: String, required: true, unique: true, trim: true },
    enabledForTiers: {
      type: [String],
      enum: ['FREE', 'BASIC', 'PRO', 'ENTERPRISE'],
      default: [],
    },
    globalOverride: { type: Boolean, default: false }, // true = enabled for everyone
    userOverrides: { type: [UserOverrideSchema], default: [] },
    description: { type: String, trim: true },
  },
  { timestamps: true }
);

FeatureFlagSchema.index({ 'userOverrides.userId': 1 });

module.exports = mongoose.models.FeatureFlag || mongoose.model('FeatureFlag', FeatureFlagSchema);
