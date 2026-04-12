const {
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
