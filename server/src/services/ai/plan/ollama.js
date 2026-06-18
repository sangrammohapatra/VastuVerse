/**
 * Ollama (dev) plan provider.
 *
 * Same split as gpt4o.js: geometry from _layoutMock (constraint solver),
 * Ollama enriches labels, summary, compliance notes, and Vastu advice.
 * Every method falls back deterministically if Ollama is unavailable.
 */

const axios = require("axios");

const { computeRoomSuggestions } = require("./_rules");
const { generateFloorPlans }     = require("./_layoutMock");
const { computeColorPalettes }   = require("./_palettes");
const { generateUtilities }      = require("./_utilities");
const { estimateCost }           = require("./_costEstimate");
const { FLOOR_PLAN_LABEL_PROMPT } = require("../../../prompts/floorPlanPrompt");

const DEFAULT_OLLAMA_URL   = process.env.OLLAMA_URL   || "";
const DEFAULT_OLLAMA_MODEL = process.env.OLLAMA_MODEL || "llama3";

async function roomSuggestions(payload) { return computeRoomSuggestions(payload); }

async function generateFloorPlan(payload, cfg = {}) {
  const ollamaUrl   = cfg.ollamaUrl   || DEFAULT_OLLAMA_URL;
  const ollamaModel = cfg.ollamaModel || DEFAULT_OLLAMA_MODEL;

  const solverResult = generateFloorPlans(payload);

  // Infeasible — return the structured error immediately, no LLM call needed
  if (!solverResult.feasible) return solverResult;

  if (!ollamaUrl) return solverResult;

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
      `${ollamaUrl}/api/generate`,
      {
        model:  ollamaModel,
        system: FLOOR_PLAN_LABEL_PROMPT,
        prompt: JSON.stringify(enrichPayload),
        format: "json",
        stream: false,
      },
      { timeout: 90000 }
    );

    const labels = safeParse(data?.response || "");
    if (labels && Array.isArray(labels.options) && labels.options.length === 3) {
      return mergeLabels(solverResult, labels);
    }
  } catch {
    // Fall through — solver result returned as-is
  }

  return solverResult;
}

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
