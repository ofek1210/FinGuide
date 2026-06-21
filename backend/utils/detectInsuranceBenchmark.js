/**
 * Insurance benchmark findings for GET /api/findings.
 */
'use strict';

const { buildInsuranceAnalysis } = require('../services/insuranceAnalysisService');
const {
  buildDomainBenchmarkFindings,
  buildDomainBenchmarkFindingsForUser,
} = require('./domainBenchmarkFindings');

const INSURANCE_CONFIG = {
  hasData: analysis => Boolean(analysis?.summary?.hasData || analysis?.hasImportedPolicies),
  healthLow: {
    id: 'insurance_health_low',
    title: 'ציון בריאות ביטוח נמוך',
    findingKind: 'insurance_health_low',
  },
  extraFindings: analysis => {
    const coverage = analysis.analysis;
    if (!coverage?.duplicateCount) return [];
    return [{
      id: 'insurance_duplicates',
      title: 'כפילויות ביטוח שזוהו',
      severity: 'warning',
      details: `זוהו ${coverage.duplicateCount} כפילויות — בזבוז חודשי משוער ₪${Math.round(coverage.totalMonthlyWaste || 0).toLocaleString('he-IL')}.`,
      meta: {
        findingKind: 'insurance_duplicate',
        duplicateCount: coverage.duplicateCount,
      },
    }];
  },
  fromRecommendations: {
    filter: rec => rec.type === 'duplicate_insurance' || rec.type.startsWith('missing_'),
    kindMap: { duplicate_insurance: 'insurance_duplicate' },
    defaultKind: 'insurance_missing_coverage',
  },
};

function buildInsuranceBenchmarkFindings(analysis) {
  return buildDomainBenchmarkFindings(analysis, INSURANCE_CONFIG);
}

function buildInsuranceBenchmarkFindingsForUser(userId) {
  return buildDomainBenchmarkFindingsForUser(userId, buildInsuranceAnalysis, INSURANCE_CONFIG);
}

module.exports = { buildInsuranceBenchmarkFindings, buildInsuranceBenchmarkFindingsForUser };
