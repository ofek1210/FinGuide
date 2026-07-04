'use strict';

/**
 * Clearinghouse-specific pension insights — hardcoded business rules from
 * "פרטי המוצרים שלי" export format (Meitav/Clal/Harel edge cases).
 */
const PensionFund = require('../models/PensionFund');
const { fundDocumentToProductRow } = require('../utils/pensionProductNormalizer');
const { comparePensionProducts, project30YearLoss } = require('./pensionComparisonEngine');

const SMALL_INACTIVE_PENSION_MAX = 5000;
const HIGH_INACTIVE_PROVIDENT_ASSET_FEE = 0.5;

function round2(n) {
  return Math.round(n * 100) / 100;
}

function fmtMoney(n) {
  return `${round2(n).toLocaleString('he-IL')} ש"ח`;
}

function fmtPct(n) {
  return `${round2(n)}%`;
}

function rec({
  type, title, reason, urgency = 'medium', financialImpact = null, impactAmount = 0, confidenceScore = 90,
}) {
  return {
    type,
    title,
    reason,
    urgency,
    financialImpact,
    impactAmount,
    confidenceScore,
  };
}

function isComprehensiveNewPension(productType, productName = '') {
  const t = String(productType || productName || '').trim();
  return t === 'פנסיה חדשה מקיפה' || /^פנסיה חדשה מקיפה\b/.test(t);
}

function isProvidentFund(productType, productName = '') {
  const t = String(productType || productName || '').trim();
  return t === 'קופת גמל' || /^קופת גמל$/.test(t);
}

function companyShort(name) {
  const s = String(name || '').trim();
  if (/מיטב/i.test(s)) return 'מיטב';
  if (/כלל/i.test(s)) return 'כלל';
  if (/הראל/i.test(s)) return 'הראל';
  return s.split(/\s+/)[0] || s;
}

function findPrimaryActivePension(rows) {
  return rows
    .filter(r => r.isActive && isComprehensiveNewPension(r.productType, r.productName))
    .sort((a, b) => (b.totalSavings || 0) - (a.totalSavings || 0))[0] || null;
}

/** Rule 1 — small inactive comprehensive pension → consolidate to active fund */
function ruleSmallInactivePension(rows) {
  const activeTarget = findPrimaryActivePension(rows);
  if (!activeTarget) return [];

  return rows
    .filter(r =>
      !r.isActive
      && isComprehensiveNewPension(r.productType, r.productName)
      && (r.totalSavings || 0) > 0
      && (r.totalSavings || 0) < SMALL_INACTIVE_PENSION_MAX,
    )
    .map(row => rec({
      type: 'clearinghouse_small_inactive_pension',
      title: 'איחוד קרנות פנסיה',
      reason: `זיהינו קרן פנסיה קטנה ולא פעילה ב${companyShort(row.companyName)} על סך ${fmtMoney(row.totalSavings)}. `
        + `מומלץ לבצע איחוד חשבונות (ניוד) אל הקרן הפעילה שלך ב${companyShort(activeTarget.companyName)} `
        + `(צבירה ${fmtMoney(activeTarget.totalSavings)}) על מנת למנוע פיזור כספים מיותר.`,
      urgency: 'medium',
      financialImpact: `מניעת דמי ניהול כפולים על ${fmtMoney(row.totalSavings)}`,
      impactAmount: row.totalSavings || 0,
      confidenceScore: 92,
    }));
}

/** Rule 2 — high asset fee on inactive provident fund */
function ruleHighFeeInactiveProvident(rows) {
  return rows
    .filter(r =>
      !r.isActive
      && isProvidentFund(r.productType, r.productName)
      && r.assetFee != null
      && r.assetFee >= HIGH_INACTIVE_PROVIDENT_ASSET_FEE,
    )
    .map(row => rec({
      type: 'clearinghouse_high_fee_inactive_provident',
      title: 'דמי ניהול חריגים בקופה לא פעילה',
      reason: `קופת הגמל הלא פעילה שלך ב${companyShort(row.companyName)} (${fmtMoney(row.totalSavings)}) `
        + `גובה דמי ניהול גבוהים במיוחד של ${fmtPct(row.assetFee)} מהצבירה. `
        + 'מכיוון שאין הפקדות חדשות, דמי הניהול הללו שוחקים את החיסכון שלך. '
        + `מומלץ להתקשר ל${companyShort(row.companyName)} להורדת התעריף או לשקול ניוד של הכסף לקרן משתלמת יותר.`,
      urgency: 'high',
      financialImpact: project30YearLoss(row.totalSavings, Math.max(0, row.assetFee - HIGH_INACTIVE_PROVIDENT_ASSET_FEE)) > 0
        ? `שחיקה צפויה ~${fmtMoney(project30YearLoss(row.totalSavings, row.assetFee - HIGH_INACTIVE_PROVIDENT_ASSET_FEE))} ב-30 שנה`
        : `דמי ניהול ${fmtPct(row.assetFee)} ללא הפקדות`,
      impactAmount: project30YearLoss(row.totalSavings, Math.max(0, row.assetFee - HIGH_INACTIVE_PROVIDENT_ASSET_FEE)),
      confidenceScore: 95,
    }));
}

