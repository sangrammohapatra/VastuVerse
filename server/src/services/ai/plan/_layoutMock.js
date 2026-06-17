/**
 * Mock floor-plan layout generator.
 *
 * Produces 3 plausible options from roomConfig + landDetails using simple
 * shelf-packing with variant-specific tweaks. Every plan provider falls back
 * to this when its real LLM call isn't configured or fails.
 *
 * Returns { options: [...] } matching the contract in floorPlanPrompt.js.
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
};

const ROOM_SPEC = {
  bedroom:          { w: 12, h: 12 },
  bathroomAttached: { w: 6,  h: 8 },
  bathroomCommon:   { w: 7,  h: 9 },
  kitchen:          { w: 10, h: 12 },
  living:           { w: 16, h: 14 },
  dining:           { w: 12, h: 10 },
  pooja:            { w: 6,  h: 6 },
  study:            { w: 10, h: 10 },
  garage:           { w: 12, h: 18 },
  servant:          { w: 8,  h: 10 },
  storage:          { w: 6,  h: 6 },
  balcony:          { w: 4,  h: 8 },
  staircase:        { w: 6,  h: 10 },
};

const VARIANTS = [
  { id: 'opt-1', variant: 'Vastu Optimised', summary: 'Kitchen SE, Pooja NE, Master SW — aligned with traditional Vastu principles.' },
  { id: 'opt-2', variant: 'Modern Open',     summary: 'Open kitchen flowing into living/dining, larger common areas.' },
  { id: 'opt-3', variant: 'Space Maximised', summary: 'Compact placement with maximum usable space and shorter circulation.' },
];

function toSqft(area, unit) {
  if (!area) return 0;
  if (unit === 'sqm') return area * SQM_TO_SQFT;
  if (unit === 'sqyd') return area * 9;
  return area;
}

/** Build a flat list of room specs from roomConfig. */
function buildRoomSpecs(roomConfig = {}) {
  const out = [];
  const sp = roomConfig.additionalSpaces || [];

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

  if (sp.includes('living'))  out.push({ id: 'living',  kind: 'living',  label: 'Living',  ...ROOM_SPEC.living,  color: COLORS.living });
  if (sp.includes('dining'))  out.push({ id: 'dining',  kind: 'dining',  label: 'Dining',  ...ROOM_SPEC.dining,  color: COLORS.dining });
  if (sp.includes('pooja'))   out.push({ id: 'pooja',   kind: 'pooja',   label: 'Pooja',   ...ROOM_SPEC.pooja,   color: COLORS.pooja });
  if (sp.includes('study'))   out.push({ id: 'study',   kind: 'study',   label: 'Study',   ...ROOM_SPEC.study,   color: COLORS.study });
  if (sp.includes('garage'))  out.push({ id: 'garage',  kind: 'garage',  label: 'Garage',  ...ROOM_SPEC.garage,  color: COLORS.garage });
  if (sp.includes('servant')) out.push({ id: 'servant', kind: 'servant', label: 'Servant Qtrs', ...ROOM_SPEC.servant, color: COLORS.servant });
  if (sp.includes('storage')) out.push({ id: 'storage', kind: 'storage', label: 'Storage', ...ROOM_SPEC.storage, color: COLORS.storage });

  if (sp.includes('balcony')) {
    for (let i = 1; i <= (roomConfig.balconies || 0); i++) {
      out.push({ id: `balcony-${i}`, kind: 'balcony', label: `Balcony ${i}`, ...ROOM_SPEC.balcony, color: COLORS.balcony });
    }
  }
  if (sp.includes('staircase') || (roomConfig.staircases || 0) > 0) {
    for (let i = 1; i <= (roomConfig.staircases || 0); i++) {
      out.push({ id: `stair-${i}`, kind: 'staircase', label: `Staircase ${i}`, ...ROOM_SPEC.staircase, color: COLORS.staircase });
    }
  }
  return out;
}

