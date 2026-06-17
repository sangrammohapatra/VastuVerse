const mongoose = require('mongoose');

const { Schema } = mongoose;

const AnnotationSchema = new Schema(
  {
    stepName: {
      type: String,
      enum: ['step1', 'step2', 'step3', 'step4', 'step5', 'step6', 'step7', 'step8', 'step9', 'step10'],
    },
    roomId: { type: String, trim: true },
    note: { type: String, trim: true, required: true },
    severity: { type: String, enum: ['info', 'minor', 'major', 'critical'], default: 'info' },
  },
  { _id: false }
);

const ArchitectReviewSchema = new Schema(
  {
    bidId: { type: Schema.Types.ObjectId, ref: 'Bid', required: true, unique: true },
    planId: { type: Schema.Types.ObjectId, ref: 'Plan', required: true, index: true },
    architectId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },

    reportUrl: { type: String }, // uploaded annotated PDF
    annotations: { type: [AnnotationSchema], default: [] },
    summary: { type: String, trim: true, maxlength: 5000 },
    recommendedChanges: { type: [String], default: [] },

    userRating: { type: Number, min: 1, max: 5, default: null },
    userReview: { type: String, trim: true, maxlength: 2000 },

    status: {
      type: String,
      enum: ['draft', 'submitted', 'accepted', 'disputed'],
      default: 'draft',
    },

    submittedAt: { type: Date, default: null },
    acceptedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

ArchitectReviewSchema.index({ architectId: 1, status: 1 });
ArchitectReviewSchema.index({ planId: 1, status: 1 });

module.exports = mongoose.models.ArchitectReview || mongoose.model('ArchitectReview', ArchitectReviewSchema);
