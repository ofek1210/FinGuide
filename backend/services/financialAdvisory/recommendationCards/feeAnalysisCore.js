'use strict';

const { feeAsDecimal } = require('../../pensionFeeAnalysisService');
const { median, percentileRank } = require('../../../utils/pensionStats');

function feeAsDisplayPercent(fee) {
  const dec = feeAsDecimal(fee);
  if (dec == null) return null;
  return Math.round(dec * 10000) / 100;
}

function normalizePeerFee(fee) {
  if (fee == null || !Number.isFinite(fee)) return null;
  return fee <= 0.05 ? Math.round(fee * 10000) / 100 : Math.round(fee * 100) / 100;
}

function classifySingleFeeStatus(userPct, peerValues) {
  if (userPct == null) return 'unknown';
  if (!peerValues.length) return 'unknown';
  const p = percentileRank(userPct, peerValues);
  if (p == null) return 'unknown';
  if (p <= 25) return 'excellent';
  if (p <= 55) return 'competitive';
  if (p <= 75) return 'above_average';
  return 'high';
}

/**
 * Pension: deposit + balance fees. Gemel/hishtalmut: balance (and deposit if present).
 */
function analyzeFeeDimensions({ fund, peerGroup, productKind }) {
  const peers = peerGroup?.peers || [];
  const balance = fund?.currentBalance ?? 0;
  const annualDeposits = (fund?.monthlyDeposit ?? fund?.monthlyEmployeeDeposit ?? 0) * 12;

  const userBalanceFeePct = feeAsDisplayPercent(fund?.managementFeeAccumulation);
  const userDepositFeePct = feeAsDisplayPercent(fund?.managementFeeDeposit);

  const peerBalanceFees = peers.map(p => normalizePeerFee(p.assetFee)).filter(v => v != null);
  const peerDepositFees = peers.map(p => normalizePeerFee(p.depositFee)).filter(v => v != null);

  const depositFeeStatus = productKind === 'pension' || userDepositFeePct != null
    ? classifySingleFeeStatus(userDepositFeePct, peerDepositFees)
    : 'not_applicable';

  const balanceFeeStatus = classifySingleFeeStatus(userBalanceFeePct, peerBalanceFees);

  const marketAvgBalance = peerBalanceFees.length ? median(peerBalanceFees) : null;
  const marketAvgDeposit = peerDepositFees.length ? median(peerDepositFees) : null;

  const balanceFeeDec = feeAsDecimal(fund?.managementFeeAccumulation) ?? 0;
  const depositFeeDec = feeAsDecimal(fund?.managementFeeDeposit) ?? 0;

  const estimatedAnnualCost = Math.round(balance * balanceFeeDec + annualDeposits * depositFeeDec);

  const savingFromBalance = (userBalanceFeePct != null && marketAvgBalance != null && balance > 0)
    ? Math.max(0, Math.round(balance * ((userBalanceFeePct - marketAvgBalance) / 100)))
    : 0;
  const savingFromDeposit = (userDepositFeePct != null && marketAvgDeposit != null && annualDeposits > 0)
    ? Math.max(0, Math.round(annualDeposits * ((userDepositFeePct - marketAvgDeposit) / 100)))
    : 0;
  const estimatedAnnualSaving = savingFromBalance + savingFromDeposit;

  return {
    depositFeeStatus,
    balanceFeeStatus,
    estimatedAnnualCost,
    estimatedAnnualSaving: estimatedAnnualSaving > 0 ? estimatedAnnualSaving : 0,
    calculationInputs: {
      currentBalance: balance,
      annualDeposits,
      userBalanceFeePct,
      userDepositFeePct,
      marketAvgBalancePct: marketAvgBalance,
      marketAvgDepositPct: marketAvgDeposit,
      peerBalanceSampleSize: peerBalanceFees.length,
      peerDepositSampleSize: peerDepositFees.length,
    },
  };
}

function overallFeeOutcome(depositFeeStatus, balanceFeeStatus) {
  const rank = { high: 4, above_average: 3, unknown: 2, competitive: 1, excellent: 0, not_applicable: 0 };
  const dep = rank[depositFeeStatus] ?? 2;
  const bal = rank[balanceFeeStatus] ?? 2;
  const worst = Math.max(dep, bal);
  if (worst >= 4) return 'high';
  if (worst >= 3) return 'above_average';
  if (depositFeeStatus === 'unknown' && balanceFeeStatus === 'unknown') return 'unknown';
  if (worst >= 2) return 'above_average';
  if (worst >= 1) return 'competitive';
  return 'excellent';
}

function buildFeeSummaryHe(feeAnalysis, productKind) {
  const { depositFeeStatus, balanceFeeStatus } = feeAnalysis;
  const parts = [];

  if (productKind === 'pension' || depositFeeStatus !== 'not_applicable') {
    parts.push(`דמי הפקדה: ${feeStatusWordHe(depositFeeStatus)}`);
  }
  parts.push(`דמי צבירה: ${feeStatusWordHe(balanceFeeStatus)}`);

  if (depositFeeStatus === 'high' && balanceFeeStatus === 'competitive') {
    return `${parts.join(' · ')} — דמי ההפקדה גבוהים יחסית לשוק; דמי הצבירה תחרותיים.`;
  }
  if (balanceFeeStatus === 'high' && depositFeeStatus === 'competitive') {
    return `${parts.join(' · ')} — דמי הצבירה גבוהים יחסית לשוק; דמי ההפקדה תחרותיים.`;
  }
  if (depositFeeStatus === 'high' || balanceFeeStatus === 'high') {
    return `${parts.join(' · ')} — לפחות ממד אחד גבוה מהממוצע בקבוצת ההשוואה.`;
  }
  if (depositFeeStatus === 'unknown' && balanceFeeStatus === 'unknown') {
    return 'לא ניתן להשוות דמי ניהול לקבוצת השוואה רשמית.';
  }
  return `${parts.join(' · ')} — דמי הניהול ביחס לשוק סבירים או תחרותיים.`;
}

function feeStatusWordHe(status) {
  switch (status) {
    case 'excellent': return 'מצוינים';
    case 'competitive': return 'תחרותיים';
    case 'above_average': return 'מעל הממוצע';
    case 'high': return 'גבוהים';
    case 'not_applicable': return 'לא רלוונטי';
    default: return 'לא ידוע';
  }
}

module.exports = {
  feeAsDisplayPercent,
  analyzeFeeDimensions,
  overallFeeOutcome,
  buildFeeSummaryHe,
  classifySingleFeeStatus,
};
