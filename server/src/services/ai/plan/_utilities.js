/**
 * Utility-plan rule engine (deterministic).
 *
 * Computes the six MEP layers from the user's selected floor plan + room
 * config. Returns geometry (paths + markers in feet, scaled by client) AND
 * summary statistics for the bottom cards.
 *
 * Layer colours follow the brief:
 *   plumbing       #42A5F5  (blue)
 *   electrical     #FFB300  (yellow)
 *   hvac           #9E9E9E  (grey)
 *   waterTanks     #00BCD4  (cyan)
 *   sewage         #8D6E63  (brown)
 *   solar          #FF6F00  (orange)
 */

const COLORS = {
  plumbing:   '#42A5F5',
  electrical: '#FFB300',
  hvac:       '#9E9E9E',
  waterTanks: '#00BCD4',
  sewage:     '#8D6E63',
  solar:      '#FF6F00',
};

const WET_KINDS = new Set(['kitchen', 'bathroomAttached', 'bathroomCommon']);
const COOL_KINDS = new Set(['bedroom', 'living', 'study']);

/* ── Helpers ────────────────────────────────────────────────────────── */

function roomCenter(r) {
  return { x: r.x + r.w / 2, y: r.y + r.h / 2 };
}

function distance(a, b) {
  return Math.round(Math.hypot(a.x - b.x, a.y - b.y) * 10) / 10;
}

function orthogonalRoute(from, to, corridor) {
  // L-shape via a shared corridor — first run to corridor y, then to drain x.
  return [
    [from.x, from.y],
    [from.x, corridor],
    [to.x, corridor],
    [to.x, to.y],
  ];
}

/* ── Layer computers ───────────────────────────────────────────────── */

function computePlumbing(rooms, plotW, plotH) {
  // Drain manifold at front-centre (south side, y near plotH)
  const drain = { x: Math.round(plotW / 2), y: plotH - 1 };
  const corridor = plotH - 2;

  const wet = rooms.filter((r) => WET_KINDS.has(r.kind));
  const paths = wet.map((r) => ({
    label: r.label,
    color: COLORS.plumbing,
    points: orthogonalRoute(roomCenter(r), drain, corridor),
  }));

  const markers = wet.map((r) => {
    const c = roomCenter(r);
    return { type: 'fixture', x: c.x, y: c.y, label: 'WC/Sink', color: COLORS.plumbing };
  });
  markers.push({ type: 'drain', x: drain.x, y: drain.y, label: 'Drain Manifold', color: COLORS.plumbing });

  const totalPipeFt = paths.reduce((acc, p) => {
    for (let i = 1; i < p.points.length; i++) {
      acc += Math.hypot(p.points[i][0] - p.points[i - 1][0], p.points[i][1] - p.points[i - 1][1]);
    }
    return acc;
  }, 0);

  return {
    color: COLORS.plumbing,
    paths,
    markers,
    summary: {
      fixtures: wet.length,
      hotWaterLines: wet.filter((r) => r.kind !== 'kitchen').length,
      pipeRunFt: Math.round(totalPipeFt),
    },
  };
}

function computeElectrical(rooms, plotW, plotH, roomConfig) {
  // Meter box at front-left, runs to each room centre.
  const meter = { x: 1.5, y: plotH - 1.5 };
  const corridor = plotH - 2.5;

  const paths = rooms.map((r) => ({
    label: r.label,
    color: COLORS.electrical,
    points: orthogonalRoute(roomCenter(r), meter, corridor),
  }));

  const markers = rooms.map((r) => {
    const c = roomCenter(r);
    return { type: 'light', x: c.x, y: c.y, label: r.label, color: COLORS.electrical };
  });
  markers.push({ type: 'meter', x: meter.x, y: meter.y, label: 'Meter', color: COLORS.electrical });

  // Sanctioned load: base 2 kW + 1.5 kW/BR + 3 kW kitchen + 1 kW/bath
  const bedrooms = roomConfig?.bedrooms || 0;
  const baths = (roomConfig?.attachedBathrooms || 0) + (roomConfig?.commonBathrooms || 0);
  const rawKw = 2 + bedrooms * 1.5 + 3 + baths * 1.0;
  const sanctioned = [3, 5, 8, 10, 15].find((t) => t >= rawKw) || 20;

  return {
    color: COLORS.electrical,
    paths,
    markers,
    summary: {
      lightingPoints: rooms.length * 2,
      powerPoints: rooms.length * 3 + 4, // ~3/room + 4 for kitchen appliances
      sanctionedLoadKw: sanctioned,
      estimatedConnectedLoadKw: Math.round(rawKw * 10) / 10,
    },
  };
}