/** Rule 3 — active Clal (or any active pension) fee benchmark vs Pensia-Net */
async function ruleActiveFundBenchmark(rows) {
  const activePensionRows = rows.filter(r =>
    r.isActive
    && (isComprehensiveNewPension(r.productType, r.productName) || /פנסיה/i.test(`${r.productType} ${r.productName}`)),
  );

  const results = [];

  for (const row of activePensionRows) {
    let comparison;
    try {
      comparison = await comparePensionProducts([{
        companyName: row.companyName,
        productName: row.productName,
        productType: row.productType,
        totalSavings: row.totalSavings,
        depositFee: row.depositFee,
        assetFee: row.assetFee,
        status: 'פעיל',
        isActive: true,
      }]);
    } catch {
      continue;
    }

    const insight = comparison.pensionInsights?.[0];
    if (!insight) continue;

    const depositDiff = insight.feeDifference?.deposit ?? 0;
    const assetDiff = insight.feeDifference?.asset ?? 0;
    const loss = insight.projected30YearLoss ?? 0;
    const isClal = /כלל/i.test(row.companyName);

    let reason;
    let title;
    let urgency = 'medium';
    let financialImpact;

    if (insight.isPayingTooMuch) {
      title = isClal ? 'השוואת דמי ניהול — כלל פנסיה' : `השוואת דמי ניהול — ${companyShort(row.companyName)}`;
      reason = `בקרן הפעילה שלך ב${companyShort(row.companyName)} (צבירה ${fmtMoney(row.totalSavings)}) `
        + `דמי הניהול שלך: ${fmtPct(row.depositFee ?? 0)} מהפקדה ו-${fmtPct(row.assetFee ?? 0)} מצבירה. `
        + `לפי פנסיה-נט, זה ${depositDiff > 0 ? `${fmtPct(depositDiff)} מעל הממוצע מהפקדה` : ''}`
        + `${depositDiff > 0 && assetDiff > 0 ? ' ו-' : ''}`
        + `${assetDiff > 0 ? `${fmtPct(assetDiff)} מעל הממוצע מצבירה` : ''}. `
        + (loss > 0
          ? `הפסד צפוי של כ-${fmtMoney(loss)} לאורך 30 שנה לעומת תעריף השוק.`
          : insight.recommendations?.feeInsight || '');
      urgency = loss > 10000 ? 'high' : 'medium';
      financialImpact = loss > 0 ? `הפסד צפוי ${fmtMoney(loss)}` : null;
    } else {
      title = isClal ? 'דמי ניהול תחרותיים — כלל פנסיה' : `דמי ניהול תחרותיים — ${companyShort(row.companyName)}`;
      reason = `בקרן הפעילה שלך ב${companyShort(row.companyName)} (צבירה ${fmtMoney(row.totalSavings)}) `
        + `דמי הניהול (${fmtPct(row.depositFee ?? 0)} מהפקדה, ${fmtPct(row.assetFee ?? 0)} מצבירה) `
        + 'נמצאים בממוצע השוק או מתחתיו לפי נתוני פנסיה-נט. '
        + (insight.recommendations?.returnInsight
          ? insight.recommendations.returnInsight
          : 'אין חריגת דמי ניהול משמעותית.');
      financialImpact = 'דמי ניהול אטרקטיביים';
      urgency = 'low';
    }

    results.push(rec({
      type: 'clearinghouse_active_fee_benchmark',
      title,
      reason,
      urgency,
      financialImpact,
      impactAmount: loss || 0,
      confidenceScore: insight.marketFundId ? 88 : 75,
    }));
  }

  return results;
}

/**
 * @param {object[]} productRows — optional pre-parsed rows; loads DB if omitted
 * @param {string} [userId]
 * @returns {Promise<object[]>} recommendation DTOs for dashboard
 */
async function generateClearinghouseInsightRecommendations(userId, productRows = null) {
  let rows = productRows;

  if (!rows && userId) {
    const funds = await PensionFund.find({ user: userId }).select('+rawData').lean();
    rows = funds.map(fundDocumentToProductRow).filter(Boolean);
  }

  if (!rows?.length) return [];

  const insights = [
    ...ruleSmallInactivePension(rows),
    ...ruleHighFeeInactiveProvident(rows),
    ...(await ruleActiveFundBenchmark(rows)),
  ];

  const seen = new Set();
  return insights.filter(item => {
    const key = `${item.type}:${item.title}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

module.exports = {
  generateClearinghouseInsightRecommendations,
  ruleSmallInactivePension,
  ruleHighFeeInactiveProvident,
  ruleActiveFundBenchmark,
  SMALL_INACTIVE_PENSION_MAX,
  HIGH_INACTIVE_PROVIDENT_ASSET_FEE,
};
