'use strict';

const { MOCK_PENSION_ANALYSIS } = require('../ai/mock/mockData');
const { getPensionSummary, projectRetirementIncome, generatePensionRecommendations } = require('../ai/tools/pensionTools');
const { projectPensionIncome } = require('../ai/engines/calculationEngine');
const PensionFund = require('../models/PensionFund');

/**
 * GET /api/pension/analysis
 */
async function getPensionAnalysis(req, res) {
  if (req.query.demo === 'true') {
    return res.json({ success: true, data: MOCK_PENSION_ANALYSIS });
  }
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

/**
 * POST /api/pension/upload  — save manual pension fund entry
 * GET  /api/pension/funds   — list saved funds (when listMode=true)
 *
 * Body (POST): {
 *   fundName, fundType, provider,
 *   currentBalance, monthlyEmployeeDeposit, monthlyEmployerDeposit,
 *   managementFeeAccumulation, managementFeeDeposit
 * }
 */
async function uploadPensionData(req, res, listMode = false) {
  const userId = req.user._id;

  // GET mode: list existing funds
  if (req.method === 'GET' || listMode) {
    const funds = await PensionFund.find({ user: userId }).lean();
    return res.json({
      success: true,
      data: funds.map((f) => ({
        id: f._id,
        fundName: f.fundName,
        fundType: f.fundType,
        provider: f.provider,
        currentBalance: f.currentBalance,
        monthlyEmployeeDeposit: f.monthlyEmployeeDeposit,
        monthlyEmployerDeposit: f.monthlyEmployerDeposit,
        managementFeeAccumulation: f.managementFeeAccumulation,
        managementFeeDeposit: f.managementFeeDeposit,
        source: f.source,
      })),
    });
  }

  const {
    fundName,
    fundType = 'pension_comprehensive',
    provider = null,
    currentBalance = 0,
    monthlyEmployeeDeposit = 0,
    monthlyEmployerDeposit = 0,
    managementFeeAccumulation = 0.003,
    managementFeeDeposit = 0.001,
  } = req.body || {};

  if (!fundName || typeof fundName !== 'string' || !fundName.trim()) {
    return res.status(400).json({ success: false, message: 'שם הקרן נדרש' });
  }

  const validTypes = ['pension_comprehensive', 'pension_old', 'managers_insurance', 'provident_fund', 'study_fund', 'other'];
  if (!validTypes.includes(fundType)) {
    return res.status(400).json({ success: false, message: 'סוג קרן לא תקין' });
  }

  const fund = await PensionFund.findOneAndUpdate(
    { user: userId, fundName: fundName.trim() },
    {
      user: userId,
      fundName: fundName.trim(),
      fundType,
      provider: provider || null,
      currentBalance: Number(currentBalance) || 0,
      monthlyEmployeeDeposit: Number(monthlyEmployeeDeposit) || 0,
      monthlyEmployerDeposit: Number(monthlyEmployerDeposit) || 0,
      managementFeeAccumulation: Number(managementFeeAccumulation) || 0.003,
      managementFeeDeposit: Number(managementFeeDeposit) || 0.001,
      source: 'manual',
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );

  return res.json({
    success: true,
    message: 'נתוני הקרן נשמרו בהצלחה',
    data: {
      id: fund._id,
      fundName: fund.fundName,
      fundType: fund.fundType,
      provider: fund.provider,
      currentBalance: fund.currentBalance,
      monthlyEmployeeDeposit: fund.monthlyEmployeeDeposit,
      monthlyEmployerDeposit: fund.monthlyEmployerDeposit,
      managementFeeAccumulation: fund.managementFeeAccumulation,
      managementFeeDeposit: fund.managementFeeDeposit,
    },
  });
}

/**
 * DELETE /api/pension/funds/:id
 */
async function deletePensionFund(req, res) {
  const userId = req.user._id;
  const { id } = req.params;

  const fund = await PensionFund.findOneAndDelete({ _id: id, user: userId });
  if (!fund) {
    return res.status(404).json({ success: false, message: 'קרן לא נמצאה' });
  }

  return res.json({ success: true, message: 'הקרן נמחקה בהצלחה' });
}

module.exports = { getPensionAnalysis, simulateScenario, uploadPensionData, deletePensionFund };
