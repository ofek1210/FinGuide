

const InsurancePolicy = require('../models/InsurancePolicy');
const { parseInsuranceExcel } = require('../services/insuranceExcelParser');
const { buildInsuranceAnalysis, importInsuranceExcel } = require('../services/insuranceImportService');
const { buildMarketAdvice } = require('../services/insuranceMarketAdvisorService');
const InsuranceImportSnapshot = require('../models/InsuranceImportSnapshot');
const { isDemoRequest } = require('../utils/demoMode');

async function getInsuranceAnalysis(req, res) {
  if (isDemoRequest(req)) {
    const { MOCK_INSURANCE_ANALYSIS } = require('../ai/mock/mockData');
    return res.json({ success: true, data: MOCK_INSURANCE_ANALYSIS });
  }

  const data = await buildInsuranceAnalysis(req.user._id);
  return res.json({ success: true, data });
}

async function getInsurancePolicies(req, res) {
  const policies = await InsurancePolicy.find({ user: req.user._id }).lean();
  return res.json({ success: true, data: policies });
}

async function getInsuranceImportHistory(req, res) {
  const snapshots = await InsuranceImportSnapshot.find({ user: req.user._id })
    .sort({ importedAt: -1 })
    .limit(5)
    .lean();

  return res.json({
    success: true,
    data: snapshots.map(s => ({
      id: s._id.toString(),
      sourceFile: s.sourceFile,
      importedAt: s.importedAt,
      policyCount: s.policyCount,
      duplicateCount: s.duplicateCount,
      totalMonthlyWaste: s.totalMonthlyWaste,
      healthScore: s.healthScore,
      annualSavings: s.annualSavings,
    })),
  });
}

async function uploadInsuranceExcel(req, res) {
  if (!req.file) {
    return res.status(400).json({ success: false, message: 'לא קיבלנו קובץ Excel' });
  }

  const parsed = parseInsuranceExcel(req.file.buffer, req.file.originalname);

  if (parsed.length === 0) {
    return res.status(400).json({
      success: false,
      message: 'לא הצלחנו לפרסר את הקובץ. ודא שזהו קובץ Har HaBituach תקין.',
    });
  }

  const result = await importInsuranceExcel(req.user._id, parsed, req.file.originalname);

  return res.json({
    success: true,
    message: `ייבאנו ${result.imported} פוליסות בהצלחה`,
    data: {
      imported: result.imported,
      merged: result.merged,
      created: result.created,
      savingsDelta: result.savingsDelta,
      healthScore: result.healthScore,
      analysis: result.analysis.analysis,
      healthCheck: result.analysis.healthCheck,
      recommendations: result.analysis.recommendations,
      policies: result.policies.map(p => ({
        id: p._id.toString(),
        type: p.type,
        provider: p.provider,
        monthlyPremium: p.monthlyPremium,
        status: p.status,
      })),
    },
  });
}

async function deleteInsurancePolicy(req, res) {
  const policy = await InsurancePolicy.findOne({ _id: req.params.id, user: req.user._id });
  if (!policy) return res.status(404).json({ success: false, message: 'פוליסה לא נמצאה' });
  await policy.deleteOne();
  return res.json({ success: true, message: 'הפוליסה נמחקה' });
}

/**
 * GET /api/insurance/market-advice — cost vs service index comparison matrix
 */
async function getMarketAdvice(req, res) {
  const forceRefresh = req.query.refresh === 'true';
  const analysis = await buildInsuranceAnalysis(req.user._id);

  if (!forceRefresh && analysis.marketAdvice?.hasData) {
    return res.json({ success: true, data: analysis.marketAdvice });
  }

  const profileDTO = {
    ...analysis,
    policies: analysis.policies || [],
    personal: analysis.personal,
    assets: analysis.assets,
    profile: analysis.profile,
  };

  const marketAdvice = await buildMarketAdvice(profileDTO.policies, profileDTO, { forceRefresh });
  return res.json({ success: true, data: marketAdvice });
}

module.exports = {
  getInsuranceAnalysis,
  getInsurancePolicies,
  getInsuranceImportHistory,
  uploadInsuranceExcel,
  deleteInsurancePolicy,
  getMarketAdvice,
};
