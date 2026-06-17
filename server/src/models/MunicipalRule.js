const mongoose = require('mongoose');

const { Schema } = mongoose;

const SetbacksSchema = new Schema(
  {
    front: { type: Number, min: 0 }, // metres
    rear: { type: Number, min: 0 },
    side: { type: Number, min: 0 },
  },
  { _id: false }
);

const ParkingNormsSchema = new Schema(
  {
    twoWheeler: { type: Number, min: 0 }, // per unit area
    fourWheeler: { type: Number, min: 0 },
  },
  { _id: false }
);

const FireNormsSchema = new Schema(
  {
    egress: { type: String },
    hydrantRequired: { type: Boolean, default: false },
  },
  { _id: false }
);

const AdditionalRuleSchema = new Schema(
  {
    rule: { type: String, trim: true, required: true },
    source: { type: String, trim: true },
  },
  { _id: false }
);

const MunicipalRuleSchema = new Schema(
  {
    state: { type: String, required: true, trim: true },
    city: { type: String, required: true, trim: true },
    zone: { type: String, trim: true, default: 'default' }, // e.g. residential / commercial / mixed

    fsiLimit: { type: Number, min: 0 },
    farLimit: { type: Number, min: 0 },
    setbacks: { type: SetbacksSchema, default: () => ({}) }, // in metres
    maxHeight: { type: Number, min: 0 }, // metres
    maxFloors: { type: Number, min: 0 },
    parkingNorms: { type: ParkingNormsSchema, default: () => ({}) },
    roadWidthRequired: { type: Number, min: 0 }, // minimum abutting road width (m)
    fireNorms: { type: FireNormsSchema, default: () => ({}) },
    additionalRules: { type: [AdditionalRuleSchema], default: [] },

    lastUpdated: { type: Date, default: Date.now },
    dataSource: { type: String, trim: true }, // e.g. "BBMP 2023 Bye-laws"
    isAdminEntered: { type: Boolean, default: false }, // false = seeded from public data
  },
  { timestamps: true }
);

// One ruleset per (state, city, zone)
MunicipalRuleSchema.index({ state: 1, city: 1, zone: 1 }, { unique: true });

module.exports = mongoose.models.MunicipalRule || mongoose.model('MunicipalRule', MunicipalRuleSchema);
