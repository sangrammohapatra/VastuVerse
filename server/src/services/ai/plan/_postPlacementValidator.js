/**
 * Post-placement validator — runs on expanded, placed rooms per floor.
 *
 * Checks that require actual room geometry (x, y, w, h) and cannot be
 * evaluated from room config alone.
 *
 * Checks:
 *   CROSS_VENTILATION_RISK   — all habitable rooms on the same plot half
 *   BATHROOM_FACES_DINING    — bathroomCommon adjacent to the dining room
 *   BEDROOM_KITCHEN_ADJACENT — a bedroom shares a wall with the kitchen
 *   KITCHEN_SHAPE_POOR       — kitchen aspect ratio > 2.5:1 (poor work triangle)
 *   LIVING_WRONG_FACE        — living room centroid not on N or E half of plot
 *   BEDROOM_OVERSIZED        — bedroom area exceeds 300 sqft after expansion
 */

const HABITABLE = ['bedroom', 'living', 'study', 'dining', 'kitchen'];

function centroid(r) {
  return { cx: r.x + r.w / 2, cy: r.y + r.h / 2 };
}

/**
 * Two rooms share a wall when their boundaries are within `gap` ft on one axis
 * AND they overlap by at least `minShared` ft on the perpendicular axis.
 * Using minShared = 3 ft avoids flagging corner-touching rooms as adjacent.
 */
function areAdjacent(a, b, gap = 1, minShared = 3) {
  // Shared vertical wall (left/right boundary)
  if (Math.abs((a.x + a.w) - b.x) <= gap || Math.abs((b.x + b.w) - a.x) <= gap) {
    const overlapY = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
    if (overlapY >= minShared) return true;
  }
  // Shared horizontal wall (top/bottom boundary)
  if (Math.abs((a.y + a.h) - b.y) <= gap || Math.abs((b.y + b.h) - a.y) <= gap) {
    const overlapX = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
    if (overlapX >= minShared) return true;
  }
  return false;
}

/**
 * @param {Array}  rooms  - Expanded, placed rooms on a single floor (all have x, y, w, h)
 * @param {number} plotW
 * @param {number} plotH
 * @returns {Array<{ code, severity, message }>}
 */
function validatePostPlacement(rooms, plotW, plotH) {
  const warnings = [];

  // Staircase floor copies (id ends with __f<n>) are excluded — they are
  // phantom duplicates used only for vertical alignment; the real staircase
  // object is on floor 1.
  const active = rooms.filter((r) => !r.id.includes('__f'));

  const habitable = active.filter((r) => HABITABLE.includes(r.kind));
  const bedrooms  = active.filter((r) => r.kind === 'bedroom');
  const kitchen   = active.find((r)  => r.kind === 'kitchen');
  const dining    = active.find((r)  => r.kind === 'dining');
  const living    = active.find((r)  => r.kind === 'living');
  const bathsCmn  = active.filter((r) => r.kind === 'bathroomCommon');

  // ── 1. Cross-ventilation ─────────────────────────────────────────────────
  // Warn if all habitable rooms sit in the same horizontal half of the plot,
  // which means no windows can be opened on opposite faces for air flow.
  if (habitable.length >= 3) {
    const northHalf = habitable.filter((r) => centroid(r).cy < plotH * 0.5);
    const southHalf = habitable.filter((r) => centroid(r).cy >= plotH * 0.5);
    if (northHalf.length === 0 || southHalf.length === 0) {
      warnings.push({
        code:     'CROSS_VENTILATION_RISK',
        severity: 'orange',
        message:  'All habitable rooms are on the same half of the plot. Windows on only one face cannot provide cross-ventilation — distribute rooms to both the north and south halves.',
      });
    }
  }

  // ── 2. Bathroom door facing dining ───────────────────────────────────────
  if (dining) {
    for (const bath of bathsCmn) {
      if (areAdjacent(bath, dining)) {
        warnings.push({
          code:     'BATHROOM_FACES_DINING',
          severity: 'orange',
          message:  'A common bathroom is directly adjacent to the dining room. A bathroom door opening toward the dining area is poor planning — add a buffer wall, corridor, or swap room positions.',
        });
        break;
      }
    }
  }

  // ── 3. Bedroom-kitchen direct adjacency ──────────────────────────────────
  if (kitchen) {
    for (const bed of bedrooms) {
      if (areAdjacent(bed, kitchen)) {
        warnings.push({
          code:     'BEDROOM_KITCHEN_ADJACENT',
          severity: 'orange',
          message:  `${bed.label} shares a wall with the kitchen. Kitchen noise, heat, and odours will disturb the bedroom. Place dining, storage, or a corridor between them.`,
        });
        break;
      }
    }
  }

  // ── 4. Kitchen work-triangle shape ───────────────────────────────────────
  // A kitchen that is too elongated cannot accommodate an efficient
  // sink–fridge–cooking work triangle. Ideal aspect ratio is 1:1 to 1.5:1.
  if (kitchen) {
    const minDim = Math.min(kitchen.w, kitchen.h);
    const maxDim = Math.max(kitchen.w, kitchen.h);
    const ratio  = maxDim / Math.max(minDim, 1);
    if (ratio > 2.5) {
      warnings.push({
        code:     'KITCHEN_SHAPE_POOR',
        severity: 'orange',
        message:  `Kitchen is ${kitchen.w}×${kitchen.h} ft (${ratio.toFixed(1)}:1 ratio) — too elongated for an efficient work triangle. A ratio closer to 1:1–1.5:1 places the sink, fridge, and cooktop within reach of each other.`,
      });
    }
  }

  // ── 5. Living room entrance face ─────────────────────────────────────────
  // Per Vastu and standard practice, the main entry is from the north or east.
  // A living room in the SW quadrant forces guests through private zones.
  if (living) {
    const { cx, cy } = centroid(living);
    const onNorthHalf = cy < plotH * 0.5;
    const onEastHalf  = cx > plotW * 0.5;
    if (!onNorthHalf && !onEastHalf) {
      warnings.push({
        code:     'LIVING_WRONG_FACE',
        severity: 'orange',
        message:  'Living room is in the south-west quadrant. The main entry is typically from the north or east face — guests may need to cross private bedroom zones to reach the living area.',
      });
    }
  }

  // ── 6. Oversized bedrooms ────────────────────────────────────────────────
  for (const bed of bedrooms) {
    const area = bed.w * bed.h;
    if (area > 300) {
      warnings.push({
        code:     'BEDROOM_OVERSIZED',
        severity: 'orange',
        message:  `${bed.label} is ${area} sqft — unusually large (>300 sqft). Consider partitioning it into a bedroom + walk-in wardrobe or study to avoid wasted space.`,
      });
    }
  }

  return warnings;
}

module.exports = { validatePostPlacement };
