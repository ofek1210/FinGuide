const { computeRecoverableSavingsAnnual } = require('../../utils/recoverableSavings');

describe('recoverableSavings', () => {
  it('ignores total withholdings and sums only real gaps', () => {
    const insights = [
      {
        id: 'gross_to_net_breakdown',
        financialImpact: 81000,
      },
      {
        id: 'tax_credit_gap',
        financialImpact: 5000,
      },
      {
        id: 'tax_credit_development_zone',
        financialImpact: 3384,
      },
      {
        id: 'pension_rate_low',
        financialImpact: 200,
      },
      {
        id: 'study_fund_underutilized',
        financialImpact: 1200,
      },
      {
        id: 'deduction_ratio_high',
        financialImpact: null,
      },
    ];

    expect(computeRecoverableSavingsAnnual(insights)).toBe(8600);
  });

  it('uses max tax estimate when refund and credit gap overlap', () => {
    const insights = [
      { id: 'tax_credit_gap', financialImpact: 4000 },
      { id: 'annual_tax_refund_estimate', financialImpact: 9000 },
    ];
    expect(computeRecoverableSavingsAnnual(insights)).toBe(9000);
  });
});
