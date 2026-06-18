/**
 * AI provider configuration — DB-backed with 60 s cache and .env fallback.
 *
 * Priority (first non-empty wins):
 *   1. SystemSettings document (key: 'ai') — editable by admin at runtime
 *   2. Environment variables
 *   3. Built-in defaults
 *
 * Call invalidateCache() after saving new settings so the next job picks
 * them up immediately rather than waiting for the TTL.
 */

const CACHE_TTL_MS = 60_000;
let _cache = null;
let _expiry = 0;

const ENV = {
  planProvider:          () => process.env.AI_PLAN_PROVIDER            || 'ollama',
  imageProvider:         () => process.env.AI_IMAGE_PROVIDER           || 'pollinations',
  shapeProvider:         () => process.env.AI_SHAPE_PROVIDER           || 'huggingface',
  openaiApiKey:          () => process.env.OPENAI_API_KEY              || '',
  openaiPlanModel:       () => process.env.OPENAI_PLAN_MODEL           || 'gpt-4o',
  openaiImageModel:      () => process.env.OPENAI_IMAGE_MODEL          || 'dall-e-3',
  ollamaUrl:             () => process.env.OLLAMA_URL                  || '',
  ollamaModel:           () => process.env.OLLAMA_MODEL                || 'llama3',
  huggingfaceApiKey:     () => process.env.HUGGINGFACE_API_KEY         || '',
  huggingfaceShapeModel: () => process.env.HUGGINGFACE_SHAPE_MODEL     || 'facebook/detr-resnet-50-panoptic',
  googleVisionApiKey:    () => process.env.GOOGLE_VISION_API_KEY       || '',
  pollinationsUrl:       () => process.env.POLLINATIONS_URL            || 'https://image.pollinations.ai/prompt',
};

async function getAiConfig() {
  if (_cache && Date.now() < _expiry) return _cache;

  let db = null;
  try {
    const SystemSettings = require('../../models/SystemSettings');
    const doc = await SystemSettings.findOne({ key: 'ai' }).lean();
    db = doc?.value || null;
  } catch {
    db = null;
  }

  // DB field wins when non-empty; otherwise fall back to env
  const cfg = {};
  for (const [field, envFn] of Object.entries(ENV)) {
    cfg[field] = db?.[field] || envFn();
  }

  _cache = cfg;
  _expiry = Date.now() + CACHE_TTL_MS;
  return _cache;
}

function invalidateCache() {
  _cache = null;
  _expiry = 0;
}

module.exports = { getAiConfig, invalidateCache };
