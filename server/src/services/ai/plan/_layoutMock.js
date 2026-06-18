/**
 * Floor-plan layout generator.
 *
 * Generation pipeline:
 *   1. validateFloorPlan()  — hard feasibility check.
 *      If infeasible, returns { feasible: false, error, options: [] } immediately.
 *      No overlapping or missing rooms are ever returned; errors surface to the UI.
 *
 *   2. scaleRoomsToFit()   — proportionally scale rooms to the per-floor BUA.
 *
 *   3. solveFloor()        — zone-aware constraint placement.
 *      Ground floor is solved first. Staircases and bathrooms are recorded and
 *      pre-placed at the same (x, y) on every upper floor for vertical alignment.
 *
 *   4. expandToFillPlot()  — extend each placed room to the nearest blocker or
 *      plot edge to eliminate blank strips (runs per floor, after Vastu scoring).
 *
 * Returns:
 *   { feasible: true,  options: [{ id, variant, summary, rooms, floors, ... }] }
 *   { feasible: false, error: { code, message, ... }, options: [] }
 */

const SQM_TO_SQFT = 10.7639;

const COLORS = {
  bedroom:          '#FFB300',
  bathroomAttached: '#90CAF9',
  bathroomCommon:   '#64B5F6',
  kitchen:          '#FF6F00',
  living:           '#66BB6A',
  dining:           '#81C784',
  pooja:            '#FFD54F',
  study:            '#9575CD',
  garage:           '#9E9E9E',
  servant:          '#A1887F',
  terrace:          '#4FC3F7',
  storage:          '#BDBDBD',
  balcony:          '#4DD0E1',
  staircase:        '#78909C',
  utility:          '#80CBC4',
  serviceYard:      '#B0BEC5',
};

/**
 * NBC 2016 minimum room dimensions (feet) — used as base sizes before scaling.
 * Scaling can reduce these; NBC compliance is validated separately in _rules.js.
 */
const ROOM_SPEC = {
  bedroom:          { w: 10, h: 10 },
  bathroomAttached: { w: 5,  h: 7  },
  bathroomCommon:   { w: 6,  h: 8  },
  kitchen:          { w: 9,  h: 10 },
  living:           { w: 14, h: 12 },
  dining:           { w: 10, h: 9  },
  pooja:            { w: 5,  h: 5  },
  study:            { w: 9,  h: 9  },
  garage:           { w: 11, h: 16 },
  servant:          { w: 7,  h: 9  },
  storage:          { w: 5,  h: 5  },
  balcony:          { w: 4,  h: 7  },
  staircase:        { w: 5,  h: 9  },
  utility:          { w: 7,  h: 8  },
  serviceYard:      { w: 6,  h: 5  },
};

/**
 * Variant meta-data.
 * 'Vastu Optimised' label is only applied when vastuEnabled === true.
 */
const VARIANT_META = [
  {
    id: 'opt-1',
    labelVastu:      'Vastu Optimised',
    labelFallback:   'Traditional',
    summaryVastu:    'Kitchen SE, Pooja NE, Master SW — directionally placed per Vastu Shastra.',
    summaryFallback: 'Balanced layout with private zones in the south and shared areas north.',
  },
  {
    id: 'opt-2',
    labelVastu:    'Modern Open',
    labelFallback: 'Modern Open',
    summaryVastu:    'Open kitchen flowing into living/dining, maximising communal north-east light.',
    summaryFallback: 'Open kitchen flowing into living/dining, larger common areas.',
  },
  {
    id: 'opt-3',
    labelVastu:    'Space Maximised',
    labelFallback: 'Space Maximised',
    summaryVastu:    'Compact directional placement — Vastu zones honoured with minimum circulation waste.',
    summaryFallback: 'Compact placement with maximum usable space and shorter circulation paths.',
  },
];

const { validateFloorPlan }          = require('./_floorPlanValidator');
const { solveFloor, detectOverlaps } = require('./_layoutSolver');
const { computeVastuScore }          = require('./_vastuScore');
const { validatePostPlacement }      = require('./_postPlacementValidator');

