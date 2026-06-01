const { evaluateRules } = require('../../services/insuranceRecommender');
const { getPriceRange } = require('../../services/insurancePricingTables');

function makeProfile(overrides = {}) {
  return {
    personal: { age: 35, childrenCount: 0, maritalStatus: 'single', ...overrides.personal },
    assets: { ownsApartment: false, ownsCar: false, hasMortgage: false, ...overrides.assets },
    insurance: {
      hasLifeInsurance: false,
      hasHealthInsurance: false,
      hasDisabilityInsurance: false,
      hasApartmentInsurance: false,
      hasCarInsurance: false,
      ...overrides.insurance,
    },
    employment: {
      isPrimaryJob: true,
      expectedMonthlyGross: 18000,
      ...overrides.employment,
    },
    retirement: { hasPension: true, hasStudyFund: true, ...overrides.retirement },
  };
}

describe('insuranceRecommender', () => {
  it('recommends life insurance when children and no coverage', async () => {
    const drafts = await evaluateRules(
      makeProfile({ personal: { age: 32, childrenCount: 2 } }),
    );
    expect(drafts.some(d => d.kind === 'life')).toBe(true);
    expect(drafts.find(d => d.kind === 'life').importance).toMatch(/critical|high/);
  });

  it('recommends apartment insurance when owns apartment without coverage', async () => {
    const drafts = await evaluateRules(
      makeProfile({ assets: { ownsApartment: true, hasMortgage: false } }),
    );
    expect(drafts.some(d => d.kind === 'apartment')).toBe(true);
    expect(drafts.find(d => d.kind === 'apartment').importance).toBe('critical');
  });

  it('recommends car insurance when owns car without coverage', async () => {
    const drafts = await evaluateRules(makeProfile({ assets: { ownsCar: true } }));
    expect(drafts.some(d => d.kind === 'car')).toBe(true);
  });

  it('recommends disability for primary job under 60', async () => {
    const drafts = await evaluateRules(makeProfile({ personal: { age: 40 } }));
    expect(drafts.some(d => d.kind === 'disability')).toBe(true);
  });

  it('recommends health insurance for age over 30', async () => {
    const drafts = await evaluateRules(makeProfile({ personal: { age: 35 } }));
    expect(drafts.some(d => d.kind === 'health')).toBe(true);
  });

  it('recommends pension increase when low pension insight flag set', async () => {
    const drafts = await evaluateRules(makeProfile(), { hasLowPensionInsight: true });
    expect(drafts.some(d => d.kind === 'pension_increase')).toBe(true);
  });

  it('returns no recommendations when fully covered', async () => {
    const drafts = await evaluateRules(
      makeProfile({
        personal: { age: 25, childrenCount: 0 },
        insurance: {
          hasLifeInsurance: true,
          hasHealthInsurance: true,
          hasDisabilityInsurance: true,
          hasApartmentInsurance: true,
          hasCarInsurance: true,
        },
      }),
    );
    expect(drafts).toHaveLength(0);
  });
});

describe('insurancePricingTables', () => {
  it('scales prices by age', () => {
    const young = getPriceRange('life', { age: 25, grossMonthly: 15000 });
    const older = getPriceRange('life', { age: 55, grossMonthly: 15000 });
    expect(older.average).toBeGreaterThan(young.average);
  });
});
