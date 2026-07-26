'use strict';

const {
  aggregatePoliciesByPolicyNumber,
  analyzeAggregatedInsurance,
} = require('../../services/insurancePolicyAggregationService');
const { analyzeDuplicateCoverage } = require('../../services/insurance/insuranceDuplicateEvidenceService');
const { normalizeInsurancePolicies } = require('../../services/insurance/insurancePolicyNormalizationService');
const { classifyCoverageFamilies, COVERAGE_FAMILIES } = require('../../services/insurance/insuranceCoverageTaxonomy');
const { analyzeCoverageGaps } = require('../../services/insurance/insuranceCoverageGapService');
const { HAR_BITUACH_REGRESSION_ROWS } = require('../fixtures/harBituachRegressionReport');

describe('insurance duplicate evidence (regression report)', () => {
  const aggregated = aggregatePoliciesByPolicyNumber(HAR_BITUACH_REGRESSION_ROWS);
  const normalized = normalizeInsurancePolicies(aggregated);
  const analysis = analyzeAggregatedInsurance(HAR_BITUACH_REGRESSION_ROWS);

  it('aggregates same policy-number riders into one policy (Shlomo, IDI, group life)', () => {
    const shlomo = aggregated.find(p => p.policyNumber === 'SH-1001');
    const idi = aggregated.find(p => p.policyNumber === 'IDI-2001');
    const groupLife = aggregated.find(p => p.policyNumber === 'L-GRP');
    expect(shlomo?.riderCount).toBe(2);
    expect(idi?.riderCount).toBe(3);
    expect(groupLife?.riderCount).toBe(2);
  });

  it('does not treat compulsory + comprehensive as duplicates', () => {
    const carFamilyDupes = analysis.duplicates.filter(d =>
      d.type === COVERAGE_FAMILIES.VEHICLE_COMPULSORY
      || d.type === COVERAGE_FAMILIES.VEHICLE_COMPREHENSIVE
      || d.type === 'car',
    );
    expect(carFamilyDupes).toHaveLength(0);
  });

  it('does not calculate vehicle savings (no verified waste)', () => {
    expect(analysis.totalMonthlyWaste).toBe(0);
    expect(analysis.verifiedSavingMonthly).toBe(0);
    analysis.duplicates.forEach(d => {
      expect(d.estimatedMonthlyWaste).toBeNull();
      expect(d.verifiedSavingMonthly).toBeNull();
    });
  });

  it('groups ~3 vehicle packages and requests vehicle count when unknown', () => {
    expect(analysis.vehiclePackages.length).toBe(3);
    expect(analysis.vehicleVerificationNeeded).toBe(true);
    const vehicleFinding = analysis.duplicates.find(d => d.type === 'vehicle_packages');
    expect(vehicleFinding?.reasonHe).toMatch(/כמה רכבים/);
  });

  it('does not mark multiple vehicles as duplicate when vehiclesOwned matches packages', () => {
    const withCount = analyzeAggregatedInsurance(HAR_BITUACH_REGRESSION_ROWS, { vehiclesOwned: 3 });
    expect(withCount.vehicleVerificationNeeded).toBe(false);
    const vehicleFinding = withCount.duplicateFindings.find(d => d.coverageFamily === 'vehicle_packages');
    expect(vehicleFinding?.status).toBe('no_duplicate_indication');
  });

  it('separates long-term care from personal accident taxonomy', () => {
    const ltc = normalized.find(p => p.policyNumber === 'LT-01');
    const pa = normalized.find(p => p.policyNumber === 'PA-01');
    expect(ltc.productTypes).toContain(COVERAGE_FAMILIES.LONG_TERM_CARE);
    expect(pa.productTypes).toContain(COVERAGE_FAMILIES.PERSONAL_ACCIDENT);
    expect(ltc.productTypes).not.toContain(COVERAGE_FAMILIES.PERSONAL_ACCIDENT);
  });

  it('marks two personal-accident policies as possible overlap only', () => {
    const paOverlap = analysis.duplicates.find(d => d.type === COVERAGE_FAMILIES.PERSONAL_ACCIDENT);
    expect(paOverlap).toBeTruthy();
    expect(paOverlap.status).toBe('possible_overlap');
    expect(paOverlap.estimatedMonthlyWaste).toBeNull();
    expect(paOverlap.reasonHe).toMatch(/חפיפה אפשרית/);
  });

  it('does not treat LTC, medical service and package as generic health duplicates', () => {
    const healthBroad = analysis.duplicates.filter(d => d.type === 'health');
    expect(healthBroad).toHaveLength(0);
  });

  it('does not auto-duplicate group and individual life', () => {
    const lifeOverlap = analysis.duplicates.find(d => d.type === COVERAGE_FAMILIES.LIFE_DEATH);
    expect(lifeOverlap?.status).toBe('insufficient_data');
    expect(lifeOverlap?.estimatedMonthlyWaste).toBeNull();
  });

  it('never assigns verified savings without validated overlap', () => {
    const result = analyzeDuplicateCoverage(normalized, { vehiclesOwned: null });
    expect(result.verifiedSavingMonthly).toBe(0);
    result.duplicateFindings.forEach(f => {
      expect(f.verifiedSavingMonthly).toBeNull();
    });
  });

  it('checks pension before labeling disability missing', () => {
    const gapNoPension = analyzeCoverageGaps({}, aggregated, { pensionFunds: [] });
    expect(gapNoPension.gapFindings.some(g => g.type === 'disability')).toBe(true);
    expect(gapNoPension.missingTypes).not.toContain('disability');

    const gapWithPension = analyzeCoverageGaps({}, aggregated, {
      pensionFunds: [{ insuranceCoverages: [{ coverageType: 'disability' }] }],
    });
    expect(gapWithPension.gapFindings.some(g => g.type === 'disability')).toBe(false);
  });
});

