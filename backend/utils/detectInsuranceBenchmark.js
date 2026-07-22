/**
 * Insurance benchmark findings for GET /api/findings.
 */



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
    const premiumReview = coverage.premiumUnderReviewMonthly;
    return [{
      id: 'insurance_overlaps_review',
      title: 'כיסויים הדורשים בדיקה',
      severity: 'info',
      details: premiumReview
        ? `נמצאו ${coverage.duplicateCount} כיסויים לבדיקה — פרמיה חודשית לבדיקה: ₪${Math.round(premiumReview).toLocaleString('he-IL')}.`
        : `נמצאו ${coverage.duplicateCount} כיסויים הדורשים בדיקה — לא אושר חיסכון.`,
      meta: {
        findingKind: 'insurance_overlap_review',
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
