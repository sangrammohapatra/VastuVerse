/**
 * Rule-based room-suggestion engine — Step 2 of the wizard.
 *
 * Two public exports:
 *
 *   computeRoomRecommendation(landDetails)
 *     Returns the ideal BHK configuration for the given plot + FSI + floors.
 *     Shown at the top of Step 2 as a reference baseline.
 *
 *   computeRoomSuggestions({ roomConfig, landDetails, vastuEnabled })
 *     Compares the user's current room config against the recommendation and
 *     the 13-rule design checklist. Returns structured suggestions and warnings.
 *
 * Response shape (computeRoomSuggestions):
 *   {
 *     suggestions:     [{ id, severity, category, message }],
 *     warnings:        [{ id, severity, category, message }],
 *     recommendation:  { bhkLabel, bedrooms, attachedBathrooms, commonBathrooms,
 *                        additionalSpaces, perFloorBUA, note },
 *     maxBUA:          <number — sqft>,
 *     feasibilityRating: 'good' | 'tight' | 'over',
 *   }
 *
 * severity → client colour mapping: green = success, orange = warning, red = error
 */

const SQM_TO_SQFT = 10.7639;

function toSqft(area, unit) {
  if (!area) return 0;
  if (unit === 'sqm')  return area * SQM_TO_SQFT;
  if (unit === 'sqyd') return area * 9;
  return area;
}

// NBC-aware minimum areas per room type (sqft)
const MIN_SQFT_PER = {
  bedroom:          110,
  attachedBath:     35,
  commonBath:       45,
  kitchen:          100,
  living:           180,
  dining:           120,
  pooja:            40,
  study:            90,
  garage:           150,
  servant:          90,
  terrace:          0,
  storage:          40,
  balcony:          30,
  staircase:        60,
  utility:          60,
  serviceYard:      40,
};

// ── BHK Recommendation ────────────────────────────────────────────────────

/**
 * Suggest an ideal room configuration for the given land details.
 * Thresholds are calibrated to Indian urban residential norms.
 */
function computeRoomRecommendation({ area, unit, floors, fsi } = {}) {
  const areaSqft   = toSqft(Number(area) || 0, unit || 'sqft');
  const floorCount = Math.max(1, Number(floors) || 1);
  const fsiFactor  = Number(fsi) || 1.5;
  const totalBUA   = areaSqft * fsiFactor;
  const perFloor   = totalBUA / floorCount;

  let bhkLabel, bedrooms, attachedBathrooms, commonBathrooms, additionalSpaces, note;

  if (perFloor < 350) {
    bhkLabel = '1RK / Studio'; bedrooms = 1;
    attachedBathrooms = 0; commonBathrooms = 1;
    additionalSpaces = ['living'];
    note = 'Very compact plot — a studio or 1RK is the most practical option.';
  } else if (perFloor < 650) {
    bhkLabel = '1 BHK'; bedrooms = 1;
    attachedBathrooms = 1; commonBathrooms = 0;
    additionalSpaces = ['living', 'dining'];
    note = `~${Math.round(perFloor)} sqft per floor comfortably fits a 1 BHK with living and dining.`;
  } else if (perFloor < 1000) {
    bhkLabel = '2 BHK'; bedrooms = 2;
    attachedBathrooms = 1; commonBathrooms = 1;
    additionalSpaces = ['living', 'dining'];
    note = `~${Math.round(perFloor)} sqft per floor is ideal for a 2 BHK.`;
  } else if (perFloor < 1500) {
    bhkLabel = '2–3 BHK'; bedrooms = 3;
    attachedBathrooms = 2; commonBathrooms = 1;
    additionalSpaces = ['living', 'dining', 'pooja'];
    note = `~${Math.round(perFloor)} sqft per floor suits a 2–3 BHK with pooja room.`;
  } else if (perFloor < 2500) {
    bhkLabel = '3–4 BHK'; bedrooms = 4;
    attachedBathrooms = 3; commonBathrooms = 1;
    additionalSpaces = ['living', 'dining', 'study', 'pooja'];
    note = `~${Math.round(perFloor)} sqft per floor works well for a 3–4 BHK with study.`;
  } else {
    bhkLabel = '4+ BHK'; bedrooms = 5;
    attachedBathrooms = 4; commonBathrooms = 1;
    additionalSpaces = ['living', 'dining', 'study', 'pooja', 'storage'];
    note = `Generous plot — a 4+ BHK with all spaces is feasible.`;
  }

  return {
    bhkLabel, bedrooms, attachedBathrooms, commonBathrooms,
    additionalSpaces, perFloorBUA: Math.round(perFloor), totalBUA: Math.round(totalBUA), note,
  };
}

