/**
 * Cost-estimate PDF builder.
 *
 * Streams a pdfkit document directly to an HTTP response. The caller is
 * responsible for setting response headers BEFORE invoking buildCostPdf().
 *
 * Layout (A4 portrait):
 *   ── Header band with brand wordmark + plan title
 *   ── "Cost estimate" + state/asOf line
 *   ── Two-column meta table (BUA, tier, etc.)
 *   ── Category breakdown table
 *   ── Total + ±15% variance band
 *   ── Footer disclaimer + generated timestamp
 *
 * pdfkit is a streaming library — we never buffer the whole PDF in memory.
 */

const PDFDocument = require('pdfkit');

const BRAND_PRIMARY  = '#2E7D32';
const BRAND_SECOND   = '#FF6F00';
const TEXT_DARK      = '#1A1A1A';
const TEXT_MUTED     = '#666666';
const ROW_DIVIDER    = '#E0E0E0';

function inr(n) {
  return '₹' + Number(n || 0).toLocaleString('en-IN');
}

function buildCostPdf({ res, plan, estimate }) {
  const doc = new PDFDocument({
    size: 'A4',
    margins: { top: 60, bottom: 70, left: 56, right: 56 },
    bufferPages: true,
    info: {
      Title: `Cost estimate — ${plan?.title || 'VastuVerse plan'}`,
      Author: 'VastuVerse',
      Subject: 'Construction cost estimate',
    },
  });

  doc.pipe(res);

  /* ── Header band ─────────────────────────────────────────────────── */
  doc
    .rect(0, 0, doc.page.width, 48)
    .fill(BRAND_PRIMARY);

  doc
    .fillColor('#FFFFFF')
    .font('Helvetica-Bold')
    .fontSize(18)
    .text('VastuVerse', 56, 16);

  doc
    .fillColor('#FFFFFF')
    .font('Helvetica')
    .fontSize(10)
    .text('AI-assisted home planning', 56, 36);

  // Right side: plan title
  if (plan?.title) {
    doc
      .fillColor('#FFFFFF')
      .font('Helvetica')
      .fontSize(11)
      .text(plan.title, 0, 22, { align: 'right', width: doc.page.width - 56 });
  }

  /* ── Title block ────────────────────────────────────────────────── */
  doc.y = 76;
  doc.fillColor(TEXT_DARK)
    .font('Helvetica-Bold')
    .fontSize(20)
    .text('Construction cost estimate');

  doc
    .moveDown(0.3)
    .fillColor(TEXT_MUTED)
    .font('Helvetica')
    .fontSize(10)
    .text(`Based on ${estimate.state || 'India'} rates as of ${estimate.asOf}.`);

  /* ── Meta two-column table ──────────────────────────────────────── */
  doc.moveDown(1.2);
  const metaStartY = doc.y;
  const metaLeftX  = 56;
  const metaRightX = doc.page.width / 2;

  const meta = [
    ['Finish tier',     capitalise(estimate.finishTier)],
    ['Built-up area',   `${estimate.buaSqft.toLocaleString('en-IN')} sqft`],
    ['State / city',    [estimate.city, estimate.state].filter(Boolean).join(', ') || '—'],
    ['Source',          estimate.source === 'CostDataset' ? 'Local cost database' : 'Bundled defaults'],
  ];

  meta.forEach(([k, v], i) => {
    const isLeft = i % 2 === 0;
    const x = isLeft ? metaLeftX : metaRightX;
    const y = metaStartY + Math.floor(i / 2) * 22;
    doc
      .fillColor(TEXT_MUTED).font('Helvetica').fontSize(9)
      .text(k.toUpperCase(), x, y, { characterSpacing: 0.6 });
    doc
      .fillColor(TEXT_DARK).font('Helvetica-Bold').fontSize(11)
      .text(v, x, y + 11);
  });
  doc.y = metaStartY + Math.ceil(meta.length / 2) * 22 + 12;

  /* ── Category breakdown table ──────────────────────────────────── */
  doc.moveDown(0.4);
  doc
    .fillColor(TEXT_DARK).font('Helvetica-Bold').fontSize(13)
    .text('Cost breakdown by category');
  doc.moveDown(0.6);

  // Column geometry
  const tableLeft = 56;
  const tableWidth = doc.page.width - 56 * 2;
  const colCategory = tableLeft;
  const colRate     = tableLeft + tableWidth * 0.45;
  const colAmount   = tableLeft + tableWidth * 0.70;

  // Header row
  doc
    .fillColor(TEXT_MUTED).font('Helvetica-Bold').fontSize(9)
    .text('CATEGORY', colCategory, doc.y, { characterSpacing: 0.6 });
  doc.text('UNIT RATE (₹/sqft)', colRate, doc.y - 11, { width: 130, align: 'right' });
  doc.text('AMOUNT',             colAmount, doc.y - 11, { align: 'right', width: tableWidth - (colAmount - tableLeft) });
  doc.moveDown(0.4);

  // Divider
  doc.strokeColor(ROW_DIVIDER).lineWidth(0.5)
    .moveTo(tableLeft, doc.y).lineTo(tableLeft + tableWidth, doc.y).stroke();
  doc.moveDown(0.4);

  // Rows
  const cats = estimate.categories || {};
  Object.values(cats).forEach((c) => {
    const rowY = doc.y;
    doc
      .fillColor(TEXT_DARK).font('Helvetica-Bold').fontSize(11)
      .text(c.label, colCategory, rowY);
    doc
      .fillColor(TEXT_MUTED).font('Helvetica').fontSize(9)
      .text(c.description, colCategory, rowY + 14, { width: tableWidth * 0.42 });

    doc
      .fillColor(TEXT_DARK).font('Helvetica').fontSize(11)
      .text(`₹ ${c.unitRateInrPerSqft}`, colRate, rowY, { width: 130, align: 'right' });
    doc
      .fillColor(TEXT_DARK).font('Helvetica-Bold').fontSize(11)
      .text(inr(c.totalInr), colAmount, rowY, { align: 'right', width: tableWidth - (colAmount - tableLeft) });

    // advance to bottom of this row (account for description wrap)
    doc.y = rowY + 38;
    doc.strokeColor(ROW_DIVIDER).lineWidth(0.5)
      .moveTo(tableLeft, doc.y).lineTo(tableLeft + tableWidth, doc.y).stroke();
    doc.moveDown(0.4);
  });

  /* ── Total band ─────────────────────────────────────────────────── */
  doc.moveDown(0.4);
  const bandY = doc.y;
  doc
    .roundedRect(tableLeft, bandY, tableWidth, 60, 6)
    .fill('#F1F8E9');

  doc
    .fillColor(BRAND_PRIMARY).font('Helvetica-Bold').fontSize(11)
    .text('TOTAL ESTIMATED COST', tableLeft + 14, bandY + 10, { characterSpacing: 0.6 });
  doc
    .fillColor(BRAND_PRIMARY).font('Helvetica-Bold').fontSize(22)
    .text(inr(estimate.totalInr), tableLeft + 14, bandY + 24);
  doc
    .fillColor(TEXT_MUTED).font('Helvetica').fontSize(9)
    .text(
      `Range with ±15% variance: ${inr(estimate.minInr)} — ${inr(estimate.maxInr)}`,
      tableLeft + 14, bandY + 50
    );

  doc.y = bandY + 76;

  /* ── Disclaimer ─────────────────────────────────────────────────── */
  doc.moveDown(0.6);
  doc
    .fillColor(TEXT_MUTED).font('Helvetica-Oblique').fontSize(9)
    .text(
      'This estimate is generated from regional reference rates and the chosen finish tier. ' +
      'Final costs vary with site conditions, soil quality, material availability, and contractor margins. ' +
      'Obtain at least 3 quotations from licensed contractors before commencing work.',
      { align: 'justify' }
    );

  /* ── Footer (every page) ────────────────────────────────────────── */
  const range = doc.bufferedPageRange();
  for (let i = 0; i < range.count; i++) {
    doc.switchToPage(range.start + i);
    const bottom = doc.page.height - 36;
    doc.strokeColor(ROW_DIVIDER).lineWidth(0.5)
      .moveTo(56, bottom).lineTo(doc.page.width - 56, bottom).stroke();
    doc.fillColor(TEXT_MUTED).font('Helvetica').fontSize(8);
    doc.text(`Generated by VastuVerse · ${new Date().toLocaleString('en-IN')}`, 56, bottom + 6);
    doc.text(
      `Page ${i + 1} / ${range.count}`,
      0, bottom + 6,
      { align: 'right', width: doc.page.width - 56 }
    );
  }

  doc.end();
}

function capitalise(s) {
  return typeof s === 'string' && s ? s[0].toUpperCase() + s.slice(1) : '—';
}

module.exports = { buildCostPdf };
