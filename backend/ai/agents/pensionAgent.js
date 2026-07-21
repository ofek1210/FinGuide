/**
 * Pension Agent
 *
 * Pipeline: buildPensionAnalysis → shared LLM insight formatter (deterministic fallback)
 */

const { buildPensionAnalysis } = require('../../services/pensionAnalysisService');

/**
 * @param {string} userId
 * @param {object} [options]
 * @param {boolean} [options.skipLLM=false]
 * @returns {Promise<PensionAgentResult>}
 */
async function runPensionAgent(userId, { skipLLM = false } = {}) {
  const startedAt = Date.now();

  const analysis = await buildPensionAnalysis(userId, { skipLLM });
  const { summary, projection, benchmark, healthCheck, recommendations, fundAdvice, llm, primaryRecommendations } = analysis;

  if (!summary.hasData) {
    return {
      agentId: 'pension',
      status: 'no_data',
      message: 'לא נמצאו נתוני פנסיה. העלה תלוש שכר או דוח הר הכסף.',
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
    agentId: 'pension',
    status: 'success',
    data: {
      grossSalary: summary.grossSalary,
      pensionEmployee: summary.pensionEmployee,
      pensionEmployer: summary.pensionEmployer,
      totalMonthlyContribution: summary.totalMonthlyContribution,
      benchmark: benchmark?.summary ?? null,
      healthCheck: healthCheck ? { score: healthCheck.score, level: healthCheck.level } : null,
      projection: projection ? {
        monthsToRetirement: projection.monthsToRetirement,
        projectedAccumulation: projection.projectedAccumulation,
        monthlyPensionEstimate: projection.monthlyPensionEstimate,
        replacementRatio: projection.replacementRatio,
        scenarios: projection.scenarios,
        mgmtFeeSavings: projection.mgmtFeeSavings,
      } : null,
      fundAdvice: fundAdvice?.hasData
        ? {
          overallVerdict: fundAdvice.overallVerdict,
          overallVerdictLabelHe: fundAdvice.overallVerdictLabelHe,
          dataSource: fundAdvice.dataSource,
          funds: fundAdvice.funds?.map(f => ({
            fundName: f.fundName,
            verdict: f.verdict,
            verdictLabelHe: f.verdictLabelHe,
            gainIfSwitch: f.financialImpact?.gainIfSwitch,
            returnPercentile: f.marketComparison?.returnPercentile,
          })),
        }
        : null,
      marketData: analysis.marketData ?? null,
      dataQuality: analysis.dataQuality ?? null,
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

module.exports = { runPensionAgent };