function computeHvac(rooms, plotW, plotH, roomConfig) {
  // Indoor split AC units in bedrooms + living. Outdoor units stack outside south side.
  const cooled = rooms.filter((r) => COOL_KINDS.has(r.kind));

  // 1 ton ~ 120 sqft
  const units = cooled.map((r) => {
    const sqft = r.w * r.h;
    const ton = Math.max(1, Math.ceil((sqft / 120) * 2) / 2); // round to 0.5
    const c = roomCenter(r);
    return { room: r.id, label: r.label, ton, x: c.x, y: c.y };
  });

  const markers = units.map((u) => ({
    type: 'ac-indoor',
    x: u.x, y: u.y - 2,
    label: `${u.ton} ton`,
    color: COLORS.hvac,
  }));

  // Outdoor compressor cluster at south wall
  units.forEach((_, i) => {
    markers.push({
      type: 'ac-outdoor',
      x: 2 + i * 3,
      y: plotH - 0.5,
      label: 'ODU',
      color: COLORS.hvac,
    });
  });

  const totalTon = units.reduce((acc, u) => acc + u.ton, 0);

  return {
    color: COLORS.hvac,
    paths: [], // visual is markers only
    markers,
    summary: {
      units: units.length,
      totalTonnage: Math.round(totalTon * 10) / 10,
      coolingArea: cooled.reduce((acc, r) => acc + r.w * r.h, 0),
      perUnit: units.map(({ room, label, ton }) => ({ room, label, ton })),
    },
  };
}

function computeWaterTanks(roomConfig, plotW, plotH) {
  // Assumed occupancy: 2 persons per bedroom + 1
  const persons = (roomConfig?.bedrooms || 1) * 2 + 1;
  const perDayLitres = persons * 135; // NBC minimum

  // Overhead = 1 day, underground = 2 days. Round up to nearest 500L.
  const overhead = Math.ceil(perDayLitres / 500) * 500;
  const underground = Math.ceil((perDayLitres * 2) / 500) * 500;

  const markers = [
    { type: 'tank-oh',  x: plotW - 2, y: 1.5, label: `OH ${overhead}L`,  color: COLORS.waterTanks },
    { type: 'tank-ug',  x: 1.5,        y: 1.5, label: `UG ${underground}L`, color: COLORS.waterTanks },
  ];
  const paths = [{
    label: 'Pump line',
    color: COLORS.waterTanks,
    points: [[1.5, 1.5], [1.5, plotH - 2], [plotW - 2, plotH - 2], [plotW - 2, 1.5]],
    dashed: true,
  }];

  return {
    color: COLORS.waterTanks,
    paths,
    markers,
    summary: {
      persons,
      perDayLitres,
      overheadLitres: overhead,
      undergroundLitres: underground,
      formula: `${persons} persons × 135 L/day × buffer`,
    },
  };
}

function computeSewage(rooms, plotW, plotH, roomConfig) {
  // Septic tank at back-left, soak pit to its right.
  const septic = { x: 2.5, y: 2.5 };
  const soak   = { x: 5.5, y: 2.5 };

  const wet = rooms.filter((r) => r.kind === 'bathroomAttached' || r.kind === 'bathroomCommon');
  const paths = wet.map((r) => ({
    label: r.label,
    color: COLORS.sewage,
    points: orthogonalRoute(roomCenter(r), septic, 3),
  }));
  // Septic → soak link
  paths.push({
    label: 'Septic→Soak',
    color: COLORS.sewage,
    points: [[septic.x + 1, septic.y], [soak.x - 1, soak.y]],
  });

  const persons = (roomConfig?.bedrooms || 1) * 2 + 1;
  const septicCap = Math.max(2000, persons * 350); // 350 L/person rule of thumb

  return {
    color: COLORS.sewage,
    paths,
    markers: [
      { type: 'septic', x: septic.x, y: septic.y, label: `Septic ${septicCap}L`, color: COLORS.sewage },
      { type: 'soak',   x: soak.x,   y: soak.y,   label: 'Soak Pit',             color: COLORS.sewage },
    ],
    summary: {
      septicCapacityLitres: septicCap,
      soakPit: true,
      bathroomCount: wet.length,
    },
  };
}

