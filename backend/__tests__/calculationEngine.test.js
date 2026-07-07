

const {
  projectPensionIncome,
  calculateMgmtFeeSavings,
  calculateSalaryTrend,
  calculateQuickHealthScore,
  estimateInsuranceSavings,
  PENSION_DEFAULTS,
} = require('../ai/engines/calculationEngine');

// ΓöÇΓöÇ projectPensionIncome ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ

describe('projectPensionIncome', () => {
  test('calculates accumulation and monthly pension for typical Israeli worker', () => {
    const result = projectPensionIncome({
      currentAge: 35,
      retirementAge: 67,
      currentAccumulation: 100000,
      monthlyContribution: 2000,
    });

    expect(result.monthsToRetirement).toBe(32 * 12); // 384
    expect(result.projectedAccumulation).toBeGreaterThan(1000000);
    expect(result.monthlyPensionEstimate).toBeGreaterThan(3000);
    expect(result.scenarios.base).toBeDefined();
    expect(result.scenarios.optimistic.monthlyPension).toBeGreaterThan(result.scenarios.base.monthlyPension);
  });

  test('returns zero accumulation with no money and no contribution', () => {
    const result = projectPensionIncome({
      currentAge: 60,
      retirementAge: 67,
      currentAccumulation: 0,
      monthlyContribution: 0,
    });

    expect(result.projectedAccumulation).toBe(0);
    expect(result.monthlyPensionEstimate).toBe(0);
  });

  test('monthsToRetirement is clamped to 0 when already at retirement age', () => {
    const result = projectPensionIncome({
      currentAge: 70,
      retirementAge: 67,
      currentAccumulation: 500000,
      monthlyContribution: 0,
    });

    expect(result.monthsToRetirement).toBe(0);
  });

  test('optimistic scenario always >= base scenario', () => {
    const result = projectPensionIncome({
      currentAge: 30,
      retirementAge: 67,
      currentAccumulation: 50000,
      monthlyContribution: 1500,
    });

    expect(result.scenarios.optimistic.accumulation).toBeGreaterThanOrEqual(result.scenarios.base.accumulation);
  });
});

// ΓöÇΓöÇ calculateMgmtFeeSavings ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ

describe('calculateMgmtFeeSavings', () => {
  test('reduces target fee saves money', () => {
    const result = calculateMgmtFeeSavings(200000, 2000, 30, 0.008, 0.003);
    expect(result.savingsByRetirement).toBeGreaterThan(0);
    expect(result.additionalMonthlyPension).toBeGreaterThan(0);
  });

  test('returns 0 when current equals target fee', () => {
    const result = calculateMgmtFeeSavings(200000, 2000, 30, 0.003, 0.003);
    expect(result.savingsByRetirement).toBe(0);
    expect(result.additionalMonthlyPension).toBe(0);
  });

  test('higher savings for longer time horizon', () => {
    const short = calculateMgmtFeeSavings(100000, 1500, 10, 0.008, 0.003);
    const long  = calculateMgmtFeeSavings(100000, 1500, 30, 0.008, 0.003);
    expect(long.savingsByRetirement).toBeGreaterThan(short.savingsByRetirement);
  });
});

// ΓöÇΓöÇ calculateSalaryTrend ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ

describe('calculateSalaryTrend', () => {
  test('detects upward trend', () => {
    const result = calculateSalaryTrend([
      { grossSalary: 20000, period: '2026-05' },
      { grossSalary: 18000, period: '2026-04' },
    ]);
    expect(result.trend).toBe('up');
    expect(result.changePct).toBeGreaterThan(0);
    expect(result.changeAmount).toBe(2000);
  });

  test('detects downward trend', () => {
    const result = calculateSalaryTrend([
      { grossSalary: 15000, period: '2026-05' },
      { grossSalary: 18000, period: '2026-04' },
    ]);
    expect(result.trend).toBe('down');
    expect(result.changePct).toBeLessThan(0);
  });

  test('returns stable for < 1% change', () => {
    const result = calculateSalaryTrend([
      { grossSalary: 18050, period: '2026-05' },
      { grossSalary: 18000, period: '2026-04' },
    ]);
    expect(result.trend).toBe('stable');
  });

  test('returns stable with fewer than 2 payslips', () => {
    expect(calculateSalaryTrend([{ grossSalary: 18000, period: '2026-05' }]).trend).toBe('stable');
    expect(calculateSalaryTrend([]).trend).toBe('stable');
    expect(calculateSalaryTrend(null).trend).toBe('stable');
  });
});

// ΓöÇΓöÇ calculateQuickHealthScore ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ

describe('calculateQuickHealthScore', () => {
  test('full score for ideal profile', () => {
    const result = calculateQuickHealthScore({
      payslipCount: 5,
      hasPension: true,
      hasInsurance: true,
      pensionRate: 0.08,
      hasAnomalies: false,
    });
    expect(result.score).toBe(100);
    expect(result.level).toBe('excellent');
  });

  test('low score for missing pension and insurance', () => {
    const result = calculateQuickHealthScore({
      payslipCount: 0,
      hasPension: false,
      hasInsurance: false,
      pensionRate: 0,
      hasAnomalies: true,
    });
    expect(result.score).toBe(0);
    expect(result.level).toBe('poor');
  });

  test('partial score for typical profile', () => {
    const result = calculateQuickHealthScore({
      payslipCount: 3,
      hasPension: true,
      hasInsurance: false,
      pensionRate: 0.06,
      hasAnomalies: false,
    });
    expect(result.score).toBeGreaterThan(50);
    expect(result.score).toBeLessThan(90);
  });
});

// ΓöÇΓöÇ estimateInsuranceSavings ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ

describe('estimateInsuranceSavings', () => {
  test('sums monthly waste across duplicates', () => {
    const duplicates = [
      { type: 'life', estimatedMonthlyWaste: 200 },
      { type: 'health', estimatedMonthlyWaste: 150 },
    ];
    const result = estimateInsuranceSavings(duplicates);
    expect(result.monthlyEstimate).toBe(350);
    expect(result.annualEstimate).toBe(4200);
  });

  test('returns 0 for empty duplicates', () => {
    expect(estimateInsuranceSavings([]).monthlyEstimate).toBe(0);
    expect(estimateInsuranceSavings(null).monthlyEstimate).toBe(0);
  });
});
