/**
 * GPT-4o (prod) plan provider.
 */

const axios = require("axios");

const { computeRoomSuggestions } = require("./_rules");
const { generateFloorPlans } = require("./_layoutMock");
const { computeColorPalettes } = require("./_palettes");
const { generateUtilities } = require("./_utilities");
const { estimateCost } = require("./_costEstimate");
const { FLOOR_PLAN_SYSTEM_PROMPT } = require("../../../prompts/floorPlanPrompt");

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "";
const OPENAI_MODEL = process.env.OPENAI_PLAN_MODEL || "gpt-4o";

async function roomSuggestions(payload) { return computeRoomSuggestions(payload); }

async function generateFloorPlan(payload) {
  if (!OPENAI_API_KEY) return generateFloorPlans(payload);
  try {
    const { data } = await axios.post(
      "https://api.openai.com/v1/chat/completions",
      {
        model: OPENAI_MODEL,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: FLOOR_PLAN_SYSTEM_PROMPT },
          { role: "user",   content: JSON.stringify(payload) },
        ],
      },
      {
        timeout: 110000,
        headers: { Authorization: `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json" },
      }
    );
    const parsed = safeParse(data?.choices?.[0]?.message?.content || "");
    if (parsed && Array.isArray(parsed.options) && parsed.options.length === 3) return parsed;
    return generateFloorPlans(payload);
  } catch { return generateFloorPlans(payload); }
}

async function colorPalettes(payload) { return computeColorPalettes(payload); }
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
