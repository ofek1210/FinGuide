'use strict';

const {
  runSalaryAnomalyRules,
  runPensionContributionRules,
  runPensionGapRules,
  runInsuranceDuplicateRules,
  runMissingCoverageRules,
  runDocumentCompletenessRules,
} = require('../ai/engines/ruleEngine');

// ΓöÇΓöÇ runSalaryAnomalyRules ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ

describe('runSalaryAnomalyRules', () => {
  test('returns no anomalies for normal salary', () => {
    const result = runSalaryAnomalyRules([{ grossSalary: 15000, netSalary: 11000 }]);
    expect(result.hasAnomalies).toBe(false);
    expect(result.anomalies).toEqual([]);
  });

  test('returns false for empty payslips array', () => {
    expect(runSalaryAnomalyRules([]).hasAnomalies).toBe(false);
    expect(runSalaryAnomalyRules(null).hasAnomalies).toBe(false);
  });
});

// ΓöÇΓöÇ runPensionContributionRules ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ

describe('runPensionContributionRules', () => {
  test('detects below minimum when rate is 5%', () => {
    const result = runPensionContributionRules(10000, 500); // 5% < 6%
    expect(result.belowMinimum).toBe(true);
    expect(result.rate).toBe(5);
    expect(result.minimumRate).toBe(6);
  });

  test('not below minimum when rate is exactly 6%', () => {
    const result = runPensionContributionRules(10000, 600);
    expect(result.belowMinimum).toBe(false);
    expect(result.rate).toBe(6);
  });

  test('not below minimum when rate is above 6%', () => {
    const result = runPensionContributionRules(18000, 1440); // 8%
    expect(result.belowMinimum).toBe(false);
  });

  test('returns safe defaults for missing values', () => {
    const result = runPensionContributionRules(null, null);
    expect(result.belowMinimum).toBe(false);
    expect(result.rate).toBeNull();
  });
});

// ΓöÇΓöÇ runPensionGapRules ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ

describe('runPensionGapRules', () => {
  test('returns hasPensionGap and missingRoles for null analysisData', () => {
    const result = runPensionGapRules(null);
    // fundSectionDetected will be false ΓåÆ no gap
    expect(result).toHaveProperty('hasPensionGap');
    expect(result).toHaveProperty('missingRoles');
    expect(result).toHaveProperty('fundSectionDetected');
    expect(Array.isArray(result.missingRoles)).toBe(true);
  });

  test('returns expected shape for analysisData with contributions', () => {
    const analysisData = {
      contributions: {
        pension_employee: { amount: 900 },
        pension_employer: { amount: 1500 },
      },
    };
    const result = runPensionGapRules(analysisData);
    expect(result).toHaveProperty('hasPensionGap');
    expect(result).toHaveProperty('missingRoles');
  });
});

// ΓöÇΓöÇ runInsuranceDuplicateRules ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ

describe('runInsuranceDuplicateRules', () => {
  test('detects duplicate life insurance policies', () => {
    const policies = [
      { type: 'life', monthlyPremium: 200, provider: '╫ö╫¿╫É╫£' },
      { type: 'life', monthlyPremium: 180, provider: '╫₧╫á╫ò╫¿╫ö' },
      { type: 'health', monthlyPremium: 150, provider: '╫₧╫¢╫æ╫Ö' },
    ];
    const result = runInsuranceDuplicateRules(policies);
    expect(result.duplicates.length).toBeGreaterThan(0);
    expect(result.duplicates[0].type).toBe('life');
    expect(result.totalWaste).toBeGreaterThan(0);
  });

  test('no duplicates for unique policy types', () => {
    const policies = [
      { type: 'life', monthlyPremium: 200 },
      { type: 'health', monthlyPremium: 150 },
      { type: 'disability', monthlyPremium: 300 },
    ];
    const result = runInsuranceDuplicateRules(policies);
    expect(result.duplicates).toEqual([]);
    expect(result.totalWaste).toBe(0);
  });

  test('returns empty for empty policies array', () => {
    const result = runInsuranceDuplicateRules([]);
    expect(result.duplicates).toEqual([]);
  });
});

// ΓöÇΓöÇ runMissingCoverageRules ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ

describe('runMissingCoverageRules', () => {
  test('detects missing disability insurance for employee', () => {
    const profile = {
      insurance: { hasDisabilityInsurance: false, hasLifeInsurance: true, hasHealthInsurance: true },
      personal: { maritalStatus: 'married', childrenCount: 2 },
      assets: { ownsApartment: true, ownsCar: true, hasMortgage: true },
    };
    const result = runMissingCoverageRules(profile, []);
    expect(result.missingTypes).toContain('disability');
  });

  test('no missing coverage for fully insured person', () => {
    const profile = {
      insurance: {
        hasLifeInsurance: true,
        hasHealthInsurance: true,
        hasDisabilityInsurance: true,
        hasApartmentInsurance: true,
        hasCarInsurance: true,
      },
      personal: { maritalStatus: 'married', childrenCount: 2 },
      assets: { ownsApartment: true, ownsCar: true, hasMortgage: true },
    };
    const result = runMissingCoverageRules(profile, []);
    expect(result.missingTypes).toEqual([]);
    expect(result.urgency).toBe('low');
  });
});

// ΓöÇΓöÇ runDocumentCompletenessRules ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ

describe('runDocumentCompletenessRules', () => {
  test('returns high completeness score when payslip uploaded', () => {
    const result = runDocumentCompletenessRules(['payslip']);
    expect(result.missingRequired).toEqual([]);
    expect(result.completenessScore).toBeGreaterThan(0);
  });

  test('marks payslip as missing required when not uploaded', () => {
    const result = runDocumentCompletenessRules([]);
    expect(result.missingRequired).toContain('payslip');
    expect(result.completenessScore).toBe(0);
  });

  test('full score when all categories uploaded', () => {
    const result = runDocumentCompletenessRules(['payslip', 'pension', 'insurance']);
    expect(result.missingCategories).toEqual([]);
    expect(result.completenessScore).toBe(100);
  });
});
