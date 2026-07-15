const {
  buildExpectedTaxCredits,
  buildTaxCreditInsights,
  avgTaxCreditPoints,
} = require('../../services/expectedTaxCreditsService');

describe('expectedTaxCreditsService', () => {
  it('includes development zone credit for Dimona', () => {
    const result = buildExpectedTaxCredits({
      personal: {
        gender: 'male',
        residenceCity: 'דימונה',
        childrenCount: 0,
        educationLevel: 'none',
      },
    });

    const dev = result.breakdown.find(b => b.id === 'development_zone');
    expect(dev).toBeDefined();
    expect(dev.points).toBe(1);
    expect(result.totalPoints).toBeGreaterThanOrEqual(3.25);
  });

  it('adds children, degree and female credits', () => {
    const result = buildExpectedTaxCredits({
      personal: {
        gender: 'female',
        childrenCount: 2,
        childrenAges: [3, 10],
        educationLevel: 'first_degree',
        residenceCity: 'תל אביב-יפו',
      },
    });

    expect(result.breakdown.some(b => b.id === 'female')).toBe(true);
    expect(result.breakdown.some(b => b.id === 'first_degree')).toBe(true);
    expect(result.breakdown.filter(b => b.id.startsWith('child_'))).toHaveLength(2);
    expect(result.totalPoints).toBeGreaterThan(5);
  });

  it('detects tax credit gap and suggests savings', () => {
    const profile = {
      personal: {
        gender: 'male',
        residenceCity: 'דימונה',
        childrenCount: 1,
        educationLevel: 'first_degree',
      },
      employment: { employmentType: 'employee' },
    };
    const enriched = [
      { taxCreditPoints: 2.25, tax: 2000 },
      { taxCreditPoints: 2.25, tax: 2100 },
    ];

    const { insights, gap } = buildTaxCreditInsights(profile, enriched);
    expect(gap).toBeGreaterThanOrEqual(1);
    expect(insights.some(i => i.id === 'tax_credit_gap')).toBe(true);
    expect(insights.some(i => i.id === 'tax_credit_development_zone')).toBe(true);
  });

  it('averages tax credit points from payslips', () => {
    expect(avgTaxCreditPoints([
      { taxCreditPoints: 2 },
      { taxCreditPoints: 4 },
    ])).toBe(3);
  });
});
