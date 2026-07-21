'use strict';

const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');
const { rtl, formatImpactStars, pdfContainsHebrew } = require('../pdf/pdfTextUtils');

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
    const buf = Buffer.from(await res.arrayBuffer());
    fs.writeFileSync(fontPath, buf);
  }
  cachedFontPath = fontPath;
  return fontPath;
}

async function generateExecutiveReportPdf(report) {
  const fontPath = await ensureHebrewFont();
  const doc = new PDFDocument({ margin: 50, size: 'A4', bufferPages: true });
  const chunks = [];

  doc.on('data', chunk => chunks.push(chunk));

  const finished = new Promise((resolve, reject) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });

  doc.registerFont('Hebrew', fontPath);
  doc.font('Hebrew');

  const dateHe = new Date(report.meta.generatedAt).toLocaleDateString('he-IL', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  // ── cover ──
  doc.fontSize(22).fillColor('#1a1a1a').text(rtl('דוח פיננסי מנהלים'), { align: 'right' });
  doc.font('Helvetica').fontSize(10).fillColor('#666').text('FinGuide', { align: 'right' });
  doc.font('Hebrew').text(rtl(dateHe), { align: 'right' });
  if (report.meta.globalHealthScore != null) {
    doc.moveDown(0.4).fontSize(11).fillColor('#333')
      .text(rtl(`ציון בריאות פיננסית: ${report.meta.globalHealthScore}/100`), { align: 'right' });
  }
  doc.moveDown(1.2).fillColor('#000');

  // ── sections ──
  sectionTitle(doc, 'סיכום מנהלים');
  bodyText(doc, report.sections.executiveSummary);

  sectionTitle(doc, 'פעולות בעדיפות עליונה');
  for (const action of report.sections.topPriorityActions) {
    doc.fontSize(13).fillColor('#1a1a1a')
      .text(rtl(`${action.rank}. ${action.title}`), { align: 'right' });
    doc.moveDown(0.25);
    if (action.explanation) {
      doc.fontSize(10).fillColor('#333').text(rtl(action.explanation), { align: 'right', lineGap: 3 });
    }
    doc.fontSize(10).fillColor('#444');
    doc.text(rtl(`למה עכשיו: ${action.whyNow}`), { align: 'right', lineGap: 2 });
    doc.text(rtl(`תועלת צפויה: ${action.expectedBenefit}`), { align: 'right', lineGap: 2 });
    doc.text(
      rtl(`עדיפות: ${action.priorityLabel} | דחיפות: ${action.urgency} | ${formatImpactStars(action.impactStars)}`),
      { align: 'right', lineGap: 2 },
    );
    if (action.conflictNote) {
      doc.text(rtl(`הערה: ${action.conflictNote}`), { align: 'right', lineGap: 2 });
    }
    doc.moveDown(0.9).fillColor('#000');
  }

  if (report.sections.conflicts?.length) {
    sectionTitle(doc, 'נושאים שדורשים איזון');
    for (const c of report.sections.conflicts) {
      doc.fontSize(11).fillColor('#1a1a1a').text(rtl(c.title), { align: 'right' });
      doc.fontSize(10).fillColor('#333');
      if (c.explanation) doc.text(rtl(c.explanation), { align: 'right', lineGap: 2 });
      if (c.tradeOff) doc.text(rtl(`הפשרה: ${c.tradeOff}`), { align: 'right', lineGap: 2 });
      if (c.recommendation) doc.text(rtl(`המלצה: ${c.recommendation}`), { align: 'right', lineGap: 2 });
      doc.moveDown(0.6).fillColor('#000');
    }
  }

  if (report.sections.financialStrengths.length) {
    sectionTitle(doc, 'חוזקות פיננסיות');
    for (const s of report.sections.financialStrengths) {
      bullet(doc, s.explanation ? `${s.title} - ${s.explanation}` : s.title);
    }
  }

  if (report.sections.risks.length) {
    sectionTitle(doc, 'סיכונים');
    for (const r of report.sections.risks) {
      bullet(doc, r.explanation ? `${r.title} - ${r.explanation}` : r.title);
    }
  }

  if (report.sections.opportunities.length) {
    sectionTitle(doc, 'הזדמנויות');
    for (const o of report.sections.opportunities) {
      const suffix = o.possibleSavings ? ' (חיסכון פוטנציאלי)' : '';
      bullet(doc, o.explanation ? `${o.title} - ${o.explanation}${suffix}` : `${o.title}${suffix}`);
    }
  }

  sectionTitle(doc, 'מפת דרכים');
  const roadmapLabels = {
    immediate: 'מיידי',
    within30Days: 'עד 30 יום',
    within3Months: 'עד 3 חודשים',
    longTerm: 'ארוך טווח',
  };
  for (const [key, label] of Object.entries(roadmapLabels)) {
    const items = report.sections.roadmap[key] || [];
    if (!items.length) continue;
    doc.fontSize(12).fillColor('#333').text(rtl(label), { align: 'right' });
    for (const item of items) {
      bullet(doc, item.title);
    }
    doc.moveDown(0.4).fillColor('#000');
  }

  sectionTitle(doc, 'לעקוב באופן קבוע');
  for (const item of report.sections.thingsToReviewRegularly) {
    bullet(doc, item);
  }

  doc.moveDown(1);
  doc.fontSize(8).fillColor('#888').text(rtl(report.disclaimer), { align: 'right', lineGap: 2 });

  doc.end();
  return finished;
}

function sectionTitle(doc, title) {
  doc.moveDown(0.8).fontSize(15).fillColor('#1a1a1a')
    .text(rtl(title), { align: 'right', underline: true });
  doc.moveDown(0.4).fontSize(11).fillColor('#000');
}

function bodyText(doc, text) {
  doc.fontSize(11).text(rtl(text), { align: 'right', lineGap: 4 });
  doc.moveDown(0.5);
}

function bullet(doc, text) {
  doc.fontSize(10).text(rtl(`- ${text}`), { align: 'right', lineGap: 3 });
}

module.exports = { generateExecutiveReportPdf, rtl, pdfContainsHebrew };
