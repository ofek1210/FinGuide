'use strict';

const {
  buildInsuranceDecision,
  computeCoverageCompleteness,
  STATUS,
} = require('../../services/insurance/insuranceDecisionEngine');
const { analyzeCoverageGaps } = require('../../services/insurance/insuranceCoverageGapService');
const { runInsuranceHealthCheck } = require('../../services/insuranceHealthCheckService');

describe('insuranceDecisionEngine', () => {
  it('marks healthy portfolio with high score when no issues', () => {
    const analysis = {
      duplicates: [],
      duplicateFindings: [],
      duplicateCount: 0,
      gapFindings: [],
      needAssessments: [
        { type: 'travel', status: 'not_recommended', needed: false, titleHe: 'נסיעות', messageHe: 'אין צורך' },
      ],
      missingCoverage: [],
    };
    const marketAdvice = {
      comparisonMatrix: [{
        policyId: '1',
        type: 'בריאות',
        provider: 'מגדל',
        serviceScore: 88,
        claimPaymentRate: 90,
        satisfactionScore: 85,
        serviceTier: 'excellent',
      }],
      companyQuality: { averageServiceIndex: 88, averageServiceTier: 'excellent' },
      portfolioOverview: { policyCount: 1, activeCount: 1, inactiveCount: 0, companies: ['מגדל'], policyTypes: [] },
    };
    const decision = buildInsuranceDecision(
      { personal: { maritalStatus: 'single', childrenCount: 0 } },
      analysis,
      marketAdvice,
      { policies: [{ id: '1', type: 'health', provider: 'מגדל', policyNumber: 'A1', coverageAmount: 100000, status: 'active', startDate: '2024-01-01' }] },
    );

    expect(decision.status).toBe(STATUS.HEALTHY);
    expect(decision.healthScore).toBeGreaterThanOrEqual(85);
    expect(decision.executiveActions.length).toBeLessThanOrEqual(5);
    expect(decision.quickAnswers.hasDuplicates.value).toBe(false);
  });

  it('requires action for high-confidence coverage gap and poor service', () => {
    const analysis = {
      duplicates: [],
      duplicateFindings: [],
      duplicateCount: 0,
      gapFindings: [{
        type: 'life',
        status: 'missing_needed',
        messageHe: 'חסר ביטוח חיים',
        confidence: 'high',
      }],
      needAssessments: [],
      missingCoverage: ['life'],
    };
    const marketAdvice = {
      comparisonMatrix: [{
        policyId: '2',
        type: 'בריאות',
        provider: 'X',
        serviceScore: 55,
        serviceTier: 'poor',
        claimPaymentRate: 60,
        satisfactionScore: 50,
      }],
      companyQuality: { averageServiceIndex: 55, averageServiceTier: 'poor' },
    };
    const decision = buildInsuranceDecision({}, analysis, marketAdvice, {
      policies: [{ id: '2', type: 'health', provider: 'X', status: 'active' }],
    });

    expect(decision.status).toBe(STATUS.ACTION_REQUIRED);
    expect(decision.executiveActions.length).toBeGreaterThan(0);
    expect(decision.executiveActions.length).toBeLessThanOrEqual(5);
    expect(decision.healthScore).toBeLessThan(75);
  });

  it('computes coverage completeness confidence from available fields', () => {
    const full = computeCoverageCompleteness({
      id: 'p1',
      type: 'life',
      provider: 'הראל',
      policyNumber: '99',
      coverageAmount: 500000,
      status: 'active',
      startDate: '2023-01-01',
    });
    expect(full.coverageConfidence).toBe('high');
    expect(full.completenessScore).toBeGreaterThanOrEqual(85);

    const thin = computeCoverageCompleteness({
      id: 'p2',
      type: 'health',
      status: 'active',
    });
    expect(thin.coverageConfidence).toBe('low');
    expect(thin.manualReviewRecommended).toBe(true);
  });
});

describe('profile-aware gaps for decision engine', () => {
  it('does not recommend building insurance for renters; may note contents', () => {
    const result = analyzeCoverageGaps({
      personal: {},
      assets: { ownsApartment: false },
      insurance: {},
    }, []);
    expect(result.missingTypes).not.toContain('apartment');
    expect(result.needAssessments.some(a => a.type === 'apartment' && a.status === 'not_recommended')).toBe(true);
    expect(result.needAssessments.some(a => a.type === 'contents' && a.status === 'optional_renter')).toBe(true);
  });

  it('recommends travel only when frequent travel signal exists', () => {
    const cold = analyzeCoverageGaps({ frequentTravel: false }, []);
    expect(cold.needAssessments.find(a => a.type === 'travel')?.status).toBe('not_recommended');

    const warm = analyzeCoverageGaps({ frequentTravel: true }, []);
    expect(warm.needAssessments.find(a => a.type === 'travel')?.status).toBe('recommended');
  });
});

describe('insuranceHealthCheckService (decision-backed)', () => {
  it('returns numeric score from decision engine', () => {
    const health = runInsuranceHealthCheck(
      { policies: [{ id: '1', type: 'health', provider: 'מגדל', status: 'active', policyNumber: '1', coverageAmount: 1, startDate: '2024-01-01' }] },
      {
        duplicates: [],
        duplicateFindings: [],
        duplicateCount: 0,
        gapFindings: [],
        needAssessments: [],
        policies: [{ id: '1', type: 'health', provider: 'מגדל', status: 'active', policyNumber: '1', coverageAmount: 1, startDate: '2024-01-01' }],
      },
      {
        comparisonMatrix: [{ policyId: '1', type: 'health', provider: 'מגדל', serviceScore: 86, serviceTier: 'excellent' }],
        companyQuality: { averageServiceIndex: 86, averageServiceTier: 'excellent' },
      },
    );
    expect(health.scoreDisabled).toBe(false);
    expect(typeof health.score).toBe('number');
    expect(health.categories.length).toBeGreaterThan(0);
  });
});
