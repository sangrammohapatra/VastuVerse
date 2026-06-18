/**
 * Zone-aware constraint layout solver.
 *
 * ── Algorithm ────────────────────────────────────────────────────────────
 *
 *  1. Sort rooms by zone priority (variant-specific) and descending area so
 *     larger rooms claim preferred zones first.
 *
 *  2. For each room, iterate through its zone priority list.  For each zone,
 *     call tryPlaceNearZone():
 *       - Compute the ideal top-left position: centre the room on the zone
 *         centroid, clamped to the plot boundary.
 *       - Generate every valid (x, y) position across the full plot (step 1 ft).
 *       - Sort positions by Manhattan distance from the ideal position.
 *       - Return the first position where the room does not overlap any
 *         already-placed room (with MIN_CIRCULATION / 2 padding on each side).
 *     The room is allowed to extend BEYOND its target zone — the zone only
 *     biases the search; it does not restrict room bounds.
 *
 *  3. If all zones fail (room is larger than the whole plot in one dimension),
 *     forcePlaceAnywhere() stacks the room without padding as a last resort
 *     so no room is silently dropped.
 *
 *  4. After all rooms are placed, detectOverlaps() validates final positions
 *     (zero tolerance) and returns conflict pairs for layoutWarnings.
 *
 *  5. Retry up to MAX_RETRIES times with alternating sort orders; keep the
 *     attempt that produced the fewest overlap conflicts.
 *
 * ── Adjacency constraints ────────────────────────────────────────────────
 *  Attached bathrooms are sorted immediately after their paired bedroom and
 *  share the same zone priority, ensuring they land adjacent.
 *
 * ── Circulation constraint ───────────────────────────────────────────────
 *  During placement checks, each room's footprint is expanded by
 *  MIN_CIRCULATION / 2 on every side, enforcing a gap of MIN_CIRCULATION ft
 *  between any two placed rooms.
 */

const {
  VASTU_IDEAL,
  ALL_ZONES,
  getZoneBounds,
} = require('./_vastuZones');

const MIN_CIRCULATION = 2;   // ft gap between rooms during placement
const MAX_RETRIES     = 4;

// ── AABB helpers ──────────────────────────────────────────────────────────

function aabbOverlaps(a, b, pad = 0) {
  return (
    a.x - pad < b.x + b.w + pad &&
    a.x + a.w + pad > b.x - pad &&
    a.y - pad < b.y + b.h + pad &&
    a.y + a.h + pad > b.y - pad
  );
}

/** Return overlapping room-id pairs (zero-tolerance, actual bounds). */
function detectOverlaps(placed) {
  const conflicts = [];
  for (let i = 0; i < placed.length; i++) {
    for (let j = i + 1; j < placed.length; j++) {
      if (aabbOverlaps(placed[i], placed[j], 0)) {
        conflicts.push([placed[i].id, placed[j].id]);
      }
    }
  }
  return conflicts;
}

// ── Zone-biased full-plot placement ───────────────────────────────────────

/**
 * Try to place `room` anywhere on the plot, biased towards `zoneBounds`.
 *
 * Generates all valid positions (1 ft grid, clamped to plot) sorted by
 * Manhattan distance from the zone centroid.  Returns a placed room object
 * or null if the room is too large for the plot.
 */
function tryPlaceNearZone(room, zoneBounds, plotW, plotH, placed) {
  const pad  = MIN_CIRCULATION / 2;
  const maxX = plotW - room.w;
  const maxY = plotH - room.h;
  if (maxX < 0 || maxY < 0) return null;   // room doesn't fit on plot at all

  // Ideal top-left: centre room on zone centroid, clamped to valid range
  const idealX = Math.max(0, Math.min(maxX, Math.round(zoneBounds.cx - room.w / 2)));
  const idealY = Math.max(0, Math.min(maxY, Math.round(zoneBounds.cy - room.h / 2)));

  // Build candidate list sorted by Manhattan distance from ideal position
  const candidates = [];
  for (let y = 0; y <= maxY; y++) {
    for (let x = 0; x <= maxX; x++) {
      candidates.push({ x, y, d: Math.abs(x - idealX) + Math.abs(y - idealY) });
    }
  }
  candidates.sort((a, b) => a.d - b.d);

  for (const { x, y } of candidates) {
    const c = { ...room, x, y };
    if (!placed.some((p) => aabbOverlaps(c, p, pad))) return c;
  }
  return null;
}

/**
 * Last-resort placement with no circulation pad.
 * Ensures no room is silently dropped from the output even on a crowded plot.
 */
