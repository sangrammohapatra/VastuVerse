/**
 * Content management — cost datasets + municipal rules.
 *
 *   GET    /admin/cost-datasets
 *   PUT    /admin/cost-datasets/:id           ('new' → create)
 *   DELETE /admin/cost-datasets/:id
 *   POST   /admin/cost-datasets/import        (CSV body or { csv })
 *
 *   GET    /admin/municipal-rules
 *   POST   /admin/municipal-rules             (create or update upsert by city+state+zone)
 *   DELETE /admin/municipal-rules/:id
 */

const CostDataset = require('../../models/CostDataset');
const MunicipalRule = require('../../models/MunicipalRule');

/* ── Minimal CSV parser (handles quoted fields, no extra dep) ─────── */
function parseCsv(text) {
  const rows = [];
  let row = []; let cell = ''; let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') inQuotes = false;
      else cell += c;
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ',') {
      row.push(cell); cell = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(cell); rows.push(row);
      row = []; cell = '';
    } else {
      cell += c;
    }
  }
  if (cell.length || row.length) { row.push(cell); rows.push(row); }
  return rows.filter((r) => r.some((x) => x !== ''));
}

/* ── Cost datasets ────────────────────────────────────────────────── */

exports.listCostDatasets = async (req, res, next) => {
  try {
    const q = {};
    if (req.query.state) q.state = req.query.state;
    if (req.query.city)  q.city  = req.query.city;
    if (req.query.materialType) q.materialType = req.query.materialType;

    const rows = await CostDataset.find(q)
      .sort({ state: 1, city: 1, materialType: 1 })
      .limit(500).lean();
    res.json({ rows, count: rows.length });
  } catch (e) { next(e); }
};

exports.updateCostDataset = async (req, res, next) => {
  try {
    const set = {};
    ['state', 'city', 'materialType', 'unitType'].forEach((k) => {
      if (typeof req.body[k] === 'string') set[k] = req.body[k].trim();
    });
    if (req.body.costs && typeof req.body.costs === 'object') {
      set.costs = {
        economy:  Number.isFinite(Number(req.body.costs.economy))  ? Number(req.body.costs.economy)  : undefined,
        standard: Number.isFinite(Number(req.body.costs.standard)) ? Number(req.body.costs.standard) : undefined,
        premium:  Number.isFinite(Number(req.body.costs.premium))  ? Number(req.body.costs.premium)  : undefined,
      };
    }
    set.lastUpdated = new Date();
    set.updatedBy = req.user.userId;

    if (req.params.id === 'new') {
      const created = await CostDataset.create(set);
      return res.status(201).json({ row: created });
    }
    const updated = await CostDataset.findByIdAndUpdate(req.params.id, { $set: set }, { new: true });
    if (!updated) return res.status(404).json({ error: 'row_not_found' });
    res.json({ row: updated });
  } catch (e) {
    if (e.code === 11000) return res.status(409).json({ error: 'duplicate_row' });
    next(e);
  }
};

exports.deleteCostDataset = async (req, res, next) => {
  try {
    const r = await CostDataset.findByIdAndDelete(req.params.id);
    if (!r) return res.status(404).json({ error: 'row_not_found' });
    res.json({ ok: true });
  } catch (e) { next(e); }
};

exports.importCostDatasetsCsv = async (req, res, next) => {
  try {
    const raw = typeof req.body === 'string' ? req.body : (req.body?.csv || '');
    if (!raw) return res.status(400).json({ error: 'csv_required' });

    const rows = parseCsv(raw);
    if (rows.length < 2) return res.status(400).json({ error: 'csv_too_short' });

    const header = rows[0].map((h) => h.toLowerCase().trim());
    const idx = {
      state:        header.indexOf('state'),
      city:         header.indexOf('city'),
      materialType: header.indexOf('material') >= 0 ? header.indexOf('material') : header.indexOf('materialtype'),
      unitType:     header.indexOf('unit') >= 0 ? header.indexOf('unit') : header.indexOf('unittype'),
      economy:      header.indexOf('economy'),
      standard:     header.indexOf('standard'),
      premium:      header.indexOf('premium'),
    };
    if (idx.state < 0 || idx.materialType < 0) {
      return res.status(400).json({ error: 'missing_columns', expected: ['state', 'material', 'economy', 'standard', 'premium'] });
    }

    let skipped = 0;
    const errors = [];
    const ops = [];

    for (let i = 1; i < rows.length; i++) {
      const r = rows[i];
      const state = (r[idx.state] || '').trim();
      const materialType = (r[idx.materialType] || '').trim();
      if (!state || !materialType) { skipped++; continue; }
      const doc = {
        state,
        city: idx.city >= 0 ? (r[idx.city] || '').trim() || undefined : undefined,
        materialType,
        unitType: idx.unitType >= 0 ? (r[idx.unitType] || '').trim() || undefined : undefined,
        costs: {
          economy:  idx.economy  >= 0 ? Number(r[idx.economy])  || undefined : undefined,
          standard: idx.standard >= 0 ? Number(r[idx.standard]) || undefined : undefined,
          premium:  idx.premium  >= 0 ? Number(r[idx.premium])  || undefined : undefined,
        },
        lastUpdated: new Date(),
        updatedBy: req.user.userId,
      };

      ops.push({
        updateOne: {
          filter: { state: doc.state, city: doc.city || null, materialType: doc.materialType },
          update: { $set: doc },
          upsert: true,
        },
      });
    }

    if (ops.length === 0) {
      return res.json({ ok: true, upserted: 0, skipped, errors });
    }

    let upserted = 0;
    try {
      const result = await CostDataset.bulkWrite(ops, { ordered: false });
      upserted = (result.upsertedCount || 0) + (result.modifiedCount || 0);
    } catch (e) {
      (e.writeErrors || []).forEach((we) => errors.push({ index: we.index, error: we.errmsg }));
      upserted = e.result?.nUpserted ? (e.result.nUpserted + (e.result.nModified || 0)) : 0;
    }

    res.json({ ok: true, upserted, skipped, errors });
  } catch (e) { next(e); }
};

/* ── Municipal rules ──────────────────────────────────────────────── */

exports.listMunicipalRules = async (req, res, next) => {
  try {
    const q = {};
    if (req.query.state) q.state = req.query.state;
    if (req.query.city)  q.city  = req.query.city;
    const rows = await MunicipalRule.find(q).sort({ state: 1, city: 1 }).limit(500).lean();
    res.json({ rows, count: rows.length });
  } catch (e) { next(e); }
};

exports.upsertMunicipalRule = async (req, res, next) => {
  try {
    const { state, city, zone = 'default' } = req.body || {};
    if (!state || !city) return res.status(400).json({ error: 'state_city_required' });

    const set = { ...req.body, state, city, zone };
    delete set._id;

    const row = await MunicipalRule.findOneAndUpdate(
      { state, city, zone },
      { $set: set },
      { new: true, upsert: true, setDefaultsOnInsert: true, runValidators: true }
    );
    res.json({ row });
  } catch (e) {
    if (e.code === 11000) return res.status(409).json({ error: 'duplicate_rule' });
    next(e);
  }
};

exports.deleteMunicipalRule = async (req, res, next) => {
  try {
    const r = await MunicipalRule.findByIdAndDelete(req.params.id);
    if (!r) return res.status(404).json({ error: 'rule_not_found' });
    res.json({ ok: true });
  } catch (e) { next(e); }
};
