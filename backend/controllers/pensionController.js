

const path = require('path');
const { MOCK_PENSION_ANALYSIS } = require('../ai/mock/mockData');
const { isDemoRequest } = require('../utils/demoMode');
const { getPensionSummary, projectRetirementIncome } = require('../ai/tools/pensionTools');
const { projectPensionIncome } = require('../ai/engines/calculationEngine');
const { parseHarHaKesef } = require('../services/harHaKesefService');
const { buildPensionAnalysis } = require('../services/pensionAnalysisService');
const {
  buildUploadAnalysisSnippet,
  isThreeCardAnalysis,
} = require('../services/financialAdvisory/threeCardAnalysisPayload');
const { buildFundAdvice } = require('../services/pensionFundAdvisorService');
const pensionFinqService = require('../services/PensionService');
const marketComparisonService = require('../services/marketComparison/marketComparisonService');
const { buildPensionRecommendations } = require('../services/pensionRecommendationService');
const { comparePensionProducts } = require('../services/pensionComparisonEngine');
const PensionFund = require('../models/PensionFund');
const { importPensionFile, syncProfileRetirement } = require('../services/pensionImportService');
const { parseClearinghouseExcel } = require('../services/pensionClearinghouseParser');
const { parsePensionFreeReport } = require('../services/pensionFreeReportParser');
const {
  importClearinghouseFile,
  importManualFundsFromPreview,
} = require('../services/pensionClearinghouseImportService');
const PensionImportSnapshot = require('../models/PensionImportSnapshot');
const { computeBufferChecksum, assertUploadNotDuplicate } = require('../utils/duplicateUpload');

const SNAPSHOT_CAP = 5;

const PENSION_PRODUCT_TYPES = new Set([
  'pension_comprehensive', 'pension_old', 'managers_insurance', 'other',
]);
const GEMEL_PRODUCT_TYPES = new Set(['study_fund', 'provident_fund']);

function buildClearinghouseAgentReadiness(funds) {
  let pensionFundCount = 0;
  let gemelFundCount = 0;
  let pensionCoverageCount = 0;
  for (const fund of funds || []) {
    if (PENSION_PRODUCT_TYPES.has(fund.fundType)) pensionFundCount += 1;
    if (GEMEL_PRODUCT_TYPES.has(fund.fundType)) gemelFundCount += 1;
    pensionCoverageCount += (fund.insuranceCoverages || []).length;
  }
  return {
    pensionReady: pensionFundCount > 0,
    gemelReady: gemelFundCount > 0,
    pensionInsuranceReady: pensionCoverageCount > 0,
    pensionFundCount,
    gemelFundCount,
    pensionCoverageCount,
  };
}

function mapPensionFundToDto(f, { idField = '_id' } = {}) {
  const id = f[idField] ?? f.id;
  return {
    id: id?.toString?.() ?? id,
    fundName: f.fundName,
    fundType: f.fundType,
    provider: f.provider,
    accountNumber: f.accountNumber ?? null,
    currentBalance: f.currentBalance,
    monthlyEmployeeDeposit: f.monthlyEmployeeDeposit,
    monthlyEmployerDeposit: f.monthlyEmployerDeposit,
    managementFeeAccumulation: f.managementFeeAccumulation,
    managementFeeDeposit: f.managementFeeDeposit,
    investmentTrack: f.investmentTrack,
    ytdReturn: f.ytdReturn ?? null,
    activityStatus: f.activityStatus ?? null,
    status: f.status ?? 'active',
    isActive: f.isActive !== false && f.status !== 'closed',
    source: f.source,
  };
}

/**
 * GET /api/pension/analysis
 */
async function getPensionAnalysis(req, res) {
  if (isDemoRequest(req)) {
    return res.json({ success: true, data: MOCK_PENSION_ANALYSIS });
  }
  const skipLLM = req.query.skipLLM === 'true';
  const data = await buildPensionAnalysis(req.user._id, { skipLLM });
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
async function uploadPensionFile(req, res, next) {
  if (!req.file) {
    return res.status(400).json({ success: false, message: 'לא קיבלנו קובץ' });
  }

  try {
    const userId = req.user._id;
    const checksum = computeBufferChecksum(req.file.buffer);
    await assertUploadNotDuplicate(userId, checksum);

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

  const result = await importPensionFile(
    userId,
    parsed.funds,
    importSource,
    req.file.originalname,
    checksum,
  );
  const { analysis } = result;

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
      healthCheck: isThreeCardAnalysis(analysis) ? null : (analysis?.healthCheck ?? null),
      recommendations: isThreeCardAnalysis(analysis) ? [] : (analysis?.recommendations ?? []),
      analysis: buildUploadAnalysisSnippet(analysis),
      funds: result.funds.map(f => mapPensionFundToDto(f)),
    },
  });
  } catch (err) {
    return next(err);
  }
}

