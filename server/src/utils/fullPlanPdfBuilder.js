/**
 * Full-plan PDF builder.
 *
 * Bundles every wizard section into a single PDF for handoff. Watermark band
 * is laid down across each page when `watermark: true` (FREE-tier preview).
 *
 * Sections rendered (where data exists):
 *   ── Cover (title + status + city/state + tier banner)
 *   ── Plot & land details
 *   ── Room programme
 *   ── Floor plan (text summary; image when available)
 *   ── Interior / Exterior style summary
 *   ── Utility plan stats
 *   ── Cost estimate
 *   ── Municipal compliance (when generated)
 *   ── Closing disclaimer
 */

const PDFDocument = require('pdfkit');

const BRAND_PRIMARY = '#2E7D32';
const BRAND_SECOND  = '#FF6F00';
const TEXT_DARK     = '#1A1A1A';
const TEXT_MUTED    = '#555555';
const DIVIDER       = '#D8DCD9';
const AMBER         = '#FF8F00';
const SUCCESS       = '#2E7D32';
const DANGER        = '#C62828';

function inr(n) { return '₹' + Number(n || 0).toLocaleString('en-IN'); }
function cap(s) { return s && typeof s === 'string' ? s[0].toUpperCase() + s.slice(1) : '—'; }

function buildFullPlanPdf({ res, plan, watermark = false, tier = 'FREE' }) {
  const doc = new PDFDocument({
    size: 'A4',
    margins: { top: 60, bottom: 70, left: 56, right: 56 },
    bufferPages: true,
    info: {
      Title: `VastuVerse plan — ${plan?.title || 'Untitled'}`,
      Author: 'VastuVerse',
      Subject: 'Comprehensive plan export',
    },
  });

  doc.pipe(res);

  /* ── Cover page ──────────────────────────────────────────────────── */
  doc.rect(0, 0, doc.page.width, doc.page.height).fill('#F1F8E9');
  doc.rect(0, 0, doc.page.width, 90).fill(BRAND_PRIMARY);

  doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(28).text('VastuVerse', 56, 26);
  doc.fillColor('#FFFFFF').font('Helvetica').fontSize(12).text('AI-assisted home planning · Plan export', 56, 60);

  doc.y = 200;
  doc.fillColor(BRAND_PRIMARY).font('Helvetica-Bold').fontSize(36)
    .text(plan?.title || 'Untitled Plan', 56, doc.y, { width: doc.page.width - 112 });

  doc.moveDown(0.6);
  doc.fillColor(TEXT_MUTED).font('Helvetica').fontSize(13)
    .text([plan?.cityState?.city, plan?.cityState?.state].filter(Boolean).join(', ') || '—', 56);

  doc.moveDown(0.4);
  doc.fillColor(TEXT_MUTED).font('Helvetica').fontSize(11)
    .text(`Status: ${cap(plan?.status)}  ·  Generated ${new Date().toLocaleString('en-IN')}`, 56);

  if (watermark) {
    doc.moveDown(2);
    doc.roundedRect(56, doc.y, doc.page.width - 112, 60, 8).fill('#FFF8E1');
    doc.fillColor(AMBER).font('Helvetica-Bold').fontSize(14)
      .text('FREE-TIER PREVIEW', 70, doc.y - 50, { characterSpacing: 1.2 });
    doc.fillColor('#5D4037').font('Helvetica').fontSize(10)
      .text('This export is watermarked. Upgrade to Basic+ for a clean, contractor-ready PDF.',
        70, doc.y - 30, { width: doc.page.width - 140 });
  }

  doc.addPage();

  /* ── Section: Plot & land ────────────────────────────────────────── */
  sectionHeader(doc, '1. Plot & land details');
  const ld = plan?.landDetails || {};
  kvRows(doc, [
    ['Area',                 ld.area ? `${ld.area} ${ld.unit || 'sqft'}` : '—'],
    ['Plot shape',           ld.shape || '—'],
    ['Floors',               String(ld.floors || 1)],
    ['Soil type',            ld.soilType || '—'],
    ['Vastu enabled',        plan.vastuEnabled ? 'Yes' : 'No'],
  ]);

  /* ── Section: Rooms ──────────────────────────────────────────────── */
  sectionHeader(doc, '2. Room programme');
  const rc = plan?.roomConfig || {};
  const additional = rc.additionalSpaces || [];
  kvRows(doc, [
    ['Bedrooms',             String(rc.bedrooms || 0)],
    ['Attached bathrooms',   String(rc.attachedBathrooms || 0)],
    ['Common bathrooms',     String(rc.commonBathrooms || 0)],
    ['Kitchen type',         rc.kitchenType || 'modular'],
    ['Staircases',           String(rc.staircases || 1)],
    ['Additional spaces',    additional.length ? additional.join(', ') : '—'],
  ]);

  /* ── Section: Floor plan ─────────────────────────────────────────── */
  sectionHeader(doc, '3. Floor plan');
  const fp = plan?.floorPlan || {};
  const sel = fp.options?.find((o) => o.id === fp.selectedOptionId);
  if (sel) {
    kvRows(doc, [
      ['Selected variant',   sel.variant || sel.label || '—'],
      ['Plot dimensions',    sel.plotDimensions ? `${sel.plotDimensions.plotW} × ${sel.plotDimensions.plotH} ft` : '—'],
      ['Built-up area',      sel.totalArea ? `${Number(sel.totalArea).toLocaleString('en-IN')} sqft` : '—'],
      ['Rooms placed',       String((sel.rooms || []).length)],
    ]);
  } else {
    para(doc, 'No floor-plan option selected yet.');
  }

  /* ── Section: Interior / Exterior ────────────────────────────────── */
  sectionHeader(doc, '4. Interior & exterior styling');
  const interior = plan?.interior || {};
  const exterior = plan?.exterior || {};
  const palette = interior.palettes?.find((p) => p.id === interior.selectedPaletteId);
  kvRows(doc, [
    ['Global interior style', cap(interior.globalStyle)],
    ['Palette',               palette?.name || '—'],
    ['Facade style',          cap(exterior.facadeStyle)],
    ['Roof',                  cap(exterior.roofType) || '—'],
    ['Boundary wall',         cap(exterior.boundaryWall) || '—'],
    ['Main gate',             cap(exterior.mainGate) || '—'],
    ['Driveway',              exterior.driveway?.enabled ? `Yes — ${exterior.driveway.material || 'pavers'}` : 'No'],
    ['Landscaping',           (exterior.landscaping || []).length ? exterior.landscaping.join(', ') : '—'],
  ]);

  /* ── Section: Utilities ──────────────────────────────────────────── */
  if (plan?.utilities?.summary && Object.keys(plan.utilities.summary).length > 0) {
    sectionHeader(doc, '5. Utilities summary');
    const u = plan.utilities.summary;
    kvRows(doc, [
      ['Plumbing fixtures',     String(u.plumbing?.fixtures || '—')],
      ['Electrical load',       u.electrical?.sanctionedLoadKw ? `${u.electrical.sanctionedLoadKw} kW (sanctioned)` : '—'],
      ['HVAC',                  u.hvac ? `${u.hvac.units || 0} units · ${u.hvac.totalTonnage || 0} ton total` : '—'],
      ['Overhead tank',         u.waterTanks?.overheadLitres ? `${u.waterTanks.overheadLitres.toLocaleString('en-IN')} L` : '—'],
      ['Septic capacity',       u.sewage?.septicCapacityLitres ? `${u.sewage.septicCapacityLitres.toLocaleString('en-IN')} L` : '—'],
      ['Recommended solar',     u.solar?.recommendedKwp ? `${u.solar.recommendedKwp} kWp · ~${inr(u.solar.estimatedMonthlySavingsInr)}/mo savings` : '—'],
    ]);
  }

  /* ── Section: Cost ───────────────────────────────────────────────── */
  if (plan?.costEstimate?.totalInr) {
    sectionHeader(doc, '6. Cost estimate');
    const c = plan.costEstimate;
    para(doc, `Finish tier: ${cap(c.finishTier)}  ·  Reference: ${c.asOf || '—'}`);
    doc.moveDown(0.3);
    const bandY = doc.y;
    const w = doc.page.width - 112;
    doc.roundedRect(56, bandY, w, 50, 6).fill('#F1F8E9');
    doc.fillColor(BRAND_PRIMARY).font('Helvetica-Bold').fontSize(10)
      .text('TOTAL', 70, bandY + 10, { characterSpacing: 0.7 });
    doc.fillColor(BRAND_PRIMARY).font('Helvetica-Bold').fontSize(20)
      .text(inr(c.totalInr), 70, bandY + 24);
    doc.y = bandY + 60;
  }

  /* ── Section: Municipal ──────────────────────────────────────────── */
  if (plan?.municipalReport?.summary) {
    sectionHeader(doc, '7. Municipal compliance');
    const s = plan.municipalReport.summary;
    const overall = s.overallStatus === 'compliant' ? SUCCESS
                  : s.overallStatus === 'non-compliant' ? DANGER : AMBER;
    para(doc,
      `${s.passed} passed · ${s.warnings} warnings · ${s.failed} failed — `,
      { continued: true });
    doc.fillColor(overall).font('Helvetica-Bold')
      .text((s.overallStatus || 'PENDING').toUpperCase());

    if (Array.isArray(plan.municipalReport.items)) {
      doc.moveDown(0.4);
      plan.municipalReport.items.forEach((item) => {
        if (doc.y > doc.page.height - 110) doc.addPage();
        const color = item.status === 'pass' ? SUCCESS
                    : item.status === 'fail' ? DANGER
                    : item.status === 'warning' ? AMBER : TEXT_MUTED;
        doc.circle(60, doc.y + 5, 4).fill(color);
        doc.fillColor(TEXT_DARK).font('Helvetica-Bold').fontSize(10.5)
          .text(item.label, 72, doc.y, { width: doc.page.width - 130 });
        doc.fillColor(TEXT_MUTED).font('Helvetica').fontSize(9)
          .text(item.summary, 72, doc.y, { width: doc.page.width - 130 });
        doc.moveDown(0.5);
      });
    }
  }

  /* ── Closing disclaimer ──────────────────────────────────────────── */
  doc.moveDown(1);
  if (doc.y > doc.page.height - 130) doc.addPage();
  doc.fillColor(TEXT_MUTED).font('Helvetica-Oblique').fontSize(9)
    .text(
      'This document is generated from VastuVerse wizard inputs and represents an indicative plan. ' +
      'Final construction documentation, structural design, and municipal approvals must be obtained from ' +
      'licensed professionals. VastuVerse is a planning tool, not an engineering certifier.',
      { align: 'justify' }
    );

  /* ── Per-page watermark + footer ─────────────────────────────────── */
  const range = doc.bufferedPageRange();
  for (let i = 0; i < range.count; i++) {
    doc.switchToPage(range.start + i);

    if (watermark) {
      // Diagonal watermark band — saved & restored so transform doesn't bleed
      doc.save();
      doc.rotate(-30, { origin: [doc.page.width / 2, doc.page.height / 2] });
      doc.fillColor(AMBER).opacity(0.10).font('Helvetica-Bold').fontSize(96)
        .text('VASTUVERSE FREE',
          0, doc.page.height / 2 - 60,
          { width: doc.page.width, align: 'center' });
      doc.opacity(1).restore();
    }

    // Footer
    const bottom = doc.page.height - 36;
    doc.strokeColor(DIVIDER).lineWidth(0.5)
      .moveTo(56, bottom).lineTo(doc.page.width - 56, bottom).stroke();
    doc.fillColor(TEXT_MUTED).font('Helvetica').fontSize(8)
      .text(`Generated by VastuVerse · ${new Date().toLocaleString('en-IN')}`,
        56, bottom + 6);
    doc.text(`Page ${i + 1} / ${range.count}  ·  Tier: ${tier}`,
      0, bottom + 6,
      { align: 'right', width: doc.page.width - 56 });
  }

  doc.end();
}

