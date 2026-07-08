/**
 * Pension Health Check — FINQ-inspired structured score (boxes א/ג/ה/ד).
 */



const { recommendedRiskLevel } = require('../utils/pensionShared');
const { statusFromRatio, buildHealthCheckResult } = require('../utils/healthScoreShared');

const CATEGORY_MAX = {
  deposits: 25,
  fees: 25,
  riskTrack: 25,
  structure: 25,
};

/**
 * @param {object} summary - from getPensionSummary
 * @param {object} [benchmark] - from benchmarkPortfolio
 */
function runPensionHealthCheck(summary, benchmark = null) {
  const categories = [];
  let totalScore = 0;

  // ── Deposits (~20% gross) ──
  const gross = summary.grossSalary || 0;
  const contrib = summary.totalMonthlyContribution || 0;
  const expectedMin = gross ? gross * 0.185 : null;
  let depositScore = 0;
  let depositStatus = 'warning';
  let depositDetail = 'אין נתוני הפקדה — העלה תלוש או דוח';

  if (gross && contrib) {
    const ratio = contrib / expectedMin;
    if (ratio >= 0.95) {
      depositScore = CATEGORY_MAX.deposits;
      depositStatus = 'good';
      depositDetail = `הפקדה חודשית ${Math.round(ratio * 100)}% מהמינימום הצפוי (~20% מהברוטו)`;
    } else if (ratio >= 0.7) {
      depositScore = Math.round(CATEGORY_MAX.deposits * 0.7);
      depositStatus = 'warning';
      depositDetail = `הפקדה ${Math.round(ratio * 100)}% מהצפוי — בדוק מול המעסיק`;
    } else {
      depositScore = Math.round(CATEGORY_MAX.deposits * 0.3);
      depositStatus = 'poor';
      depositDetail = `הפקדה נמוכה: ₪${contrib.toLocaleString('he-IL')}/חודש vs צפוי ~₪${Math.round(expectedMin).toLocaleString('he-IL')}`;
    }
  } else if (contrib > 0) {
    depositScore = Math.round(CATEGORY_MAX.deposits * 0.5);
    depositDetail = `הפקדה חודשית ₪${contrib.toLocaleString('he-IL')} — חסר תלוש לאימות`;
  }

  categories.push({
    id: 'deposits',
    label: 'הפקדות',
    score: depositScore,
    maxScore: CATEGORY_MAX.deposits,
    status: depositStatus,
    detail: depositDetail,
  });
  totalScore += depositScore;

  // ── Fees ──
  const fundsAboveFee = benchmark?.summary?.fundsAboveMarketFee ?? 0;
  const fundCount = summary.fundCount || 0;
  let feeScore = CATEGORY_MAX.fees;
  let feeStatus = 'good';
  let feeDetail = 'דמי ניהול בממוצע שוק או טובים יותר';

  if (fundCount === 0) {
    feeScore = 0;
    feeStatus = 'warning';
    feeDetail = 'אין נתוני קרנות לבדיקת דמי ניהול';
  } else if (fundsAboveFee > 0) {
    const ratio = 1 - fundsAboveFee / fundCount;
    feeScore = Math.round(CATEGORY_MAX.fees * Math.max(0.2, ratio));
    feeStatus = statusFromRatio(ratio);
    feeDetail = `${fundsAboveFee} מתוך ${fundCount} קרנות עם דמי ניהול מעל ממוצע השוק`;
  }

  categories.push({
    id: 'fees',
    label: 'דמי ניהול',
    score: feeScore,
    maxScore: CATEGORY_MAX.fees,
    status: feeStatus,
    detail: feeDetail,
  });
  totalScore += feeScore;

  // ── Risk track vs age ──
  const riskMismatch = benchmark?.summary?.riskMismatchCount ?? 0;
  let riskScore = CATEGORY_MAX.riskTrack;
  let riskStatus = 'good';
  let riskDetail = 'מסלולי סיכון מתאימים לגיל';

  if (!summary.currentAge) {
    riskScore = Math.round(CATEGORY_MAX.riskTrack * 0.4);
    riskStatus = 'warning';
    riskDetail = 'הגדר גיל בפרופיל לבדיקת התאמת מסלול';
  } else if (riskMismatch > 0) {
    const rec = benchmark?.summary?.recommendedRiskLevel
      || recommendedRiskLevel(summary.currentAge, summary.retirementAge - summary.currentAge);
    riskScore = Math.round(CATEGORY_MAX.riskTrack * Math.max(0.25, 1 - riskMismatch / Math.max(fundCount, 1)));
    riskStatus = 'poor';
    riskDetail = `${riskMismatch} קרנות במסלול לא מתאים לגיל ${summary.currentAge} — מומלץ ${rec || 'medium'}`;
  }

  categories.push({
    id: 'riskTrack',
    label: 'מסלול סיכון',
    score: riskScore,
    maxScore: CATEGORY_MAX.riskTrack,
    status: riskStatus,
    detail: riskDetail,
  });
  totalScore += riskScore;

  // ── Structure (consolidation + study fund) ──
  let structScore = CATEGORY_MAX.structure;
  let structStatus = 'good';
  const structIssues = [];
  if (summary.fundCount > 2) structIssues.push(`ריבוי קרנות (${summary.fundCount})`);
  if (summary.hasStudyFund === false) structIssues.push('חסרה קרן השתלמות');

  if (structIssues.length === 1) {
    structScore = Math.round(CATEGORY_MAX.structure * 0.65);
    structStatus = 'warning';
  } else if (structIssues.length >= 2) {
    structScore = Math.round(CATEGORY_MAX.structure * 0.35);
    structStatus = 'poor';
  }

  categories.push({
    id: 'structure',
    label: 'מבנה תיק',
    score: structScore,
    maxScore: CATEGORY_MAX.structure,
    status: structStatus,
    detail: structIssues.length ? structIssues.join(' · ') : 'מבנה תיק מאוזן',
  });
  totalScore += structScore;

  return buildHealthCheckResult(
    categories,
    'הציון מבוסס על נתוני הייבוא והפרופיל — אינו מהווה ייעוץ פנסיוני.',
    'pension',
  );
}

module.exports = { runPensionHealthCheck };
