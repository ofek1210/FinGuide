'use strict';

const PDFDocument = require('pdfkit');
const {
  registerHebrewFonts,
  drawRtlText,
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

  const agentReport = report.sections.agentReport;
  const dateHe = new Date(report.meta.generatedAt).toLocaleDateString('he-IL', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  sectionTitle(doc, report.sections.title || 'הדוח הפיננסי האישי שלי');
  drawRtlText(doc, dateHe);
  doc.moveDown(0.5);

  sectionTitle(doc, 'התמונה הפיננסית שלי');
  bodyText(doc, report.sections.executiveSummary);

  for (const section of (agentReport?.agentSections || [])) {
    sectionTitle(doc, section.title);
    if (section.statusMessage) {
      bodyText(doc, section.statusMessage);
    }
    if (section.missingDetail) {
      bodyText(doc, `חסר: ${section.missingDetail.whatIsMissing}`);
      bodyText(doc, `לאחר העלאה: ${section.missingDetail.whatEnables}`);
    }
    if (section.dataSummary?.length) {
      for (const item of section.dataSummary) {
        bullet(doc, `${item.label}: ${item.value}`);
      }
    }
    if (section.plainLanguageExplanation) {
      bodyText(doc, section.plainLanguageExplanation);
    }
    for (const f of (section.findings || [])) {
      bullet(doc, `${f.title}${f.explanation ? ` — ${f.explanation}` : ''}`);
    }
    for (const rec of (section.recommendations || [])) {
      doc.font('Hebrew-Bold').fontSize(11);
      drawRtlText(doc, rec.title);
      doc.font('Hebrew').fontSize(10);
      if (rec.description) drawRtlText(doc, rec.description, { lineGap: 2 });
      if (rec.expectedBenefit) drawRtlText(doc, `צעד מומלץ: ${rec.expectedBenefit}`, { lineGap: 2 });
      doc.moveDown(0.4);
    }
    if (section.sourceData) {
      doc.fontSize(9).fillColor('#666');
      drawRtlText(doc, `מקור: ${section.sourceData}`);
      doc.fillColor('#000');
    }
    doc.moveDown(0.5);
  }

  if (agentReport?.combinedSummary?.notes?.length) {
    sectionTitle(doc, 'סיכום משולב');
    for (const note of agentReport.combinedSummary.notes) {
      bullet(doc, note);
    }
  }

  if (agentReport?.whatToDo?.length) {
    sectionTitle(doc, 'מה כדאי לעשות');
    for (const item of agentReport.whatToDo) {
      bullet(doc, `${item.title}: ${item.action}`);
    }
  }

  if (agentReport?.missingData?.length) {
    sectionTitle(doc, 'מידע שחסר');
    for (const m of agentReport.missingData) {
      bullet(doc, `${m.title} — ${m.whatIsMissing || m.message}`);
    }
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
  drawRtlText(doc, text || '—', { lineGap: 4 });
  doc.moveDown(0.5);
}

function bullet(doc, text) {
  doc.fontSize(10);
  drawRtlText(doc, `- ${text}`, { lineGap: 3 });
}

module.exports = { generateExecutiveReportPdf, pdfContainsHebrew };
