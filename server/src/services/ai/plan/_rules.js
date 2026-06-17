/**
 * Rule-based room-suggestion fallback.
 *
 * Returns the same shape a real LLM call would (so the route's contract is
 * stable regardless of provider availability). Real Ollama / GPT-4o calls
 * happen in the provider files; they fall back to this function on any
 * failure or when keys aren't configured.
 *
 *   { suggestions: [{ id, severity, category, message }],
 *     warnings:    [{ id, severity, category, message }],
 *     maxBUA:      <number in sqft>,
 *     feasibilityRating: 'good' | 'tight' | 'over' }
 *
 *  severity → client mapping:  green = success, orange = warning, red = error
 */

const SQM_TO_SQFT = 10.7639;

function toSqft(area, unit) {
  if (!area) return 0;
  if (unit === 'sqm') return area * SQM_TO_SQFT;
  if (unit === 'sqyd') return area * 9;
  return area; // sqft fallback
}

function computeRoomSuggestions({ roomConfig = {}, landDetails = {}, vastuEnabled = false } = {}) {
  const suggestions = [];
  const warnings = [];

  const areaSqft = toSqft(Number(landDetails.area) || 0, landDetails.unit || 'sqft');
  const floors = Number(landDetails.floors) || 1;
  const fsi = Number(landDetails.fsi) || 1.5;
  const maxBUA = Math.max(0, Math.round(areaSqft * fsi));

  const bedrooms          = Number(roomConfig.bedrooms) || 0;
  const attachedBathrooms = Number(roomConfig.attachedBathrooms) || 0;
  const commonBathrooms   = Number(roomConfig.commonBathrooms) || 0;
  const additionalSpaces  = Array.isArray(roomConfig.additionalSpaces) ? roomConfig.additionalSpaces : [];
  const balconies         = Number(roomConfig.balconies) || 0;
  const staircases        = Number(roomConfig.staircases) || 0;
  const kitchenType       = roomConfig.kitchenType;

  // Rough NBC-aware minimum area estimates (sqft per room).
  const MIN_SQFT_PER = {
    bedroom: 110,
    attachedBath: 35,
    commonBath: 45,
    kitchen: kitchenType === 'open' ? 80 : kitchenType === 'traditional' ? 120 : 100,
    living: 180,
    dining: 120,
    pooja: 40,
    study: 90,
    garage: 150,
    servant: 90,
    terrace: 0,
    storage: 40,
    balcony: 30,
    staircase: 60,
  };

  let needed = 0;
  needed += bedrooms * MIN_SQFT_PER.bedroom;
  needed += attachedBathrooms * MIN_SQFT_PER.attachedBath;
  needed += commonBathrooms * MIN_SQFT_PER.commonBath;
  needed += MIN_SQFT_PER.kitchen;
  needed += balconies * MIN_SQFT_PER.balcony;
  needed += staircases * MIN_SQFT_PER.staircase;
  additionalSpaces.forEach((id) => {
    if (MIN_SQFT_PER[id]) needed += MIN_SQFT_PER[id];
  });
  needed = Math.round(needed);

  let feasibilityRating = 'good';

  /* ── RED · NBC compliance warnings ── */
  if (floors > 1 && staircases < 1) {
    warnings.push({
      id: 'nbc-staircase',
      severity: 'red',
      category: 'compliance',
      message: 'NBC requires at least one staircase for multi-storey buildings. Add a staircase before proceeding.',
    });
    feasibilityRating = 'over';
  }

  if (bedrooms === 0) {
    warnings.push({
      id: 'no-bedrooms',
      severity: 'red',
      category: 'compliance',
      message: 'A residential plan must include at least one bedroom.',
    });
    feasibilityRating = 'over';
  }

  if (!additionalSpaces.includes('living')) {
    suggestions.push({
      id: 'no-living',
      severity: 'orange',
      category: 'suggestion',
      message: 'Most homes benefit from a dedicated living room — consider adding one.',
    });
  }

  /* ── ORANGE / GREEN · area feasibility ── */
  if (areaSqft > 0) {
    if (needed > maxBUA) {
      suggestions.push({
        id: 'feasibility-over',
        severity: 'orange',
        category: 'feasibility',
        message: `Estimated requirement (~${needed} sqft) exceeds the buildable area (~${maxBUA} sqft). Drop a room, downsize, or increase floors.`,
      });
      feasibilityRating = feasibilityRating === 'over' ? 'over' : 'tight';
    } else if (needed > maxBUA * 0.85) {
      suggestions.push({
        id: 'feasibility-tight',
        severity: 'orange',
        category: 'feasibility',
        message: `Layout will be tight (~${needed} / ${maxBUA} sqft used). Circulation space may suffer.`,
      });
      feasibilityRating = feasibilityRating === 'over' ? 'over' : 'tight';
    } else {
      suggestions.push({
        id: 'feasibility-ok',
        severity: 'green',
        category: 'feasibility',
        message: `Configuration fits comfortably within ~${maxBUA} sqft buildable area (~${needed} sqft needed).`,
      });
    }
  }

  /* ── Bathroom-to-bedroom ratio ── */
  if (bedrooms > 0) {
    const recommended = Math.ceil(bedrooms / 2);
    const total = attachedBathrooms + commonBathrooms;
    if (total < recommended) {
      suggestions.push({
        id: 'bath-ratio',
        severity: 'orange',
        category: 'suggestion',
        message: `Consider at least ${recommended} bathroom${recommended > 1 ? 's' : ''} for ${bedrooms} bedroom${bedrooms > 1 ? 's' : ''}.`,
      });
    } else {
      suggestions.push({
        id: 'bath-ratio-ok',
        severity: 'green',
        category: 'suggestion',
        message: 'Bathroom-to-bedroom ratio looks healthy.',
      });
    }
  }

  /* ── Vastu-specific ── */
  if (vastuEnabled) {
    if (!additionalSpaces.includes('pooja')) {
      suggestions.push({
        id: 'vastu-pooja',
        severity: 'orange',
        category: 'suggestion',
        message: 'Vastu strongly recommends a dedicated pooja room in the north-east (Ishanya).',
      });
    } else {
      suggestions.push({
        id: 'vastu-pooja-ok',
        severity: 'green',
        category: 'suggestion',
        message: 'Pooja room included — it will be placed in the north-east per Vastu.',
      });
    }
    suggestions.push({
      id: 'vastu-kitchen',
      severity: 'green',
      category: 'compliance',
      message: 'Kitchen will be placed in the south-east (Agni corner) per Vastu Shastra.',
    });
  }

  /* ── Multi-storey hints ── */
  if (floors > 1) {
    if (staircases >= 1) {
      suggestions.push({
        id: 'staircase-ok',
        severity: 'green',
        category: 'compliance',
        message: `${staircases} staircase${staircases > 1 ? 's' : ''} configured for ${floors} floors — NBC requirements met.`,
      });
    }
    if (!additionalSpaces.includes('terrace') && floors >= 2) {
      suggestions.push({
        id: 'terrace-hint',
        severity: 'orange',
        category: 'suggestion',
        message: 'A terrace on the top floor is a popular addition in Indian homes — consider including one.',
      });
    }
  }

  return { suggestions, warnings, maxBUA, feasibilityRating };
}

module.exports = { computeRoomSuggestions };
