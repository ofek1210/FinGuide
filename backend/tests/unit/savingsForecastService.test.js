jest.mock('../../models/Document', () => ({
  find: jest.fn(),
}));

const Document = require('../../models/Document');
const {
  buildForecastSummary,
  buildSavingsForecast,
  deriveContributionFromDocument,
  normalizeSavingsForecastInput,
} = require('../../services/savingsForecastService');
const { ValidationError } = require('../../utils/appErrors');

describe('savingsForecastService', () => {
  it('normalizes valid forecast input', () => {
    expect(
      normalizeSavingsForecastInput({
        currentBalance: '100000',
        currentAge: '32',
        retirementAge: '65',
        adjustedMonthlyContribution: '2500',
        currentMonthlyContribution: '1800',
      })
    ).toEqual({
      currentBalance: 100000,
      currentAge: 32,
      retirementAge: 65,
      adjustedMonthlyContribution: 2500,
      currentMonthlyContribution: 1800,
    });
  });

  it('rejects invalid retirement ages', () => {
    expect(() =>
      normalizeSavingsForecastInput({
        currentBalance: 100000,
        currentAge: 65,
        retirementAge: 64,
        adjustedMonthlyContribution: 2500,
      })
    ).toThrow(ValidationError);
  });

  it('derives pension contribution from complete document data', () => {
    expect(
      deriveContributionFromDocument({
        analysisData: {
          contributions: {
            pension: {
              employee: 500,
              employer: 650,
              severance: 830,
            },
          },
        },
      })
    ).toEqual({
      monthlyContribution: 1980,
      warnings: [],
    });
  });

  it('buildForecastSummary computes retirement gap fields', () => {
    expect(
      buildForecastSummary(
        { monthsToRetirement: 36, projectedBalance: 171280 },
        { monthsToRetirement: 36, projectedBalance: 190000 },
        { currentAge: 32, retirementAge: 35 }
      )
    ).toEqual({
      yearsToRetirement: 3,
      monthsToRetirement: 36,
      currentProjectedBalance: 171280,
      adjustedProjectedBalance: 190000,
      differenceAtRetirement: 18720,
    });
  });

  it('buildSavingsForecast returns summary and warnings array for manual contribution', async () => {
    Document.find.mockReturnValue({
      select: jest.fn().mockReturnValue({
        sort: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue([]),
        }),
      }),
    });

    const result = await buildSavingsForecast({
      userId: 'user-1',
      input: {
        currentBalance: 100000,
        currentAge: 32,
        retirementAge: 35,
        adjustedMonthlyContribution: 2500,
        currentMonthlyContribution: 1800,
      },
    });

    expect(result.summary).toEqual({
      yearsToRetirement: 3,
      monthsToRetirement: 36,
      currentProjectedBalance: 164800,
      adjustedProjectedBalance: 190000,
      differenceAtRetirement: 25200,
    });
    expect(result.meta.warnings).toEqual([
      'לא נמצא מסמך פנסיוני תקין. נעשה שימוש בהפקדה הידנית שהוזנה.',
    ]);
  });

  it('adds warning when the contribution is derived from partial document data', () => {
    expect(
      deriveContributionFromDocument({
        analysisData: {
          contributions: {
            pension: {
              employee: 500,
              employer: 650,
            },
          },
        },
      })
    ).toEqual({
      monthlyContribution: 1150,
      warnings: ['ההפקדה החודשית נגזרה מחלק מנתוני המסמך האחרון.'],
    });
  });
});
