/**
 * Municipal compliance rule engine.
 *
 * Computes a 7-item compliance checklist against a Plan + (optional)
 * MunicipalRule row for the city/state. When no row exists we fall back to
 * NBC 2016 + bundled defaults — the report is still meaningful, just less
 * city-specific.
 *
 * Each check returns the same shape so the UI can render them uniformly:
 *   { id, label, status, severity, summary, actual, required, reference }
 *
 * status: 'pass' | 'fail' | 'warning' | 'info'
 * severity (when failing): 'low' | 'medium' | 'high'
 */

const FT_PER_M = 3.28084;
const SQM_PER_SQFT = 0.092903;

/* ── NBC 2016 defaults (used when MunicipalRule absent or partial) ─── */

const NBC_DEFAULTS = {
  setbacksByPlotSqm: [
    // [ <= sqm, { front, rear, side } ] — metres
    [200, { front: 3.0, rear: 1.5, side: 1.5 }],
    [500, { front: 4.5, rear: 3.0, side: 1.5 }],
    [Infinity, { front: 6.0, rear: 4.5, side: 3.0 }],
  ],
  fsiLimitByZone: { residential: 1.75, commercial: 2.5, mixed: 2.0, default: 1.75 },
  groundCoverageMaxPct: 60,
  parkingPerDwelling: 1,
  parkingSpaceSqft: 100,        // ≈ 9.3 sqm
  minRoadWidthMByPlotSqm: [
    [200, 6],
    [500, 7.5],
    [Infinity, 9],
  ],
  fireMinStaircaseWidthM: 1.0,
  fireMinExitsForSqm: 500,
  seismicZoneByState: {
    // Coarse zoning — IS 1893 Part 1 has the full map.
    'Gujarat': 'IV–V', 'Maharashtra': 'III', 'Karnataka': 'II–III',
    'Tamil Nadu': 'II–III', 'Kerala': 'III', 'Telangana': 'II',
    'Andhra Pradesh': 'II–III', 'Odisha': 'II–III', 'West Bengal': 'III–IV',
    'Bihar': 'IV–V', 'Uttar Pradesh': 'II–IV', 'Delhi': 'IV',
    'Haryana': 'IV', 'Punjab': 'IV', 'Rajasthan': 'II–IV',
    'Himachal Pradesh': 'IV–V', 'Uttarakhand': 'IV–V',
    'Assam': 'V', 'Sikkim': 'IV', 'Jammu & Kashmir': 'IV–V',
  },
};

/* ── Helpers ────────────────────────────────────────────────────────── */

function toSqft(area, unit) {
  if (!area) return 0;
  if (unit === 'sqm') return area / SQM_PER_SQFT;
  if (unit === 'sqyd') return area * 9;
  return Number(area) || 0;
}

function plotSqftToSqm(sqft) { return sqft * SQM_PER_SQFT; }

function pickSetbackTier(plotSqm, source) {
  for (const [max, vals] of source) {
    if (plotSqm <= max) return vals;
  }
  return source[source.length - 1][1];
}

function ftFromM(m) { return Math.round(m * FT_PER_M * 10) / 10; }

function effectiveRules(rules) {
  // Merge MunicipalRule overrides onto NBC defaults
  if (!rules) {
    return {
      hasCityData: false,
      dataSource: 'NBC 2016 (no city ruleset configured)',
    };
  }
  return {
    hasCityData: true,
    dataSource: rules.dataSource || 'Local bye-law',
    fsiLimit: rules.fsiLimit,
    farLimit: rules.farLimit,
    setbacks: rules.setbacks, // m
    maxHeight: rules.maxHeight,
    maxFloors: rules.maxFloors,
    parkingNorms: rules.parkingNorms,
    roadWidthRequired: rules.roadWidthRequired, // m
    fireNorms: rules.fireNorms,
    additionalRules: rules.additionalRules || [],
  };
}

/* ── Geometry: compute actual setbacks from the selected floor plan ── */

