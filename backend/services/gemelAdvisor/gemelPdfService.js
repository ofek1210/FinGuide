'use strict';

const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');
const { rtl } = require('../pdf/pdfTextUtils');

const FONT_URL = 'https://github.com/googlefonts/noto-fonts/raw/main/hinted/ttf/NotoSansHebrew/NotoSansHebrew-Regular.ttf';
let cachedFontPath = null;

async function ensureHebrewFont() {
  if (cachedFontPath && fs.existsSync(cachedFontPath)) return cachedFontPath;
  const fontDir = path.join(__dirname, '../../.work/fonts');
  fs.mkdirSync(fontDir, { recursive: true });
  const fontPath = path.join(fontDir, 'NotoSansHebrew-Regular.ttf');
  if (!fs.existsSync(fontPath)) {
    const res = await fetch(FONT_URL);
    if (!res.ok) throw new Error('Failed to download Hebrew font for PDF');
    fs.writeFileSync(fontPath, Buffer.from(await res.arrayBuffer()));
  }
  cachedFontPath = fontPath;
  return fontPath;
}

async function generateGemelAdvisorPdf(report) {
  const fontPath = await ensureHebrewFont();
  const doc = new PDFDocument({ margin: 50, size: 'A4' });
  const chunks = [];
  doc.on('data', chunk => chunks.push(chunk));
  const finished = new Promise((resolve, reject) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });

  doc.registerFont('Hebrew', fontPath);
  doc.font('Hebrew');
  doc.fontSize(20).text(rtl('דוח גמל והשתלמות'), { align: 'right' });
  doc.font('Helvetica').fontSize(10).fillColor('#666').text('FinGuide', { align: 'right' });
  doc.font('Hebrew').text(rtl(new Date(report.generatedAt).toLocaleDateString('he-IL')), { align: 'right' });
  doc.moveDown().fillColor('#000');

  doc.fontSize(12).text(rtl(report.humanSummary || ''), { align: 'right', lineGap: 4 });
  doc.moveDown();

  doc.fontSize(14).text(rtl('חשבונות'), { align: 'right', underline: true });
  for (const acc of report.accounts || []) {
    doc.fontSize(11).text(rtl(`${acc.fundName} - ${Math.round(acc.balance || 0).toLocaleString('he-IL')} ש"ח`), { align: 'right' });
    doc.fontSize(9).fillColor('#444').text(rtl(acc.plainLanguage?.fees || ''), { align: 'right' });
    doc.fillColor('#000').moveDown(0.5);
  }

  if (report.recommendations?.length) {
    doc.fontSize(14).text(rtl('ממצאים עיקריים'), { align: 'right', underline: true });
    for (const rec of report.recommendations.slice(0, 8)) {
      doc.fontSize(10).text(rtl(`- ${rec.title}`), { align: 'right' });
    }
  }

  doc.moveDown().fontSize(8).fillColor('#888').text(rtl(report.disclaimer || ''), { align: 'right' });
  doc.end();
  return finished;
}

module.exports = { generateGemelAdvisorPdf };
