'use strict';

const PDFDocument = require('pdfkit');
const {
  registerHebrewFonts,
  drawRtlText,
  formatImpactStars,
  pdfContainsHebrew,
} = require('../pdf/pdfTextUtils');

async function generateExecutiveReportPdf(report) {
  const doc = new PDFDocument({ margin: 50, size: 'A4', bufferPages: true });
  const chunks = [];

  doc.on('data', chunk => chunks.push(chunk));

  const finished = new Promise((resolve, reject) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });

  registerHebrewFonts(doc);
  doc.font('Hebrew');

  const dateHe = new Date(report.meta.generatedAt).toLocaleDateString('he-IL', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  // ── cover ──
  doc.font('Hebrew-Bold').fontSize(22).fillColor('#1a1a1a');
  drawRtlText(doc, 'דוח פיננסי מנהלים');
  doc.font('Helvetica').fontSize(10).fillColor('#666').text('FinGuide', { align: 'right' });
  doc.font('Hebrew');
  drawRtlText(doc, dateHe);
  if (report.meta.globalHealthScore != null) {
    doc.moveDown(0.4).fontSize(11).fillColor('#333');
    drawRtlText(doc, `ציון בריאות פיננסית: ${report.meta.globalHealthScore}/100`);
  }
  doc.moveDown(1.2).fillColor('#000');

  // ── sections ──
  sectionTitle(doc, 'סיכום מנהלים');
  bodyText(doc, report.sections.executiveSummary);

  sectionTitle(doc, 'פעולות בעדיפות עליונה');
  for (const action of report.sections.topPriorityActions) {
    doc.font('Hebrew-Bold').fontSize(13).fillColor('#1a1a1a');
    drawRtlText(doc, `${action.rank}. ${action.title}`);
    doc.font('Hebrew');
    doc.moveDown(0.25);
    if (action.explanation) {
      doc.fontSize(10).fillColor('#333');
      drawRtlText(doc, action.explanation, { lineGap: 3 });
    }
    doc.fontSize(10).fillColor('#444');
    drawRtlText(doc, `למה עכשיו: ${action.whyNow}`, { lineGap: 2 });
    drawRtlText(doc, `תועלת צפויה: ${action.expectedBenefit}`, { lineGap: 2 });
    drawRtlText(
      doc,
      `עדיפות: ${action.priorityLabel} | דחיפות: ${action.urgency} | ${formatImpactStars(action.impactStars)}`,
      { lineGap: 2 },
    );
    if (action.conflictNote) {
      drawRtlText(doc, `הערה: ${action.conflictNote}`, { lineGap: 2 });
    }
    doc.moveDown(0.9).fillColor('#000');
  }

  if (report.sections.conflicts?.length) {
    sectionTitle(doc, 'נושאים שדורשים איזון');
    for (const c of report.sections.conflicts) {
      doc.font('Hebrew-Bold').fontSize(11).fillColor('#1a1a1a');
      drawRtlText(doc, c.title);
      doc.font('Hebrew').fontSize(10).fillColor('#333');
      if (c.explanation) drawRtlText(doc, c.explanation, { lineGap: 2 });
      if (c.tradeOff) drawRtlText(doc, `הפשרה: ${c.tradeOff}`, { lineGap: 2 });
      if (c.recommendation) drawRtlText(doc, `המלצה: ${c.recommendation}`, { lineGap: 2 });
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
    doc.font('Hebrew-Bold').fontSize(12).fillColor('#333');
    drawRtlText(doc, label);
    doc.font('Hebrew');
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
  doc.fontSize(8).fillColor('#888');
  drawRtlText(doc, report.disclaimer, { lineGap: 2 });

  doc.end();
  return finished;
}

function sectionTitle(doc, title) {
  doc.moveDown(0.8).font('Hebrew-Bold').fontSize(15).fillColor('#1a1a1a');
  drawRtlText(doc, title);
  doc.moveDown(0.4).font('Hebrew').fontSize(11).fillColor('#000');
}

function bodyText(doc, text) {
  doc.fontSize(11);
  drawRtlText(doc, text, { lineGap: 4 });
  doc.moveDown(0.5);
}

function bullet(doc, text) {
  doc.fontSize(10);
  drawRtlText(doc, `- ${text}`, { lineGap: 3 });
}

module.exports = { generateExecutiveReportPdf, pdfContainsHebrew };