function toSqft(area, unit) {
  if (!area) return 0;
  if (unit === 'sqm')  return area * SQM_TO_SQFT;
  if (unit === 'sqyd') return area * 9;
  return area;
}

// ── Room list builder ─────────────────────────────────────────────────────

function buildRoomSpecs(roomConfig = {}) {
  const out = [];
  const sp  = roomConfig.additionalSpaces || [];

  for (let i = 1; i <= (roomConfig.bedrooms || 0); i++) {
    out.push({ id: `bed-${i}`, kind: 'bedroom', label: i === 1 ? 'Master BR' : `Bedroom ${i}`, ...ROOM_SPEC.bedroom, color: COLORS.bedroom });
  }
  for (let i = 1; i <= (roomConfig.attachedBathrooms || 0); i++) {
    out.push({ id: `atb-${i}`, kind: 'bathroomAttached', label: `Att. Bath ${i}`, ...ROOM_SPEC.bathroomAttached, color: COLORS.bathroomAttached });
  }
  for (let i = 1; i <= (roomConfig.commonBathrooms || 0); i++) {
    out.push({ id: `cb-${i}`, kind: 'bathroomCommon', label: `Bathroom ${i}`, ...ROOM_SPEC.bathroomCommon, color: COLORS.bathroomCommon });
  }
  out.push({ id: 'kitchen', kind: 'kitchen', label: 'Kitchen', ...ROOM_SPEC.kitchen, color: COLORS.kitchen });

  if (sp.includes('living'))  out.push({ id: 'living',  kind: 'living',  label: 'Living',       ...ROOM_SPEC.living,  color: COLORS.living  });
  if (sp.includes('dining'))  out.push({ id: 'dining',  kind: 'dining',  label: 'Dining',       ...ROOM_SPEC.dining,  color: COLORS.dining  });
  if (sp.includes('pooja'))   out.push({ id: 'pooja',   kind: 'pooja',   label: 'Pooja',        ...ROOM_SPEC.pooja,   color: COLORS.pooja   });
  if (sp.includes('study'))   out.push({ id: 'study',   kind: 'study',   label: 'Study',        ...ROOM_SPEC.study,   color: COLORS.study   });
  if (sp.includes('garage'))  out.push({ id: 'garage',  kind: 'garage',  label: 'Garage',       ...ROOM_SPEC.garage,  color: COLORS.garage  });
  if (sp.includes('servant')) out.push({ id: 'servant', kind: 'servant', label: 'Servant Qtrs', ...ROOM_SPEC.servant, color: COLORS.servant });
  if (sp.includes('storage'))     out.push({ id: 'storage',     kind: 'storage',     label: 'Storage',      ...ROOM_SPEC.storage,     color: COLORS.storage     });
  if (sp.includes('terrace'))     out.push({ id: 'terrace',     kind: 'terrace',     label: 'Terrace',      w: 12, h: 10,             color: COLORS.terrace     });
  if (sp.includes('utility'))     out.push({ id: 'utility',     kind: 'utility',     label: 'Utility',      ...ROOM_SPEC.utility,     color: COLORS.utility     });
  if (sp.includes('serviceYard')) out.push({ id: 'serviceYard', kind: 'serviceYard', label: 'Service Yard', ...ROOM_SPEC.serviceYard, color: COLORS.serviceYard });

  if (sp.includes('balcony')) {
    for (let i = 1; i <= (roomConfig.balconies || 0); i++) {
      out.push({ id: `balcony-${i}`, kind: 'balcony', label: `Balcony ${i}`, ...ROOM_SPEC.balcony, color: COLORS.balcony });
    }
  }
  for (let i = 1; i <= (roomConfig.staircases || 0); i++) {
    out.push({ id: `stair-${i}`, kind: 'staircase', label: `Staircase ${i}`, ...ROOM_SPEC.staircase, color: COLORS.staircase });
  }
  return out;
}

