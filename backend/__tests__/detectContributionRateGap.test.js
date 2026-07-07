const {
  analyzeContributionRates,
  buildContributionRateGapFindings,
  computeImpliedPercent,
  adjustedBaseForJobPercent,
} = require('../utils/detectContributionRateGap');
const { getContributionRateThresholds } = require('../config/contributionRateThresholds');

const okPensionAnalysis = {
  period: { month: '2024-06' },
  contributions: {
    pension: {
      base_salary_for_pension: 26000,
      employee: 1560,
      employer: 1690,
      employee_rate_percent: 6,
      employer_rate_percent: 6.5,
      detection: { sectionDetected: true, noDeposit: false },
    },
  },
  quality: { warning_categories: [] },
};

describe('computeImpliedPercent', () => {
  test('computes percent from amount and base', () => {
    expect(computeImpliedPercent(1560, 26000)).toBeCloseTo(6, 2);
  });
});

describe('analyzeContributionRates', () => {
  test('no inconsistency when stated matches implied', () => {
    const result = analyzeContributionRates(okPensionAnalysis, 'pension');
    expect(result.applies).toBe(false);
    expect(result.sides.every(side => !side.consistencyGap)).toBe(true);
  });

  test('detects inconsistency when stated percent does not match amount', () => {
    const result = analyzeContributionRates(
      {
        ...okPensionAnalysis,
        contributions: {
          pension: {
            ...okPensionAnalysis.contributions.pension,
            employee: 1400,
            employee_rate_percent: 6,
          },
        },
      },
      'pension',
    );

    expect(result.applies).toBe(true);
    const employeeSide = result.sides.find(side => side.role === 'employee');
    expect(employeeSide.consistencyGap).toBe(true);
  });

  test('detects below minimum when effective percent is low', () => {
    const result = analyzeContributionRates(
      {
        period: { month: '2024-06' },
        contributions: {
          pension: {
            base_salary_for_pension: 26000,
            employee: 1300,
            employer: 1690,
            employee_rate_percent: 5,
            employer_rate_percent: 6.5,
            detection: { sectionDetected: true, noDeposit: false },
          },
        },
        quality: { warning_categories: [] },
      },
      'pension',
      getContributionRateThresholds(),
    );

    const employeeSide = result.sides.find(side => side.role === 'employee');
    expect(employeeSide.belowMinimum).toBe(true);
    expect(result.applies).toBe(true);
  });

  test('skips when fund has no deposit', () => {
    const result = analyzeContributionRates(
      {
        contributions: {
          study_fund: {
            base_salary_for_study_fund: 20000,
            employee: 0,
            employer: 0,
            detection: { sectionDetected: true, noDeposit: true },
          },
        },
        quality: { warning_categories: [] },
      },
      'study_fund',
    );

    expect(result.skipped).toBe(true);
    expect(result.applies).toBe(false);
  });

  test('uses gross salary as contribution base when pension base is missing (IDF payslips)', () => {
    const result = analyzeContributionRates(
      {
        period: { month: '2026-05' },
        salary: { gross_total: 30391.26 },
        contributions: {
          pension: {
            employee: 2112.62,
            employer: 1063.79,
            participation_total: 3176.41,
            detection: { sectionDetected: true, noDeposit: false },
          },
        },
        quality: { warning_categories: [] },
      },
      'pension',
    );

    const employeeSide = result.sides.find(side => side.role === 'employee');
    const employerSide = result.sides.find(side => side.role === 'employer');
    expect(employeeSide.base).toBe(30391.26);
    expect(employeeSide.impliedPercent).toBeCloseTo((2112.62 / 30391.26) * 100, 2);
    expect(employerSide.impliedPercent).toBeCloseTo((1063.79 / 30391.26) * 100, 2);
  });

  test('detects below minimum using implied percent only', () => {
    const result = analyzeContributionRates(
      {
        period: { month: '2024-07' },
        contributions: {
          pension: {
            base_salary_for_pension: 26000,
            employee: 1300,
            employer: 1690,
            detection: { sectionDetected: true, noDeposit: false },
          },
        },
        quality: { warning_categories: [] },
      },
      'pension',
    );

    const employeeSide = result.sides.find(side => side.role === 'employee');
    expect(employeeSide.belowMinimum).toBe(true);
    expect(employeeSide.statedPercent).toBeNull();
  });

  test('flags data incomplete sides when deposit exists without stated rate', () => {
    const result = analyzeContributionRates(
      {
        period: { month: '2024-08' },
        contributions: {
          study_fund: {
            base_salary_for_study_fund: 20000,
            employee: 500,
            employer: 1500,
            detection: { sectionDetected: true, noDeposit: false },
          },
        },
        quality: { warning_categories: [] },
      },
      'study_fund',
    );

    expect(result.dataIncompleteSides.length).toBeGreaterThan(0);
    expect(result.applies).toBe(true);
  });

  test('low confidence when ambiguous roles', () => {
    const result = analyzeContributionRates(
      {
        ...okPensionAnalysis,
        quality: { warning_categories: ['ambiguous.contributions.pension_roles'] },
      },
      'pension',
    );

    expect(result.confidence).toBe('low');
  });
});

describe('adjustedBaseForJobPercent', () => {
  test('scales base when job percent is partial', () => {
    const thresholds = { ...getContributionRateThresholds(), adjustForJobPercent: true };
    const adjusted = adjustedBaseForJobPercent(
      { employment: { job_percent: 50 } },
      26000,
      thresholds,
    );
    expect(adjusted).toBe(13000);
    expect(computeImpliedPercent(780, 26000, { employment: { job_percent: 50 } }, thresholds)).toBeCloseTo(
      6,
      1,
    );
  });
});

describe('buildContributionRateGapFindings', () => {
  test('returns pension_rate_inconsistency finding', () => {
    const findings = buildContributionRateGapFindings([
      {
        _id: '1',
        status: 'completed',
        originalName: 'june.pdf',
        analysisData: {
          period: { month: '2024-06' },
          contributions: {
            pension: {
              base_salary_for_pension: 26000,
              employee: 1400,
              employer: 1690,
              employee_rate_percent: 6,
              employer_rate_percent: 6.5,
              detection: { sectionDetected: true, noDeposit: false },
            },
          },
          quality: { warning_categories: [] },
        },
      },
    ]);

    const ids = findings.map(item => item.id);
    expect(ids).toContain('pension_rate_inconsistency');
  });

  test('returns pension_rate_data_incomplete when rates missing', () => {
    const findings = buildContributionRateGapFindings([
      {
        _id: '2',
        status: 'completed',
        metadata: { category: 'payslip' },
        originalName: 'aug.pdf',
        analysisData: {
          period: { month: '2024-08' },
          contributions: {
            pension: {
              base_salary_for_pension: 26000,
              employee: 1560,
              employer: 1690,
              detection: { sectionDetected: true, noDeposit: false },
            },
          },
          quality: { warning_categories: [] },
        },
      },
    ]);

    const ids = findings.map(item => item.id);
    expect(ids).toContain('pension_rate_data_incomplete');
  });
});
