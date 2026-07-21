'use strict';

const PDFDocument = require('pdfkit');
const {
  registerHebrewFonts,
  drawRtlText,
  pdfContainsHebrew,
} = require('../pdf/pdfTextUtils');

async function generateExecutiveReportPdf(report, { mode = 'user' } = {}) {
  if (mode === 'professional') {
    return generateProfessionalPdf(report);
  }
  return generateUserFriendlyPdf(report);
}

async function generateUserFriendlyPdf(report) {
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

  sectionTitle(doc, report.sections.userFriendly?.title || 'הדוח הפיננסי האישי שלי');
  drawRtlText(doc, dateHe);
  doc.moveDown(0.5);

  sectionTitle(doc, 'התמונה שלי');
  const overview = report.sections.personalOverview;
  if (overview) {
    bodyText(doc, `תחומים שנותחו: ${(overview.analyzedDomains || []).join(', ') || '—'}`);
    bodyText(doc, `מקורות: ${(overview.availableReports || []).join(', ') || '—'}`);
    bodyText(doc, `ממצאים: ${overview.findingCount ?? 0} · הזדמנויות מהותיות: ${overview.materialOpportunityCount ?? 0}`);
    if (overview.healthScore) {
      bodyText(doc, `ציון בריאות פיננסית: ${overview.healthScore.score}/100`);
      bodyText(doc, `חישוב: ${overview.healthScore.howCalculated}`);
      if (overview.healthScore.pointsLost?.length) {
        bodyText(doc, `נקודות שאבדו: ${overview.healthScore.pointsLost.join('; ')}`);
      }
    }
  }

  sectionTitle(doc, 'מה מצאנו');
  bodyText(doc, report.sections.executiveSummary);
  for (const decision of (report.sections.mainDecisions || []).slice(0, 6)) {
    doc.font('Hebrew-Bold').fontSize(12);
    drawRtlText(doc, decision.title);
    doc.font('Hebrew').fontSize(10);
    if (decision.finding) drawRtlText(doc, decision.finding, { lineGap: 2 });
    if (decision.whyItMatters) drawRtlText(doc, `למה זה חשוב: ${decision.whyItMatters}`, { lineGap: 2 });
    if (decision.monetaryImpact?.summary) {
      drawRtlText(doc, decision.monetaryImpact.summary, { lineGap: 2 });
      for (const a of (decision.monetaryImpact.assumptions || [])) {
        drawRtlText(doc, `• ${a}`, { lineGap: 1 });
      }
    }
    doc.moveDown(0.6);
  }

  const fees = report.sections.managementFees;
  if (fees?.products?.length) {
    sectionTitle(doc, 'דמי ניהול — סיכום');
    for (const p of fees.products.slice(0, 8)) {
      const excess = p.estimatedAnnualExcess != null
        ? ` · עודף שנתי ~₪${Math.round(p.estimatedAnnualExcess).toLocaleString('he-IL')}`
        : '';
      bullet(doc, `${p.product}: ${p.conclusion || ''}${excess}`);
    }
    if (fees.totalEstimatedAnnualExcess != null) {
      bodyText(doc, `סה"כ עודף שנתי מוערך: ₪${Math.round(fees.totalEstimatedAnnualExcess).toLocaleString('he-IL')}`);
    }
    for (const im of (fees.immaterialProducts || [])) {
      bullet(doc, `${im.product}: ${im.reason}`);
    }
  }

  sectionTitle(doc, 'מה כדאי לעשות');
  renderActionBucket(doc, report.sections.actionPlan?.doNow || []);

  sectionTitle(doc, 'לפני שמבצעים שינוי');
  renderActionBucket(doc, report.sections.actionPlan?.beforeChange || []);

  sectionTitle(doc, 'מידע שחסר');
  renderActionBucket(doc, report.sections.actionPlan?.missingData || []);

  doc.moveDown(1);
  doc.fontSize(8).fillColor('#888');
  drawRtlText(doc, report.disclaimer, { lineGap: 2 });

  doc.end();
  return finished;
}

async function generateProfessionalPdf(report) {
  const doc = new PDFDocument({ margin: 50, size: 'A4', bufferPages: true });
  const chunks = [];

  doc.on('data', chunk => chunks.push(chunk));

  const finished = new Promise((resolve, reject) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });

  registerHebrewFonts(doc);
  doc.font('Hebrew');

  const pro = report.sections.professional || {};
  sectionTitle(doc, pro.title || 'סיכום פיננסי לאיש מקצוע');
  bodyText(doc, `תאריך: ${new Date(pro.reportDate || report.meta.generatedAt).toLocaleDateString('he-IL')}`);
  bodyText(doc, `מקורות: ${(pro.dataSources || []).join(', ')}`);

  sectionTitle(doc, 'מלאי מוצרים ויתרות');
  for (const item of (pro.balances || [])) {
    bullet(doc, `${item.label}: ${item.formatted} (${item.sourceAgent})`);
  }

  sectionTitle(doc, 'דמי ניהול');
  for (const p of (pro.fees?.products || [])) {
    bullet(doc, `${p.product} | יתרה: ${p.balance ?? '—'} | דמ"נ: ${p.currentFee ?? '—'} | עודף שנתי: ${p.estimatedAnnualExcess ?? '—'}`);
  }

  sectionTitle(doc, 'כיסוי ביטוחי');
  const ins = pro.insuranceCoverage || {};
  for (const item of [...(ins.pensionEmbedded || []), ...(ins.privatePolicies || [])]) {
    bullet(doc, `${item.title}: ${item.detail}`);
  }
  bodyText(doc, `מקורות: ${(ins.sources || []).join(', ')}`);

  sectionTitle(doc, 'ממצאים לפי סוכן');
  for (const [agentId, data] of Object.entries(pro.findingsByAgent || {})) {
    doc.font('Hebrew-Bold').fontSize(11);
    drawRtlText(doc, agentId);
    doc.font('Hebrew').fontSize(10);
    for (const f of (data.findings || []).slice(0, 5)) {
      bullet(doc, `${f.title}: ${f.explanation || ''}`);
    }
    doc.moveDown(0.4);
  }

  sectionTitle(doc, 'המלצות מאוחדות');
  for (const rec of (pro.consolidatedRecommendations || []).slice(0, 20)) {
    bullet(doc, `[${rec.classification}] ${rec.title} — ${(rec.sourceAgents || []).join('+')} (${(rec.sourceReports || []).join(', ')})`);
  }

  sectionTitle(doc, 'הנחות ומידע חסר');
  for (const a of (pro.assumptions || []).slice(0, 10)) {
    bullet(doc, a);
  }
  for (const m of (pro.missingData || [])) {
    bullet(doc, m.title);
  }

  doc.moveDown(1);
  doc.fontSize(8).fillColor('#888');
  drawRtlText(doc, pro.disclaimer || report.disclaimer, { lineGap: 2 });

  doc.end();
  return finished;
}

function renderActionBucket(doc, items) {
  if (!items.length) {
    bodyText(doc, '—');
    return;
  }
  for (const item of items) {
    doc.font('Hebrew-Bold').fontSize(11);
    drawRtlText(doc, item.title);
    doc.font('Hebrew').fontSize(10);
    if (item.explanation) drawRtlText(doc, item.explanation, { lineGap: 2 });
    if (item.whoToContact) drawRtlText(doc, `ליצירת קשר: ${item.whoToContact}`, { lineGap: 1 });
    if (item.whatToRequest) drawRtlText(doc, `לבקש: ${item.whatToRequest}`, { lineGap: 1 });
    doc.moveDown(0.5);
  }
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
