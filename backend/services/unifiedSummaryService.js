/**
 * Unified financial summary — single source for email, WhatsApp, reports, UI.
 */
'use strict';

const { buildPensionAnalysis } = require('./pensionAnalysisService');
const { buildInsuranceAnalysis } = require('./insuranceAnalysisService');
const { getPayslipInsights } = require('./payslipInsightsService');
const {
  toPensionSummary,
  toInsuranceSummary,
  toPayslipSummary,
  buildNarrativeHints,
} = require('../utils/domainSummaryMapper');

async function buildUnifiedSummary(userId) {
  const [pensionResult, insuranceResult, payslipResult] = await Promise.allSettled([
    buildPensionAnalysis(userId),
    buildInsuranceAnalysis(userId),
    getPayslipInsights(userId),
  ]);

  const pensionAnalysis = pensionResult.status === 'fulfilled' ? pensionResult.value : null;
  const insuranceAnalysis = insuranceResult.status === 'fulfilled' ? insuranceResult.value : null;
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
  const payslipSummary = toPayslipSummary(payslip);
  const narrativeHints = buildNarrativeHints(pension, insurance, payslipSummary);

  return { pension, insurance, payslip: payslipSummary, narrativeHints };
}

module.exports = { buildUnifiedSummary };
