/**
 * Ollama (dev) plan provider — local llama3 via http://ollama:11434.
 *
 * Wraps roomSuggestions, generateFloorPlan, colorPalettes, generateUtilities,
 * and estimateCost. Every method has a deterministic fallback so the wizard
 * works end-to-end without external services.
 */

const axios = require("axios");

const { computeRoomSuggestions } = require("./_rules");
const { generateFloorPlans } = require("./_layoutMock");
const { computeColorPalettes } = require("./_palettes");
const { generateUtilities } = require("./_utilities");
const { estimateCost } = require("./_costEstimate");
const { FLOOR_PLAN_SYSTEM_PROMPT } = require("../../../prompts/floorPlanPrompt");

const OLLAMA_URL = process.env.OLLAMA_URL || "";
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || "llama3";

async function roomSuggestions(payload) { return computeRoomSuggestions(payload); }

async function generateFloorPlan(payload) {
  if (!OLLAMA_URL) return generateFloorPlans(payload);
  try {
    const { data } = await axios.post(
      `${OLLAMA_URL}/api/generate`,
      { model: OLLAMA_MODEL, system: FLOOR_PLAN_SYSTEM_PROMPT, prompt: JSON.stringify(payload), format: "json", stream: false },
      { timeout: 110000 }
    );
    const parsed = safeParse(data?.response || "");
    if (parsed && Array.isArray(parsed.options) && parsed.options.length === 3) return parsed;
    return generateFloorPlans(payload);
  } catch { return generateFloorPlans(payload); }
}

async function colorPalettes(payload) { return computeColorPalettes(payload); }

// Utilities + cost are deterministic; the LLM adds no value.
async function generateUtilityPlan(payload) { return generateUtilities(payload); }
async function estimateCostFor(payload)    { return estimateCost(payload); }

function safeParse(s) { try { return JSON.parse(s); } catch { return null; } }

module.exports = {
  roomSuggestions,
  generateFloorPlan,
  colorPalettes,
  generateUtilityPlan,
  estimateCostFor,
};
