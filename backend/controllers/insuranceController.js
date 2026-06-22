'use strict';

const InsurancePolicy = require('../models/InsurancePolicy');
const { parseInsuranceExcel } = require('../services/insuranceExcelParser');
const { buildInsuranceAnalysis, importInsuranceExcel } = require('../services/insuranceImportService');
const InsuranceImportSnapshot = require('../models/InsuranceImportSnapshot');

async function getInsuranceAnalysis(req, res) {
  if (req.query.demo === 'true') {
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

module.exports = {
  getInsuranceAnalysis,
  getInsurancePolicies,
  getInsuranceImportHistory,
  uploadInsuranceExcel,
  deleteInsurancePolicy,
};