// ── Floor distribution ────────────────────────────────────────────────────

function distributeRoomsToFloors(rooms, floorAssignments, floors) {
  const byFloor  = Array.from({ length: floors }, () => []);
  const assigned = new Set();

  // Honour explicit user assignments
  for (let f = 1; f <= floors; f++) {
    const ids = (floorAssignments?.[`floor${f}`] || []);
    ids.forEach((id) => {
      const r = rooms.find((rm) => rm.id === id);
      if (r && !assigned.has(id)) { byFloor[f - 1].push(r); assigned.add(id); }
    });
  }

  const SHARED    = new Set(['living', 'dining', 'kitchen', 'pooja', 'garage', 'storage', 'utility', 'serviceYard']);
  const upperIdxs = floors > 1 ? Array.from({ length: floors - 1 }, (_, i) => i + 1) : [];
  let upperPick   = 0;

  rooms.forEach((r) => {
    if (assigned.has(r.id)) return;

    if (r.kind === 'staircase') {
      // Clone staircase to every floor — will be aligned in the solver phase
      for (let f = 0; f < floors; f++) {
        byFloor[f].push({ ...r, id: `${r.id}__f${f + 1}` });
      }
      assigned.add(r.id);
      return;
    }

    if (SHARED.has(r.kind) || floors === 1) {
      byFloor[0].push(r);
    } else if ((r.kind === 'bedroom' || r.kind === 'bathroomAttached') && upperIdxs.length) {
      byFloor[upperIdxs[upperPick % upperIdxs.length]].push(r);
      upperPick += 1;
    } else {
      byFloor[0].push(r);
    }
    assigned.add(r.id);
  });

  return byFloor;
}

// ── Scaling ───────────────────────────────────────────────────────────────

/**
 * Proportionally scale rooms so they fit inside the plot at ~85% fill.
 * Rooms scale freely down to a 3 ft render minimum; NBC compliance is
 * validated separately by _floorPlanValidator and _rules.
 */
function scaleRoomsToFit(rooms, plotW, plotH) {
  if (!rooms.length) return rooms;
  const totalArea = rooms.reduce((s, r) => s + r.w * r.h, 0);
  const plotArea  = plotW * plotH * 0.85;
  const areaScale = totalArea > plotArea ? Math.sqrt(plotArea / totalArea) : 1;
  const maxW      = Math.max(...rooms.map((r) => r.w));
  const maxH      = Math.max(...rooms.map((r) => r.h));
  const fitW      = maxW > plotW * 0.9 ? (plotW * 0.9) / maxW : 1;
  const fitH      = maxH > plotH * 0.9 ? (plotH * 0.9) / maxH : 1;
  const scale     = Math.min(1, areaScale, fitW, fitH);
  if (scale >= 0.99) return rooms;
  return rooms.map((r) => ({
    ...r,
    w: Math.max(3, Math.round(r.w * scale)),
    h: Math.max(3, Math.round(r.h * scale)),
  }));
}

// ── Post-placement fill ───────────────────────────────────────────────────

/**
 * Expand each room rightward then downward to the nearest blocker or plot edge.
 * Eliminates blank strips after zone-biased placement.
 * Always run AFTER Vastu scoring so scores reflect original zone positions.
 */