/**
 * POST /api/pension/upload  — save manual pension fund entry
 * GET  /api/pension/funds   — list saved funds (when listMode=true)
 */
async function uploadPensionData(req, res, listMode = false) {
  const userId = req.user._id;

  if (req.method === 'GET' || listMode) {
    // Gemel-type funds (study/provident) live on /api/gemel/funds — the gemel agent owns them.
    const funds = await PensionFund.find({
      user: userId,
      fundType: { $nin: ['study_fund', 'provident_fund'] },
    }).lean();
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

  // Gemel types are created via POST /api/gemel/funds
  const validTypes = ['pension_comprehensive', 'pension_old', 'managers_insurance', 'other'];
  if (!validTypes.includes(fundType)) {
    return res.status(400).json({ success: false, message: 'סוג קרן לא תקין — קופות גמל והשתלמות מנוהלות בעמוד הגמל' });
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
 * DELETE /api/pension/funds — delete ALL pension data for the user (settings privacy zone).
 */
async function deleteAllPensionData(req, res) {
  const userId = req.user._id;
  const PensionDeposit = require('../models/PensionDeposit');
  const UserProfile = require('../models/UserProfile');

  await Promise.all([
    PensionFund.deleteMany({ user: userId }),
    PensionDeposit.deleteMany({ user: userId }),
    PensionImportSnapshot.deleteMany({ user: userId }),
  ]);

  await UserProfile.findOneAndUpdate(
    { user: userId },
    {
      $set: {
        'retirement.currentPensionAccumulation': 0,
        'retirement.hasPension': false,
        'retirement.hasStudyFund': false,
      },
    },
  );

  return res.json({ success: true, message: 'כל נתוני הפנסיה נמחקו' });
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
 * POST /api/pension/analyze-pension-only — compare uploaded pension products vs Pensia-Net.
 * Body: { products: [...] } — rows from "פרטי המוצרים שלי" (Hebrew or English keys).
 */
async function analyzePensionOnly(req, res) {
  const { products } = req.body || {};

  if (!Array.isArray(products) || !products.length) {
    return res.status(400).json({
      success: false,
      message: 'חסר מערך products עם נתוני המוצרים מהדוח',
    });
  }

  const result = await comparePensionProducts(products);

  return res.json({
    success: true,
    totalPensionSavings: result.totalPensionSavings,
    pensionInsights: result.pensionInsights,
  });
}

/**
 * POST /api/pension/recommendations — Pensia-Net fee + performance + actuarial engines.
 */
async function getPensionRecommendations(req, res) {
  const { currentFundId, userManagementFee, riskPreference } = req.body || {};

  const result = await buildPensionRecommendations({
    currentFundId: String(currentFundId).trim(),
    userManagementFee: Number(userManagementFee),
    riskPreference,
  });

  return res.json({
    success: true,
    feeAnalysis: result.feeAnalysis,
    recommendedFunds: result.recommendedFunds,
  });
}

/**
 * GET /api/pension/leading-funds?risk=low|medium|high&period=12|36|5y|combined&limit=5
 * Official PensiaNet market comparison (Step 3).
 */
async function getLeadingFunds(req, res) {
  const data = await marketComparisonService.getPensionMarketComparison({
    risk: req.query.risk,
    period: req.query.period,
    limit: req.query.limit,
    comparisonGroup: req.query.comparisonGroup || null,
  });
  return res.json({ success: true, data });
}

/**
 * GET /api/pension/leading-funds/finq?risk=LOW|MEDIUM|HIGH|INCREASED
 * Legacy Finq leading funds — retained for backward compatibility during transition.
 */
async function getLeadingFinqFunds(req, res) {
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

/**
 * POST /api/pension/upload-free-preview — Option A: parse free report, no DB write.
 */
async function uploadFreePreview(req, res) {
  if (!req.file) {
    return res.status(400).json({ success: false, message: 'לא קיבלנו קובץ' });
  }

  const ext = path.extname(req.file.originalname || '').toLowerCase();
  let parsed;
  try {
    parsed = parsePensionFreeReport(req.file.buffer, {
      ext,
      originalName: req.file.originalname,
    });
  } catch (err) {
    return res.status(400).json({
      success: false,
      message: err.message || 'שגיאה בפרסור הדוח החינמי',
    });
  }

  if (!parsed.funds?.length) {
    return res.status(400).json({
      success: false,
      message: 'לא זוהו מוצרים פנסיוניים בקובץ. ודא שזה דוח הר הביטוח או Excel תקין.',
      warnings: parsed.summary?.parseWarnings || [],
    });
  }

  const active = parsed.funds.filter(f => f.isActive);
  const inactive = parsed.funds.filter(f => !f.isActive);

  return res.json({
    success: true,
    data: {
      sourceKind: parsed.sourceKind,
      funds: parsed.funds,
      summary: parsed.summary,
      narrative: active.length
        ? `לפי הממצאים: זוהו ${active.length} מוצרים פעילים${inactive.length ? ` ו-${inactive.length} לא פעילים` : ''}.`
        : 'לא זוהו מוצרים פעילים — ניתן להזין ידנית.',
    },
  });
}

/**
 * POST /api/pension/complete-manual-funds — Option A step 2: save manual balances.
 */
async function completeManualFunds(req, res) {
  const userId = req.user._id;
  const { funds } = req.body || {};

  if (!Array.isArray(funds) || !funds.length) {
    return res.status(400).json({ success: false, message: 'חסרים נתוני קרנות לשמירה' });
  }

  for (const f of funds) {
    if (!f.fundName?.trim()) {
      return res.status(400).json({ success: false, message: 'שם קרן חסר באחת הרשומות' });
    }
    if (f.currentBalance == null || Number.isNaN(Number(f.currentBalance))) {
      return res.status(400).json({
        success: false,
        message: `חסר סכום צבירה עבור "${f.fundName}"`,
      });
    }
  }

  const result = await importManualFundsFromPreview(userId, funds, 'free_report_wizard');
  const {analysis} = result;

  return res.json({
    success: true,
    message: `נשמרו ${result.imported} קרנות בהצלחה`,
    data: {
      imported: result.imported,
      funds: result.funds.map(f => mapPensionFundToDto(f)),
      analysis: buildUploadAnalysisSnippet(analysis),
    },
  });
}

/**
 * POST /api/pension/upload-clearinghouse — Option B: full paid clearinghouse import.
 */
async function uploadClearinghouse(req, res) {
  if (!req.file) {
    return res.status(400).json({ success: false, message: 'לא קיבלנו קובץ' });
  }

  const ext = path.extname(req.file.originalname || '').toLowerCase();
  if (!['.xlsx', '.xls'].includes(ext)) {
    return res.status(400).json({ success: false, message: 'יש להעלות קובץ Excel (.xls / .xlsx) מהמסלקה הפנסיונית' });
  }

  const userId = req.user._id;
  let parsed;
  try {
    parsed = parseClearinghouseExcel(req.file.buffer);
  } catch (err) {
    return res.status(400).json({
      success: false,
      message: err.message || 'שגיאה בפרסור קובץ המסלקה',
    });
  }

  if (!parsed.funds?.length) {
    return res.status(400).json({
      success: false,
      message: 'לא הצלחנו לפרסר את קובץ המסלקה. ודא שזהו דוח מסלקה פנסיונית (Excel) עם 3 גיליונות.',
      warnings: parsed.summary?.parseWarnings || [],
      sheetNames: parsed.summary?.sheetNames,
    });
  }

  const result = await importClearinghouseFile(userId, parsed, req.file.originalname);
  const {analysis} = result;

  return res.json({
    success: true,
    message: `יובאו ${result.imported} קרנות מהמסלקה (${result.depositsSaved || 0} רשומות הפקדות)`,
    data: {
      imported: result.imported,
      depositsSaved: result.depositsSaved || 0,
      warnings: parsed.summary?.parseWarnings || [],
      summary: parsed.summary,
      savingsDelta: result.savingsDelta,
      healthScore: result.healthScore,
      analysis: buildUploadAnalysisSnippet(analysis),
      funds: result.funds.map(f => mapPensionFundToDto(f)),
      agentReadiness: buildClearinghouseAgentReadiness(result.funds),
    },
  });
}

module.exports = {
  getPensionAnalysis,
  getImportHistory,
  simulateScenario,
  uploadPensionData,
  uploadPensionFile,
  uploadFreePreview,
  completeManualFunds,
  uploadClearinghouse,
  updatePensionFund,
  deletePensionFund,
  getFundAdvice,
  getLeadingFunds,
  getLeadingFinqFunds,
  getMarketFundById,
  getPensionRecommendations,
  deleteAllPensionData,
  analyzePensionOnly,
};
