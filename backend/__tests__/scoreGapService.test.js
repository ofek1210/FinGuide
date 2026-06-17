const {
  buildPayslipFieldGaps,
  parseGapId,
  applyGapAnswer,
} = require('../services/scoreGapService');

const payslipEntry = (overrides = {}) => ({
  doc: {
    _id: 'doc1',
    analysisData: {
      contributions: {
        pension: {
          base_salary_for_pension: 26000,
          employee: 0,
          employer: 600,
          detection: { sectionDetected: true },
        },
      },
      quality: { warning_categories: [] },
      ...overrides.analysisData,
    },
  },
  period: { year: 2023, month: 1 },
});

describe('parseGapId', () => {
  test('parses a valid payslip_field id', () => {
    expect(parseGapId('pension.employee.2023-01')).toEqual({
      fundType: 'pension',
      role: 'employee',
      period: '2023-01',
    });
  });

  test('rejects malformed ids', () => {
    expect(parseGapId('pension.employee')).toBeNull();
    expect(parseGapId('crypto.employee.2023-01')).toBeNull();
    expect(parseGapId('pension.boss.2023-01')).toBeNull();
    expect(parseGapId('pension.employee.2023-1')).toBeNull();
    expect(parseGapId(42)).toBeNull();
  });
});

describe('buildPayslipFieldGaps', () => {
  test('emits a gap only for the genuinely-absent employee pension amount', () => {
    // employee not extracted (absent), employer present (600)
    const entry = payslipEntry({
      analysisData: {
        contributions: {
          pension: {
            base_salary_for_pension: 26000,
            employer: 600,
            detection: { sectionDetected: true },
          },
        },
        quality: { warning_categories: [] },
      },
    });
    const gaps = buildPayslipFieldGaps([entry]);
    const employeeGap = gaps.find(g => g.id === 'pension.employee.2023-01');

    expect(employeeGap).toBeDefined();
    expect(employeeGap.kind).toBe('payslip_field');
    expect(employeeGap.fundType).toBe('pension');
    expect(employeeGap.role).toBe('employee');
    expect(employeeGap.documentId).toBe('doc1');
    expect(employeeGap.improves).toEqual({ kind: 'score', label: 'עקביות פנסיה' });
    // employer side is present (600) → no gap for it
    expect(gaps.find(g => g.id === 'pension.employer.2023-01')).toBeUndefined();
  });

  test('does NOT ask about a confirmed zero amount (no-deposit finding, not missing data)', () => {
    const entry = payslipEntry({
      analysisData: {
        contributions: {
          pension: {
            base_salary_for_pension: 26000,
            employee: 0,
            employer: 600,
            detection: { sectionDetected: true },
          },
        },
        quality: { warning_categories: [] },
      },
    });
    const gaps = buildPayslipFieldGaps([entry]);
    expect(gaps.find(g => g.id === 'pension.employee.2023-01')).toBeUndefined();
  });

  test('no gaps when the fund section is not detected on the slip', () => {
    const entry = {
      doc: { _id: 'd', analysisData: { contributions: {}, quality: { warning_categories: [] } } },
      period: { year: 2023, month: 1 },
    };
    expect(buildPayslipFieldGaps([entry])).toHaveLength(0);
  });

  test('never asks about study fund — it does not move the score', () => {
    const entry = {
      doc: {
        _id: 'd',
        analysisData: {
          contributions: {
            study_fund: {
              base_salary_for_study_fund: 20000,
              detection: { sectionDetected: true },
            },
          },
          quality: { warning_categories: [] },
        },
      },
      period: { year: 2023, month: 1 },
    };
    const gaps = buildPayslipFieldGaps([entry]);
    expect(gaps.every(g => g.fundType !== 'study_fund')).toBe(true);
  });
});

describe('applyGapAnswer', () => {
  test('writes the amount across every field family the score + findings read', () => {
    const doc = {
      analysisData: {
        contributions: { pension: { employer: 600 } },
        quality: { warning_categories: ['missing.contributions.pension_line'] },
      },
      markModified: jest.fn(),
    };

    applyGapAnswer(doc, { fundType: 'pension', role: 'employee' }, 540);

    const analysis = doc.analysisData;
    expect(analysis.contributions.pension.employee).toBe(540);
    expect(analysis.contributions.pension.employee_amount).toBe(540);
    expect(analysis.summary.pensionEmployee).toBe(540);
    expect(analysis.contributions.pension.detection.sectionDetected).toBe(true);
    expect(analysis.contributions.pension.detection.source).toBe('manual');
    // employee 540 + employer 600 > 0 → not a "no deposit"
    expect(analysis.contributions.pension.detection.noDeposit).toBe(false);
    // missing-line warning cleared so the section is treated as detected
    expect(analysis.quality.warning_categories).not.toContain('missing.contributions.pension_line');
    expect(analysis.manualEntries['pension.employee'].value).toBe(540);
    expect(doc.markModified).toHaveBeenCalledWith('analysisData');
  });

  test('rejects negative amounts', () => {
    const doc = { analysisData: {}, markModified: jest.fn() };
    expect(() => applyGapAnswer(doc, { fundType: 'pension', role: 'employee' }, -5)).toThrow();
  });
});
