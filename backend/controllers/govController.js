'use strict';

const { runGovMarketMonthlySync, getGovMarketStatus } = require('../jobs/govMarketMonthlySync');
const { syncGemelNetDataset, getGemelNetStatus } = require('../services/gemelNetIngestionService');
const { syncBituahNetDataset, getBituahNetStatus } = require('../services/bituahNetIngestionService');
const { syncPensiaNetDataset } = require('../services/pensiaNetIngestionService');
const { listGovFunds, getGovFundById, getLeadingGovFunds } = require('../services/govFundQueryService');
const { buildGemelAnalysis } = require('../services/gemelAnalysisService');
const { buildInsuranceAnalysis } = require('../services/insuranceAnalysisService');
const { buildPayslipGovBenchmarkRecommendations } = require('../services/payslipGovBenchmarkService');

async function getGovStatus(req, res) {
  const data = await getGovMarketStatus();
  return res.json({ success: true, data });
}

async function postGovSync(req, res) {
  const result = await runGovMarketMonthlySync();
  return res.json({ success: true, data: result });
}

async function postNetSync(req, res) {
  const { net } = req.params;
  const syncFns = {
    pensia: syncPensiaNetDataset,
    gemel: syncGemelNetDataset,
    bituah: syncBituahNetDataset,
  };
  const fn = syncFns[net];
  if (!fn) {
    return res.status(400).json({ success: false, message: 'רשת לא נתמכת — pensia | gemel | bituah' });
  }
  const data = await fn();
  return res.json({ success: true, data });
}

async function getNetStatus(req, res) {
  const { net } = req.params;
  const statusFns = {
    gemel: getGemelNetStatus,
    bituah: getBituahNetStatus,
  };
  if (statusFns[net]) {
    const data = await statusFns[net]();
    return res.json({ success: true, data });
  }
  if (net === 'pensia') {
    const status = await getGovMarketStatus();
    return res.json({ success: true, data: status.nets.pensia });
  }
  return res.status(400).json({ success: false, message: 'רשת לא נתמכת — pensia | gemel | bituah' });
}

async function getFunds(req, res) {
  const { net } = req.params;
  if (!['pensia', 'gemel', 'bituah'].includes(net)) {
    return res.status(400).json({ success: false, message: 'רשת לא נתמכת' });
  }
  const data = await listGovFunds(net, req.query);
  return res.json({ success: true, data });
}

async function getFundById(req, res) {
  const { net, id } = req.params;
  const data = await getGovFundById(net, id);
  if (!data) {
    return res.status(404).json({ success: false, message: 'מסלול לא נמצא' });
  }
  return res.json({ success: true, data });
}

async function getLeadingFunds(req, res) {
  const { net } = req.params;
  const data = await getLeadingGovFunds(net, {
    limit: Number(req.query.limit) || 10,
    classification: req.query.classification,
  });
  return res.json({ success: true, data });
}

async function getGemelAdvice(req, res) {
  const analysis = await buildGemelAnalysis(req.user._id);
  const data = analysis.marketAdvice || { hasData: false, funds: [] };
  return res.json({ success: true, data });
}

async function getBituahAdvice(req, res) {
  const analysis = await buildInsuranceAnalysis(req.user._id);
  const data = analysis.bituahAdvice || { hasData: false, funds: [] };
  return res.json({ success: true, data });
}

async function getPayslipBenchmarks(req, res) {
  const recommendations = await buildPayslipGovBenchmarkRecommendations(req.user._id);
  return res.json({ success: true, data: { recommendations } });
}

async function postPensiaCohortAnnual(req, res) {
  if (!req.file?.buffer) {
    return res.status(400).json({ success: false, message: 'חסר קובץ Excel' });
  }
  const { importPensiaNetCohortAnnualExcel } = require('../services/pensiaNetCohortAnnualImportService');
  const data = await importPensiaNetCohortAnnualExcel(req.file.buffer, {
    sourceFile: req.file.originalname,
  });
  return res.json({ success: true, data });
}

async function getPensiaCohortAnnual(req, res) {
  const { getCohortAnnualSummary } = require('../services/pensiaNetCohortAnnualImportService');
  const rows = await getCohortAnnualSummary();
  return res.json({ success: true, data: rows });
}

module.exports = {
  getGovStatus,
  postGovSync,
  postNetSync,
  getNetStatus,
  getFunds,
  getFundById,
  getLeadingFunds,
  getGemelAdvice,
  getBituahAdvice,
  getPayslipBenchmarks,
  postPensiaCohortAnnual,
  getPensiaCohortAnnual,
};
