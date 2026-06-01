const Document = require('../../models/Document');
const {
  analyzePayslipTrends,
  analyzePensionContributions,
  detectUnusualDeductions,
  SALARY_CHANGE_THRESHOLD,
} = require('../../services/insightsEngine');

jest.mock('../../models/Document');
jest.mock('../../models/Insight', () => ({
  findOne: jest.fn(),
  create: jest.fn(),
}));
jest.mock('../../services/notificationService', () => ({
  notifyInsightCreated: jest.fn(),
}));

function makeDoc(overrides = {}) {
  return {
    _id: overrides._id || 'doc1',
    status: 'completed',
    analysisData: {
      period: { month: '2026-01' },
      salary: { gross_total: 20000, net_payable: 14000 },
      summary: {
        grossSalary: 20000,
        netSalary: 14000,
        tax: 3000,
        pensionEmployee: 1200,
      },
      contributions: { pension: { employee_amount: 1200 } },
      deductions: { mandatory: { total: 6000, income_tax: 3000 } },
      ...overrides.analysisData,
    },
    ...overrides,
  };
}

describe('insightsEngine', () => {
  describe('analyzePayslipTrends', () => {
    it('detects salary drop above threshold', async () => {
      const history = {
        items: [
          { id: 'd2', periodMonth: '2026-02', grossSalary: 18000, netSalary: 12000 },
          { id: 'd1', periodMonth: '2026-01', grossSalary: 20000, netSalary: 14000 },
        ],
      };
      const drafts = await analyzePayslipTrends('user1', history);
      expect(drafts.some(d => d.kind === 'salary_drop')).toBe(true);
      const drop = drafts.find(d => d.kind === 'salary_drop');
      expect(drop.payload.changePercent).toBe(-10);
    });

    it('returns empty when only one payslip', async () => {
      const drafts = await analyzePayslipTrends('user1', { items: [{ grossSalary: 20000 }] });
      expect(drafts).toHaveLength(0);
    });
  });

  describe('analyzePensionContributions', () => {
    it('flags missing pension', async () => {
      const docs = [
        makeDoc({
          analysisData: {
            salary: { gross_total: 20000 },
            summary: { pensionEmployee: 0 },
            contributions: { pension: { employee_amount: 0 } },
          },
        }),
      ];
      const drafts = await analyzePensionContributions('user1', docs);
      expect(drafts.some(d => d.kind === 'pension_missing')).toBe(true);
    });

    it('flags low pension rate', async () => {
      const docs = [
        makeDoc({
          analysisData: {
            salary: { gross_total: 20000 },
            summary: { pensionEmployee: 600 },
            contributions: { pension: { employee_amount: 600 } },
          },
        }),
      ];
      const drafts = await analyzePensionContributions('user1', docs);
      expect(drafts.some(d => d.kind === 'pension_low')).toBe(true);
    });
  });

  describe('detectUnusualDeductions', () => {
    it('detects large tax increase', async () => {
      const docs = [
        makeDoc({
          _id: 'latest',
          analysisData: {
            summary: { tax: 5000, grossSalary: 20000, netSalary: 14000 },
            deductions: { mandatory: { total: 6000, income_tax: 5000 } },
          },
        }),
        makeDoc({
          _id: 'prev',
          analysisData: {
            summary: { tax: 2000, grossSalary: 20000, netSalary: 16000 },
            deductions: { mandatory: { total: 4000, income_tax: 2000 } },
          },
        }),
      ];
      const drafts = await detectUnusualDeductions('user1', docs);
      expect(drafts.some(d => d.kind === 'unusual_deduction')).toBe(true);
    });
  });

  it('exports threshold constants', () => {
    expect(SALARY_CHANGE_THRESHOLD).toBe(0.05);
  });
});
