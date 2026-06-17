'use strict';

const { getPensionSummary, projectRetirementIncome, generatePensionRecommendations } = require('../ai/tools/pensionTools');
const { projectPensionIncome } = require('../ai/engines/calculationEngine');

/**
 * GET /api/pension/analysis
 */
async function getPensionAnalysis(req, res) {
  const userId = req.user._id;

  const summary = await getPensionSummary(userId);
  const projection = projectRetirementIncome(summary);
  const recommendations = generatePensionRecommendations(summary, projection);

  return res.json({
    success: true,
    data: {
      summary,
      projection: projection.available ? projection : null,
      recommendations,
    },
  });
}

/**
 * POST /api/pension/simulate
 * Body: { retirementAge, additionalMonthlyContribution, targetMgmtFee }
 */
async function simulateScenario(req, res) {
  const userId = req.user._id;
  const { retirementAge, additionalMonthlyContribution = 0, targetMgmtFee } = req.body || {};

  const summary = await getPensionSummary(userId);

  if (!summary.hasData) {
    return res.status(400).json({ success: false, message: 'אין מספיק נתוני פנסיה לסימולציה' });
  }

  const simRetirementAge = Number(retirementAge) || summary.retirementAge;
  const simContribution = summary.totalMonthlyContribution + Number(additionalMonthlyContribution || 0);
  const simMgmtFee = targetMgmtFee != null ? Number(targetMgmtFee) : (summary.currentMgmtFee || 0.003);

  if (!summary.currentAge) {
    return res.status(400).json({ success: false, message: 'גיל לא מוגדר בפרופיל' });
  }

  const simResult = projectPensionIncome({
    currentAge: summary.currentAge,
    retirementAge: simRetirementAge,
    currentAccumulation: summary.currentAccumulation,
    monthlyContribution: simContribution,
    mgmtFeeAccumulation: simMgmtFee,
  });

  // Baseline for comparison
  const baseResult = projectPensionIncome({
    currentAge: summary.currentAge,
    retirementAge: summary.retirementAge,
    currentAccumulation: summary.currentAccumulation,
    monthlyContribution: summary.totalMonthlyContribution,
    mgmtFeeAccumulation: summary.currentMgmtFee || 0.003,
  });

  return res.json({
    success: true,
    data: {
      simulation: {
        retirementAge: simRetirementAge,
        additionalMonthlyContribution: Number(additionalMonthlyContribution || 0),
        targetMgmtFee: simMgmtFee,
        projectedAccumulation: simResult.projectedAccumulation,
        monthlyPensionEstimate: simResult.monthlyPensionEstimate,
      },
      baseline: {
        retirementAge: summary.retirementAge,
        projectedAccumulation: baseResult.projectedAccumulation,
        monthlyPensionEstimate: baseResult.monthlyPensionEstimate,
      },
      delta: {
        accumulationDiff: simResult.projectedAccumulation - baseResult.projectedAccumulation,
        monthlyPensionDiff: simResult.monthlyPensionEstimate - baseResult.monthlyPensionEstimate,
      },
    },
  });
}

module.exports = { getPensionAnalysis, simulateScenario };
