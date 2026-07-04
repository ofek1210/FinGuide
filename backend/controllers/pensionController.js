'use strict';

const { MOCK_PENSION_ANALYSIS } = require('../ai/mock/mockData');
const { getPensionSummary, projectRetirementIncome } = require('../ai/tools/pensionTools');
const { projectPensionIncome } = require('../ai/engines/calculationEngine');
const { parseHarHaKesef } = require('../services/harHaKesefService');
const { buildPensionAnalysis } = require('../services/pensionAnalysisService');
const { buildFundAdvice } = require('../services/pensionFundAdvisorService');
const pensionFinqService = require('../services/PensionService');
const PensionFund = require('../models/PensionFund');
const { importPensionFile, syncProfileRetirement } = require('../services/pensionImportService');
const PensionImportSnapshot = require('../models/PensionImportSnapshot');
const path = require('path');

const SNAPSHOT_CAP = 5;

function mapPensionFundToDto(f, { idField = '_id' } = {}) {
  const id = f[idField] ?? f.id;
  return {
    id: id?.toString?.() ?? id,
    fundName: f.fundName,
    fundType: f.fundType,
    provider: f.provider,
    currentBalance: f.currentBalance,
    monthlyEmployeeDeposit: f.monthlyEmployeeDeposit,
    monthlyEmployerDeposit: f.monthlyEmployerDeposit,
    managementFeeAccumulation: f.managementFeeAccumulation,
    managementFeeDeposit: f.managementFeeDeposit,
    investmentTrack: f.investmentTrack,
    source: f.source,
    status: f.status,
    isActive: f.isActive,
  };
}

/**
 * GET /api/pension/analysis
 */
async function getPensionAnalysis(req, res) {
  if (req.query.demo === 'true') {
    return res.json({ success: true, data: MOCK_PENSION_ANALYSIS });
  }
  const data = await buildPensionAnalysis(req.user._id);
  return res.json({ success: true, data });
}

/**
 * GET /api/pension/import-history
 */
async function getImportHistory(req, res) {
  const snapshots = await PensionImportSnapshot.find({ user: req.user._id })
    .sort({ importedAt: -1 })
    .limit(SNAPSHOT_CAP)
    .lean();

  return res.json({
    success: true,
    data: snapshots.map(s => ({
      id: s._id.toString(),
      source: s.source,
      sourceFile: s.sourceFile,
      importedAt: s.importedAt,
      fundCount: s.fundCount,
      totalPotentialSavings: s.totalPotentialSavings,
      healthScore: s.healthScore,
      avgRankPercentile: s.avgRankPercentile,
      fundsAboveMarketFee: s.fundsAboveMarketFee,
    })),
  });
}

/**
 * POST /api/pension/simulate
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
 * POST /api/pension/upload-file
 */
async function uploadPensionFile(req, res) {
  if (!req.file) {
    return res.status(400).json({ success: false, message: 'לא קיבלנו קובץ' });
  }

  const userId = req.user._id;
  const ext = path.extname(req.file.originalname || '').toLowerCase();
  const importSource = req.query.importSource === 'quarterly_report' ? 'quarterly_report' : 'har_hakesef';

  let parsed;
  try {
    parsed = await parseHarHaKesef(req.file.buffer, {
      ext,
      originalName: req.file.originalname,
      importSource,
    });
  } catch (err) {
    return res.status(400).json({
      success: false,
      message: err.message || 'שגיאה בפרסור הקובץ',
    });
  }

  if (!parsed.funds?.length) {
    return res.status(400).json({
      success: false,
      message: importSource === 'quarterly_report'
        ? 'לא הצלחנו לפרסר את הדוח התקופתי. ודא שזה PDF או Excel מלא מהגוף המנהל.'
        : 'לא הצלחנו לפרסר את הקובץ. ודא שזהו דוח הר הכסף תקין (Excel או PDF).',
      warnings: parsed.summary?.parseWarnings || [],
    });
  }

  const result = await importPensionFile(userId, parsed.funds, importSource, req.file.originalname);
  const analysis = result.analysis;

  return res.json({
    success: true,
    message: `ייבאנו ${result.imported} קרנות בהצלחה`,
    data: {
      imported: result.imported,
      merged: result.merged,
      created: result.created,
      warnings: parsed.summary?.parseWarnings || [],
      summary: parsed.summary,
      savingsDelta: result.savingsDelta,
      healthScore: result.healthScore,
      healthCheck: analysis?.healthCheck ?? null,
      recommendations: analysis?.recommendations ?? [],
      analysis: analysis ? {
        summary: analysis.summary,
        benchmark: analysis.benchmark,
        projection: analysis.projection,
      } : null,
      funds: result.funds.map(f => mapPensionFundToDto(f)),
    },
  });
}

