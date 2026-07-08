/**
 * Payslip Agent
 *
 * Runs the full payslip analysis pipeline:
 *   Tool (getPayslipSummaries) → Tool (analyzeSalary) → Tool (generateRecommendations) → LLM explanation
 *
 * Returns a structured DTO — never raw documents.
 */



const { getPayslipSummaries, analyzeSalary, generatePayslipRecommendations } = require('../tools/payslipTools');
const { buildPayslipGovBenchmarkRecommendations } = require('../../services/payslipGovBenchmarkService');
const { buildPayslipSystemPrompt } = require('../prompts/payslipPrompt');
const { askClaude } = require('../../services/claudeChatService');

/**
 * @param {string} userId
 * @param {object} [options]
 * @param {boolean} [options.skipLLM=false] - skip LLM for tests / rule-only mode
 * @returns {Promise<PayslipAgentResult>}
 */
async function runPayslipAgent(userId, { skipLLM = false } = {}) {
  const startedAt = Date.now();

  // Step 1: Fetch data via tools
  const payslipData = await getPayslipSummaries(userId);

  if (payslipData.count === 0) {
    return {
      agentId: 'payslip',
      status: 'no_data',
      message: 'לא נמצאו תלושי שכר מנותחים. העלה תלוש שכר כדי לקבל ניתוח.',
      data: null,
      recommendations: [],
      llmExplanation: null,
      durationMs: Date.now() - startedAt,
    };
  }

  // Step 2: Run analysis (rules + calculations)
  const analysis = analyzeSalary(payslipData.payslips);

  // Step 3: Generate rule-based recommendations
  const recommendations = generatePayslipRecommendations(analysis, payslipData.payslips);
  const govRecs = await buildPayslipGovBenchmarkRecommendations(userId);
  const mergedRecs = [...govRecs, ...recommendations];

  // Step 4: LLM explanation (optional)
  let llmExplanation = null;
  if (!skipLLM && process.env.ANTHROPIC_API_KEY) {
    try {
      const systemPrompt = buildPayslipSystemPrompt({
        count: payslipData.count,
        latest: payslipData.payslips[0],
        trend: analysis.trend,
        anomalies: analysis.anomalies,
        recommendationCount: recommendations.length,
      });
      const result = await askClaude(
        'ספק ניתוח קצר של תלושי השכר ב-3-4 משפטים בעברית.',
        systemPrompt,
        [],
      );
      llmExplanation = result?.answer || null;
    } catch {
      // Non-fatal — return without LLM
    }
  }

  return {
    agentId: 'payslip',
    status: 'success',
    data: {
      payslipCount: payslipData.count,
      latestPeriod: payslipData.latestPeriod,
      latestGross: analysis.latestGross,
      latestNet: analysis.latestNet,
      trend: analysis.trend,
      anomalies: analysis.anomalies,
    },
    recommendations: mergedRecs,
    llmExplanation,
    durationMs: Date.now() - startedAt,
  };
}

module.exports = { runPayslipAgent };
