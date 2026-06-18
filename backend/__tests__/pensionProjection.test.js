'use strict';

const { projectPensionIncome, PENSION_DEFAULTS } = require('../ai/engines/calculationEngine');

/**
 * Pension projection integration tests.
 * Uses realistic Israeli scenarios to validate the math is in the right ballpark.
 */

describe('Pension projection — realistic Israeli scenarios', () => {

  test('typical 30-year-old with ₪15,000 gross reaches ₪1.5M+ by 67', () => {
    const result = projectPensionIncome({
      currentAge: 30,
      retirementAge: 67,
      currentAccumulation: 30000,
      monthlyContribution: 2250, // 15% of 15,000 (employee + employer)
    });

    expect(result.projectedAccumulation).toBeGreaterThan(1500000);
    expect(result.monthlyPensionEstimate).toBeGreaterThan(5000);
    expect(result.monthsToRetirement).toBe(37 * 12);
  });

  test('late starter at 50 with ₪400k accumulation — realistic scenario', () => {
    const result = projectPensionIncome({
      currentAge: 50,
      retirementAge: 67,
      currentAccumulation: 400000,
      monthlyContribution: 3000,
    });

    expect(result.projectedAccumulation).toBeGreaterThan(900000);
    expect(result.monthsToRetirement).toBe(17 * 12);
  });

  test('replacement ratio improves with higher contributions', () => {
    const base = projectPensionIncome({
      currentAge: 35,
      retirementAge: 67,
      currentAccumulation: 150000,
      monthlyContribution: 1800,
    });

    const higher = projectPensionIncome({
      currentAge: 35,
      retirementAge: 67,
      currentAccumulation: 150000,
      monthlyContribution: 3600, // double
    });

    expect(higher.monthlyPensionEstimate).toBeGreaterThan(base.monthlyPensionEstimate);
    // Roughly proportional — double contributions → roughly 1.6-2x pension (FV is non-linear)
    expect(higher.monthlyPensionEstimate / base.monthlyPensionEstimate).toBeGreaterThan(1.5);
  });

  test('later retirement significantly improves pension', () => {
    const early = projectPensionIncome({
      currentAge: 40,
      retirementAge: 62,
      currentAccumulation: 200000,
      monthlyContribution: 2000,
    });

    const late = projectPensionIncome({
      currentAge: 40,
      retirementAge: 70,
      currentAccumulation: 200000,
      monthlyContribution: 2000,
    });

    // Later retirement = more accumulation months AND shorter drawdown → roughly 50%+ better
    expect(late.monthlyPensionEstimate).toBeGreaterThan(early.monthlyPensionEstimate * 1.4);
  });

  test('lower management fee increases accumulation', () => {
    const highFee = projectPensionIncome({
      currentAge: 35,
      retirementAge: 67,
      currentAccumulation: 100000,
      monthlyContribution: 2000,
      mgmtFeeAccumulation: 0.008,
    });

    const lowFee = projectPensionIncome({
      currentAge: 35,
      retirementAge: 67,
      currentAccumulation: 100000,
      monthlyContribution: 2000,
      mgmtFeeAccumulation: 0.002,
    });

    expect(lowFee.projectedAccumulation).toBeGreaterThan(highFee.projectedAccumulation);
    const improvementPct = ((lowFee.projectedAccumulation - highFee.projectedAccumulation) / highFee.projectedAccumulation) * 100;
    // 0.6% fee difference over 32 years should yield 10%+ improvement
    expect(improvementPct).toBeGreaterThan(10);
  });

  test('PENSION_DEFAULTS are sensible for Israeli market 2026', () => {
    expect(PENSION_DEFAULTS.annualReturnRate).toBeGreaterThan(0.04);
    expect(PENSION_DEFAULTS.annualReturnRate).toBeLessThan(0.10);
    expect(PENSION_DEFAULTS.avgMgmtFeeAccumulation).toBeGreaterThan(0);
    expect(PENSION_DEFAULTS.avgMgmtFeeAccumulation).toBeLessThan(0.01);
    expect(PENSION_DEFAULTS.replacementRate).toBeCloseTo(0.70, 1);
  });
});

describe('Pension projection — edge cases', () => {
  test('handles zero accumulation and zero contribution', () => {
    const result = projectPensionIncome({
      currentAge: 40,
      retirementAge: 67,
      currentAccumulation: 0,
      monthlyContribution: 0,
    });
    expect(result.projectedAccumulation).toBe(0);
    expect(result.monthlyPensionEstimate).toBe(0);
  });

  test('handles very large accumulation (high earner)', () => {
    const result = projectPensionIncome({
      currentAge: 50,
      retirementAge: 67,
      currentAccumulation: 2000000,
      monthlyContribution: 6000,
    });
    expect(result.projectedAccumulation).toBeGreaterThan(3000000);
    expect(Number.isFinite(result.monthlyPensionEstimate)).toBe(true);
  });

  test('result object has expected shape', () => {
    const result = projectPensionIncome({
      currentAge: 35,
      retirementAge: 67,
      currentAccumulation: 100000,
      monthlyContribution: 2000,
    });

    expect(result).toHaveProperty('monthsToRetirement');
    expect(result).toHaveProperty('projectedAccumulation');
    expect(result).toHaveProperty('monthlyPensionEstimate');
    expect(result).toHaveProperty('scenarios');
    expect(result.scenarios).toHaveProperty('base');
    expect(result.scenarios).toHaveProperty('optimistic');
    expect(result.scenarios.base).toHaveProperty('label');
    expect(result.scenarios.base).toHaveProperty('accumulation');
    expect(result.scenarios.base).toHaveProperty('monthlyPension');
  });
});