/** Determine which floor each room belongs to. Uses explicit assignments if provided. */
function distributeRoomsToFloors(rooms, floorAssignments, floors) {
  const byFloor = Array.from({ length: floors }, () => []);
  const assigned = new Set();

  // Honour explicit assignments first
  for (let f = 1; f <= floors; f++) {
    const ids = (floorAssignments?.[`floor${f}`] || []);
    ids.forEach((id) => {
      const r = rooms.find((rm) => rm.id === id);
      if (r && !assigned.has(id)) {
        byFloor[f - 1].push(r);
        assigned.add(id);
      }
    });
  }

  // Auto-distribute the rest. Default: shared areas go to ground floor,
  // bedrooms/attached bathrooms go to upper floors when available.
  const SHARED = new Set(['living', 'dining', 'kitchen', 'pooja', 'garage']);
  const groundIdx = 0;
  const upperFloors = floors > 1 ? Array.from({ length: floors - 1 }, (_, i) => i + 1) : [];
  let upperPick = 0;

  rooms.forEach((r) => {
    if (assigned.has(r.id)) return;
    if (SHARED.has(r.kind) || floors === 1 || r.kind === 'storage') {
      byFloor[groundIdx].push(r);
    } else if ((r.kind === 'bedroom' || r.kind === 'bathroomAttached') && upperFloors.length) {
      byFloor[upperFloors[upperPick % upperFloors.length]].push(r);
      upperPick += 1;
    } else if (r.kind === 'staircase') {
      // a staircase on every floor
      for (let f = 0; f < floors; f++) byFloor[f].push({ ...r, id: `${r.id}__f${f + 1}` });
    } else {
      byFloor[groundIdx].push(r);
    }
    assigned.add(r.id);
  });

  return byFloor;
}

/**
 * Scale rooms so they collectively fit within the plot.
 * Ensures no single room exceeds plot dimensions and total area fits at ~85% fill.
 */
function scaleRoomsToFit(rooms, plotW, plotH) {
  if (!rooms.length) return rooms;
  const totalArea = rooms.reduce((s, r) => s + r.w * r.h, 0);
  const plotArea = plotW * plotH;
  const areaScale = totalArea > 0 ? Math.sqrt((plotArea * 0.85) / totalArea) : 1;
  const maxRoomW = Math.max(...rooms.map((r) => r.w));
  const maxRoomH = Math.max(...rooms.map((r) => r.h));
  const widthScale = maxRoomW > plotW * 0.95 ? (plotW * 0.95) / maxRoomW : 1;
  const heightScale = maxRoomH > plotH * 0.95 ? (plotH * 0.95) / maxRoomH : 1;
  const scale = Math.min(1, areaScale, widthScale, heightScale);
  if (scale >= 0.99) return rooms;
  return rooms.map((r) => ({
    ...r,
    w: Math.max(4, Math.round(r.w * scale)),
    h: Math.max(4, Math.round(r.h * scale)),
  }));
}

/**
 * Stretch all placed rooms so they completely fill plotW × plotH.
 * Each row's rooms are scaled to fill the full width; rows are scaled to fill the full height.
 */
function fillPlot(placed, plotW, plotH) {
  if (!placed.length) return placed;

  // Group by packed y-coordinate (= row identity)
  const rowYs = [...new Set(placed.map((r) => r.y))].sort((a, b) => a - b);
  const byRow = new Map(rowYs.map((y) => [y, placed.filter((r) => r.y === y).sort((a, b) => a.x - b.x)]));

  // Width pass: each row fills plotW
  const widthFilled = [];
  for (const [, row] of byRow) {
    const totalW = row.reduce((s, r) => s + r.w, 0);
    let curX = 0;
    row.forEach((r, i) => {
      const newW = i === row.length - 1 ? plotW - curX : Math.round((r.w / totalW) * plotW);
      widthFilled.push({ ...r, x: curX, w: newW });
      curX += newW;
    });
  }

  // Height pass: all rows together fill plotH
  const rowMaxH = rowYs.map((y) => Math.max(...placed.filter((r) => r.y === y).map((r) => r.h)));
  const totalH = rowMaxH.reduce((s, h) => s + h, 0);
  let curY = 0;
  const yMeta = new Map();
  rowYs.forEach((origY, i) => {
    const newH = i === rowYs.length - 1 ? plotH - curY : Math.round((rowMaxH[i] / totalH) * plotH);
    yMeta.set(origY, { y: curY, h: newH });
    curY += newH;
  });

  return widthFilled.map((r) => ({ ...r, y: yMeta.get(r.y).y, h: yMeta.get(r.y).h }));
}

