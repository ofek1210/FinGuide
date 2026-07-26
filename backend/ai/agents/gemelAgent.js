/**
 * Gemel Agent — קופות גמל וקרנות השתלמות
 *
 * Pipeline: buildGemelAnalysis → shared LLM insight formatter (deterministic fallback)
 */

const { buildGemelAnalysis } = require('../../services/gemelAnalysisService');
const { buildGemelAdvisorReport } = require('../../services/gemelAdvisor/gemelAdvisorService');

/**
 * @param {string} userId
 * @param {object} [options]
 * @param {boolean} [options.skipLLM=false]
 * @returns {Promise<GemelAgentResult>}
 */
async function runGemelAgent(userId, { skipLLM = false } = {}) {
  const startedAt = Date.now();

  const analysis = await buildGemelAnalysis(userId, { skipLLM });
  const advisorReport = await buildGemelAdvisorReport(userId, { skipLLM }).catch(() => null);
  const { summary, marketAdvice, payslipFindings, recommendations, llm, primaryRecommendations } = analysis;

  if (!summary.hasData && !advisorReport?.accounts?.length) {
    return {
      agentId: 'gemel',
      status: 'no_data',
      message: 'לא נמצאו נתוני גמל או השתלמות. העלה תלוש שכר או דוח הר הכסף.',
      data: null,
      recommendations: [],
      structuredInsights: [],
      primaryRecommendations: [],
      llmExplanation: null,
      llm: { used: false, provider: null, fallbackUsed: true },
      durationMs: Date.now() - startedAt,
    };
  }

  const llmExplanation = llm?.summary
    || (primaryRecommendations?.length
      ? primaryRecommendations.map(r => r.explanation).join(' ')
      : null);

  return {
    agentId: 'gemel',
    status: 'success',
    data: {
      grossSalary: summary.grossSalary,
      studyFundEmployee: summary.studyFundEmployee,
      studyFundEmployer: summary.studyFundEmployer,
      totalMonthlyContribution: summary.totalMonthlyContribution,
      totalBalance: summary.totalBalance,
      studyFundBalance: summary.studyFundBalance,
      providentBalance: summary.providentBalance,
      fundCount: summary.fundCount,
      studyFundCount: summary.studyFundCount,
      providentFundCount: summary.providentFundCount,
      hasStudyFund: summary.hasStudyFund,
      hasProvidentFund: summary.hasProvidentFund,
      declaredStudyFund: summary.declaredStudyFund,
      currentMgmtFee: summary.currentMgmtFee,
      salaryAboveCeiling: summary.salaryAboveCeiling,
      annualTaxFreeDeposit: summary.annualTaxFreeDeposit,
      marketAdvice: marketAdvice?.hasData
        ? {
          overallVerdict: marketAdvice.overallVerdict,
          overallVerdictLabelHe: marketAdvice.overallVerdictLabelHe,
          dataSource: marketAdvice.dataSource,
          sourceName: marketAdvice.sourceName,
          funds: marketAdvice.funds?.map(f => ({
            productName: f.productName,
            companyName: f.companyName,
            verdict: f.verdict,
            verdictLabelHe: f.verdictLabelHe,
            returnPercentile: f.returnPercentile,
            userFee: f.userFee,
            marketFee: f.marketFee,
            annualSavingsEstimate: f.annualSavingsEstimate,
            alternatives: f.alternatives,
            summaryHe: f.summaryHe,
          })),
        }
        : null,
      payslipFindings: payslipFindings.map(f => ({
        id: f.id,
        title: f.title,
        severity: f.severity,
        details: f.details,
        meta: f.meta ?? null,
      })),
      marketData: analysis.marketData ?? null,
      dataQuality: analysis.dataQuality ?? null,
      advisorReport: advisorReport ? {
        status: advisorReport.status,
        summary: advisorReport.summary,
        accounts: advisorReport.accounts,
        recommendations: advisorReport.recommendations,
        orchestrator: advisorReport.orchestrator,
      } : null,
    },
    recommendations,
    structuredInsights: analysis.structuredInsights ?? [],
    primaryRecommendations: primaryRecommendations ?? [],
    secondaryInsights: analysis.secondaryInsights ?? [],
    additionalInsights: analysis.additionalInsights ?? [],
    llmExplanation,
    llm: llm ?? { used: false, provider: null, fallbackUsed: true },
    analysisId: analysis.analysisId ?? null,
    durationMs: Date.now() - startedAt,
  };
}

module.exports = { runGemelAgent };
