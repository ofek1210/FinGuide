'use strict';

const {
  LEGAL_RETIREMENT_AGE,
  resolveRetirementAge,
  recommendedRiskLevel,
  normalizeFundRiskLevel,
  riskLevelShortLabel,
  riskLevelFullLabel,
  weightedAvgMgmtFee,
} = require('../../utils/pensionShared');

describe('pensionShared', () => {
  test('LEGAL_RETIREMENT_AGE is 67', () => {
    expect(LEGAL_RETIREMENT_AGE).toBe(67);
  });

  test('resolveRetirementAge prefers profile fields', () => {
    expect(resolveRetirementAge(null)).toBe(67);
    expect(resolveRetirementAge({ retirementAge: 65 })).toBe(65);
    expect(resolveRetirementAge({ retirement: { plannedRetirementAge: 62 } })).toBe(62);
  });

  test('recommendedRiskLevel by age and years', () => {
    expect(recommendedRiskLevel(null, 20)).toBeNull();
    expect(recommendedRiskLevel(30, 30)).toBe('high');
    expect(recommendedRiskLevel(40, 20)).toBe('medium');
    expect(recommendedRiskLevel(55, 10)).toBe('low');
  });

  test('normalizeFundRiskLevel handles Hebrew and English', () => {
    expect(normalizeFundRiskLevel('high')).toBe('high');
    expect(normalizeFundRiskLevel('גבוה')).toBe('high');
    expect(normalizeFundRiskLevel('סולידי')).toBe('low');
    expect(normalizeFundRiskLevel('unknown')).toBe('unknown');
    expect(normalizeFundRiskLevel('medium')).toBe('medium');
  });

  test('risk level labels', () => {
    expect(riskLevelShortLabel('high')).toBe('גבוה');
    expect(riskLevelFullLabel('high')).toContain('מניות');
  });

  test('weightedAvgMgmtFee balances by fund size', () => {
    const fee = weightedAvgMgmtFee([
      { currentBalance: 100000, managementFeeAccumulation: 0.004, status: 'active' },
      { currentBalance: 100000, managementFeeAccumulation: 0.002, status: 'active' },
    ]);
    expect(fee).toBeCloseTo(0.003, 5);
  });
});
