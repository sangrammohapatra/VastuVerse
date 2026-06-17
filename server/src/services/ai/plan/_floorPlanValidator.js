/**
 * Floor plan feasibility validator — runs before layout generation (Step 3).
 *
 * Checks whether the requested room configuration can physically fit inside
 * the computed plot dimensions while respecting the structural design rules
 * defined in the VastuVerse planning rulebook.
 *
 * Returns { feasible, errors, warnings, suggestions }
 *   feasible: false → caller should abort generation and surface errors to UI
 *   errors   → hard blockers (MUST be resolved by the user)
 *   warnings → soft issues (layout may be sub-optimal but will still generate)
 *
 * Error codes:
 *   AREA_EXCEEDED      — rooms need more sqft than the per-floor BUA allows
 *   ROOM_WIDER_THAN_PLOT — a room's minimum width exceeds the usable plot width
 *   ROOM_TALLER_THAN_PLOT — a room's minimum depth exceeds the usable plot height
 *   NO_BEDROOM         — residential plan with no bedrooms
 *   NO_STAIRCASE       — multi-storey building without a staircase
 *   PLOT_TOO_SMALL     — plot is under NBC §3.1 minimum (20 sqm ≈ 215 sqft)
 *   CIRCULATION_BLOCKED — rooms fill > 92% of BUA; no room for circulation
 *
 * Warning codes:
 *   TIGHT_FIT          — 85–92% fill; circulation will be narrow
 *   NO_LIVING_ROOM     — no living room means public zone is mixed with private
 *   NO_DINING          — kitchen with no dining reduces kitchen usability
 *   BATHROOM_FAR_STACK — bathrooms on upper floors may not align with ground floor
 *   NATURAL_LIGHT_RISK — room count is high relative to plot perimeter; some rooms may lack windows
 */

const SQM_TO_SQFT = 10.7639;

const NBC_MIN_SQFT = {
  bedroom:          80,
  bathroomAttached: 20,
  bathroomCommon:   25,
  kitchen:          50,
  living:           100,
  dining:           80,
  pooja:            25,
  study:            70,
  garage:           130,
  servant:          70,
  storage:          30,
  balcony:          25,
  staircase:        45,
  terrace:          50,
  utility:          50,
  serviceYard:      30,
};

const NBC_MIN_WIDTH = {
  bedroom:          8,
  bathroomAttached: 4,
  bathroomCommon:   5,
  kitchen:          7,
  living:           10,
  dining:           8,
  pooja:            4,
  study:            7,
  garage:           9,
  servant:          6,
  storage:          4,
  balcony:          3,
  staircase:        4,
  terrace:          6,
  utility:          5,
  serviceYard:      3,
};

function toSqft(area, unit) {
  if (!area) return 0;
  if (unit === 'sqm')  return area * SQM_TO_SQFT;
  if (unit === 'sqyd') return area * 9;
  return area;
}

function buildRoomList(roomConfig = {}) {
  const list = [];
  const sp   = roomConfig.additionalSpaces || [];

  for (let i = 0; i < (roomConfig.bedrooms || 0); i++)          list.push('bedroom');
  for (let i = 0; i < (roomConfig.attachedBathrooms || 0); i++) list.push('bathroomAttached');
  for (let i = 0; i < (roomConfig.commonBathrooms || 0); i++)   list.push('bathroomCommon');
  list.push('kitchen');
  for (let i = 0; i < (roomConfig.balconies || 0); i++)         list.push('balcony');
  for (let i = 0; i < (roomConfig.staircases || 0); i++)        list.push('staircase');

  const extras = ['living','dining','pooja','study','garage','servant','storage','terrace','utility','serviceYard'];
  extras.forEach((k) => { if (sp.includes(k)) list.push(k); });

  return list;
}

/**
 * @param {{ roomConfig, landDetails }} payload
 * @returns {{ feasible: boolean, errors: Array, warnings: Array, suggestions: Array }}
 */
