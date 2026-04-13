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
        _id: 'doc-1',
        status: 'completed',
        metadata: { category: 'payslip', source: 'manual_upload' },
        analysisData: {
          salary: { gross_total: 10000, net_payable: 8200, components: [] },
          deductions: { mandatory: { total: 1800 } },
          contributions: {
            pension: {
              employee: 500,
              employer: 650,
              severance: 830,
            },
          },
          parties: { employee_name: 'Test User' },
          employment: {},
          summary: {},
          quality: {},
        },
      })
    ).toEqual({
      monthlyContribution: 1980,
      sourceDocumentId: 'doc-1',
      warnings: [],
    });
  });

  it('adds warning when the contribution is derived from partial document data', () => {
    expect(
      deriveContributionFromDocument({
        _id: 'doc-2',
        status: 'completed',
        metadata: { category: 'payslip', source: 'manual_upload' },
        analysisData: {
          salary: { gross_total: 10000, net_payable: 8200, components: [] },
          deductions: { mandatory: { total: 1800 } },
          contributions: {
            pension: {
              employee: 500,
              employer: 650,
            },
          },
          parties: { employee_name: 'Test User' },
          employment: {},
          summary: {},
          quality: {},
        },
      })
    ).toEqual({
      monthlyContribution: 1150,
      sourceDocumentId: 'doc-2',
      warnings: ['ההפקדה החודשית נגזרה מחלק מנתוני המסמך האחרון.'],
    });
  });
});