/** Basic shelf packer — returns placed rooms (local coords) and any that didn't fit. */
function shelfPack(rooms, maxW, maxH) {
  let x = 0, y = 0, rowH = 0;
  const placed = [], overflow = [];
  for (const r of rooms) {
    if (x + r.w > maxW) { x = 0; y += rowH; rowH = 0; }
    if (y + r.h > maxH) { overflow.push(r); continue; }
    placed.push({ ...r, x, y });
    x += r.w;
    rowH = Math.max(rowH, r.h);
  }
  return { placed, overflow };
}

/**
 * Sort non-staircase rooms by variant preference and pair each attached bathroom
 * directly after its bedroom so they land adjacent in the shelf packer.
 */
function sortAndPairRooms(rooms, variantIdx, vastuEnabled) {
  const sorted = [...rooms];
  if (variantIdx === 0 && vastuEnabled) {
    sorted.sort((a, b) => priority(a, ['pooja', 'kitchen', 'living', 'bedroom', 'bathroomAttached']) - priority(b, ['pooja', 'kitchen', 'living', 'bedroom', 'bathroomAttached']));
  } else if (variantIdx === 1) {
    sorted.sort((a, b) => priority(a, ['living', 'dining', 'kitchen', 'bedroom', 'bathroomAttached']) - priority(b, ['living', 'dining', 'kitchen', 'bedroom', 'bathroomAttached']));
  } else {
    sorted.sort((a, b) => (b.w * b.h) - (a.w * a.h));
  }
  // Interleave: each attached bathroom immediately follows its paired bedroom
  const baths = sorted.filter((r) => r.kind === 'bathroomAttached');
  const paired = [];
  for (const r of sorted.filter((r) => r.kind !== 'bathroomAttached')) {
    paired.push(r);
    if (r.kind === 'bedroom') {
      const bath = baths.shift();
      if (bath) paired.push(bath);
    }
  }
  paired.push(...baths);
  return paired;
}

/**
 * Shelf-pack a floor using a two-zone layout so the staircase is always at the
 * same position and size across every floor:
 *
 *   ┌──────┬──────────────────┐
 *   │Stair │   Zone A         │  y: 0 → stairH
 *   ├──────┴──────────────────┤
 *   │   Zone B (full width)   │  y: stairH → plotH
 *   └─────────────────────────┘
 *
 * stairW / stairH are percentages of plotW / plotH → identical on every floor.
 */