function expandToFillPlot(placed, plotW, plotH) {
  const rooms = placed.map((r) => ({ ...r }));

  // Pass 1 — expand right
  rooms.sort((a, b) => a.x - b.x);
  for (const r of rooms) {
    let right = plotW;
    for (const o of rooms) {
      if (o === r) continue;
      if (o.x >= r.x + r.w && o.x < right &&
          o.y < r.y + r.h && o.y + o.h > r.y) right = o.x;
    }
    r.w = right - r.x;
  }

  // Pass 2 — expand down
  rooms.sort((a, b) => a.y - b.y);
  for (const r of rooms) {
    let bottom = plotH;
    for (const o of rooms) {
      if (o === r) continue;
      if (o.y >= r.y + r.h && o.y < bottom &&
          o.x < r.x + r.w && o.x + o.w > r.x) bottom = o.y;
    }
    r.h = bottom - r.y;
  }

  // Pass 3 — expand left (absorb left-side gaps)
  rooms.sort((a, b) => b.x - a.x);
  for (const r of rooms) {
    let left = 0;
    for (const o of rooms) {
      if (o === r) continue;
      if (o.x + o.w <= r.x && o.x + o.w > left &&
          o.y < r.y + r.h && o.y + o.h > r.y) left = o.x + o.w;
    }
    r.w += r.x - left;
    r.x = left;
  }

  // Pass 4 — expand up (absorb top-side gaps)
  rooms.sort((a, b) => b.y - a.y);
  for (const r of rooms) {
    let top = 0;
    for (const o of rooms) {
      if (o === r) continue;
      if (o.y + o.h <= r.y && o.y + o.h > top &&
          o.x < r.x + r.w && o.x + o.w > r.x) top = o.y + o.h;
    }
    r.h += r.y - top;
    r.y = top;
  }

  return rooms;
}

// ── Public API ────────────────────────────────────────────────────────────

