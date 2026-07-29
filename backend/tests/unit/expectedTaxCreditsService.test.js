const {
  buildExpectedTaxCredits,
  buildTaxCreditInsights,
  avgTaxCreditPoints,
} = require('../../services/expectedTaxCreditsService');
const {
  computeLocalityIncomeCredit,
  lookupQualifyingLocality,
} = require('../../services/qualifyingLocalitiesTaxCredit');

describe('expectedTaxCreditsService', () => {
  it('includes locality income credit for Dimona (percent + cap, not points)', () => {
    const result = buildExpectedTaxCredits({
      personal: {
        gender: 'male',
        residenceCity: 'דימונה',
        childrenCount: 0,
        educationLevel: 'none',
      },
    }, { annualWorkIncome: 240000 });

    const loc = result.breakdown.find(b => b.id === 'locality_income_credit');
    expect(loc).toBeDefined();
    expect(loc.points).toBe(0);
    // 18% of min(240000, 245400) = 18% of 240000
    expect(loc.annualCreditIls).toBe(Math.round(240000 * 0.18));
    expect(result.localityIncomeCredit.eligible).toBe(true);
    expect(result.totalPoints).toBe(2.25);
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
    expect(result.localityIncomeCredit.eligible).toBe(false);
  });

  it('detects tax credit gap and locality income insight', () => {
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
      { taxCreditPoints: 2.25, tax: 2000, grossSalary: 20000 },
      { taxCreditPoints: 2.25, tax: 2100, grossSalary: 20000 },
    ];

    const { insights, gap } = buildTaxCreditInsights(profile, enriched);
    expect(gap).toBeGreaterThanOrEqual(1);
    expect(insights.some(i => i.id === 'tax_credit_gap')).toBe(true);
    expect(insights.some(i => i.id === 'tax_credit_locality_income')).toBe(true);
  });

  it('averages tax credit points from payslips', () => {
    expect(avgTaxCreditPoints([
      { taxCreditPoints: 2 },
      { taxCreditPoints: 4 },
    ])).toBe(3);
  });
});

describe('qualifyingLocalitiesTaxCredit', () => {
  it('looks up Sderot at 20% / 267840', () => {
    const row = lookupQualifyingLocality('שדרות');
    expect(row).toMatchObject({ creditPercent: 20, annualIncomeCap: 267840 });
  });

  it('caps credit at annual income cap when income is higher', () => {
    // Example from booklet: 11% of 168000 = 18480
    const result = computeLocalityIncomeCredit('דימונה', 300000);
    expect(result.eligible).toBe(true);
    expect(result.annualCredit).toBe(Math.round(245400 * 0.18));
  });

  it('uses income when below cap', () => {
    const result = computeLocalityIncomeCredit('דימונה', 100000);
    expect(result.annualCredit).toBe(Math.round(100000 * 0.18));
  });
});
