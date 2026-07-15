/**
 * Unit tests for ai/tools/gemelTools.
 * - generateGemelRecommendations is pure.
 * - getGemelSummary hits UserProfile/Document/PensionFund, mocked here.
 */

jest.mock('../../models/UserProfile');
jest.mock('../../models/Document');
jest.mock('../../models/PensionFund');

const UserProfile = require('../../models/UserProfile');
const Document = require('../../models/Document');
const PensionFund = require('../../models/PensionFund');
const {
  getGemelSummary,
  generateGemelRecommendations,
  GEMEL_FUND_TYPES,
  STUDY_FUND_EMPLOYER_RATE,
} = require('../../ai/tools/gemelTools');

function mockDb({ profile = null, payslip = null, funds = [] } = {}) {
  UserProfile.findOne.mockReturnValue({ lean: () => Promise.resolve(profile) });
  const docChain = {
    sort: jest.fn(() => docChain),
    lean: jest.fn(() => Promise.resolve(payslip)),
  };
  Document.findOne.mockReturnValue(docChain);
  PensionFund.find.mockReturnValue({ lean: () => Promise.resolve(funds) });
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('getGemelSummary', () => {
  it('throws when no userId is provided', async () => {
    await expect(getGemelSummary()).rejects.toThrow('userId is required');
  });

  it('queries PensionFund with gemel fund types only', async () => {
    mockDb();
    await getGemelSummary('user-1');
    expect(PensionFund.find).toHaveBeenCalledWith(
      expect.objectContaining({ fundType: { $in: GEMEL_FUND_TYPES } }),
    );
  });

  it('returns hasData=false when there is no payslip and no funds', async () => {
    mockDb();
    const summary = await getGemelSummary('user-1');
    expect(summary.hasData).toBe(false);
    expect(summary.fundCount).toBe(0);
  });

  it('builds a payslip-only summary with study fund contributions', async () => {
    mockDb({
      payslip: {
        analysisData: {
          summary: {
            grossSalary: 20000,
            trainingFundEmployee: 500,
            trainingFundEmployer: 1500,
            trainingFundEmployerRate: 7.5,
          },
        },
      },
    });
    const summary = await getGemelSummary('user-1');
    expect(summary.hasData).toBe(true);
    expect(summary.dataSource).toBe('payslip');
    expect(summary.hasStudyFund).toBe(true);
    expect(summary.payslipContribution).toBe(2000);
    expect(summary.salaryAboveCeiling).toBe(true); // 20,000 > 15,712
  });

  it('aggregates imported gemel funds: balances, counts and type flags', async () => {
    mockDb({
      funds: [
        {
          fundType: 'study_fund',
          currentBalance: 80000,
          monthlyEmployeeDeposit: 250,
          monthlyEmployerDeposit: 750,
          managementFeeAccumulation: 0.7,
          source: 'har_hakesef',
          status: 'active',
        },
        {
          fundType: 'provident_fund',
          currentBalance: 40000,
          monthlyDeposit: 300,
          managementFeeAccumulation: 0.5,
          source: 'har_hakesef',
          status: 'active',
        },
      ],
    });
    const summary = await getGemelSummary('user-1');
    expect(summary.hasData).toBe(true);
    expect(summary.dataSource).toBe('har_hakesef');
    expect(summary.totalBalance).toBe(120000);
    expect(summary.studyFundBalance).toBe(80000);
    expect(summary.providentBalance).toBe(40000);
    expect(summary.totalMonthlyContribution).toBe(1300); // 250+750 + monthlyDeposit 300
    expect(summary.studyFundCount).toBe(1);
    expect(summary.providentFundCount).toBe(1);
    expect(summary.hasStudyFund).toBe(true);
    expect(summary.hasProvidentFund).toBe(true);
  });

  it('flags a deposit mismatch between payslip and imported report', async () => {
    mockDb({
      payslip: {
        analysisData: {
          summary: { grossSalary: 15000, trainingFundEmployee: 375, trainingFundEmployer: 1125 },
        },
      },
      funds: [
        {
          fundType: 'study_fund',
          currentBalance: 50000,
          monthlyEmployeeDeposit: 100,
          monthlyEmployerDeposit: 300,
          status: 'active',
        },
      ],
    });
    const summary = await getGemelSummary('user-1');
    expect(summary.depositMismatch).toBe(true);
    expect(summary.parseWarnings.length).toBe(1);
  });
});

describe('generateGemelRecommendations', () => {
  const baseSummary = {
    hasData: true,
    grossSalary: 15000,
    hasStudyFund: false,
    hasProvidentFund: false,
    declaredStudyFund: null,
    studyFundCount: 0,
    providentFundCount: 0,
    fundCount: 0,
    payslipContribution: null,
    fundContribution: null,
    depositMismatch: false,
    parseWarnings: [],
    salaryAboveCeiling: false,
    monthlySalaryCeiling: 15712,
    annualTaxFreeDeposit: 20520,
    expectedEmployee: 375,
    expectedEmployer: 1125,
    studyFundEmployeeRate: null,
    studyFundEmployerRate: null,
  };

  it('recommends opening a study fund when none exists', () => {
    const recs = generateGemelRecommendations(baseSummary);
    expect(recs.map(r => r.type)).toContain('no_study_fund');
  });

  it('flags declared-but-missing study fund deposits as high urgency', () => {
    const recs = generateGemelRecommendations({
      ...baseSummary,
      declaredStudyFund: true,
    });
    const rec = recs.find(r => r.type === 'study_fund_declared_no_deposit');
    expect(rec).toBeDefined();
    expect(rec.urgency).toBe('high');
  });

  it('turns market verdicts into typed recommendations and skips LEAVE', () => {
    const recs = generateGemelRecommendations(
      { ...baseSummary, hasStudyFund: true, studyFundCount: 1, fundCount: 1 },
      {
        marketAdvice: {
          hasData: true,
          funds: [
            { verdict: 'SWITCH', verdictLabelHe: 'שקול מעבר', productName: 'א', summaryHe: 'x', annualSavingsEstimate: 900 },
            { verdict: 'LEAVE', verdictLabelHe: 'הישאר', productName: 'ב', summaryHe: 'y' },
          ],
        },
      },
    );
    const types = recs.map(r => r.type);
    expect(types).toContain('gemel_market_switch');
    expect(types.filter(t => t.startsWith('gemel_market_'))).toHaveLength(1);
  });

  it('flags employer rate below the market standard', () => {
    const recs = generateGemelRecommendations({
      ...baseSummary,
      hasStudyFund: true,
      studyFundEmployerRate: 5,
    });
    const rec = recs.find(r => r.type === 'study_fund_employer_rate_low');
    expect(rec).toBeDefined();
    expect(rec.reason).toContain(`${STUDY_FUND_EMPLOYER_RATE}%`);
  });

  it('recommends consolidation for more than two funds', () => {
    const recs = generateGemelRecommendations({
      ...baseSummary,
      hasStudyFund: true,
      fundCount: 3,
    });
    expect(recs.map(r => r.type)).toContain('multiple_gemel_funds');
  });

  it('does not emit impactAmount on returned recommendations', () => {
    const recs = generateGemelRecommendations(baseSummary);
    recs.forEach(r => expect(r).not.toHaveProperty('impactAmount'));
  });
});
