/**
 * Cost-estimate rule engine.
 *
 * Looks up CostDataset rows for (state, finishTier) and falls back to bundled
 * default rates so the wizard still produces an answer when the database
 * isn't pre-seeded. Returns a per-category breakdown ready for the table +
 * chart on the client.
 *
 * BUA (built-up area) comes from the selected floor-plan option's totalArea.
 * If no option is selected we fall back to landArea × floors × 0.6 (typical
 * Indian ground coverage).
 */

const SQM_TO_SQFT = 10.7639;

const CATEGORIES = ['civil', 'electrical', 'plumbing', 'flooring', 'painting', 'fixtures'];

/* ── Bundled defaults (Bangalore mid-2025 reference, ₹/sqft) ───────── */

const DEFAULT_RATES = {
  economy:  { civil: 950,  electrical: 140, plumbing: 90,  flooring: 110, painting: 50,  fixtures: 100 },
  standard: { civil: 1300, electrical: 180, plumbing: 130, flooring: 180, painting: 80,  fixtures: 200 },
  premium:  { civil: 1800, electrical: 250, plumbing: 200, flooring: 320, painting: 150, fixtures: 400 },
};

/* ── Category descriptions for the table ───────────────────────────── */

const CATEGORY_LABELS = {
  civil:       { label: 'Civil & structure',  description: 'Foundation, RCC, brickwork, plaster, formwork.' },
  electrical:  { label: 'Electrical',         description: 'Wiring, switches, lighting, sanctioned load, earthing.' },
  plumbing:    { label: 'Plumbing & sanitary',description: 'Pipes, fittings, sanitaryware, water proofing.' },
  flooring:    { label: 'Flooring',           description: 'Tile / vitrified / marble + skirting + laying.' },
  painting:    { label: 'Painting',           description: 'Putty, primer, two coats interior + exterior.' },
  fixtures:    { label: 'Fixtures & joinery', description: 'Doors, windows, kitchen, wardrobes, basics.' },
};

/* ── Helpers ────────────────────────────────────────────────────────── */

function toSqft(area, unit) {
  if (!area) return 0;
  if (unit === 'sqm') return area * SQM_TO_SQFT;
  if (unit === 'sqyd') return area * 9;
  return Number(area) || 0;
}

function deriveBua({ floorPlan = {}, landDetails = {} } = {}) {
  // Prefer the user's selected option's totalArea
  const sel = floorPlan.options?.find((o) => o.id === floorPlan.selectedOptionId);
  if (sel && Number(sel.totalArea) > 0) return Number(sel.totalArea);

  // Otherwise approximate from land + floors with ground coverage
  const land = toSqft(landDetails.area, landDetails.unit || 'sqft');
  const floors = Math.max(1, Number(landDetails.floors) || 1);
  return Math.round(land * floors * 0.6);
}

function monthLabel(d = new Date()) {
  return d.toLocaleString('en-IN', { month: 'long', year: 'numeric' });
}

/* ── Dataset lookup (with mongoose-soft optional) ─────────────────── */

async function ratesForStateTier({ CostDataset, state, finishTier }) {
  // Try DB first
  if (CostDataset && state && finishTier) {
    try {
      const rows = await CostDataset.find({
        state,
        finishTier,
        category: { $in: CATEGORIES },
      }).lean();

      if (rows.length > 0) {
        const map = { ...DEFAULT_RATES[finishTier] };
        rows.forEach((r) => {
          if (CATEGORIES.includes(r.category) && Number(r.unitRateInrPerSqft) > 0) {
            map[r.category] = Number(r.unitRateInrPerSqft);
          }
        });
        return { rates: map, source: 'CostDataset' };
      }
    } catch (e) {
      // fall through to defaults
    }
  }
  return {
    rates: DEFAULT_RATES[finishTier] || DEFAULT_RATES.standard,
    source: 'default',
  };
}

/* ── Public ─────────────────────────────────────────────────────────── */

/**
 * Compute a cost estimate.
 *
 * @param {Object} args
 * @param {Object} args.plan      The Plan doc / object (with cityState, landDetails, floorPlan)
 * @param {string} args.finishTier  economy | standard | premium
 * @param {Object} [args.CostDataset] Mongoose model (optional — for testing)
 */
async function estimateCost({ plan = {}, finishTier = 'standard', CostDataset } = {}) {
  const tier = ['economy', 'standard', 'premium'].includes(finishTier) ? finishTier : 'standard';
  const bua = deriveBua(plan);
  const state = plan.cityState?.state || '—';

  const { rates, source } = await ratesForStateTier({ CostDataset, state, finishTier: tier });

  const categories = {};
  let total = 0;

  CATEGORIES.forEach((c) => {
    const unit = rates[c] || DEFAULT_RATES[tier][c];
    const amount = Math.round(unit * bua);
    total += amount;
    categories[c] = {
      label: CATEGORY_LABELS[c].label,
      description: CATEGORY_LABELS[c].description,
      unitRateInrPerSqft: unit,
      totalInr: amount,
    };
  });

  const variance = Math.round(total * 0.15);
  const asOf = monthLabel();

  return {
    finishTier: tier,
    state,
    city: plan.cityState?.city || '',
    buaSqft: bua,
    categories,
    totalInr: total,
    varianceInr: variance,
    minInr: total - variance,
    maxInr: total + variance,
    asOf,
    source,
    generatedAt: new Date().toISOString(),
  };
}

module.exports = { estimateCost, CATEGORIES, CATEGORY_LABELS, DEFAULT_RATES };