describe('insuranceCoverageTaxonomy', () => {
  it('classifies compulsory and comprehensive separately', () => {
    const compulsory = classifyCoverageFamilies(
      { type: 'car', rawData: { subBranch: 'ביטוח חובה' } },
      'ביטוח חובה',
    );
    const comprehensive = classifyCoverageFamilies(
      { type: 'car', rawData: { subBranch: 'ביטוח מקיף' } },
      'ביטוח מקיף',
    );
    expect(compulsory).toContain(COVERAGE_FAMILIES.VEHICLE_COMPULSORY);
    expect(comprehensive).toContain(COVERAGE_FAMILIES.VEHICLE_COMPREHENSIVE);
  });
});

describe('insuranceMarketAdvisorService premium gating', () => {
  const { hasComparablePremiumFactors } = require('../../services/insuranceMarketAdvisorService');

  it('does not treat broad category average as strong conclusion without factors', () => {
    const comparable = hasComparablePremiumFactors(
      { type: 'car', monthlyPremium: 500, rawData: { subBranch: 'ביטוח חובה' } },
      { personal: { age: 35 } },
    );
    expect(comparable).toBe(false);
  });
});

describe('insurancePolicyAggregationService (updated)', () => {
  it('aggregates 4 Har HaBituach rows with same policy number into 1 policy', () => {
    const rows = [
      { provider: 'הראל', policyNumber: '513826409', type: 'health', monthlyPremium: 120,
        rawData: { subBranch: 'תרופות מחוץ לסל' }, status: 'active' },
      { provider: 'הראל', policyNumber: '513826409', type: 'health', monthlyPremium: 80,
        rawData: { subBranch: 'השתלות' }, status: 'active' },
      { provider: 'הראל', policyNumber: '513826409', type: 'health', monthlyPremium: 95,
        rawData: { subBranch: 'ניתוחים בחו"ל' }, status: 'active' },
      { provider: 'הראל', policyNumber: '513826409', type: 'health', monthlyPremium: 55,
        rawData: { subBranch: 'מחלות קשות' }, status: 'active' },
    ];

    const result = analyzeAggregatedInsurance(rows);
    expect(result.aggregatedPolicies).toHaveLength(1);
    expect(result.duplicateCount).toBe(0);
    expect(result.totalMonthlyWaste).toBe(0);
  });

  it('flags possible overlap for same family across companies without waste calc', () => {
    const policies = [
      { id: 'a', provider: 'הראל', policyNumber: '111', type: 'health', monthlyPremium: 180,
        rawData: { subBranch: 'תאונות אישיות' }, status: 'active' },
      { id: 'b', provider: 'כלל', policyNumber: '222', type: 'health', monthlyPremium: 220,
        rawData: { subBranch: 'תאונה אישית' }, status: 'active' },
    ];

    const result = analyzeAggregatedInsurance(policies);
    expect(result.totalMonthlyWaste).toBe(0);
    const pa = result.duplicates.find(d => d.type === COVERAGE_FAMILIES.PERSONAL_ACCIDENT);
    expect(pa?.status).toBe('possible_overlap');
    expect(pa?.estimatedMonthlyWaste).toBeNull();
  });
});