function validateFloorPlan({ roomConfig = {}, landDetails = {} } = {}) {
  const errors      = [];
  const warnings    = [];
  const suggestions = [];

  const areaSqft    = toSqft(Number(landDetails.area) || 0, landDetails.unit || 'sqft');
  const floors      = Math.max(1, Number(landDetails.floors) || 1);
  const fsi         = Number(landDetails.fsi) || 1.5;
  const bedrooms    = Number(roomConfig.bedrooms) || 0;
  const staircases  = Number(roomConfig.staircases) || 0;

  // Plot minimum
  if (areaSqft > 0 && areaSqft < 215) {
    errors.push({
      code: 'PLOT_TOO_SMALL',
      message: `Plot area (${Math.round(areaSqft)} sqft) is below the NBC §3.1 minimum of 20 sqm (215 sqft). Increase the plot area or switch to a commercial classification.`,
    });
  }

  // Bedroom requirement
  if (bedrooms === 0) {
    errors.push({
      code: 'NO_BEDROOM',
      message: 'A residential floor plan must include at least one bedroom.',
    });
  }

  // Staircase for multi-storey
  if (floors > 1 && staircases < 1) {
    errors.push({
      code: 'NO_STAIRCASE',
      message: `A ${floors}-storey building requires at least one staircase (NBC §12.4). Add a staircase in the room configuration.`,
    });
  }

  // Compute buildable area per floor
  const totalBUA     = areaSqft > 0 ? areaSqft * fsi : 0;
  const perFloorBUA  = totalBUA / floors;

  if (perFloorBUA > 0) {
    const roomKinds    = buildRoomList(roomConfig);
    const totalNeeded  = roomKinds.reduce((s, k) => s + (NBC_MIN_SQFT[k] || 0), 0);
    const circulationReserve = perFloorBUA * 0.10; // minimum 10% for corridors
    const usable       = perFloorBUA - circulationReserve;
    const fillPct      = totalNeeded / perFloorBUA;

    if (totalNeeded > perFloorBUA) {
      const excess = Math.round(totalNeeded - perFloorBUA);
      const saves  = buildQuickFixes(roomKinds, excess);
      errors.push({
        code: 'AREA_EXCEEDED',
        message: `The selected rooms require a minimum of ${Math.round(totalNeeded)} sqft per floor, but the plot provides only ${Math.round(perFloorBUA)} sqft (${excess} sqft over). Remove rooms or increase floors/FSI.`,
        needed: Math.round(totalNeeded),
        available: Math.round(perFloorBUA),
        excess,
        quickFixes: saves,
      });
    } else if (totalNeeded > usable) {
      warnings.push({
        code: 'CIRCULATION_BLOCKED',
        message: `Rooms fill ${Math.round(fillPct * 100)}% of the per-floor BUA, leaving less than 10% for corridors and circulation. Consider removing 1–2 smaller rooms.`,
      });
    } else if (fillPct > 0.85) {
      warnings.push({
        code: 'TIGHT_FIT',
        message: `Rooms fill ~${Math.round(fillPct * 100)}% of the per-floor BUA. Layout will be tight; circulation paths may be narrower than the recommended 3 ft.`,
      });
    }

    // Check each room's minimum width vs. plot width
    const setbackSide  = 3;
    const setbackFront = 5;
    const side         = Math.max(20, Math.round(Math.sqrt(perFloorBUA)));
    const plotW        = Math.max(15, side - setbackSide * 2);
    const plotH        = Math.max(15, side - setbackFront - setbackSide);

    const wide = roomKinds.find((k) => (NBC_MIN_WIDTH[k] || 0) > plotW);
    if (wide) {
      errors.push({
        code: 'ROOM_WIDER_THAN_PLOT',
        message: `The minimum width for a ${wide} (${NBC_MIN_WIDTH[wide]} ft) exceeds the usable plot width (${plotW} ft). Increase the plot area or remove this room type.`,
      });
    }

    const tall = roomKinds.find((k) => (NBC_MIN_WIDTH[k] || 0) > plotH);
    if (tall) {
      errors.push({
        code: 'ROOM_TALLER_THAN_PLOT',
        message: `The minimum depth for a ${tall} (${NBC_MIN_WIDTH[tall]} ft) exceeds the usable plot depth (${plotH} ft). Increase the plot area or remove this room type.`,
      });
    }
  }

  // Soft warnings — functional zoning, natural light, kitchen-dining
  const sp = roomConfig.additionalSpaces || [];

  if (!sp.includes('living') && bedrooms > 1) {
    warnings.push({
      code: 'NO_LIVING_ROOM',
      message: 'Without a living room, guests must enter private bedroom zones directly. Add a living room to separate the public and private zones.',
    });
  }

  if (!sp.includes('dining') && bedrooms > 0) {
    warnings.push({
      code: 'NO_DINING',
      message: 'No dining area — the kitchen will double as a dining space, reducing usability. Add a dining room for better functionality.',
    });
  }

  // Natural light risk: each habitable room needs at least one external wall.
  // Rough heuristic: if total rooms > 2 × (plot perimeter / avg room width), some rooms will be internal.
  if (perFloorBUA > 0) {
    const side       = Math.round(Math.sqrt(perFloorBUA));
    const perimeter  = 4 * side;
    const avgRoomW   = 10; // ft, conservative estimate
    const maxRooms   = Math.floor(perimeter / avgRoomW);
    const roomKinds  = buildRoomList(roomConfig);
    const habitable  = roomKinds.filter((k) => !['staircase','storage','balcony'].includes(k));

    if (habitable.length > maxRooms) {
      warnings.push({
        code: 'NATURAL_LIGHT_RISK',
        message: `${habitable.length} habitable rooms for a ~${side}×${side} ft footprint — some rooms may not get external walls or natural light. NBC §5 requires every habitable room to have a window.`,
      });
    }
  }

  if (floors > 1 && (roomConfig.attachedBathrooms || 0) + (roomConfig.commonBathrooms || 0) > 0) {
    const bathsOnGround = 1; // assumption: at least one ground-floor bathroom
    if ((roomConfig.attachedBathrooms || 0) > bathsOnGround) {
      suggestions.push({
        code: 'BATHROOM_FAR_STACK',
        message: 'Stack bathrooms vertically (same x/y on each floor) to keep plumbing shafts short and costs low.',
      });
    }
  }

  const feasible = errors.length === 0;
  return { feasible, errors, warnings, suggestions };
}

function buildQuickFixes(roomKinds, excessSqft) {
  const candidates = ['garage','servant','serviceYard','utility','storage','study','dining','pooja'];
  const fixes = [];
  let saved = 0;
  for (const kind of candidates) {
    if (!roomKinds.includes(kind)) continue;
    const save = NBC_MIN_SQFT[kind] || 0;
    fixes.push(`Remove ${kind} (saves ~${save} sqft)`);
    saved += save;
    if (saved >= excessSqft) break;
  }
  if (fixes.length === 0) {
    fixes.push('Add 1 floor to redistribute the room area');
    fixes.push('Increase FSI if local bylaws allow');
  }
  return fixes;
}

module.exports = { validateFloorPlan };