// ── Room suggestions ──────────────────────────────────────────────────────

function computeRoomSuggestions({ roomConfig = {}, landDetails = {}, vastuEnabled = false } = {}) {
  const suggestions = [];
  const warnings    = [];

  const areaSqft          = toSqft(Number(landDetails.area) || 0, landDetails.unit || 'sqft');
  const floors            = Number(landDetails.floors) || 1;
  const fsi               = Number(landDetails.fsi) || 1.5;
  const maxBUA            = Math.max(0, Math.round(areaSqft * fsi));
  const perFloorBUA       = maxBUA / floors;

  const bedrooms          = Number(roomConfig.bedrooms) || 0;
  const attachedBathrooms = Number(roomConfig.attachedBathrooms) || 0;
  const commonBathrooms   = Number(roomConfig.commonBathrooms) || 0;
  const additionalSpaces  = Array.isArray(roomConfig.additionalSpaces) ? roomConfig.additionalSpaces : [];
  const balconies         = Number(roomConfig.balconies) || 0;
  const staircases        = Number(roomConfig.staircases) || 0;
  const kitchenType       = roomConfig.kitchenType;

  // ── Recommendation ──────────────────────────────────────────────────────
  const rec = computeRoomRecommendation(landDetails);

  // ── Hard blockers (red) ─────────────────────────────────────────────────
  if (floors > 1 && staircases < 1) {
    warnings.push({
      id:       'nbc-staircase',
      severity: 'red',
      category: 'compliance',
      message:  `NBC §12.4 requires at least one staircase for a ${floors}-storey building. Add a staircase before generating the floor plan.`,
    });
  }

  if (bedrooms === 0) {
    warnings.push({
      id:       'no-bedrooms',
      severity: 'red',
      category: 'compliance',
      message:  'A residential plan must include at least one bedroom.',
    });
  }

  // ── Recommendation deviation warnings (orange) ───────────────────────────
  if (areaSqft > 0) {
    const recBeds = rec.bedrooms;
    if (bedrooms > recBeds + 1) {
      warnings.push({
        id:       'over-bedrooms',
        severity: 'orange',
        category: 'recommendation',
        message:  `For a ${rec.bhkLabel} plot (~${rec.perFloorBUA} sqft/floor), ${bedrooms} bedrooms is over the recommended ${recBeds}. Rooms will be cramped and circulation may suffer.`,
      });
    } else if (bedrooms < recBeds - 1 && bedrooms > 0) {
      suggestions.push({
        id:       'under-bedrooms',
        severity: 'orange',
        category: 'recommendation',
        message:  `${bedrooms} bedroom${bedrooms > 1 ? 's' : ''} for a ${rec.bhkLabel} plot — you could comfortably fit ${recBeds}. ${rec.note}`,
      });
    }
  }

  // ── Area feasibility ─────────────────────────────────────────────────────
  let needed = 0;
  needed += bedrooms * MIN_SQFT_PER.bedroom;
  needed += attachedBathrooms * MIN_SQFT_PER.attachedBath;
  needed += commonBathrooms   * MIN_SQFT_PER.commonBath;
  needed += MIN_SQFT_PER.kitchen;
  needed += balconies * MIN_SQFT_PER.balcony;
  needed += staircases * MIN_SQFT_PER.staircase;
  additionalSpaces.forEach((id) => { if (MIN_SQFT_PER[id]) needed += MIN_SQFT_PER[id]; });
  needed = Math.round(needed);

  let feasibilityRating = 'good';

  if (areaSqft > 0) {
    if (needed > maxBUA) {
      suggestions.push({
        id:       'feasibility-over',
        severity: 'orange',
        category: 'feasibility',
        message:  `Estimated requirement (~${needed} sqft) exceeds total buildable area (~${maxBUA} sqft). The floor plan will show an error. Drop a room, reduce floors, or increase FSI.`,
      });
      feasibilityRating = 'over';
    } else if (needed > maxBUA * 0.90) {
      suggestions.push({
        id:       'feasibility-tight',
        severity: 'orange',
        category: 'feasibility',
        message:  `Layout will be very tight (~${needed} / ${maxBUA} sqft). Less than 10% remains for corridors and circulation — NBC recommends 10–15%.`,
      });
      feasibilityRating = 'tight';
    } else if (needed > maxBUA * 0.85) {
      suggestions.push({
        id:       'feasibility-snug',
        severity: 'orange',
        category: 'feasibility',
        message:  `Layout will be snug (~${needed} / ${maxBUA} sqft, ~${Math.round((1 - needed / maxBUA) * 100)}% left for circulation). Manageable but tight.`,
      });
      feasibilityRating = 'tight';
    } else {
      suggestions.push({
        id:       'feasibility-ok',
        severity: 'green',
        category: 'feasibility',
        message:  `Room configuration fits comfortably within ~${maxBUA} sqft (~${needed} sqft needed, ${Math.round((1 - needed / maxBUA) * 100)}% available for circulation).`,
      });
    }
  }

  // ── Bathroom-to-bedroom ratio ─────────────────────────────────────────────
  if (bedrooms > 0) {
    const recommended = Math.ceil(bedrooms / 2);
    const maxBaths    = bedrooms + 1;
    const total       = attachedBathrooms + commonBathrooms;
    if (total < recommended) {
      suggestions.push({
        id:       'bath-ratio',
        severity: 'orange',
        category: 'suggestion',
        message:  `Consider at least ${recommended} bathroom${recommended > 1 ? 's' : ''} for ${bedrooms} bedroom${bedrooms > 1 ? 's' : ''}. Current: ${total}.`,
      });
    } else if (total > maxBaths) {
      warnings.push({
        id:       'bath-excess',
        severity: 'orange',
        category: 'suggestion',
        message:  `${total} bathrooms for ${bedrooms} bedroom${bedrooms !== 1 ? 's' : ''} exceeds the recommended ${maxBaths} (one per bedroom + one common). The extra bathrooms consume area that could be better used for living space.`,
      });
    } else {
      suggestions.push({
        id:       'bath-ratio-ok',
        severity: 'green',
        category: 'suggestion',
        message:  'Bathroom-to-bedroom ratio looks healthy.',
      });
    }
  }

  // ── Functional zoning ────────────────────────────────────────────────────
  if (!additionalSpaces.includes('living')) {
    suggestions.push({
      id:       'no-living',
      severity: 'orange',
      category: 'zoning',
      message:  'No living room — guests will enter directly into the private/sleeping zone. Add a living room to separate the public and private zones.',
    });
  }

  if (!additionalSpaces.includes('dining') && bedrooms > 0) {
    suggestions.push({
      id:       'no-dining',
      severity: 'orange',
      category: 'zoning',
      message:  'No dedicated dining area. The kitchen will need to accommodate dining, reducing usability. Consider adding a dining room adjacent to the kitchen.',
    });
  }

  // Kitchen-dining proximity hint
  if (additionalSpaces.includes('dining')) {
    suggestions.push({
      id:       'kitchen-dining-ok',
      severity: 'green',
      category: 'zoning',
      message:  'Dining included — it will be placed adjacent to the kitchen for a short service path.',
    });
  }

  // ── Multi-storey hints ────────────────────────────────────────────────────
  if (floors > 1) {
    if (staircases >= 1) {
      suggestions.push({
        id:       'staircase-ok',
        severity: 'green',
        category: 'compliance',
        message:  `${staircases} staircase${staircases > 1 ? 's' : ''} for ${floors} floors — NBC §12.4 met. The staircase will be aligned at the same position on every floor.`,
      });
    }
    if (!additionalSpaces.includes('terrace') && floors >= 2) {
      suggestions.push({
        id:       'terrace-hint',
        severity: 'orange',
        category: 'suggestion',
        message:  'A terrace on the top floor is a popular addition in Indian homes and provides future expansion potential. Consider adding one.',
      });
    }
    // Bathroom stacking
    if (attachedBathrooms > 0 || commonBathrooms > 0) {
      suggestions.push({
        id:       'bath-stack',
        severity: 'green',
        category: 'structural',
        message:  'Bathrooms will be placed in the same quadrant on each floor to minimise plumbing shaft lengths.',
      });
    }
  }

  // ── Vastu-specific ────────────────────────────────────────────────────────
  if (vastuEnabled) {
    if (!additionalSpaces.includes('pooja')) {
      suggestions.push({
        id:       'vastu-pooja',
        severity: 'orange',
        category: 'vastu',
        message:  'Vastu strongly recommends a dedicated pooja room in the North-East (Ishanya). Without it the NE zone will remain unactivated.',
      });
    } else {
      suggestions.push({
        id:       'vastu-pooja-ok',
        severity: 'green',
        category: 'vastu',
        message:  'Pooja room included — it will be placed in the North-East per Vastu.',
      });
    }
    suggestions.push({
      id:       'vastu-kitchen',
      severity: 'green',
      category: 'vastu',
      message:  'Kitchen will be placed in the South-East (Agni corner) per Vastu Shastra.',
    });
    suggestions.push({
      id:       'vastu-master',
      severity: 'green',
      category: 'vastu',
      message:  'Master bedroom will be placed in the South-West (Nairutya) — earth/stability zone.',
    });
  }

  // ── Utility / laundry room ────────────────────────────────────────────────
  if (!additionalSpaces.includes('utility') && bedrooms >= 2) {
    suggestions.push({
      id:       'utility-hint',
      severity: 'orange',
      category: 'suggestion',
      message:  'A utility/laundry area keeps washing machines and dirty linen out of the kitchen. Consider adding one adjacent to the kitchen (placed in the NW/W zone per Vastu).',
    });
  }

  // ── Service yard ─────────────────────────────────────────────────────────
  if (!additionalSpaces.includes('serviceYard') && bedrooms >= 3) {
    suggestions.push({
      id:       'service-yard-hint',
      severity: 'orange',
      category: 'suggestion',
      message:  'Homes with 3+ bedrooms benefit from a dedicated service yard for AC outdoor units, drying lines, and maintenance access. Place on the west or north-west face.',
    });
  }

  // ── Overhead water tank (OHT) when terrace is present ────────────────────
  if (additionalSpaces.includes('terrace')) {
    suggestions.push({
      id:       'water-tank-hint',
      severity: 'orange',
      category: 'suggestion',
      message:  'Terrace included — reserve a corner for an overhead water tank (OHT) and plan the plumbing and electrical connections to the terrace level during initial construction.',
    });
  }

  // ── Storage ───────────────────────────────────────────────────────────────
  if (!additionalSpaces.includes('storage') && bedrooms >= 3) {
    suggestions.push({
      id:       'storage-hint',
      severity: 'orange',
      category: 'suggestion',
      message:  'Homes with 3+ bedrooms often benefit from a dedicated storage room. Consider adding one.',
    });
  }

  return { suggestions, warnings, recommendation: rec, maxBUA, feasibilityRating };
}

module.exports = { computeRoomSuggestions, computeRoomRecommendation };
