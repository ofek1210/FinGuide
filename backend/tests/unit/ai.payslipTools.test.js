/**
 * Unit tests for ai/tools/payslipTools.
 * - analyzeSalary and generatePayslipRecommendations are pure.
 * - getPayslipSummaries hits the Document model, which is mocked here.
 */

jest.mock('../../models/Document');

const Document = require('../../models/Document');
const {
  getPayslipSummaries,
  analyzeSalary,
  generatePayslipRecommendations,
} = require('../../ai/tools/payslipTools');

beforeEach(() => {
  jest.clearAllMocks();
});

function mockFindChain(docs) {
  const chain = {
    sort: jest.fn(() => chain),
    limit: jest.fn(() => chain),
    lean: jest.fn(() => Promise.resolve(docs)),
  };
  Document.find.mockReturnValue(chain);
  return chain;
}

describe('getPayslipSummaries', () => {
  it('throws when no userId is provided', async () => {
    await expect(getPayslipSummaries()).rejects.toThrow('userId is required');
  });

  it('maps documents to safe payslip DTOs (no raw fields leaked)', async () => {
    mockFindChain([
      {
        _id: { toString: () => 'doc1' },
        status: 'completed',
        metadata: { category: 'payslip', periodMonth: 3, periodYear: 2025 },
        uploadedAt: new Date('2025-03-10'),
        analysisData: {
          period: { month: '2025-03' },
          summary: { grossSalary: 20000, netSalary: 14000, tax: 2500 },
        },
      },
    ]);

    const result = await getPayslipSummaries('user-1', 6);
    expect(result.count).toBe(1);
    expect(result.latestPeriod).toBe('03/2025');
    const dto = result.payslips[0];
    expect(dto).toMatchObject({ documentId: 'doc1', grossSalary: 20000, netSalary: 14000 });
    expect(dto).not.toHaveProperty('analysisData');
  });

  it('returns payslips ordered by salary period, not upload date', async () => {
    mockFindChain([
      {
        _id: { toString: () => 'mar' },
        status: 'completed',
        metadata: { category: 'payslip' },
        uploadedAt: new Date('2025-04-01'),
        analysisData: { period: { month: '2025-03' }, summary: { grossSalary: 30000 } },
      },
      {
        _id: { toString: () => 'jan' },
        status: 'completed',
        metadata: { category: 'payslip' },
        uploadedAt: new Date('2025-04-03'),
        analysisData: { period: { month: '2025-01' }, summary: { grossSalary: 10000 } },
      },
      {
        _id: { toString: () => 'feb' },
        status: 'completed',
        metadata: { category: 'payslip' },
        uploadedAt: new Date('2025-04-02'),
        analysisData: { period: { month: '2025-02' }, summary: { grossSalary: 20000 } },
      },
    ]);

    const result = await getPayslipSummaries('user-1', 3);
    expect(result.payslips.map(p => p.documentId)).toEqual(['mar', 'feb', 'jan']);
  });

  it('returns an empty summary when the user has no payslips', async () => {
    mockFindChain([]);
    const result = await getPayslipSummaries('user-1');
    expect(result.count).toBe(0);
    expect(result.latestPeriod).toBeNull();
  });
});

describe('analyzeSalary', () => {
  it('returns a safe empty shape for no payslips', () => {
    const out = analyzeSalary([]);
    expect(out.trend).toBeNull();
    expect(out.anomalies.hasAnomalies).toBe(false);
    expect(out.latestGross).toBeNull();
  });

  it('reports the latest gross/net and produces a trend + anomalies object', () => {
    const payslips = [
      { grossSalary: 21000, netSalary: 14500, period: '3/2025' },
      { grossSalary: 20000, netSalary: 14000, period: '2/2025' },
    ];
    const out = analyzeSalary(payslips);
    expect(out.latestGross).toBe(21000);
    expect(out.latestNet).toBe(14500);
    expect(out).toHaveProperty('trend');
    expect(out.anomalies).toHaveProperty('hasAnomalies');
  });
});

describe('generatePayslipRecommendations', () => {
  it('flags a low pension contribution rate (< 6%)', () => {
    const payslips = [{ grossSalary: 20000, pensionEmployee: 1000, trainingFundEmployee: 500 }];
    const recs = generatePayslipRecommendations({ anomalies: { hasAnomalies: false } }, payslips);
    expect(recs.some((r) => r.type === 'pension_low')).toBe(true);
  });

  it('does not flag pension when the rate is healthy (>= 6%)', () => {
    const payslips = [{ grossSalary: 20000, pensionEmployee: 1300, trainingFundEmployee: 500 }];
    const recs = generatePayslipRecommendations({ anomalies: { hasAnomalies: false } }, payslips);
    expect(recs.some((r) => r.type === 'pension_low')).toBe(false);
  });

  it('surfaces detected salary anomalies', () => {
    const payslips = [{ grossSalary: 20000, pensionEmployee: 1300, trainingFundEmployee: 500 }];
    const recs = generatePayslipRecommendations(
      { anomalies: { hasAnomalies: true, anomalies: ['ירידה חדה בשכר'] } },
      payslips,
    );
    expect(recs.some((r) => r.type === 'salary_anomaly')).toBe(true);
  });

  it('flags a missing training fund', () => {
    const payslips = [{ grossSalary: 20000, pensionEmployee: 1300, trainingFundEmployee: null }];
    const recs = generatePayslipRecommendations({ anomalies: { hasAnomalies: false } }, payslips);
    expect(recs.some((r) => r.type === 'missing_training_fund')).toBe(true);
  });

  it('returns no recommendations when there is no payslip', () => {
    expect(generatePayslipRecommendations({}, [])).toEqual([]);
  });
});
