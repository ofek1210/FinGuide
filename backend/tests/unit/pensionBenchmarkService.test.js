'use strict';

const { benchmarkPortfolio, matchFundToTrack, feeStatus } = require('../../services/pensionBenchmarkService');

describe('pensionBenchmarkService', () => {
  const sampleFund = {
    _id: 'fund1',
    fundName: 'מגדל מקיפה',
    provider: 'מגדל',
    fundType: 'pension_comprehensive',
    investmentTrack: 'מניות (גבוה)',
    riskLevel: 'high',
    currentBalance: 185000,
    monthlyEmployeeDeposit: 1080,
    monthlyEmployerDeposit: 1500,
    managementFeeAccumulation: 0.006,
    status: 'active',
    isActive: true,
  };

  it('matchFundToTrack fuzzy-matches Migdal comprehensive', () => {
    const match = matchFundToTrack(sampleFund);
    expect(match.track).not.toBeNull();
    expect(match.track.provider).toBe('מגדל');
    expect(match.confidence).toBeGreaterThan(0.25);
  });

  it('feeStatus classifies above-market fees', () => {
    expect(feeStatus(0.004, 0.0035)).toBe('above_market');
    expect(feeStatus(0.006, 0.0035)).toBe('high');
    expect(feeStatus(0.0018, 0.0035)).toBe('excellent');
  });

  it('benchmarkPortfolio returns rank and savings for high-fee fund', () => {
    const result = benchmarkPortfolio([sampleFund], { currentAge: 35, retirementAge: 67 });
    expect(result.funds).toHaveLength(1);
    expect(result.funds[0].matchedTrack).not.toBeNull();
    expect(result.funds[0].feeVsMarket).toMatch(/above_market|high/);
    expect(result.summary.fundsAboveMarketFee).toBe(1);
    expect(result.summary.totalPotentialSavings).toBeGreaterThan(0);
  });

  it('benchmarkPortfolio flags risk mismatch for young user in low track', () => {
    const lowFund = {
      ...sampleFund,
      fundName: 'מגדל מקיפה סולידי',
      investmentTrack: 'סולידי',
      riskLevel: 'low',
      managementFeeAccumulation: 0.0028,
    };
    const result = benchmarkPortfolio([lowFund], { currentAge: 28, retirementAge: 67 });
    expect(result.funds[0].riskMismatch).toBe(true);
    expect(result.summary.riskMismatchCount).toBe(1);
  });
});
