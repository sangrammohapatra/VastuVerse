/**
 * SystemSettings — singleton key/value store for server-wide configuration
 * that admins can change without redeploying (env vars are still the fallback).
 *
 * Each document is identified by a unique `key` string.
 * The `value` field is schemaless Mixed so any shape can be stored.
 *
 * Current keys:
 *   'storage' — { provider, cloudinaryUrl, s3Bucket, s3Region, s3AccessKeyId, s3SecretAccessKey }
 *   'ai'      — { planProvider, imageProvider, shapeProvider, openaiApiKey, openaiPlanModel,
 *                 openaiImageModel, ollamaUrl, ollamaModel, huggingfaceApiKey,
 *                 huggingfaceShapeModel, googleVisionApiKey, pollinationsUrl }
 */

const mongoose = require('mongoose');

const { Schema } = mongoose;

const SystemSettingsSchema = new Schema(
  {
    key:       { type: String, required: true, unique: true, trim: true },
    value:     { type: Schema.Types.Mixed, default: {} },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

module.exports =
  mongoose.models.SystemSettings ||
  mongoose.model('SystemSettings', SystemSettingsSchema);
