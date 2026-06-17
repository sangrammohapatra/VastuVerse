const mongoose = require('mongoose');

const { Schema } = mongoose;

const CostsSchema = new Schema(
  {
    economy: { type: Number, min: 0 },
    standard: { type: Number, min: 0 },
    premium: { type: Number, min: 0 },
  },
  { _id: false }
);

const CostDatasetSchema = new Schema(
  {
    state: { type: String, required: true, trim: true },
    city: { type: String, trim: true }, // optional: null = state-level baseline
    materialType: { type: String, required: true, trim: true }, // e.g. 'cement','steel','brick','labour'
    unitType: { type: String, trim: true }, // e.g. 'per_bag','per_kg','per_sqft'

    costs: { type: CostsSchema, default: () => ({}) },

    lastUpdated: { type: Date, default: Date.now },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

// One row per (state, city, material)
CostDatasetSchema.index({ state: 1, city: 1, materialType: 1 }, { unique: true });
CostDatasetSchema.index({ state: 1, materialType: 1 });

module.exports = mongoose.models.CostDataset || mongoose.model('CostDataset', CostDatasetSchema);