/**
 * POST /api/pension/upload  — save manual pension fund entry
 * GET  /api/pension/funds   — list saved funds (when listMode=true)
 */
async function uploadPensionData(req, res, listMode = false) {
  const userId = req.user._id;

  if (req.method === 'GET' || listMode) {
    const funds = await PensionFund.find({ user: userId }).lean();
    return res.json({
      success: true,
      data: funds.map(f => mapPensionFundToDto(f, { idField: '_id' })),
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
      status: 'active',
      isActive: true,
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );

  await syncProfileRetirement(userId);

  return res.json({
    success: true,
    message: 'נתוני הקרן נשמרו בהצלחה',
    data: mapPensionFundToDto(fund, { idField: '_id' }),
  });
}

/**
 * PATCH /api/pension/funds/:id
 */
async function updatePensionFund(req, res) {
  const userId = req.user._id;
  const { id } = req.params;
  const body = req.body || {};

  const allowed = [
    'fundName', 'fundType', 'provider', 'currentBalance',
    'monthlyEmployeeDeposit', 'monthlyEmployerDeposit',
    'managementFeeAccumulation', 'managementFeeDeposit', 'investmentTrack',
  ];

  const updates = {};
  for (const key of allowed) {
    if (body[key] !== undefined) updates[key] = body[key];
  }

  if (Object.keys(updates).length === 0) {
    return res.status(400).json({ success: false, message: 'אין שדות לעדכון' });
  }

  const fund = await PensionFund.findOneAndUpdate(
    { _id: id, user: userId },
    { $set: { ...updates, lastUpdated: new Date() } },
    { new: true },
  );

  if (!fund) {
    return res.status(404).json({ success: false, message: 'קרן לא נמצאה' });
  }

  await syncProfileRetirement(userId);

  return res.json({
    success: true,
    message: 'הקרן עודכנה בהצלחה',
    data: mapPensionFundToDto(fund, { idField: '_id' }),
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

  await syncProfileRetirement(userId);

  return res.json({ success: true, message: 'הקרן נמחקה בהצלחה' });
}

/**
 * GET /api/pension/fund-advice — actuarial LEAVE | NEGOTIATE | SWITCH per fund
 */
async function getFundAdvice(req, res) {
  const forceRefresh = req.query.refresh === 'true';
  const analysis = await buildPensionAnalysis(req.user._id);

  if (!forceRefresh && analysis.fundAdvice?.hasData) {
    return res.json({ success: true, data: analysis.fundAdvice });
  }

  const fundAdvice = await buildFundAdvice(analysis.summary?.funds || [], {
    ...analysis.profile,
    currentAge: analysis.summary?.currentAge,
    retirementAge: analysis.summary?.retirementAge,
  }, { forceRefresh });

  return res.json({ success: true, data: fundAdvice });
}

/**
 * GET /api/pension/leading-funds?risk=LOW|MEDIUM|HIGH|INCREASED
 * Leading comprehensive pension funds from Finq (cached per risk cohort).
 */
async function getLeadingFunds(req, res) {
  const forceRefresh = req.query.refresh === 'true';
  const data = await pensionFinqService.getLeadingFunds(req.query.risk, { forceRefresh });
  return res.json({ success: true, data });
}

/**
 * GET /api/pension/fund/:id — deep fund metrics (Finq + cache fallback).
 */
async function getMarketFundById(req, res) {
  const data = await pensionFinqService.getFundById(req.params.id, { risk: req.query.risk });
  return res.json({ success: true, data });
}

module.exports = {
  getPensionAnalysis,
  getImportHistory,
  simulateScenario,
  uploadPensionData,
  uploadPensionFile,
  updatePensionFund,
  deletePensionFund,
  getFundAdvice,
  getLeadingFunds,
  getMarketFundById,
};
