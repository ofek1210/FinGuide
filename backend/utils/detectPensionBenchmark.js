/**
 * Pension benchmark findings for GET /api/findings.
 */



const { buildPensionAnalysis } = require('../services/pensionAnalysisService');
const {
  buildDomainBenchmarkFindings,
  buildDomainBenchmarkFindingsForUser,
} = require('./domainBenchmarkFindings');

const PENSION_CONFIG = {
  hasData: analysis => Boolean(analysis?.summary?.hasData),
  healthLow: {
    id: 'pension_health_low',
    title: 'ציון בריאות פנסיונית נמוך',
    findingKind: 'pension_health_low',
  },
  fromRecommendations: {
    filter: rec => ['fee_above_market', 'risk_wrong_for_age', 'track_underperforming'].includes(rec.type),
    kindMap: {
      fee_above_market: 'fee_above_market',
      risk_wrong_for_age: 'risk_wrong_for_age',
      track_underperforming: 'track_underperforming',
    },
    meta: analysis => ({ currentAge: analysis.summary?.currentAge ?? null }),
  },
};

function buildPensionBenchmarkFindings(analysis) {
  return buildDomainBenchmarkFindings(analysis, PENSION_CONFIG);
}

function buildPensionBenchmarkFindingsForUser(userId) {
  return buildDomainBenchmarkFindingsForUser(userId, buildPensionAnalysis, PENSION_CONFIG);
}

module.exports = { buildPensionBenchmarkFindings, buildPensionBenchmarkFindingsForUser };
