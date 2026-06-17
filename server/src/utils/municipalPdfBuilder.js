/**
 * Municipal draft document PDF builder.
 *
 * Layout (A4 portrait):
 *   ── Header band with brand wordmark + plan title
 *   ── "Application for Building Permit" + statute reference
 *   ── User-fill table (4 fields)
 *   ── Land use & development parameters (AI-filled)
 *   ── Room summary
 *   ── Compliance checklist (7 items with pass/fail icons)
 *   ── Notes (NBC references)
 *   ── Disclaimer band — on EVERY page footer
 */

const PDFDocument = require('pdfkit');

const BRAND_PRIMARY = '#2E7D32';
const TEXT_DARK     = '#1A1A1A';
const TEXT_MUTED    = '#555555';
const DIVIDER       = '#D0D0D0';
const AMBER         = '#FF8F00';
const DANGER        = '#C62828';
const SUCCESS       = '#2E7D32';

const DISCLAIMER =
  'This is a guidance document only. Final approval must be obtained from your local ULB / Municipal Corporation. ' +
  'VastuVerse does not guarantee compliance. Plans must be signed by a licensed architect / structural engineer before submission.';

function buildMunicipalPdf({ res, plan, report }) {
  const doc = new PDFDocument({
    size: 'A4',
    margins: { top: 60, bottom: 90, left: 56, right: 56 },
    bufferPages: true,
    info: {
      Title: `Municipal draft — ${plan?.title || 'VastuVerse plan'}`,
      Author: 'VastuVerse',
      Subject: 'Municipal compliance draft',
    },
  });

  doc.pipe(res);

  /* ── Header band ─────────────────────────────────────────────────── */
  doc.rect(0, 0, doc.page.width, 50).fill(BRAND_PRIMARY);
  doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(18).text('VastuVerse', 56, 16);
  doc.fillColor('#FFFFFF').font('Helvetica').fontSize(10).text('Municipal compliance draft', 56, 36);

  if (plan?.title) {
    doc.fillColor('#FFFFFF').font('Helvetica').fontSize(11)
      .text(plan.title, 0, 22, { align: 'right', width: doc.page.width - 56 });
  }

  /* ── Title block ────────────────────────────────────────────────── */
  doc.y = 80;
  doc.fillColor(TEXT_DARK).font('Times-Bold').fontSize(20)
    .text('APPLICATION FOR BUILDING PERMIT', { align: 'center' });
  doc.moveDown(0.2);
  doc.fillColor(TEXT_MUTED).font('Times-Italic').fontSize(10)
    .text('(Indicative draft generated from wizard inputs)', { align: 'center' });

  doc.moveDown(1);

  /* ── User-fill table ────────────────────────────────────────────── */
  const uf = report?.userFields || {};
  const labelW = 150;
  const tableLeft = 56;
  const tableW = doc.page.width - 56 * 2;

  doc.fillColor(TEXT_DARK).font('Helvetica-Bold').fontSize(12).text('Applicant & site details');
  doc.moveDown(0.4);

  const rows = [
    ['Plot Number',       uf.plotNumber || '—'],
    ['Survey / Khasra',   uf.surveyNumber || '—'],
    ['Local Authority',   uf.localAuthority || '—'],
    ['Owner Name',        uf.ownerName || '—'],
    ['City / State',      [plan?.cityState?.city, plan?.cityState?.state].filter(Boolean).join(', ') || '—'],
  ];

  rows.forEach(([k, v]) => {
    const rowY = doc.y;
    doc.fillColor(TEXT_MUTED).font('Helvetica').fontSize(10)
      .text(k, tableLeft, rowY, { width: labelW });
    doc.fillColor(TEXT_DARK).font('Times-Roman').fontSize(11)
      .text(v, tableLeft + labelW, rowY, { width: tableW - labelW });
    doc.y = rowY + 18;
    doc.strokeColor(DIVIDER).lineWidth(0.5)
      .moveTo(tableLeft, doc.y).lineTo(tableLeft + tableW, doc.y).stroke();
    doc.moveDown(0.3);
  });

  doc.moveDown(0.8);

  /* ── Development parameters ─────────────────────────────────────── */
  const d = report?.draft || {};

  doc.fillColor(TEXT_DARK).font('Helvetica-Bold').fontSize(12)
    .text('Land use & development parameters');
  doc.moveDown(0.4);

  const dev = [
    ['Land use zone',       d.landUseZone || '—'],
    ['Plot area',           d.plotAreaSqft ? `${d.plotAreaSqft.toLocaleString('en-IN')} sqft` : '—'],
    ['Number of floors',    String(d.floors || 1)],
    ['Proposed BUA',        d.proposedBuaSqft ? `${d.proposedBuaSqft.toLocaleString('en-IN')} sqft` : '—'],
    ['FSI statement',       d.fsiStatement || '—'],
    ['Setback compliance',  d.setbackStatement || '—'],
    ['Ruleset',             d.rulesetSource || 'NBC 2016 (default)'],
  ];

  dev.forEach(([k, v]) => {
    const rowY = doc.y;
    doc.fillColor(TEXT_MUTED).font('Helvetica').fontSize(10)
      .text(k, tableLeft, rowY, { width: labelW });
    doc.fillColor(TEXT_DARK).font('Times-Roman').fontSize(11)
      .text(v, tableLeft + labelW, rowY, { width: tableW - labelW });
    doc.y = Math.max(doc.y, rowY + 18);
    doc.strokeColor(DIVIDER).lineWidth(0.5)
      .moveTo(tableLeft, doc.y).lineTo(tableLeft + tableW, doc.y).stroke();
    doc.moveDown(0.3);
  });

  doc.moveDown(0.8);

  /* ── Room summary ───────────────────────────────────────────────── */
  if (d.roomSummary) {
    doc.fillColor(TEXT_DARK).font('Helvetica-Bold').fontSize(12).text('Proposed accommodation');
    doc.moveDown(0.4);
    doc.fillColor(TEXT_DARK).font('Times-Roman').fontSize(11)
      .text(d.roomSummary, { align: 'justify' });
    doc.moveDown(0.9);
  }

  /* ── Compliance checklist ───────────────────────────────────────── */
  doc.fillColor(TEXT_DARK).font('Helvetica-Bold').fontSize(12)
    .text('Compliance checklist');
  doc.moveDown(0.5);

  (report?.items || []).forEach((item) => {
    if (doc.y > doc.page.height - 130) doc.addPage();

    const rowY = doc.y;
    const statusColor = item.status === 'pass'    ? SUCCESS
                      : item.status === 'fail'    ? DANGER
                      : item.status === 'warning' ? AMBER
                      :                              TEXT_MUTED;
    const glyph = item.status === 'pass' ? '✓'
                : item.status === 'fail' ? '✗'
                : item.status === 'warning' ? '!'
                : 'i';

    // Status circle
    doc.circle(tableLeft + 6, rowY + 6, 6).fill(statusColor);
    doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(8)
      .text(glyph, tableLeft + 3, rowY + 3, { width: 6, align: 'center' });

    doc.fillColor(TEXT_DARK).font('Helvetica-Bold').fontSize(11)
      .text(item.label, tableLeft + 22, rowY, { width: tableW - 22 });
    doc.fillColor(TEXT_MUTED).font('Helvetica').fontSize(9.5)
      .text(item.summary, tableLeft + 22, doc.y, { width: tableW - 22, align: 'justify' });

    if (item.reference?.code) {
      doc.fillColor(TEXT_MUTED).font('Helvetica-Oblique').fontSize(8.5)
        .text(`Ref: ${item.reference.code}`, tableLeft + 22, doc.y + 2, { width: tableW - 22 });
    }
    doc.moveDown(0.6);
    doc.strokeColor(DIVIDER).lineWidth(0.5)
      .moveTo(tableLeft, doc.y).lineTo(tableLeft + tableW, doc.y).stroke();
    doc.moveDown(0.5);
  });

  /* ── Summary band ───────────────────────────────────────────────── */
  doc.moveDown(0.5);
  if (doc.y > doc.page.height - 130) doc.addPage();
  const s = report?.summary || {};
  const bandY = doc.y;
  doc.roundedRect(tableLeft, bandY, tableW, 50, 6).fill('#F1F8E9');
  doc.fillColor(BRAND_PRIMARY).font('Helvetica-Bold').fontSize(11)
    .text('SUMMARY', tableLeft + 14, bandY + 10, { characterSpacing: 0.6 });
  doc.fillColor(TEXT_DARK).font('Helvetica-Bold').fontSize(13)
    .text(
      `${s.passed || 0} passed · ${s.warnings || 0} warning(s) · ${s.failed || 0} fail(s)  —  ${labelStatus(s.overallStatus)}`,
      tableLeft + 14, bandY + 26
    );
  doc.y = bandY + 60;

  /* ── Footer disclaimer on every page (bufferedPages pass) ──────── */
  const range = doc.bufferedPageRange();
  for (let i = 0; i < range.count; i++) {
    doc.switchToPage(range.start + i);
    const bandTop = doc.page.height - 78;

    // Amber disclaimer band
    doc.rect(0, bandTop, doc.page.width, 60).fill('#FFF8E1');
    doc.rect(0, bandTop, 4, 60).fill(AMBER);

    doc.fillColor(AMBER).font('Helvetica-Bold').fontSize(9)
      .text('GUIDANCE ONLY — NOT FOR SUBMISSION', 56, bandTop + 8, { characterSpacing: 0.7 });
    doc.fillColor('#5D4037').font('Helvetica').fontSize(8.5)
      .text(DISCLAIMER, 56, bandTop + 22, { width: doc.page.width - 56 * 2, align: 'justify' });

    // Page number on top of band
    doc.fillColor(TEXT_MUTED).font('Helvetica').fontSize(8)
      .text(`Page ${i + 1} / ${range.count}  ·  Generated by VastuVerse · ${new Date().toLocaleString('en-IN')}`,
        56, doc.page.height - 16, { align: 'left', width: doc.page.width - 112 });
  }

  doc.end();
}

function labelStatus(s) {
  if (s === 'compliant')      return 'COMPLIANT';
  if (s === 'needs-attention')return 'NEEDS ATTENTION';
  if (s === 'non-compliant')  return 'NON-COMPLIANT';
  return 'PENDING';
}

module.exports = { buildMunicipalPdf };