function computeActualSetbacks(option) {
  if (!option?.rooms?.length) return null;
  const plotW = option.plotDimensions?.plotW || 0;
  const plotH = option.plotDimensions?.plotH || 0;
  if (!plotW || !plotH) return null;

  // Only consider floor-1 footprint (ground floor defines property-line setbacks)
  const rooms = option.rooms.filter((r) => r.floor === 1);
  if (rooms.length === 0) return null;

  // Convention used by _layoutMock: y=0 at top (north), y=plotH at bottom (front/south)
  let frontFt = Infinity, rearFt = Infinity, leftFt = Infinity, rightFt = Infinity;
  rooms.forEach((r) => {
    frontFt = Math.min(frontFt, plotH - (r.y + r.h)); // distance from south wall to room
    rearFt  = Math.min(rearFt, r.y);                  // distance from north wall
    leftFt  = Math.min(leftFt, r.x);
    rightFt = Math.min(rightFt, plotW - (r.x + r.w));
  });

  return {
    frontFt: Math.max(0, Math.round(frontFt * 10) / 10),
    rearFt:  Math.max(0, Math.round(rearFt * 10) / 10),
    leftFt:  Math.max(0, Math.round(leftFt * 10) / 10),
    rightFt: Math.max(0, Math.round(rightFt * 10) / 10),
  };
}

function groundFootprintSqft(option) {
  if (!option?.rooms?.length) return 0;
  return option.rooms
    .filter((r) => r.floor === 1)
    .reduce((acc, r) => acc + r.w * r.h, 0);
}

/* ── Individual checks ─────────────────────────────────────────────── */

function checkSetbacks(option, plotSqft, eff) {
  const actual = computeActualSetbacks(option);
  if (!actual) {
    return {
      id: 'setback', label: 'Setback compliance',
      status: 'info', severity: 'low',
      summary: 'Select a floor plan in Step 3 to verify setbacks.',
      actual: null, required: null,
      reference: { code: 'NBC 2016 Part 3 §8.1', text: 'Setbacks are measured from the building edge to the property line.' },
    };
  }

  const plotSqm = plotSqftToSqm(plotSqft);
  const required = eff.setbacks?.front
    ? eff.setbacks                                                  // metres from MunicipalRule
    : pickSetbackTier(plotSqm, NBC_DEFAULTS.setbacksByPlotSqm);     // metres from NBC

  const requiredFt = {
    front: ftFromM(required.front),
    rear:  ftFromM(required.rear),
    side:  ftFromM(required.side),
  };

  const fails = [];
  if (actual.frontFt < requiredFt.front) fails.push(`front ${actual.frontFt}ft < ${requiredFt.front}ft`);
  if (actual.rearFt  < requiredFt.rear)  fails.push(`rear ${actual.rearFt}ft < ${requiredFt.rear}ft`);
  if (Math.min(actual.leftFt, actual.rightFt) < requiredFt.side)
    fails.push(`side ${Math.min(actual.leftFt, actual.rightFt)}ft < ${requiredFt.side}ft`);

  const status = fails.length === 0 ? 'pass' : 'fail';
  return {
    id: 'setback',
    label: 'Setback compliance',
    status,
    severity: status === 'fail' ? 'high' : 'low',
    summary: status === 'pass'
      ? `Front ${actual.frontFt}ft / rear ${actual.rearFt}ft / sides ${Math.min(actual.leftFt, actual.rightFt)}ft — all meet bye-law minimums.`
      : `Insufficient setback on: ${fails.join('; ')}.`,
    actual: { ...actual, unit: 'ft' },
    required: { ...requiredFt, unit: 'ft', sourceMetres: required },
    reference: {
      code: eff.hasCityData ? `${eff.dataSource} — setback schedule` : 'NBC 2016 Part 3 §8.1',
      text:
        'Setbacks shall be provided on all sides of a building. Minimum values vary with plot area: ' +
        '≤200 m² → 3.0/1.5/1.5 m (front/rear/side); ≤500 m² → 4.5/3.0/1.5 m; >500 m² → 6.0/4.5/3.0 m.',
    },
  };
}

