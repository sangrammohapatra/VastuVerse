/**
 * GPT-4o plan provider.
 *
 * Geometry is always produced by _layoutMock (zone-aware constraint solver).
 * GPT-4o is called only to enrich each option with a variant label, summary,
 * compliance notes, and Vastu advice — text tasks it can do reliably without
 * producing spatially impossible coordinates.
 */

const axios = require("axios");

const { computeRoomSuggestions } = require("./_rules");
const { generateFloorPlans }     = require("./_layoutMock");
const { computeColorPalettes }   = require("./_palettes");
const { generateUtilities }      = require("./_utilities");
const { estimateCost }           = require("./_costEstimate");
const { FLOOR_PLAN_LABEL_PROMPT } = require("../../../prompts/floorPlanPrompt");

const DEFAULT_OPENAI_KEY   = process.env.OPENAI_API_KEY    || "";
const DEFAULT_OPENAI_MODEL = process.env.OPENAI_PLAN_MODEL || "gpt-4o";

async function roomSuggestions(payload) { return computeRoomSuggestions(payload); }

async function generateFloorPlan(payload, cfg = {}) {
  const apiKey = cfg.openaiApiKey    || DEFAULT_OPENAI_KEY;
  const model  = cfg.openaiPlanModel || DEFAULT_OPENAI_MODEL;

  // Geometry + feasibility check always from the constraint solver
  const solverResult = generateFloorPlans(payload);

  // Infeasible — return the structured error immediately, no LLM call needed
  if (!solverResult.feasible) return solverResult;

  if (!apiKey) return solverResult;

  try {
    const enrichPayload = {
      vastuEnabled: payload.vastuEnabled || false,
      options: solverResult.options.map((o) => ({
        id:             o.id,
        rooms:          o.rooms,
        floors:         o.floors,
        plotDimensions: o.plotDimensions,
        totalArea:      o.totalArea,
        ...(o.vastuScore !== undefined && { vastuScore: o.vastuScore }),
      })),
    };

    const { data } = await axios.post(
      "https://api.openai.com/v1/chat/completions",
      {
        model,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: FLOOR_PLAN_LABEL_PROMPT },
          { role: "user",   content: JSON.stringify(enrichPayload) },
        ],
      },
      {
        timeout: 30000,
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      }
    );

    const labels = safeParse(data?.choices?.[0]?.message?.content || "");
    if (labels && Array.isArray(labels.options) && labels.options.length === 3) {
      return mergeLabels(solverResult, labels);
    }
  } catch {
    // Fall through — solver result returned as-is
  }

  return solverResult;
}

/** Merge LLM-generated text fields onto solver geometry. */
function mergeLabels(solverResult, labels) {
  const labelMap = Object.fromEntries(labels.options.map((o) => [o.id, o]));
  return {
    feasible: solverResult.feasible,
    options: solverResult.options.map((opt) => {
      const lbl = labelMap[opt.id];
      if (!lbl) return opt;
      return {
        ...opt,
        variant:         lbl.variant        ?? opt.variant,
        summary:         lbl.summary        ?? opt.summary,
        complianceNotes: lbl.complianceNotes ?? opt.complianceNotes,
        ...(lbl.vastuAdvice && { vastuAdvice: lbl.vastuAdvice }),
      };
    }),
  };
}

async function colorPalettes(payload)       { return computeColorPalettes(payload); }
async function generateUtilityPlan(payload) { return generateUtilities(payload); }
async function estimateCostFor(payload)     { return estimateCost(payload); }

function safeParse(s) { try { return JSON.parse(s); } catch { return null; } }

module.exports = {
  roomSuggestions,
  generateFloorPlan,
  colorPalettes,
  generateUtilityPlan,
  estimateCostFor,
};
