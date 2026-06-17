/**
 * Vastu Shastra directional zone definitions.
 *
 * The plot is divided into a 3×3 grid (col: West→East, row: North→South).
 * Screen coordinates: y=0 is the top (North), y=plotH is the bottom (South).
 *
 *   NW(0,0) | N(1,0)  | NE(2,0)
 *   W (0,1) | C (1,1) | E (2,1)
 *   SW(0,2) | S (1,2) | SE(2,2)
 *
 * Authentic Vastu Shastra sources used for direction assignments:
 *   Ashtakona (8 directions) + Brahmasthan (center void).
 *   Nakshatra-based orientation is out of scope for v1; a due-North reference is assumed.
 */

const ZONE_GRID = {
  NW: { col: 0, row: 0 },
  N:  { col: 1, row: 0 },
  NE: { col: 2, row: 0 },
  W:  { col: 0, row: 1 },
  C:  { col: 1, row: 1 },
  E:  { col: 2, row: 1 },
  SW: { col: 0, row: 2 },
  S:  { col: 1, row: 2 },
  SE: { col: 2, row: 2 },
};

const ALL_ZONES = Object.keys(ZONE_GRID);

/**
 * Ideal zone priority per room kind.
 * Ordered: [primary, secondary, tertiary, ...].
 *
 * Sources: Vastu Shastra Ashtakona directions:
 *   NE (Ishanya)   — sacred / water / light
 *   SE (Agneya)    — fire / kitchen
 *   SW (Nairutya)  — earth / stability / master bedroom
 *   NW (Vayavya)   — air / movement / guests
 *   N  (Uttara)    — wealth / study / treasury
 *   S  (Dakshina)  — Yama / bedrooms
 *   E  (Purva)     — sunlight / living / verandah
 *   W  (Paschima)  — children / study
 *   C  (Brahma)    — void; no rooms should occupy the center
 */
const VASTU_IDEAL = {
  pooja:            ['NE'],
  kitchen:          ['SE'],
  bedroom:          ['SW', 'S', 'W'],
  bathroomAttached: ['SW', 'S', 'W'],
  bathroomCommon:   ['NW', 'W'],
  living:           ['N', 'E', 'NE'],
  dining:           ['W', 'N'],
  study:            ['N', 'W', 'NE'],
  garage:           ['NW', 'SW'],
  servant:          ['NW', 'SW'],
  storage:          ['SW', 'NW', 'W'],
  balcony:          ['N', 'E', 'NE'],
  staircase:        ['SW', 'W', 'NW'],
  terrace:          ['NW', 'N', 'NE'],
  utility:          ['NW', 'W', 'SW'],
  serviceYard:      ['NW', 'W'],
};

/**
 * Zones the room kind should explicitly avoid (used in scoring penalty).
 */
const VASTU_AVOID = {
  bedroom:          ['NE', 'SE'],
  kitchen:          ['NE', 'NW', 'SW'],
  pooja:            ['SW', 'S', 'SE'],
  bathroomCommon:   ['NE'],
  bathroomAttached: ['NE'],
  utility:          ['NE', 'E'],
  serviceYard:      ['NE', 'E', 'SE'],
};

/**
 * Chebyshev distance between two zone names.
 * Zones adjacent on the grid (incl. diagonal) = distance 1.
 */
function zoneDistance(zoneA, zoneB) {
  const a = ZONE_GRID[zoneA];
  const b = ZONE_GRID[zoneB];
  if (!a || !b) return 4;
  return Math.max(Math.abs(a.col - b.col), Math.abs(a.row - b.row));
}

/**
 * Identify which zone a point (cx, cy) falls in given plot dimensions.
 */
function getZoneForPosition(cx, cy, plotW, plotH) {
  const col = Math.min(2, Math.floor((cx / plotW) * 3));
  const row = Math.min(2, Math.floor((cy / plotH) * 3));
  const entry = ALL_ZONES.find((z) => ZONE_GRID[z].col === col && ZONE_GRID[z].row === row);
  return entry || 'C';
}

/**
 * Return the bounding box of a zone within the plot.
 */
function getZoneBounds(zone, plotW, plotH) {
  const { col, row } = ZONE_GRID[zone] || ZONE_GRID['C'];
  const zW = plotW / 3;
  const zH = plotH / 3;
  return {
    x:  col * zW,
    y:  row * zH,
    w:  zW,
    h:  zH,
    cx: col * zW + zW / 2,
    cy: row * zH + zH / 2,
  };
}

module.exports = {
  ZONE_GRID,
  ALL_ZONES,
  VASTU_IDEAL,
  VASTU_AVOID,
  zoneDistance,
  getZoneForPosition,
  getZoneBounds,
};
