// Helpers de PDF compartidos por los reportes (documento, títulos, secciones y tablas).
const PDFDocument = require('pdfkit');

const PDF_MIME = 'application/pdf';

function createPdf(res, filename, title) {
  res.setHeader('Content-Type', PDF_MIME);
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

  const doc = new PDFDocument({ size: 'A4', margin: 50, bufferPages: true });
  const now = new Date();
  doc.info = {
    Title: title,
    Author: 'Club Deportivo',
    Subject: title,
    Creator: 'Club Deportivo',
    Producer: 'PDFKit',
    CreationDate: now,
    ModDate: now
  };
  doc.on('error', (error) => {
    console.error(`Error generando PDF ${filename}:`, error);
    if (!res.destroyed) res.destroy(error);
  });
  res.on('error', (error) => {
    console.error(`Error enviando PDF ${filename}:`, error);
  });
  doc.pipe(res);
  return doc;
}

function finalizePdf(doc) {
  const range = doc.bufferedPageRange();
  const total = range.count;
  const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  for (let i = 0; i < total; i++) {
    doc.switchToPage(range.start + i);
    doc
      .fontSize(8)
      .fillColor('#94A3B8')
      .font('Helvetica')
      .text(`Página ${i + 1} de ${total}`, doc.page.margins.left, doc.page.height - doc.page.margins.bottom + 10, {
        align: 'right',
        width: pageWidth
      });
  }
  doc.flushPages();
  doc.end();
}

// ─── PDF helpers ──────────────────────────────────────────────────────────────
const PDF_C = {
  navy: '#1E3A5F',
  blue: '#3B82F6',
  rowEven: '#F1F5F9',
  rowOdd: '#FFFFFF',
  secBg: '#EFF6FF',
  body: '#1E293B',
  muted: '#64748B',
  kvKey: '#475569',
  kvEven: '#F8FAFC'
};
const HDR_H = 24;
const ROW_H = 18;
const SECT_H = 26;
const PAD = 5;

function ensurePdfSpace(doc, requiredHeight = 48) {
  if (doc.y + requiredHeight <= doc.page.height - doc.page.margins.bottom) return;
  doc.addPage();
}

// Draw a filled rectangle without affecting doc.y
function fillRect(doc, x, y, w, h, color) {
  doc.rect(x, y, w, h).fill(color);
}

// Write text at absolute position.
// Key: set doc.y = targetY - 1 BEFORE calling doc.text so PDFKit
// never thinks we are "going backwards" (which would trigger a new page).
function absText(doc, str, x, targetY, w, opts) {
  doc.y = targetY - 0.1; // just above target — prevents new-page logic
  doc.text(String(str ?? '-'), x, targetY, {
    width: w,
    lineBreak: false,
    ellipsis: true,
    ...opts
  });
}

function writePdfTitle(doc, title, subtitleLines = []) {
  const L = doc.page.margins.left;
  const W = doc.page.width - L - doc.page.margins.right;
  const bannerH = 50 + subtitleLines.length * 15;
  const startY = doc.y;

  fillRect(doc, L - 10, startY, W + 20, bannerH, PDF_C.navy);
  fillRect(doc, L - 10, startY + bannerH - 3, W + 20, 3, PDF_C.blue);

  doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(17);
  absText(doc, title, L, startY + 11, W);

  doc.fillColor('#BFDBFE').font('Helvetica').fontSize(9);
  subtitleLines.forEach((line, i) => {
    absText(doc, line, L, startY + 34 + i * 15, W);
  });

  doc.y = startY + bannerH + 14;
  doc.fillColor(PDF_C.body);
}

function writePdfSection(doc, title) {
  ensurePdfSpace(doc, SECT_H + ROW_H + 4);
  const L = doc.page.margins.left;
  const W = doc.page.width - L - doc.page.margins.right;
  const sY = doc.y;

  fillRect(doc, L, sY, W, SECT_H, PDF_C.secBg);
  fillRect(doc, L, sY, 4, SECT_H, PDF_C.navy);

  doc.fillColor(PDF_C.navy).font('Helvetica-Bold').fontSize(10.5);
  absText(doc, title, L + 12, sY + 8, W - 16);

  doc.y = sY + SECT_H + 6;
  doc.fillColor(PDF_C.body).font('Helvetica').fontSize(9.5);
}

function writePdfKeyValueRows(doc, rows) {
  const L = doc.page.margins.left;
  const W = doc.page.width - L - doc.page.margins.right;
  const keyW = W * 0.46;
  const valX = L + keyW + 8;
  const valW = W - keyW - 8;

  rows.forEach(([key, value], idx) => {
    ensurePdfSpace(doc, ROW_H);
    const rY = doc.y;
    fillRect(doc, L, rY, W, ROW_H, idx % 2 === 0 ? PDF_C.kvEven : PDF_C.rowOdd);

    doc.fillColor(PDF_C.kvKey).font('Helvetica-Bold').fontSize(8.5);
    absText(doc, `${key}:`, L + PAD, rY + 5, keyW - PAD);

    doc.fillColor(PDF_C.body).font('Helvetica').fontSize(9);
    absText(doc, value, valX, rY + 5, valW);

    doc.y = rY + ROW_H;
  });
  fillRect(
    doc,
    doc.page.margins.left,
    doc.y,
    doc.page.width - doc.page.margins.left - doc.page.margins.right,
    2,
    PDF_C.blue
  );
  doc.y += 12;
}

function writePdfTable(doc, headers, rows, colRatios = null) {
  const L = doc.page.margins.left;
  const W = doc.page.width - L - doc.page.margins.right;

  // Column widths
  let colWidths;
  if (colRatios && colRatios.length === headers.length) {
    const tot = colRatios.reduce((a, b) => a + b, 0);
    colWidths = colRatios.map((r) => (r / tot) * W);
  } else {
    colWidths = headers.map(() => W / headers.length);
  }
  const colX = [];
  let cx = L;
  colWidths.forEach((w) => {
    colX.push(cx);
    cx += w;
  });

  // ── Header ──
  ensurePdfSpace(doc, HDR_H + ROW_H + 4);
  const hY = doc.y;
  fillRect(doc, L, hY, W, HDR_H, PDF_C.navy);
  fillRect(doc, L, hY + HDR_H - 2, W, 2, PDF_C.blue);

  doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(8.5);
  headers.forEach((h, i) => absText(doc, h, colX[i] + PAD, hY + 8, colWidths[i] - PAD * 2));
  doc.y = hY + HDR_H;

  // ── Data rows ──
  rows.forEach((row, rowIdx) => {
    ensurePdfSpace(doc, ROW_H + 2);
    const rY = doc.y;
    fillRect(doc, L, rY, W, ROW_H, rowIdx % 2 === 0 ? PDF_C.rowEven : PDF_C.rowOdd);
    fillRect(doc, L, rY + ROW_H - 0.5, W, 0.5, '#E2E8F0');

    doc.fillColor(PDF_C.body).font('Helvetica').fontSize(8.5);
    row.forEach((cell, i) => absText(doc, cell, colX[i] + PAD, rY + 5, colWidths[i] - PAD * 2));
    doc.y = rY + ROW_H;
  });

  fillRect(doc, L, doc.y, W, 2, PDF_C.blue);
  doc.y += 14;
}

module.exports = {
  createPdf,
  finalizePdf,
  ensurePdfSpace,
  writePdfTitle,
  writePdfSection,
  writePdfKeyValueRows,
  writePdfTable
};
