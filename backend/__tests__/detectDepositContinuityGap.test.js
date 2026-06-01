const { buildFundTimeline } = require('../utils/contributionTimeline');
const {
  analyzeFundContinuity,
  buildDepositContinuityFindings,
} = require('../utils/detectDepositContinuityGap');
const { getDepositContinuityConfig } = require('../config/depositContinuityConfig');

const baseConfig = {
  ...getDepositContinuityConfig(),
  minMonthsWithDeposit: 2,
  minGapMonths: 1,
  lookbackMonths: 36,
};

const makePensionDoc = (period, employee, employer, overrides = {}) => ({
  status: 'completed',
  metadata: { category: 'payslip' },
  uploadedAt: new Date(`${period}-15`),
  analysisData: {
    period: { month: period },
    contributions: {
      pension: {
        base_salary_for_pension: 26000,
        employee,
        employer,
        detection: {
          sectionDetected: true,
          noDeposit: employee === 0 && employer === 0,
        },
        ...overrides.contributions?.pension,
      },
    },
    quality: { warning_categories: overrides.warningCategories || [] },
    ...overrides.analysisData,
  },
});

describe('buildFundTimeline', () => {
  test('classifies deposit and no-deposit months', () => {
    const { entries } = buildFundTimeline(
      [
        makePensionDoc('2024-01', 1560, 1690),
        makePensionDoc('2024-02', 0, 0),
      ],
      'pension',
    );
    expect(entries).toHaveLength(2);
    expect(entries[0].classification).toBe('hasDeposit');
    expect(entries[1].classification).toBe('noDepositOnPayslip');
  });
});

describe('analyzeFundContinuity', () => {
  test('detects internal on-payslip break', () => {
    const analysis = analyzeFundContinuity(
      [
        makePensionDoc('2024-01', 1560, 1690),
        makePensionDoc('2024-02', 0, 0),
        makePensionDoc('2024-03', 1560, 1690),
      ],
      'pension',
      baseConfig,
    );
    expect(analysis.onPayslipBreaks).toHaveLength(1);
    expect(analysis.onPayslipBreaks[0].type).toBe('internal');
    expect(analysis.onPayslipBreaks[0].gapMonths).toHaveLength(1);
  });

  test('detects trailing on-payslip break', () => {
    const analysis = analyzeFundContinuity(
      [
        makePensionDoc('2024-01', 1560, 1690),
        makePensionDoc('2024-02', 1560, 1690),
        makePensionDoc('2024-03', 0, 0),
      ],
      'pension',
      baseConfig,
    );
    expect(analysis.onPayslipBreaks.some(b => b.type === 'trailing')).toBe(true);
  });

  test('detects missing payslip month between deposits', () => {
    const analysis = analyzeFundContinuity(
      [
        makePensionDoc('2024-01', 1560, 1690),
        makePensionDoc('2024-03', 1560, 1690),
      ],
      'pension',
      baseConfig,
    );
    expect(analysis.missingPayslipBreaks).toHaveLength(1);
    expect(analysis.missingPayslipBreaks[0].gapMonths).toHaveLength(1);
    expect(analysis.missingPayslipBreaks[0].gapMonths[0].key).toBe('2024-02');
  });

  test('does not apply with fewer than minMonthsWithDeposit', () => {
    const analysis = analyzeFundContinuity(
      [makePensionDoc('2024-01', 1560, 1690), makePensionDoc('2024-02', 0, 0)],
      'pension',
      baseConfig,
    );
    expect(analysis.applies).toBe(false);
  });

  test('reports uncertain timeline finding when ambiguous months exceed threshold', () => {
    const { findings } = buildDepositContinuityFindings(
      [
        makePensionDoc('2024-01', 1560, 1690, {
          warningCategories: ['ambiguous.contributions.pension_roles'],
        }),
        makePensionDoc('2024-02', 1560, 1690, {
          warningCategories: ['missing.contributions.pension_line'],
        }),
        makePensionDoc('2024-03', 1560, 1690),
      ],
      { ...baseConfig, uncertainMonthsThreshold: 2 },
    );
    const ids = findings.map(f => f.id);
    expect(ids).toContain('pension_deposit_timeline_uncertain');
  });
});

describe('buildDepositContinuityFindings', () => {
  test('returns pension_deposit_break_on_payslip finding', () => {
    const { findings } = buildDepositContinuityFindings(
      [
        makePensionDoc('2024-01', 1560, 1690),
        makePensionDoc('2024-02', 1560, 1690),
        makePensionDoc('2024-03', 0, 0),
        makePensionDoc('2024-04', 1560, 1690),
      ],
      baseConfig,
    );
    const ids = findings.map(f => f.id);
    expect(ids).toContain('pension_deposit_break_on_payslip');
  });

  test('returns missing payslip finding id', () => {
    const { findings } = buildDepositContinuityFindings(
      [
        makePensionDoc('2024-01', 1560, 1690),
        makePensionDoc('2024-02', 1560, 1690),
        makePensionDoc('2024-04', 1560, 1690),
      ],
      baseConfig,
    );
    const ids = findings.map(f => f.id);
    expect(ids).toContain('pension_deposit_break_missing_payslip');
  });
});

const makeStudyDoc = (period, employee, employer) => ({
  status: 'completed',
  metadata: { category: 'payslip' },
  uploadedAt: new Date(`${period}-15`),
  analysisData: {
    period: { month: period },
    contributions: {
      study_fund: {
        base_salary_for_study_fund: 20000,
        employee,
        employer,
        detection: {
          sectionDetected: true,
          noDeposit: employee === 0 && employer === 0,
        },
      },
    },
    quality: { warning_categories: [] },
  },
});

describe('study fund continuity', () => {
  test('detects study_fund internal break', () => {
    const analysis = analyzeFundContinuity(
      [
        makeStudyDoc('2024-01', 500, 1500),
        makeStudyDoc('2024-02', 500, 1500),
        makeStudyDoc('2024-03', 0, 0),
        makeStudyDoc('2024-04', 500, 1500),
      ],
      'study_fund',
      baseConfig,
    );
    expect(analysis.onPayslipBreaks.length).toBeGreaterThan(0);
  });
});
