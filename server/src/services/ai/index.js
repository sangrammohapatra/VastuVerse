/**
 * AIServiceFactory — central provider selector for all AI calls.
 *
 * All methods are async so they can load the DB-backed config on first use.
 * Config is cached for 60 s in _config.js; call invalidateAiConfig() after
 * saving new settings so the change takes effect immediately.
 *
 *   getShapeService()           Step 1   polygon detection from plot image
 *   getRoomSuggestionService()  Step 2   NBC + feasibility hints
 *   getPlanService()            Step 3   full floor-plan JSON
 *   getImageService()           Step 3+  render images (Pollinations / DALL-E)
 */

const huggingfaceShape = require('./shape/huggingface');
const googleVisionShape = require('./shape/googleVision');

const ollamaPlan = require('./plan/ollama');
const gpt4oPlan  = require('./plan/gpt4o');

const pollinationsImg = require('./image/pollinations');
const dalleImg        = require('./image/dalle');

const { getAiConfig, invalidateCache } = require('./_config');
const { computeRoomRecommendation }    = require('./plan/_rules');

/**
 * Each returned service object forwards cfg automatically so callers never
 * need to think about which provider is active.
 */
class AIServiceFactory {
  static async getShapeService() {
    const cfg = await getAiConfig();
    const provider = cfg.shapeProvider;
    if (provider === 'google-vision') {
      return {
        recognizeShape: (buf, mime) => googleVisionShape.recognizeShape(buf, mime, cfg),
      };
    }
    return {
      recognizeShape: (buf, mime) => huggingfaceShape.recognizeShape(buf, mime, cfg),
    };
  }

  static async getRoomSuggestionService() {
    const cfg = await getAiConfig();
    const provider = cfg.planProvider;
    if (provider === 'gpt4o') {
      return { roomSuggestions: (p) => gpt4oPlan.roomSuggestions(p, cfg), colorPalettes: (p) => gpt4oPlan.colorPalettes(p, cfg) };
    }
    return { roomSuggestions: (p) => ollamaPlan.roomSuggestions(p, cfg), colorPalettes: (p) => ollamaPlan.colorPalettes(p, cfg) };
  }

  static async getPlanService() {
    const cfg = await getAiConfig();
    const provider = cfg.planProvider;
    if (provider === 'gpt4o') {
      return {
        generateFloorPlan:  (p) => gpt4oPlan.generateFloorPlan(p, cfg),
        generateUtilityPlan: (p) => gpt4oPlan.generateUtilityPlan(p, cfg),
        estimateCostFor:    (p) => gpt4oPlan.estimateCostFor(p, cfg),
      };
    }
    return {
      generateFloorPlan:  (p) => ollamaPlan.generateFloorPlan(p, cfg),
      generateUtilityPlan: (p) => ollamaPlan.generateUtilityPlan(p, cfg),
      estimateCostFor:    (p) => ollamaPlan.estimateCostFor(p, cfg),
    };
  }

  static async getImageService() {
    const cfg = await getAiConfig();
    const provider = cfg.imageProvider;
    if (provider === 'dalle') {
      return { generateImage: (p) => dalleImg.generateImage(p, cfg) };
    }
    return { generateImage: (p) => pollinationsImg.generateImage(p, cfg) };
  }

  static getRoomRecommendation(landDetails) {
    return computeRoomRecommendation(landDetails);
  }

  static invalidateAiConfig() {
    invalidateCache();
  }
}

module.exports = AIServiceFactory;
