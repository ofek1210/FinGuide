/**
 * Gemel Agent — קופות גמל וקרנות השתלמות
 *
 * Pipeline: buildGemelAnalysis → LLM explanation (mirrors pensionAgent.js)
 */

const { buildGemelAnalysis } = require('../../services/gemelAnalysisService');
const { buildGemelSystemPrompt } = require('../prompts/gemelPrompt');
const { askClaude } = require('../../services/claudeChatService');

/**
 * @param {string} userId
 * @param {object} [options]
 * @param {boolean} [options.skipLLM=false]
 * @returns {Promise<GemelAgentResult>}
 */
async function runGemelAgent(userId, { skipLLM = false } = {}) {
  const startedAt = Date.now();

  const analysis = await buildGemelAnalysis(userId);
  const { summary, marketAdvice, payslipFindings, recommendations } = analysis;

  if (!summary.hasData) {
    return {
      agentId: 'gemel',
      status: 'no_data',
      message: 'לא נמצאו נתוני גמל או השתלמות. העלה תלוש שכר או דוח הר הכסף.',
      data: null,
      recommendations: [],
      llmExplanation: null,
      durationMs: Date.now() - startedAt,
    };
  }

  let llmExplanation = null;
  if (!skipLLM && process.env.ANTHROPIC_API_KEY) {
    try {
      const systemPrompt = buildGemelSystemPrompt({
        summary: {
          grossSalary: summary.grossSalary,
          studyFundEmployee: summary.studyFundEmployee,
          studyFundEmployer: summary.studyFundEmployer,
          totalMonthlyContribution: summary.totalMonthlyContribution,
          totalBalance: summary.totalBalance,
          fundCount: summary.fundCount,
          hasStudyFund: summary.hasStudyFund,
          hasProvidentFund: summary.hasProvidentFund,
          currentMgmtFee: summary.currentMgmtFee,
        },
        marketAdvice: marketAdvice?.hasData
          ? {
            overallVerdict: marketAdvice.overallVerdict,
            funds: marketAdvice.funds?.map(f => ({
              productName: f.productName,
              verdict: f.verdict,
              userFee: f.userFee,
              marketFee: f.marketFee,
              returnPercentile: f.returnPercentile,
              annualSavingsEstimate: f.annualSavingsEstimate,
            })),
          }
          : null,
        findingsCount: payslipFindings.length,
        recommendationCount: recommendations.length,
      });
      const result = await askClaude(
        'ספק ניתוח קצר של הגמל וההשתלמות: השוואה מול גמל-נט, פסק דין (LEAVE/NEGOTIATE/SWITCH), והשפעה כספית — 4-5 משפטים בעברית.',
        systemPrompt,
        [],
      );
      llmExplanation = result?.answer || null;
    } catch {
      // Non-fatal
    }
  }

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
    },
    recommendations,
    llmExplanation,
    durationMs: Date.now() - startedAt,
  };
}

module.exports = { runGemelAgent };
