/**
 * Ollama (self-hosted LLM) plan provider.
 *
 * floorPlanMode = 'ai'     → LLM generates room coordinates (FLOOR_PLAN_SYSTEM_PROMPT).
 *                            If the LLM returns invalid geometry, falls back to solver.
 * floorPlanMode = 'solver' → Constraint solver generates geometry (default).
 *
 * In both modes the LLM is called a second time (FLOOR_PLAN_LABEL_PROMPT) to enrich
 * each option with a variant label, summary, compliance notes, and Vastu advice —
 * but only if an Ollama URL is configured.
 */

const axios = require('axios');

const { computeRoomSuggestions }   = require('./_rules');
const { generateFloorPlans,
        buildRoomSpecs,
        distributeRoomsToFloors,
        scaleRoomsToFit }          = require('./_layoutMock');
const { generateFloorPlanWithAI }  = require('./_aiLayoutGenerator');
const { computeColorPalettes }     = require('./_palettes');
const { generateUtilities }        = require('./_utilities');
const { estimateCost }             = require('./_costEstimate');
const { FLOOR_PLAN_LABEL_PROMPT }  = require('../../../prompts/floorPlanPrompt');

const DEFAULT_OLLAMA_URL   = process.env.OLLAMA_URL   || '';
const DEFAULT_OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'llama3';

const SQM_TO_SQFT = 10.7639;

function toSqft(area, unit) {
  if (!area) return 0;
  if (unit === 'sqm')  return area * SQM_TO_SQFT;
  if (unit === 'sqyd') return area * 9;
  return area;
}

async function roomSuggestions(payload) { return computeRoomSuggestions(payload); }

async function generateFloorPlan(payload, cfg = {}) {
  const ollamaUrl   = cfg.ollamaUrl   || DEFAULT_OLLAMA_URL;
  const ollamaModel = cfg.ollamaModel || DEFAULT_OLLAMA_MODEL;
  const aiMode      = cfg.floorPlanMode === 'ai';

  let result = null;

  // ── AI geometry mode ────────────────────────────────────────────────────
  if (aiMode && ollamaUrl) {
    result = await tryAiLayout(payload, cfg);
  }

  // ── Solver fallback (always used if AI mode off or AI failed) ───────────
  if (!result) {
    result = generateFloorPlans(payload);
  }

  if (!result.feasible) return result;

  // ── Label enrichment (LLM text pass) ────────────────────────────────────
  if (!ollamaUrl) return result;

  try {
    const enrichPayload = buildEnrichPayload(payload, result);
    const { data } = await axios.post(
      `${ollamaUrl}/api/generate`,
      {
        model:  ollamaModel,
        system: FLOOR_PLAN_LABEL_PROMPT,
        prompt: JSON.stringify(enrichPayload),
        format: 'json',
        stream: false,
      },
      { timeout: 90_000 }
    );

    const labels = safeParse(data?.response || '');
    if (labels && Array.isArray(labels.options) && labels.options.length === 3) {
      return mergeLabels(result, labels);
    }
  } catch {
    // Fall through — return geometry-only result
  }

  return result;
}

/** Attempt AI geometry generation; returns null on failure so caller can fallback. */
async function tryAiLayout(payload, cfg) {
  try {
    const { roomConfig = {}, landDetails = {}, vastuEnabled = false } = payload;

    const areaSqft    = toSqft(Number(landDetails.area) || 0, landDetails.unit || 'sqft');
    const floors      = Math.max(1, Number(landDetails.floors) || 1);
    const fsi         = Number(landDetails.fsi) || 1.5;
    const perFloorBUA = (areaSqft * fsi) / floors;
    const side        = Math.max(20, Math.round(Math.sqrt(perFloorBUA)));
    const setbackFront = 5;
    const setbackSide  = 3;
    const plotW = Math.max(15, side - setbackSide * 2);
    const plotH = Math.max(15, side - setbackFront - setbackSide);

    const baseRooms = buildRoomSpecs(roomConfig);
    if (floors > 1 && !baseRooms.some((r) => r.kind === 'staircase')) {
      const { ROOM_SPEC, COLORS } = require('./_layoutMock');
      baseRooms.push({ id: 'stair-1', kind: 'staircase', label: 'Staircase', ...ROOM_SPEC.staircase, color: COLORS.staircase });
    }

    const floorBuckets     = distributeRoomsToFloors(baseRooms, roomConfig.floorAssignments, floors);
    const groundFloorRooms = scaleRoomsToFit(floorBuckets[0], plotW, plotH);
    const upperFloorBuckets = floorBuckets.slice(1).map((b) => scaleRoomsToFit(b, plotW, plotH));

    return await generateFloorPlanWithAI({
      payload,
      cfg,
      plotW,
      plotH,
      floors,
      side,
      setbackFront,
      setbackSide,
      groundFloorRooms,
      upperFloorBuckets,
    });
  } catch (err) {
    console.error('[ollama] AI layout error:', err.message);
    return null;
  }
}

function buildEnrichPayload(payload, result) {
  return {
    vastuEnabled: payload.vastuEnabled || false,
    options: result.options.map((o) => ({
      id:             o.id,
      rooms:          o.rooms,
      floors:         o.floors,
      plotDimensions: o.plotDimensions,
      totalArea:      o.totalArea,
      ...(o.vastuScore !== undefined && { vastuScore: o.vastuScore }),
    })),
  };
}

function mergeLabels(result, labels) {
  const labelMap = Object.fromEntries(labels.options.map((o) => [o.id, o]));
  return {
    feasible: result.feasible,
    options: result.options.map((opt) => {
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