function computeSolar(plotW, plotH) {
  // Solar array across rear-roof (north side, y near 0); panels facing south.
  const area = (plotW - 6) * 4; // 4 ft wide band, 3 ft setback each side
  const wattsPerSqft = 12;
  const kwp = Math.round(((area * wattsPerSqft) / 1000) * 10) / 10;
  const panelCount = Math.max(1, Math.round((kwp * 1000) / 400));
  const monthlyKwh = Math.round(kwp * 4.5 * 30);
  const savingsInr = Math.round(monthlyKwh * 7); // ₹7/unit retail

  return {
    color: COLORS.solar,
    paths: [],
    markers: [
      {
        type: 'solar-array',
        x: 3, y: 0.5,
        w: plotW - 6, h: 4,
        label: `${kwp} kWp`,
        color: COLORS.solar,
      },
    ],
    summary: {
      recommendedKwp: kwp,
      panelCount,
      arrayAreaSqft: Math.round(area),
      estimatedMonthlyKwh: monthlyKwh,
      estimatedMonthlySavingsInr: savingsInr,
    },
  };
}

/* ── Public ─────────────────────────────────────────────────────────── */

function generateUtilities({ floorPlan = {}, roomConfig = {}, landDetails = {} } = {}) {
  const selected = floorPlan.options?.find((o) => o.id === floorPlan.selectedOptionId)
    || floorPlan.options?.[0];

  if (!selected || !Array.isArray(selected.rooms) || selected.rooms.length === 0) {
    const err = new Error('no_floor_plan_selected');
    err.status = 422;
    throw err;
  }

  const plotW = selected.plotDimensions?.plotW || 30;
  const plotH = selected.plotDimensions?.plotH || 30;

  // Group by floor — we render utilities per floor on the client
  const floorIds = Array.from(new Set(selected.rooms.map((r) => r.floor))).sort();
  const layers = {
    plumbing: [], electrical: [], hvac: [],
    waterTanks: [], sewage: [], solar: [],
  };

  floorIds.forEach((floor) => {
    const roomsOnFloor = selected.rooms.filter((r) => r.floor === floor);
    layers.plumbing.push({ floor, ...computePlumbing(roomsOnFloor, plotW, plotH) });
    layers.electrical.push({ floor, ...computeElectrical(roomsOnFloor, plotW, plotH, roomConfig) });
    layers.hvac.push({ floor, ...computeHvac(roomsOnFloor, plotW, plotH, roomConfig) });
    // Tanks/sewage/solar only on ground floor visually
    if (floor === 1) {
      layers.waterTanks.push({ floor, ...computeWaterTanks(roomConfig, plotW, plotH) });
      layers.sewage.push({ floor, ...computeSewage(roomsOnFloor, plotW, plotH, roomConfig) });
      layers.solar.push({ floor, ...computeSolar(plotW, plotH) });
    } else {
      layers.waterTanks.push({ floor, color: COLORS.waterTanks, paths: [], markers: [] });
      layers.sewage.push({ floor, color: COLORS.sewage, paths: [], markers: [] });
      layers.solar.push({ floor, color: COLORS.solar, paths: [], markers: [] });
    }
  });

  // Top-level summary: aggregate stats from floor-1 layers (the canonical view)
  const f1 = (key) => layers[key][0]?.summary || {};

  return {
    plotDimensions: { plotW, plotH },
    floorPlanOptionId: selected.id,
    floors: floorIds,
    layers,
    summary: {
      plumbing:   f1('plumbing'),
      electrical: f1('electrical'),
      hvac:       f1('hvac'),
      waterTanks: f1('waterTanks'),
      sewage:     f1('sewage'),
      solar:      f1('solar'),
    },
  };
}

module.exports = { generateUtilities, COLORS };
