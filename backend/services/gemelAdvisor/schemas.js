'use strict';

function emptyNormalizedAccount(overrides = {}) {
  return {
    accountId: null,
    userId: null,
    productType: 'unknown',
    fundCode: null,
    fundName: '',
    companyName: null,
    trackName: null,
    accountStatus: 'unknown',
    balance: 0,
    monthlyDeposit: 0,
    employeeDeposit: 0,
    employerDeposit: 0,
    managementFeeDepositPct: null,
    managementFeeBalancePct: null,
    liquidityDate: null,
    openingDate: null,
    source: 'user_excel',
    rawData: {},
    warnings: [],
    ...overrides,
  };
}

function emptyOfficialFund(overrides = {}) {
  return {
    fundCode: null,
    fundName: '',
    companyName: '',
    productType: 'other',
    trackName: null,
    trackCategory: 'other',
    riskLevel: 'unknown',
    reportDate: null,
    assetsUnderManagement: null,
    managementFeeDepositAvgPct: null,
    managementFeeBalanceAvgPct: null,
    return1MonthPct: null,
    return12MonthsPct: null,
    return3YearsCumulativePct: null,
    return5YearsCumulativePct: null,
    return3YearsAnnualizedPct: null,
    return5YearsAnnualizedPct: null,
    volatility: null,
    sharpeRatio: null,
    source: 'gemelnet',
    rawData: {},
    ...overrides,
  };
}

function emptyMatchResult(overrides = {}) {
  return {
    matchMethod: 'no_match',
    matchConfidence: 0,
    matchedFundCode: null,
    warnings: [],
    ...overrides,
  };
}

function mapPensionFundToAccount(fund, userId) {
  const feeBal = fund.managementFeeAccumulation;
  const feeDep = fund.managementFeeDeposit;
  return emptyNormalizedAccount({
    accountId: String(fund._id || fund.id),
    userId: String(userId),
    productType: fund.fundType === 'study_fund' ? 'study_fund'
      : fund.fundType === 'provident_fund' ? 'gemel' : 'unknown',
    fundCode: fund.fundCode || fund.rawData?.fundCode || null,
    fundName: fund.fundName || '',
    companyName: fund.provider || null,
    trackName: fund.investmentTrack || null,
    accountStatus: fund.isActive === false || fund.status === 'closed' ? 'inactive' : 'active',
    balance: fund.currentBalance || 0,
    monthlyDeposit: fund.monthlyDeposit
      || ((fund.monthlyEmployeeDeposit || 0) + (fund.monthlyEmployerDeposit || 0)),
    employeeDeposit: fund.monthlyEmployeeDeposit || 0,
    employerDeposit: fund.monthlyEmployerDeposit || 0,
    managementFeeDepositPct: feeDep != null ? (feeDep <= 0.05 ? feeDep * 100 : feeDep) : null,
    managementFeeBalancePct: feeBal != null ? (feeBal <= 0.05 ? feeBal * 100 : feeBal) : null,
    liquidityDate: fund.rawData?.liquidityDate || null,
    openingDate: fund.rawData?.openingDate || null,
    source: fund.source || 'manual',
    rawData: fund.rawData || {},
  });
}

module.exports = {
  emptyNormalizedAccount,
  emptyOfficialFund,
  emptyMatchResult,
  mapPensionFundToAccount,
};
