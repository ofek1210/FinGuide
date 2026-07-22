'use strict';

const {
  FEE_STATUSES,
  CARD_SLOTS,
  CARD_OUTCOMES,
  assertNoForbiddenPhrases,
} = require('./recommendationCardContract');
const { buildBaseConfidenceFactors, confidenceLabelHe } = require('./confidenceModel');
const {
  analyzeFeeDimensions,
  overallFeeOutcome,
  buildFeeSummaryHe,
  classifySingleFeeStatus,
  feeAsDisplayPercent,
} = require('./feeAnalysisCore');
const { resolveProductKind } = require('./suitabilityContext');
const { accountRef } = require('./cardPriority');

function feeStatusTitleHe(status, feeAnalysis) {
  if (status === FEE_STATUSES.UNKNOWN) return 'דמי ניהול — נתונים חלקיים';
  if (feeAnalysis?.depositFeeStatus === 'high' && feeAnalysis?.balanceFeeStatus !== 'high') {
    return 'דמי הפקדה גבוהים';
  }
  if (feeAnalysis?.balanceFeeStatus === 'high' && feeAnalysis?.depositFeeStatus !== 'high') {
    return 'דמי צבירה גבוהים';
  }
  switch (status) {
    case FEE_STATUSES.EXCELLENT: return 'דמי ניהול מצוינים';
    case FEE_STATUSES.COMPETITIVE: return 'דמי ניהול תחרותיים';
    case FEE_STATUSES.ABOVE_AVERAGE: return 'דמי ניהול מעל הממוצע';
    case FEE_STATUSES.HIGH: return 'דמי ניהול גבוהים';
    default: return 'דמי ניהול';
  }
}

function resolveFeeCardOutcome(status, feeAnalysis, confidence) {
  if (status === FEE_STATUSES.UNKNOWN || confidence.level === 'insufficient_data') {
    return CARD_OUTCOMES.INSUFFICIENT_DATA;
  }
  if (status === FEE_STATUSES.HIGH || status === FEE_STATUSES.ABOVE_AVERAGE) {
    return feeAnalysis.estimatedAnnualSaving > 0 ? CARD_OUTCOMES.ACTIONABLE : CARD_OUTCOMES.MONITORING;
  }
  return CARD_OUTCOMES.MONITORING;
}

function buildFeesCard({ primaryFund: fund, marketCtx, userContext, productType }) {
  const slot = CARD_SLOTS.MANAGEMENT_FEES;
  const ref = accountRef(fund);
  const productKind = resolveProductKind(productType, fund);
  const peerGroup = marketCtx?.peerGroup;

  const feeAnalysis = analyzeFeeDimensions({
    fund,
    peerGroup,
    productKind,
  });

  const status = overallFeeOutcome(feeAnalysis.depositFeeStatus, feeAnalysis.balanceFeeStatus);
  const mappedStatus = status === 'unknown' ? FEE_STATUSES.UNKNOWN
    : status === 'excellent' ? FEE_STATUSES.EXCELLENT
      : status === 'competitive' ? FEE_STATUSES.COMPETITIVE
        : status === 'above_average' ? FEE_STATUSES.ABOVE_AVERAGE
          : FEE_STATUSES.HIGH;

  const feePeerCount = Math.max(
    feeAnalysis.calculationInputs.peerBalanceSampleSize,
    feeAnalysis.calculationInputs.peerDepositSampleSize,
  );
  const confidence = buildBaseConfidenceFactors({
    userContext,
    matchConfidence: marketCtx?.matchConfidence,
    comparisonGroupCertain: Boolean(peerGroup?.groupKey),
    hasReturnHistory: feePeerCount >= 3,
  });

  const cardOutcome = resolveFeeCardOutcome(mappedStatus, feeAnalysis, confidence);

  let summary = buildFeeSummaryHe(feeAnalysis, productKind);
  let recommendation;
  let why = 'ההשוואה מפרידה בין דמי הפקדה לדמי צבירה ומחשבת עלות שנתית: הפקדות שנתיות × דמי הפקדה + יתרה × דמי צבירה.';

  if (cardOutcome === CARD_OUTCOMES.INSUFFICIENT_DATA) {
    recommendation = 'כדאי לוודא שדמי הניהול מופיעים בדוח ולהשלים התאמה למסלול בגמל-נט/פנסיה-נט.';
    why += ' חסרים נתונים להשוואה רשמית.';
  } else if (mappedStatus === FEE_STATUSES.HIGH || mappedStatus === FEE_STATUSES.ABOVE_AVERAGE) {
    recommendation = 'כדאי לנסות לנהל משא ומתן על דמי הניהול לפני ששוקלים החלפת מסלול.';
    if (feeAnalysis.depositFeeStatus === 'high' && feeAnalysis.balanceFeeStatus !== 'high') {
      why += ' דמי ההפקדה הם הממד הבולט — לא דמי הצבירה.';
    } else if (feeAnalysis.balanceFeeStatus === 'high' && feeAnalysis.depositFeeStatus !== 'high') {
      why += ' דמי הצבירה הם הממד הבולט — לא דמי ההפקדה.';
    }
  } else {
    recommendation = 'אין צורך בפעולה מיידית מבחינת דמי ניהול — המשך מעקב.';
  }

  assertNoForbiddenPhrases(`${summary} ${recommendation} ${why}`);

  return {
    slot,
    icon: 'fees',
    title: 'דמי ניהול',
    status: mappedStatus,
    statusLabelHe: feeStatusTitleHe(mappedStatus, feeAnalysis),
    cardOutcome,
    summary,
    recommendation,
    confidence: confidence.level,
    confidenceLabelHe: confidenceLabelHe(confidence.level),
    confidenceScore: confidence.score,
    why,
    accountId: ref.accountId,
    accountLabel: ref.accountLabel,
    metrics: {
      fundName: fund?.fundName || null,
      accountId: ref.accountId,
      depositFeeStatus: feeAnalysis.depositFeeStatus,
      balanceFeeStatus: feeAnalysis.balanceFeeStatus,
      estimatedAnnualCost: feeAnalysis.estimatedAnnualCost,
      estimatedAnnualSaving: feeAnalysis.estimatedAnnualSaving,
      calculationInputs: feeAnalysis.calculationInputs,
      currentFeeBalancePct: feeAnalysis.calculationInputs.userBalanceFeePct,
      currentFeeDepositPct: feeAnalysis.calculationInputs.userDepositFeePct,
      marketAverageFeeBalancePct: feeAnalysis.calculationInputs.marketAvgBalancePct,
      potentialAnnualSavingIls: feeAnalysis.estimatedAnnualSaving || null,
      comparisonGroup: peerGroup?.comparisonGroupLabel || peerGroup?.groupKey || null,
    },
    productType,
  };
}

module.exports = {
  buildFeesCard,
  classifyFeeStatus: classifySingleFeeStatus,
  feeAsDisplayPercent,
};
