const mongoose = require('mongoose');

const { Schema } = mongoose;

const GeneratedImageSchema = new Schema(
  {
    url: { type: String, required: true },
    view: { type: String }, // e.g. "front", "top", "isometric"
  },
  { _id: false }
);

const PlanVersionSchema = new Schema(
  {
    planId: { type: Schema.Types.ObjectId, ref: 'Plan', required: true, index: true },
    versionNumber: { type: Number, required: true, min: 1 },

    stepName: {
      type: String,
      enum: ['step1', 'step2', 'step3', 'step4', 'step5', 'step6', 'step7', 'step8', 'step9', 'step10', 'manual'],
      required: true,
    },
    label: { type: String, trim: true, maxlength: 200 }, // "Floor Plan - Option 2"

    snapshotData: { type: Schema.Types.Mixed }, // full step data snapshot
    thumbnailUrl: { type: String },
    generatedImages: { type: [GeneratedImageSchema], default: undefined },

    aiProvider: { type: String, trim: true }, // provider used to generate this version
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
    isRollbackPoint: { type: Boolean, default: false },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

// One version number per plan; fast newest-first listing
PlanVersionSchema.index({ planId: 1, versionNumber: 1 }, { unique: true });
PlanVersionSchema.index({ planId: 1, createdAt: -1 });

module.exports = mongoose.models.PlanVersion || mongoose.model('PlanVersion', PlanVersionSchema);