function checkFsi(plan, option, plotSqft, eff) {
  // BUA: prefer option.totalArea, else land × floors × ground coverage
  let bua = Number(option?.totalArea) || 0;
  if (!bua) {
    const floors = Math.max(1, Number(plan.landDetails?.floors) || 1);
    bua = Math.round(plotSqft * floors * 0.6);
  }
  const fsi = plotSqft > 0 ? Math.round((bua / plotSqft) * 100) / 100 : 0;

  const allowed = Number(eff.fsiLimit) || NBC_DEFAULTS.fsiLimitByZone.residential;
  const ok = fsi <= allowed;

  return {
    id: 'fsi',
    label: 'FSI / FAR within permissible limit',
    status: ok ? 'pass' : 'fail',
    severity: ok ? 'low' : 'high',
    summary: ok
      ? `Proposed FSI ${fsi} against permissible ${allowed} — within limit.`
      : `Proposed FSI ${fsi} exceeds permissible ${allowed}. Reduce BUA or split into more floors.`,
    actual: { fsi, buaSqft: bua, plotSqft },
    required: { maxFsi: allowed },
    reference: {
      code: eff.hasCityData ? `${eff.dataSource} — FSI table` : 'NBC 2016 + state DCR',
      text:
        'Floor Space Index (FSI) = Total built-up area ÷ Plot area. Residential zones in most Indian ' +
        'cities permit FSI between 1.5 and 2.5 depending on plot size and road width.',
    },
  };
}

function checkParking(plan, plotSqft, eff) {
  const driveway = plan.exterior?.driveway?.enabled === true;
  const requiredSlots = NBC_DEFAULTS.parkingPerDwelling;

  if (driveway) {
    return {
      id: 'parking',
      label: 'Parking norms',
      status: 'pass',
      severity: 'low',
      summary: `Driveway present — provides ≥1 covered parking space (${eff.parkingNorms?.fourWheeler || 1} car required per dwelling).`,
      actual: { providedSlots: 1, driveway: true },
      required: { slots: requiredSlots },
      reference: {
        code: eff.hasCityData ? `${eff.dataSource} — parking schedule` : 'NBC 2016 Part 3 §11.0',
        text:
          'A minimum of one off-street four-wheeler parking space is required per residential dwelling unit ' +
          'in most municipal bye-laws. Two-wheeler parking is computed separately.',
      },
    };
  }
  return {
    id: 'parking',
    label: 'Parking norms',
    status: 'fail',
    severity: 'medium',
    summary: 'No driveway/parking declared in Step 5. At least one off-street car parking space is required per dwelling.',
    actual: { providedSlots: 0, driveway: false },
    required: { slots: requiredSlots },
    reference: {
      code: 'NBC 2016 Part 3 §11.0',
      text:
        'A minimum of one off-street four-wheeler parking space is required per residential dwelling unit. ' +
        'Visitor parking may be required additionally for plots above 300 m².',
    },
  };
}

function checkFireEgress(plan, option, eff) {
  // Crude check: every floor must have a staircase egress
  const floors = Math.max(1, Number(plan.landDetails?.floors) || 1);
  const hasStaircase = (option?.rooms || []).some((r) => r.kind === 'staircase');
  const buaSqm = (Number(option?.totalArea) || 0) * SQM_PER_SQFT;

  const needsTwoExits = buaSqm > (eff.fireNorms?.minExitsForSqm || NBC_DEFAULTS.fireMinExitsForSqm);

  if (floors > 1 && !hasStaircase) {
    return {
      id: 'fire',
      label: 'Fire egress compliance',
      status: 'fail',
      severity: 'high',
      summary: `Multi-storey plan with no staircase declared. Each upper floor must have a fire-safe egress.`,
      actual: { floors, hasStaircase, buaSqm: Math.round(buaSqm) },
      required: { staircase: true, minWidthM: NBC_DEFAULTS.fireMinStaircaseWidthM },
      reference: {
        code: 'NBC 2016 Part 4 §4.6',
        text:
          'For residential buildings up to 15 m height, at least one internal staircase of minimum 1.0 m ' +
          'width is required. Above 15 m, two staircases or one staircase plus a fire escape are mandatory.',
      },
    };
  }

  return {
    id: 'fire',
    label: 'Fire egress compliance',
    status: needsTwoExits ? 'warning' : 'pass',
    severity: needsTwoExits ? 'medium' : 'low',
    summary: needsTwoExits
      ? `BUA ${Math.round(buaSqm)} m² exceeds the single-exit threshold — verify with the local Fire Officer.`
      : `Single staircase egress acceptable for BUA ${Math.round(buaSqm)} m² and ${floors} floor(s).`,
    actual: { floors, hasStaircase, buaSqm: Math.round(buaSqm) },
    required: { staircase: true, minWidthM: NBC_DEFAULTS.fireMinStaircaseWidthM },
    reference: {
      code: 'NBC 2016 Part 4 §4.6',
      text:
        'Single staircase of 1.0 m clear width is acceptable for residential occupancy up to 500 m² BUA ' +
        'and 15 m height. Beyond that, two separate exits are mandatory.',
    },
  };
}