function forcePlaceAnywhere(room, plotW, plotH, placed) {
  const maxX = Math.max(0, plotW - room.w);
  const maxY = Math.max(0, plotH - room.h);

  for (let y = 0; y <= maxY; y++) {
    for (let x = 0; x <= maxX; x++) {
      const c = { ...room, x, y };
      if (!placed.some((p) => aabbOverlaps(c, p, 0))) return c;
    }
  }
  // Plot is completely full — stack at origin; caller flags as conflict
  return { ...room, x: 0, y: 0 };
}

// ── Zone priority lists ───────────────────────────────────────────────────

function vastuZonePriority(kind) {
  const ideal = VASTU_IDEAL[kind] || [];
  const rest  = ALL_ZONES.filter((z) => z !== 'C' && !ideal.includes(z));
  return [...ideal, ...rest, 'C'];
}

function openPlanZonePriority(kind) {
  if (['living', 'dining'].includes(kind))
    return ['N', 'NE', 'E', 'NW', 'W', 'S', 'SW', 'SE', 'C'];
  if (kind === 'kitchen')
    return ['NE', 'N', 'E', 'NW', 'W', 'S', 'SW', 'SE', 'C'];
  if (['bedroom', 'bathroomAttached'].includes(kind))
    return ['SW', 'S', 'W', 'SE', 'NW', 'N', 'NE', 'E', 'C'];
  return ALL_ZONES;
}

function compactZonePriority() {
  return ['SW', 'SE', 'NW', 'NE', 'S', 'N', 'W', 'E', 'C'];
}

function getZonePriority(kind, variantIdx) {
  if (variantIdx === 0) return vastuZonePriority(kind);
  if (variantIdx === 1) return openPlanZonePriority(kind);
  return compactZonePriority();
}

// ── Room sorting ──────────────────────────────────────────────────────────

function sortAndPair(rooms, variantIdx, attempt) {
  const nonBath = rooms.filter((r) => r.kind !== 'bathroomAttached');
  const baths   = [...rooms.filter((r) => r.kind === 'bathroomAttached')];

  nonBath.sort((a, b) => {
    const areaDiff = (b.w * b.h) - (a.w * a.h);
    return attempt % 2 === 0 ? areaDiff : -areaDiff;
  });

  // Interleave: each bedroom is immediately followed by its attached bathroom
  const paired = [];
  for (const r of nonBath) {
    paired.push(r);
    if (r.kind === 'bedroom') {
      const bath = baths.shift();
      if (bath) paired.push(bath);
    }
  }
  paired.push(...baths);
  return paired;
}

// ── Main solver ───────────────────────────────────────────────────────────

/**
 * Place all rooms on a single floor within plotW × plotH.
 *
 * @param {Array}   rooms        - [{ id, kind, label, w, h, color, ... }]
 * @param {number}  plotW
 * @param {number}  plotH
 * @param {number}  variantIdx   - 0: Vastu, 1: open-plan, 2: compact
 * @param {boolean} vastuEnabled
 * @param {Array}   prePlaced    - Rooms already positioned on this floor (staircase
 *                                 alignment from ground floor, etc.). They act as
 *                                 fixed obstacles and are included in the output.
 * @returns {{ placed: Array, unplaced: Array, conflicts: Array }}
 *   unplaced: rooms that could not be fitted — caller should surface an error.
 */
function solveFloor(rooms, plotW, plotH, variantIdx, vastuEnabled, prePlaced = []) {
  const prePlacedIds = new Set(prePlaced.map((r) => r.id));
  // Only solve rooms not already pre-placed
  const toSolve = rooms.filter((r) => !prePlacedIds.has(r.id));

  let best = null;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const sorted   = sortAndPair(toSolve, variantIdx, attempt);
    // Start with pre-placed rooms as fixed obstacles
    const placed   = [...prePlaced];
    const unplaced = [];

    for (const room of sorted) {
      const priority = getZonePriority(room.kind, variantIdx);
      let result     = null;

      for (const zone of priority) {
        const bounds = getZoneBounds(zone, plotW, plotH);
        result       = tryPlaceNearZone(room, bounds, plotW, plotH, placed);
        if (result) break;
      }

      if (result) {
        placed.push(result);
      } else {
        // Circulation gap couldn't be satisfied — place without gap rather than drop the room
        const forced = forcePlaceAnywhere(room, plotW, plotH, placed);
        placed.push(forced);
      }
    }

    const conflicts = detectOverlaps(placed);

    if (!best || unplaced.length < best.unplaced.length ||
        (unplaced.length === best.unplaced.length && conflicts.length < best.conflicts.length)) {
      best = { placed, unplaced, conflicts };
    }
    if (unplaced.length === 0 && conflicts.length === 0) break;
  }

  return best;
}

module.exports = { solveFloor, detectOverlaps };
