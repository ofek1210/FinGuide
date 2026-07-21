'use strict';

const { calculateMgmtFeeSavings } = require('../ai/engines/calculationEngine');
const config = require('../config/pensionAnalysisConfig');
const { median, percentileRank } = require('../utils/pensionStats');

function feeAsDecimal(fee) {
  if (fee == null || !Number.isFinite(fee)) return null;
  return fee > 0.05 ? fee / 100 : fee;
}

/**
 * Estimate net return after personal management fees (approximation).
 * @param {object} fund
 * @param {object} ctx
 * @returns {object[]}
 */
function analyzeNetReturnAfterFees(fund, ctx) {
  const { match, peerGroup } = ctx;
  const grossReturn = fund.historicalReturn5Y ?? match?.return5Y ?? fund.ytdReturn ?? match?.return1Y;
  if (grossReturn == null) return [];

  const assetFeePct = feeAsDecimal(fund.managementFeeAccumulation) ?? 0;
  const depositFeePct = feeAsDecimal(fund.managementFeeDeposit) ?? 0;
  const estimatedNet = grossReturn - assetFeePct - (depositFeePct * 0.15);

  const peers = peerGroup?.peers || [];
  const peerNetEstimates = peers
    .map(p => {
      const r = p.return5Y;
      const af = feeAsDecimal(p.assetFee) ?? 0;
      const df = feeAsDecimal(p.depositFee) ?? 0;
      if (r == null) return null;
      return r - af - (df * 0.15);
    })
    .filter(v => v != null);

  const netPercentile = peerNetEstimates.length >= config.minPeerGroupSize
    ? percentileRank(estimatedNet, peerNetEstimates)
    : null;

  const { buildPensionInsight } = require('../utils/pensionInsightBuilder');

  return [buildPensionInsight({
    category: 'net_return_estimate',
    severity: netPercentile != null && netPercentile < 35 ? 'medium' : 'info',
    title: `תשואה משוערת נטו לאחר דמי ניהול — ${fund.fundName}`,
    finding: `תשואה ברוטו משוערת ${grossReturn.toFixed(2)}%, `
      + `דמי ניהול מצבירה ${(assetFeePct * 100).toFixed(2)}%, `
      + `מהפקדה ${(depositFeePct * 100).toFixed(2)}% — `
      + `תשואה נטו משוערת ~${estimatedNet.toFixed(2)}%.`
      + (netPercentile != null ? ` אחוזון ${netPercentile} מול מסלולים דומים.` : ''),
    personalDataUsed: ['fund.managementFeeAccumulation', 'fund.managementFeeDeposit', 'fund.historicalReturn5Y'],
    marketDataUsed: ['pensia_net.TSUA_SHNATIT_MEMUZAAT_5_SHANIM', 'pensia_net.fees'],
    benchmark: {
      group: peerGroup?.groupKey ?? null,
      median: median(peerNetEstimates),
      percentile: netPercentile,
    },
    recommendedAction: 'מומלץ לבדוק עם בעל רישיון את ההשפעה האמיתית של דמי הניהול על התשואה לטווח ארוך.',
    confidence: 0.6,
    assumptions: ['הערכת תשואה נטו — לא תשואה חשבונאית', 'הנחת השפעה שנתית של דמי הפקדה ~15%'],
    limitations: [config.netReturnDisclaimer],
    fundId: ctx.fundId,
    legacyType: 'net_return_estimate',
  })];
}

/**
 * Deliverable #8 — fee cost until retirement.
 */
function analyzeFeeCostUntilRetirement(fund, ctx) {
  const { userContext } = ctx;
  const years = userContext?.retirement?.yearsToRetirement;
  const balance = fund.currentBalance ?? 0;
  const monthly = fund.monthlyDeposit ?? fund.monthlyEmployeeDeposit ?? 0;
  const currentFee = feeAsDecimal(fund.managementFeeAccumulation);
  const medianPeerFee = median((ctx.peerGroup?.peers || []).map(p => feeAsDecimal(p.assetFee)).filter(v => v != null));

  if (years == null || currentFee == null || balance <= 0) return [];

  const targetFee = medianPeerFee ?? currentFee * 0.7;
  const { savingsByRetirement, additionalMonthlyPension } = calculateMgmtFeeSavings(
    balance,
    monthly,
    years,
    currentFee,
    targetFee,
  );

  const annualFeeCost = Math.round(balance * currentFee);
  const { buildPensionInsight } = require('../utils/pensionInsightBuilder');

  return [buildPensionInsight({
    category: 'fee_cost_projection',
    severity: savingsByRetirement > 50000 ? 'medium' : 'info',
    title: `עלות דמי ניהול עד גיל פרישה — ${fund.fundName}`,
    finding: `עלות משוערת של דמי ניהול מצבירה ~₪${annualFeeCost.toLocaleString('he-IL')} בשנה. `
      + `פער לעומת חציון קבוצת השוואה עשוי להשפיע על הצבירה ב-₪${Math.abs(savingsByRetirement).toLocaleString('he-IL')} עד גיל ${userContext.retirement.plannedRetirementAge}.`,
    personalDataUsed: ['profile.personal.age', 'profile.retirement.plannedRetirementAge', 'fund.currentBalance', 'fund.monthlyDeposit'],
    marketDataUsed: ['pensia_net.SHIUR_D_NIHUL_AHARON_TTVURAH'],
    benchmark: { group: ctx.peerGroup?.groupKey, median: medianPeerFee != null ? medianPeerFee * 100 : null },
    estimatedImpact: {
      annual: annualFeeCost,
      retirement: Math.abs(savingsByRetirement),
      currency: 'ILS',
    },
    recommendedAction: 'כדאי לבחון האם ניתן להוזיל דמי ניהול — מומלץ להתייעץ עם בעל רישיון.',
    confidence: medianPeerFee != null ? 0.75 : 0.55,
    assumptions: [
      `הנחת תשואה שנתית ${(config.defaultAnnualReturnAssumption * 100).toFixed(1)}%`,
      `דמי ניהול נוכחיים ${(currentFee * 100).toFixed(2)}%`,
    ],
    limitations: ['חישוב הערכה בלבד — לא כולל דמי ניהול מהפקדה בנפרד'],
    fundId: ctx.fundId,
    legacyType: 'fee_cost_until_retirement',
    impactAmount: Math.abs(savingsByRetirement),
  })];
}

module.exports = { analyzeNetReturnAfterFees, analyzeFeeCostUntilRetirement, feeAsDecimal };