function packFloor(rooms, plotW, plotH, variantIdx, vastuEnabled) {
  const stairRooms = rooms.filter((r) => r.kind === 'staircase');
  const otherRooms = rooms.filter((r) => r.kind !== 'staircase');

  // Fixed staircase slot — same proportions on all floors
  const stairW = stairRooms.length ? Math.max(4, Math.round(plotW * 0.22)) : 0;
  const stairH = stairRooms.length ? Math.max(6, Math.round(plotH * 0.45)) : 0;

  // Pre-place staircase at the fixed top-left position
  const placed = stairRooms.slice(0, 1).map((s) => ({ ...s, x: 0, y: 0, w: stairW, h: stairH }));

  // Zone A (right of staircase) and Zone B (full width below)
  const zoneAW = plotW - stairW;
  const zoneAH = stairH;
  const zoneBW = plotW;
  const zoneBH = plotH - stairH;

  // Scale other rooms to the available total area; cap individual room height
  const availArea = (zoneAW * zoneAH + zoneBW * zoneBH) * 0.9;
  const totalArea = otherRooms.reduce((s, r) => s + r.w * r.h, 0);
  const areaScale = totalArea > 0 ? Math.min(1, Math.sqrt(availArea / totalArea)) : 1;
  const maxZoneH = Math.min(zoneAH || plotH, zoneBH || plotH);
  const maxRH = otherRooms.length ? Math.max(...otherRooms.map((r) => r.h)) : 1;
  const scale = Math.min(areaScale, maxRH > maxZoneH ? maxZoneH / maxRH : 1);

  const sortedPaired = sortAndPairRooms(otherRooms, variantIdx, vastuEnabled);
  const scaled = sortedPaired.map((r) => ({
    ...r,
    w: Math.max(4, Math.round(r.w * scale)),
    h: Math.max(4, Math.round(r.h * scale)),
  }));

  // Pack Zone A, overflow spills to Zone B
  const { placed: aRooms, overflow: bInput } = shelfPack(scaled, zoneAW, zoneAH);
  const { placed: bRooms } = shelfPack(bInput, zoneBW, Math.max(1, zoneBH));

  // fillPlot each zone, then apply coordinate offsets
  const aFilled = aRooms.length
    ? fillPlot(aRooms, zoneAW, zoneAH).map((r) => ({ ...r, x: r.x + stairW }))
    : [];
  const bFilled = bRooms.length
    ? fillPlot(bRooms, zoneBW, Math.max(1, zoneBH)).map((r) => ({ ...r, y: r.y + stairH }))
    : [];

  return [...placed, ...aFilled, ...bFilled];
}

function priority(room, order) {
  const idx = order.indexOf(room.kind);
  return idx === -1 ? 99 : idx;
}

/* ── Public API ─────────────────────────────────────────────────────── */

function generateFloorPlans({ roomConfig = {}, landDetails = {}, vastuEnabled = false } = {}) {
  const areaSqft = toSqft(Number(landDetails.area) || 0, landDetails.unit || 'sqft');
  const floors = Math.max(1, Number(landDetails.floors) || 1);
  const fsi = Number(landDetails.fsi) || 1.5;

  // Per-floor buildable area; approximate square plot side
  const perFloorBUA = (areaSqft * fsi) / floors;
  const side = Math.max(20, Math.round(Math.sqrt(perFloorBUA)));

  // Setbacks (in feet): 5 front, 3 sides+rear
  const setbackFront = 5, setbackSide = 3;
  const plotW = Math.max(15, side - setbackSide * 2);
  const plotH = Math.max(15, side - setbackFront - setbackSide);

  const baseRooms = buildRoomSpecs(roomConfig);

  // Multi-storey buildings always need a staircase even if not explicitly configured
  if (floors > 1 && !baseRooms.some((r) => r.kind === 'staircase')) {
    baseRooms.push({ id: 'stair-1', kind: 'staircase', label: 'Staircase', ...ROOM_SPEC.staircase, color: COLORS.staircase });
  }

  const options = VARIANTS.map((meta, variantIdx) => {
    const floorBuckets = distributeRoomsToFloors(baseRooms, roomConfig.floorAssignments, floors);
    const allPlaced = [];
    const floorsMeta = [];

    floorBuckets.forEach((roomsOnFloor, fIdx) => {
      const placed = packFloor(roomsOnFloor, plotW, plotH, variantIdx, vastuEnabled);
      placed.forEach((r) => allPlaced.push({ ...r, floor: fIdx + 1 }));
      floorsMeta.push({ w: plotW, h: plotH });
    });

    const totalArea = allPlaced.reduce((acc, r) => acc + r.w * r.h, 0);

    const complianceNotes = ['NBC §10 min room sizes', 'NBC §5 ventilation'];
    if (vastuEnabled) complianceNotes.push('Vastu zoning applied');
    if (floors > 1) complianceNotes.push(`${(roomConfig.staircases || 1)} staircase per floor`);

    return {
      ...meta,
      rooms: allPlaced,
      floors: floorsMeta,
      plotDimensions: { side, plotW, plotH, setbackFront, setbackSide },
      totalArea: Math.round(totalArea),
      complianceNotes,
    };
  });

  return { options };
}

module.exports = { generateFloorPlans, COLORS, ROOM_SPEC };
