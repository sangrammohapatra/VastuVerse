/**
 * Vastu scoring engine.
 *
 * Scores a placed floor plan 0–100 based on how closely each room's
 * actual position matches its Vastu-ideal directional zone.
 *
 * ── Published methodology ────────────────────────────────────────────────
 *
 * 1. ZONE MAPPING
 *    The plot is divided into a 3×3 grid of directional zones (NW, N, NE,
 *    W, C, E, SW, S, SE). Each room's centroid is mapped to a zone.
 *
 * 2. PER-ROOM SCORE
 *    Given the room's actual zone vs. its ideal zone list (from _vastuZones):
 *      Chebyshev distance 0 (ideal):            100 pts
 *      distance 1 (adjacent):                    75 pts
 *      distance 2 (two hops):                    45 pts
 *      distance 3+ (far/opposite):               20 pts
 *    Rooms in an explicit VASTU_AVOID zone:      score capped at 15 pts
 *    Any room in the Brahmasthan (center, C):    score capped at 10 pts
 *    Rooms with no ideal zone defined:           neutral 55 pts
 *
 * 3. BRAHMASTHAN BONUS
 *    If no room centroid falls in the center zone:  +8 pts to total
 *
 * 4. TOTAL
 *    Weighted average of room scores (weights reflect Vastu importance),
 *    scaled to 0–92, then +8 Brahmasthan bonus if earned → max 100.
 *
 * ─────────────────────────────────────────────────────────────────────────
 */

const {
  VASTU_IDEAL,
  VASTU_AVOID,
  zoneDistance,
  getZoneForPosition,
} = require('./_vastuZones');

const DIST_SCORE = [100, 75, 45, 20, 15];

const ROOM_WEIGHT = {
  pooja:            2.0,
  kitchen:          1.8,
  bedroom:          1.5,
  living:           1.2,
  study:            1.0,
  dining:           0.9,
  bathroomAttached: 0.8,
  bathroomCommon:   0.8,
  garage:           0.6,
  servant:          0.6,
  staircase:        0.5,
  storage:          0.5,
  balcony:          0.4,
  terrace:          0.4,
  utility:          0.5,
  serviceYard:      0.3,
};

const BRAHMASTHAN_BONUS = 8;

function scoreRoom(room, plotW, plotH) {
  const cx = room.x + room.w / 2;
  const cy = room.y + room.h / 2;
  const actualZone = getZoneForPosition(cx, cy, plotW, plotH);
  const ideal  = VASTU_IDEAL[room.kind] || [];
  const avoid  = VASTU_AVOID[room.kind] || [];

  let score;
  let advice = '';

  if (actualZone === 'C') {
    score  = 10;
    advice = 'Brahmasthan (center) must remain open. Relocate this room to its ideal zone.';
  } else if (ideal.length === 0) {
    score = 55;
  } else {
    const dist = Math.min(...ideal.map((z) => zoneDistance(actualZone, z)));
    score = DIST_SCORE[Math.min(dist, DIST_SCORE.length - 1)];
    if (avoid.includes(actualZone)) score = Math.min(score, 15);

    if (score < 45) {
      advice = `Strongly misplaced. Move to ${ideal.slice(0, 2).join(' or ')} for Vastu compliance.`;
    } else if (score < 80) {
      advice = `Ideally placed in ${ideal[0]}. Current zone (${actualZone}) is acceptable.`;
    }
  }

  return {
    id: room.id,
    kind: room.kind,
    label: room.label,
    actualZone,
    idealZone: ideal[0] || 'any',
    score,
    advice,
  };
}

/**
 * Compute the Vastu score for a set of placed rooms on a single floor.
 *
 * @param {Array} rooms    - Placed rooms: [{ id, kind, label, x, y, w, h }]
 * @param {number} plotW
 * @param {number} plotH
 * @returns {{ total: number, roomScores: Array, brahmasthanOpen: boolean }}
 */
function computeVastuScore(rooms, plotW, plotH) {
  if (!rooms || !rooms.length) {
    return { total: 0, roomScores: [], brahmasthanOpen: true };
  }

  // Deduplicate staircase copies placed on each floor (id has __f suffix)
  const unique = rooms.filter((r) => !r.id.includes('__f'));
  const roomScores = unique.map((r) => scoreRoom(r, plotW, plotH));

  const brahmasthanOpen = !roomScores.some((rs) => rs.actualZone === 'C');

  let weightSum = 0;
  let scoreSum  = 0;
  roomScores.forEach((rs) => {
    const w = ROOM_WEIGHT[rs.kind] || 0.5;
    scoreSum  += rs.score * w;
    weightSum += w;
  });

  const base  = weightSum > 0 ? scoreSum / weightSum : 50;
  const scaled = Math.round(base * (92 / 100));
  const total  = Math.min(100, scaled + (brahmasthanOpen ? BRAHMASTHAN_BONUS : 0));

  return { total, roomScores, brahmasthanOpen };
}

module.exports = { computeVastuScore };
