

jest.mock('../../models/PensionFund', () => ({ find: jest.fn() }));
jest.mock('../../models/UserProfile', () => ({ findOne: jest.fn() }));
jest.mock('../../models/Document', () => ({ findOne: jest.fn() }));

const { getPensionSummary, generatePensionRecommendations } = require('../../ai/tools/pensionTools');
const PensionFund = require('../../models/PensionFund');
const UserProfile = require('../../models/UserProfile');
const Document = require('../../models/Document');

function chain(result) {
  const c = {
    select: jest.fn(() => c),
    sort: jest.fn(() => c),
    limit: jest.fn(() => c),
    lean: jest.fn(() => Promise.resolve(result)),
  };
  return c;
}

describe('pensionTools with PensionFund data', () => {
  const userId = 'user123';

  beforeEach(() => {
    jest.clearAllMocks();
    UserProfile.findOne.mockReturnValue(chain({
      personal: { age: 35 },
      retirement: { plannedRetirementAge: 67, hasStudyFund: null },
    }));
    Document.findOne.mockReturnValue(chain({
      analysisData: { summary: { grossSalary: 18000, pensionEmployee: 1080, pensionEmployer: 1500 } },
    }));
  });

  it('getPensionSummary prefers imported PensionFund data', async () => {
    PensionFund.find.mockReturnValue(chain([
      {
        fundName: 'מגדל מקיפה',
        fundType: 'pension_comprehensive',
        currentBalance: 185000,
        monthlyEmployeeDeposit: 1080,
        monthlyEmployerDeposit: 1500,
        managementFeeAccumulation: 0.006,
        isActive: true,
        status: 'active',
        source: 'har_hakesef',
      },
      {
        fundName: 'מיטב השתלמות',
        fundType: 'study_fund',
        currentBalance: 78000,
        monthlyEmployeeDeposit: 400,
        monthlyEmployerDeposit: 400,
        managementFeeAccumulation: 0.0035,
        isActive: true,
        status: 'active',
        source: 'har_hakesef',
      },
    ]));

    const summary = await getPensionSummary(userId);

    expect(summary.hasData).toBe(true);
    expect(summary.dataSource).toBe('har_hakesef');
    expect(summary.currentAccumulation).toBe(263000);
    expect(summary.totalMonthlyContribution).toBe(3380);
    expect(summary.fundCount).toBe(2);
    expect(summary.hasStudyFund).toBe(true);
    expect(summary.grossSalary).toBe(18000);
  });

  it('generatePensionRecommendations flags multiple funds and missing study fund', () => {
    const summary = {
      hasData: true,
      fundCount: 4,
      hasStudyFund: false,
      parseWarnings: ['חסרה יתרה'],
      grossSalary: 18000,
      hasMissingPension: false,
      currentAccumulation: 400000,
      totalMonthlyContribution: 3000,
      currentMgmtFee: 0.006,
      currentAge: 35,
      retirementAge: 67,
    };
    const projection = {
      available: true,
      contributionRules: { belowMinimum: false },
      mgmtFeeSavings: { additionalMonthlyPension: 200 },
      replacementRatio: 45,
    };

    const recs = generatePensionRecommendations(summary, projection);
    const types = recs.map(r => r.type);

    expect(types).toContain('multiple_funds');
    expect(types).toContain('no_study_fund');
    expect(types).toContain('partial_import_data');
  });
});