function checkRoadWidth(plan, plotSqft, eff) {
  const plotSqm = plotSqftToSqm(plotSqft);
  const required = Number(eff.roadWidthRequired)
    || NBC_DEFAULTS.minRoadWidthMByPlotSqm.find(([max]) => plotSqm <= max)[1];

  const capturedM = Number(plan.landDetails?.roadWidthM) || null;
  const ref = {
    code: eff.hasCityData ? `${eff.dataSource} — road width schedule` : 'State DCR / Master Plan',
    text:
      'Plots up to 200 m² typically need a 6 m road; up to 500 m² need 7.5 m; above 500 m² need 9 m. ' +
      'Plots on private/cul-de-sac roads have separate rules.',
  };

  if (!capturedM) {
    return {
      id: 'road',
      label: 'Minimum abutting road width',
      status: 'warning',
      severity: 'medium',
      summary: `Plot must abut a road of at least ${required} m. Enter the road width in Step 1 for an exact check.`,
      actual: { providedM: null },
      required: { minM: required },
      reference: ref,
    };
  }

  const ok = capturedM >= required;
  return {
    id: 'road',
    label: 'Minimum abutting road width',
    status: ok ? 'pass' : 'fail',
    severity: ok ? 'low' : 'high',
    summary: ok
      ? `Road width ${capturedM} m meets the ${required} m minimum for this plot size.`
      : `Road width ${capturedM} m is below the required ${required} m. Building permission is likely to be denied.`,
    actual: { providedM: capturedM },
    required: { minM: required },
    reference: ref,
  };
}

function checkStructural(plan) {
  const state = plan.cityState?.state;
  const zone = NBC_DEFAULTS.seismicZoneByState[state] || 'II–IV (varies by district)';

  return {
    id: 'structural',
    label: 'Structural safety (seismic)',
    status: 'warning',
    severity: 'medium',
    summary: `${state || 'India'} falls in seismic zone ${zone}. Structural drawings must be signed by a licensed structural engineer to IS 1893 + IS 13920.`,
    actual: { zone },
    required: { complianceStandard: 'IS 1893 (Part 1):2016 + IS 13920:2016' },
    reference: {
      code: 'IS 1893 (Part 1):2016',
      text:
        'All buildings in zones III, IV, and V require structural design as per IS 1893 + IS 13920 ' +
        '(ductile detailing). Zone II buildings may use simpler structural systems but must still be ' +
        'engineer-certified.',
    },
  };
}

function checkGroundCoverage(plan, option, plotSqft, eff) {
  const footprint = groundFootprintSqft(option);
  const pct = plotSqft > 0 ? Math.round((footprint / plotSqft) * 1000) / 10 : 0;
  const maxPct = NBC_DEFAULTS.groundCoverageMaxPct;

  const ok = pct <= maxPct;
  return {
    id: 'coverage',
    label: 'Ground coverage',
    status: ok ? 'pass' : 'fail',
    severity: ok ? 'low' : 'medium',
    summary: ok
      ? `Ground footprint ${footprint} sqft (${pct}%) — within ${maxPct}% limit.`
      : `Ground coverage ${pct}% exceeds the ${maxPct}% maximum. Consider reducing the footprint or splitting onto more floors.`,
    actual: { footprintSqft: footprint, pct },
    required: { maxPct },
    reference: {
      code: 'NBC 2016 Part 3 §8.2',
      text:
        'Ground coverage in residential zones is typically capped at 50–65% of plot area, with the balance ' +
        'reserved for setbacks, driveway, and open space.',
    },
  };
}

