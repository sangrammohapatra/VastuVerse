const mongoose = require('mongoose');

const { Schema } = mongoose;

const CommentSchema = new Schema(
  {
    planId: { type: Schema.Types.ObjectId, ref: 'Plan', required: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },

    parentId: { type: Schema.Types.ObjectId, ref: 'Comment', default: null }, // null = root, set = reply
    roomId: { type: String, trim: true }, // room identifier from floor plan JSON
    stepName: {
      type: String,
      enum: ['step1', 'step2', 'step3', 'step4', 'step5', 'step6', 'step7', 'step8', 'step9', 'step10'],
    },

    content: { type: String, required: true, trim: true, minlength: 1, maxlength: 4000 },

    resolved: { type: Boolean, default: false },
    resolvedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    resolvedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

CommentSchema.index({ planId: 1, stepName: 1 });
CommentSchema.index({ planId: 1, resolved: 1 });
CommentSchema.index({ parentId: 1 });

module.exports = mongoose.models.Comment || mongoose.model('Comment', CommentSchema);