/* ── Layout helpers ────────────────────────────────────────────────── */

function sectionHeader(doc, title) {
  if (doc.y > doc.page.height - 200) doc.addPage();
  doc.moveDown(0.6);
  doc.fillColor(BRAND_PRIMARY).font('Helvetica-Bold').fontSize(13)
    .text(title, 56);
  doc.strokeColor(BRAND_PRIMARY).lineWidth(1.2)
    .moveTo(56, doc.y).lineTo(56 + 40, doc.y).stroke();
  doc.moveDown(0.5);
}

function kvRows(doc, rows) {
  const left = 56;
  const labelW = 170;
  const w = doc.page.width - 112;
  rows.forEach(([k, v]) => {
    if (doc.y > doc.page.height - 90) doc.addPage();
    const y = doc.y;
    doc.fillColor(TEXT_MUTED).font('Helvetica').fontSize(10).text(k, left, y, { width: labelW });
    doc.fillColor(TEXT_DARK).font('Helvetica-Bold').fontSize(11)
      .text(v, left + labelW, y, { width: w - labelW });
    doc.y = Math.max(doc.y, y + 18);
    doc.strokeColor(DIVIDER).lineWidth(0.5).moveTo(left, doc.y).lineTo(left + w, doc.y).stroke();
    doc.moveDown(0.3);
  });
}

function para(doc, text, opts = {}) {
  doc.fillColor(TEXT_DARK).font('Helvetica').fontSize(10.5)
    .text(text, { align: 'justify', ...opts });
  doc.moveDown(0.3);
}

module.exports = { buildFullPlanPdf };
