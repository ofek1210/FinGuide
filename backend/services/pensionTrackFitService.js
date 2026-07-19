'use strict';

const { buildPensionInsight } = require('../utils/pensionInsightBuilder');
const { normalizeFundRiskLevel, riskLevelFullLabel } = require('../utils/pensionShared');

/**
 * Deliverable #4 — track fit for user (no direct "switch track" orders).
 */
function analyzeTrackFit(fund, ctx) {
  const { userContext } = ctx;
  const effectiveRisk = userContext?.risk?.effective;
  const fundRisk = normalizeFundRiskLevel(fund.riskLevel || fund.investmentTrack);
  const age = userContext?.personal?.age;
  const yearsToRetirement = userContext?.retirement?.yearsToRetirement;

  if (!effectiveRisk || fundRisk === 'unknown') return [];

  const riskOrder = { low: 0, medium: 1, high: 2 };
  const gap = (riskOrder[fundRisk] ?? 1) - (riskOrder[effectiveRisk] ?? 1);

  if (Math.abs(gap) < 1) return [];

  const severity = Math.abs(gap) >= 2 ? 'medium' : 'low';
  const direction = gap > 0 ? 'גבוהה' : 'נמוכה';
  const recommended = riskLevelFullLabel(effectiveRisk);

  const personalUsed = ['profile.personal.age', 'profile.financial.riskTolerance', 'profile.retirement.plannedRetirementAge'];
  if (userContext?.personal?.maritalStatus) personalUsed.push('profile.personal.maritalStatus');

  return [buildPensionInsight({
    category: 'track_fit',
    severity,
    title: `התאמת מסלול לפרופיל — ${fund.fundName}`,
    finding: `מסלול ${riskLevelFullLabel(fundRisk)} בגיל ${age ?? '—'} `
      + `(עוד ${yearsToRetirement ?? '—'} שנים לפרישה משוערת). `
      + `לפי פרופיל הסיכון שהוגדר (${riskLevelFullLabel(effectiveRisk)}), רמת הסיכון במסלול נראית ${direction} מהמומלץ.`,
    personalDataUsed: personalUsed,
    marketDataUsed: [],
    recommendedAction: 'ייתכן שרמת הסיכון אינה תואמת לפרופיל שהוגדר — מומלץ לבדוק עם בעל רישיון האם המסלול מתאים.',
    confidence: userContext?.financial?.riskTolerance ? 0.75 : 0.6,
    assumptions: userContext?.financial?.riskTolerance ? [] : ['לא הוגדרה העדפת סיכון באונבורדינג — נעשה שימוש בהמלצה לפי גיל'],
    fundId: ctx.fundId,
    legacyType: 'risk_wrong_for_age',
  })];
}

module.exports = { analyzeTrackFit };
