/**
 * Unified financial summary — single source for email, WhatsApp, reports, UI.
 */



const { buildPensionAnalysis } = require('./pensionAnalysisService');
const { buildInsuranceAnalysis } = require('./insuranceAnalysisService');
const { buildGemelAnalysis } = require('./gemelAnalysisService');
const { getPayslipInsights } = require('./payslipInsightsService');
const {
  toPensionSummary,
  toInsuranceSummary,
  toGemelSummary,
  toPayslipSummary,
  buildNarrativeHints,
} = require('../utils/domainSummaryMapper');

async function buildUnifiedSummary(userId) {
  const [pensionResult, insuranceResult, gemelResult, payslipResult] = await Promise.allSettled([
    buildPensionAnalysis(userId),
    buildInsuranceAnalysis(userId),
    buildGemelAnalysis(userId),
    getPayslipInsights(userId),
  ]);

  const pensionAnalysis = pensionResult.status === 'fulfilled' ? pensionResult.value : null;
  const insuranceAnalysis = insuranceResult.status === 'fulfilled' ? insuranceResult.value : null;
  const gemelAnalysis = gemelResult.status === 'fulfilled' ? gemelResult.value : null;
  const payslip = payslipResult.status === 'fulfilled' ? payslipResult.value : null;

  const pension = toPensionSummary(pensionAnalysis) || {
    healthScore: null,
    totalPotentialSavings: 0,
    topRecs: [],
    hasData: false,
  };
  const insurance = toInsuranceSummary(insuranceAnalysis) || {
    healthScore: null,
    duplicateCount: 0,
    totalMonthlyWaste: 0,
    topRecs: [],
    hasData: false,
  };
  const gemel = toGemelSummary(gemelAnalysis) || {
    totalBalance: 0,
    fundCount: 0,
    hasStudyFund: false,
    overallVerdictLabelHe: null,
    topRecs: [],
    hasData: false,
  };
  const payslipSummary = toPayslipSummary(payslip);
  const narrativeHints = buildNarrativeHints(pension, insurance, payslipSummary, gemel);

  return { pension, insurance, gemel, payslip: payslipSummary, narrativeHints };
}

module.exports = { buildUnifiedSummary };
