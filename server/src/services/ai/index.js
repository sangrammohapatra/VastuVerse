/**
 * AIServiceFactory — central provider selector for all AI calls.
 *
 *   getShapeService()           Step 1   polygon detection from plot image
 *   getRoomSuggestionService()  Step 2   NBC + feasibility hints
 *   getPlanService()            Step 3   full floor-plan JSON
 *   getImageService()           Step 3+  render images (Pollinations / DALL-E)
 *
 * Selection is driven entirely by .env (AI_*_PROVIDER) so swapping providers
 * is a config change, not a code change.
 */

const huggingfaceShape = require("./shape/huggingface");
const googleVisionShape = require("./shape/googleVision");

const ollamaPlan = require("./plan/ollama");
const gpt4oPlan = require("./plan/gpt4o");

const pollinationsImg = require("./image/pollinations");
const dalleImg = require("./image/dalle");

const SHAPE_PROVIDERS = {
  huggingface: huggingfaceShape,
  "google-vision": googleVisionShape,
};

const PLAN_PROVIDERS = {
  ollama: ollamaPlan,
  gpt4o: gpt4oPlan,
};

const IMAGE_PROVIDERS = {
  pollinations: pollinationsImg,
  dalle: dalleImg,
};

function pick(map, envKey, fallback) {
  const provider = process.env[envKey] || fallback;
  const svc = map[provider];
  if (!svc) {
    throw new Error(
      `Unknown ${envKey}: "${provider}". Expected one of: ${Object.keys(map).join(", ")}`
    );
  }
  return svc;
}

class AIServiceFactory {
  static getShapeService() {
    return pick(SHAPE_PROVIDERS, "AI_SHAPE_PROVIDER", "huggingface");
  }
  static getRoomSuggestionService() {
    return pick(PLAN_PROVIDERS, "AI_PLAN_PROVIDER", "ollama");
  }
  static getPlanService() {
    return pick(PLAN_PROVIDERS, "AI_PLAN_PROVIDER", "ollama");
  }
  static getImageService() {
    return pick(IMAGE_PROVIDERS, "AI_IMAGE_PROVIDER", "pollinations");
  }
}

module.exports = AIServiceFactory;