function generateFloorPlans({ roomConfig = {}, landDetails = {}, vastuEnabled = false } = {}) {

  // ── Step 1: hard feasibility check ──────────────────────────────────────
  const validation = validateFloorPlan({ roomConfig, landDetails });
  if (!validation.feasible) {
    return {
      feasible: false,
      error: {
        // Surface the first hard error; the others appear in `allErrors`
        code:       validation.errors[0]?.code    || 'VALIDATION_FAILED',
        message:    validation.errors[0]?.message || 'Floor plan configuration is invalid.',
        allErrors:  validation.errors,
        warnings:   validation.warnings,
        suggestions: validation.suggestions,
      },
      options: [],
    };
  }

  // ── Step 2: compute plot dimensions ─────────────────────────────────────
  const areaSqft   = toSqft(Number(landDetails.area) || 0, landDetails.unit || 'sqft');
  const floors     = Math.max(1, Number(landDetails.floors) || 1);
  const fsi        = Number(landDetails.fsi) || 1.5;

  const perFloorBUA = (areaSqft * fsi) / floors;
  const side        = Math.max(20, Math.round(Math.sqrt(perFloorBUA)));
  const setbackFront = 5;
  const setbackSide  = 3;
  const plotW = Math.max(15, side - setbackSide * 2);
  const plotH = Math.max(15, side - setbackFront - setbackSide);

  const baseRooms = buildRoomSpecs(roomConfig);
  if (floors > 1 && !baseRooms.some((r) => r.kind === 'staircase')) {
    baseRooms.push({ id: 'stair-1', kind: 'staircase', label: 'Staircase', ...ROOM_SPEC.staircase, color: COLORS.staircase });
  }

  // ── Step 3: generate 3 layout variants ──────────────────────────────────
  const options = VARIANT_META.map((meta, variantIdx) => {
    const floorBuckets = distributeRoomsToFloors(baseRooms, roomConfig.floorAssignments, floors);

    const allPlaced    = [];
    const allConflicts = [];
    const allUnplaced  = [];
    const floorsMeta   = [];

    // Tracks positions of vertically-stacked elements (staircase, bathrooms).
    // key: room.kind  →  value: { x, y, w, h }  from the ground floor.
    const verticalAnchor = new Map();

    floorBuckets.forEach((roomsOnFloor, fIdx) => {
      const scaled = scaleRoomsToFit(roomsOnFloor, plotW, plotH);

      // Build pre-placed list for this floor from ground-floor anchors
      const prePlaced = [];
      if (fIdx > 0) {
        for (const room of scaled) {
          const anchor = verticalAnchor.get(room.kind);
          if (!anchor) continue;
          // Enforce same position AND same dimensions as ground floor
          prePlaced.push({
            ...room,
            x: anchor.x,
            y: anchor.y,
            w: anchor.w,
            h: anchor.h,
          });
        }
      }

      const { placed, unplaced, conflicts } = solveFloor(
        scaled, plotW, plotH, variantIdx, vastuEnabled, prePlaced
      );

      // After ground floor, record positions of vertically-stacked elements:
      // staircase, bathrooms, kitchen, and utility — all share plumbing shafts
      // or structural cores and must land at the same (x, y) on every floor.
      if (fIdx === 0) {
        const STACK_KINDS = new Set(['staircase', 'bathroomAttached', 'bathroomCommon', 'kitchen', 'utility']);
        for (const r of placed) {
          if (STACK_KINDS.has(r.kind) && !verticalAnchor.has(r.kind)) {
            verticalAnchor.set(r.kind, { x: r.x, y: r.y, w: r.w, h: r.h });
          }
        }
      }

      placed.forEach((r) => allPlaced.push({ ...r, floor: fIdx + 1 }));
      unplaced.forEach((r) => allUnplaced.push({ ...r, floor: fIdx + 1 }));
      if (conflicts.length) allConflicts.push(...conflicts.map((pair) => ({ floor: fIdx + 1, pair })));
      floorsMeta.push({ w: plotW, h: plotH });
    });

    // If any rooms couldn't be placed, surface it as an error in this option
    const placementError = allUnplaced.length > 0
      ? {
          code: 'ROOMS_UNPLACED',
          message: `${allUnplaced.length} room(s) could not be placed without overlapping: ${allUnplaced.map((r) => r.label).join(', ')}. Reduce the number of rooms or increase the plot area.`,
          unplacedRooms: allUnplaced.map((r) => ({ id: r.id, label: r.label, floor: r.floor })),
        }
      : null;

    // Vastu score uses original (pre-expand) positions
    const isVastuVariant = variantIdx === 0 && vastuEnabled;
    const vastuScore = vastuEnabled
      ? computeVastuScore(allPlaced.filter((r) => r.floor === 1), plotW, plotH)
      : undefined;

    // Expand per floor and run post-placement validation on final geometry
    const postPlacementWarnings = [];
    const expandedRooms = floorBuckets.flatMap((_, fIdx) => {
      const floorRooms = expandToFillPlot(
        allPlaced.filter((r) => r.floor === fIdx + 1),
        plotW, plotH
      );
      const floorWarnings = validatePostPlacement(floorRooms, plotW, plotH);
      floorWarnings.forEach((w) => postPlacementWarnings.push({ ...w, floor: fIdx + 1 }));
      return floorRooms;
    });

    const totalArea = expandedRooms.reduce((acc, r) => acc + r.w * r.h, 0);

    const complianceNotes = ['NBC §10 minimum room sizes', 'NBC §5 ventilation setbacks'];
    if (floors > 1) complianceNotes.push('Staircase aligned at same position on all floors');
    if (floors > 1) complianceNotes.push('Wet areas stacked vertically for shared plumbing');
    if (isVastuVariant) complianceNotes.push('Vastu directional zones enforced (NE→pooja, SE→kitchen, SW→master BR)');

    return {
      id:      meta.id,
      variant: isVastuVariant ? meta.labelVastu : meta.labelFallback,
      summary: isVastuVariant ? meta.summaryVastu : meta.summaryFallback,
      rooms:   expandedRooms,
      floors:  floorsMeta,
      plotDimensions: { side, plotW, plotH, setbackFront, setbackSide },
      totalArea: Math.round(totalArea),
      complianceNotes,
      ...(vastuScore !== undefined          && { vastuScore }),
      ...(allConflicts.length               && { layoutWarnings: allConflicts }),
      ...(postPlacementWarnings.length      && { postPlacementWarnings }),
      ...(placementError                    && { placementError }),
    };
  });

  return { feasible: true, options };
}

module.exports = {
  generateFloorPlans,
  COLORS,
  ROOM_SPEC,
  buildRoomSpecs,
  distributeRoomsToFloors,
  scaleRoomsToFit,
  expandToFillPlot,
};