/* ── Draft data (for the application document preview) ─────────────── */

function deriveDraftData(plan, option, plotSqft, eff, items) {
  const fsiItem = items.find((i) => i.id === 'fsi');
  const bua = Number(option?.totalArea) || fsiItem?.actual?.buaSqft || 0;
  const fsi = fsiItem?.actual?.fsi ?? 0;
  const allowed = fsiItem?.required?.maxFsi ?? 0;

  const rc = plan.roomConfig || {};
  const additional = rc.additionalSpaces || [];
  const roomSummary = [
    rc.bedrooms ? `${rc.bedrooms} bedrooms` : null,
    rc.attachedBathrooms ? `${rc.attachedBathrooms} attached baths` : null,
    rc.commonBathrooms ? `${rc.commonBathrooms} common baths` : null,
    additional.includes('living')  ? 'living'  : null,
    additional.includes('dining')  ? 'dining'  : null,
    additional.includes('kitchen') ? 'kitchen' : 'kitchen', // kitchen is always present
    additional.includes('pooja')   ? 'pooja'   : null,
    additional.includes('study')   ? 'study'   : null,
    rc.staircases ? `${rc.staircases} staircase` : null,
  ].filter(Boolean).join(', ');

  return {
    landUseZone: 'Residential — R1 (default)',
    proposedBuaSqft: bua,
    plotAreaSqft: plotSqft,
    floors: Math.max(1, Number(plan.landDetails?.floors) || 1),
    fsi,
    fsiAllowed: allowed,
    fsiStatement: allowed
      ? `Proposed FSI ${fsi} against permissible ${allowed} — ${fsi <= allowed ? 'within' : 'exceeding'} limit.`
      : `Proposed FSI ${fsi} (no local FSI cap configured; please verify against bye-law).`,
    roomSummary,
    setbackStatement: items.find((i) => i.id === 'setback')?.summary || '',
    rulesetSource: eff.dataSource,
  };
}

/* ── Public ─────────────────────────────────────────────────────────── */

function generateMunicipalReport({ plan = {}, rules = null } = {}) {
  const eff = effectiveRules(rules);
  const option = plan.floorPlan?.options?.find((o) => o.id === plan.floorPlan?.selectedOptionId);
  const plotSqft = toSqft(plan.landDetails?.area, plan.landDetails?.unit || 'sqft');

  const items = [
    checkSetbacks(option, plotSqft, eff),
    checkFsi(plan, option, plotSqft, eff),
    checkParking(plan, plotSqft, eff),
    checkFireEgress(plan, option, eff),
    checkRoadWidth(plan, plotSqft, eff),
    checkStructural(plan),
    checkGroundCoverage(plan, option, plotSqft, eff),
  ];

  const passed   = items.filter((i) => i.status === 'pass').length;
  const failed   = items.filter((i) => i.status === 'fail').length;
  const warnings = items.filter((i) => i.status === 'warning').length;

  let overallStatus = 'compliant';
  if (failed > 0) overallStatus = 'non-compliant';
  else if (warnings > 0) overallStatus = 'needs-attention';

  return {
    generatedAt: new Date().toISOString(),
    city: plan.cityState?.city || null,
    state: plan.cityState?.state || null,
    applicable: eff.hasCityData,
    ruleSetVersion: eff.dataSource,
    items,
    summary: {
      totalChecks: items.length,
      passed,
      failed,
      warnings,
      overallStatus,
    },
    draft: deriveDraftData(plan, option, plotSqft, eff, items),
  };
}

module.exports = {
  generateMunicipalReport,
  NBC_DEFAULTS,
};
