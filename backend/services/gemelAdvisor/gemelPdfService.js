'use strict';

const PDFDocument = require('pdfkit');
const { registerHebrewFonts, drawRtlText } = require('../pdf/pdfTextUtils');

async function generateGemelAdvisorPdf(report) {
  const doc = new PDFDocument({ margin: 50, size: 'A4' });
  const chunks = [];
  doc.on('data', chunk => chunks.push(chunk));
  const finished = new Promise((resolve, reject) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });

  registerHebrewFonts(doc);
  doc.font('Hebrew-Bold').fontSize(20);
  drawRtlText(doc, 'דוח גמל והשתלמות');
  doc.font('Helvetica').fontSize(10).fillColor('#666').text('FinGuide', { align: 'right' });
  doc.font('Hebrew');
  drawRtlText(doc, new Date(report.generatedAt).toLocaleDateString('he-IL'));
  doc.moveDown().fillColor('#000');

  doc.fontSize(12);
  drawRtlText(doc, report.humanSummary || '', { lineGap: 4 });
  doc.moveDown();

  doc.font('Hebrew-Bold').fontSize(14);
  drawRtlText(doc, 'חשבונות');
  doc.font('Hebrew');
  for (const acc of report.accounts || []) {
    doc.fontSize(11);
    drawRtlText(doc, `${acc.fundName} - ${Math.round(acc.balance || 0).toLocaleString('he-IL')} ש"ח`);
    doc.fontSize(9).fillColor('#444');
    drawRtlText(doc, acc.plainLanguage?.fees || '');
    doc.fillColor('#000').moveDown(0.5);
  }

  if (report.recommendations?.length) {
    doc.font('Hebrew-Bold').fontSize(14);
    drawRtlText(doc, 'ממצאים עיקריים');
    doc.font('Hebrew');
    for (const rec of report.recommendations.slice(0, 8)) {
      doc.fontSize(10);
      drawRtlText(doc, `- ${rec.title}`);
    }
  }

  doc.moveDown().fontSize(8).fillColor('#888');
  drawRtlText(doc, report.disclaimer || '');
  doc.end();
  return finished;
}

module.exports = { generateGemelAdvisorPdf };
