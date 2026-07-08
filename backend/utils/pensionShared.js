/**
 * Shared pension constants and pure helpers — single source for risk/fee logic.
 */



const { getMarketAverage } = require('../config/pensionBenchmarkTables');

const LEGAL_RETIREMENT_AGE = 67;

const DEFAULT_MARKET_MGMT_FEE =
  getMarketAverage('pension_comprehensive', 'medium')?.mgmtFeeAccumulation ?? 0.0035;

const FEE_STATUS_LABELS = {
  excellent: 'מצוין',
  fair: 'הוגן',
  above_market: 'מעל השוק',
  high: 'גבוה מאוד',
};

function resolveRetirementAge(profile) {
  if (!profile) return LEGAL_RETIREMENT_AGE;
  return profile.retirementAge
    ?? profile.retirement?.plannedRetirementAge
    ?? LEGAL_RETIREMENT_AGE;
}

function recommendedRiskLevel(age, yearsToRetirement) {
  if (age == null) return null;
  if (age < 35 || (yearsToRetirement != null && yearsToRetirement > 25)) return 'high';
  if (age < 50 || (yearsToRetirement != null && yearsToRetirement > 15)) return 'medium';
  return 'low';
}

function normalizeFundRiskLevel(raw) {
  const current = String(raw || 'unknown').toLowerCase();
  if (current.includes('low') || current.includes('נמוך') || current.includes('סולידי')) {
    return 'low';
  }
  if (current.includes('high') || current.includes('גבוה') || current.includes('מניות')) {
    return 'high';
  }
  if (current === 'unknown') return 'unknown';
  return 'medium';
}

function riskLevelShortLabel(level) {
  const map = { high: 'גבוה', medium: 'בינוני', low: 'נמוך' };
  return map[level] || level;
}

function riskLevelFullLabel(level) {
  const map = {
    high: 'מניות (גבוה)',
    medium: 'כללי (בינוני)',
    low: 'מדדים/סולידי (נמוך)',
  };
  return map[level] || level;
}

function weightedAvgMgmtFee(funds) {
  const active = (funds || []).filter(f => f.isActive !== false && f.status !== 'closed');
  let totalBal = 0;
  let weighted = 0;
  for (const f of active) {
    const bal = f.currentBalance || 0;
    const fee = f.managementFeeAccumulation;
    if (bal > 0 && fee != null) {
      totalBal += bal;
      weighted += fee * bal;
    }
  }
  if (totalBal === 0) {
    const withFee = active.find(f => f.managementFeeAccumulation != null);
    return withFee?.managementFeeAccumulation ?? null;
  }
  return weighted / totalBal;
}

module.exports = {
  LEGAL_RETIREMENT_AGE,
  DEFAULT_MARKET_MGMT_FEE,
  FEE_STATUS_LABELS,
  resolveRetirementAge,
  recommendedRiskLevel,
  normalizeFundRiskLevel,
  riskLevelShortLabel,
  riskLevelFullLabel,
  weightedAvgMgmtFee,
};
