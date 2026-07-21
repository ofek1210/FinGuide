/**
 * Gemel controller — קופות גמל וקרנות השתלמות.
 *
 * Holdings live in PensionFund (fundType: study_fund | provident_fund);
 * market data comes from GemelNetFund (גמל-נט, data.gov.il).
 */

const PensionFund = require('../models/PensionFund');
const { buildGemelAnalysis } = require('../services/gemelAnalysisService');
const { runGemelAgent } = require('../ai/agents/gemelAgent');
const marketComparisonService = require('../services/marketComparison/marketComparisonService');
const { GEMEL_FUND_TYPES } = require('../ai/tools/gemelTools');
const {
  buildGemelAdvisorReport,
  importUserExcelAccounts,
} = require('../services/gemelAdvisor/gemelAdvisorService');
const { saveGemelAdvisorReport, getGemelAdvisorReport } = require('../services/gemelAdvisor/gemelReportCache');
const { generateGemelAdvisorPdf } = require('../services/gemelAdvisor/gemelPdfService');
const { ValidationError, NotFoundError } = require('../utils/appErrors');

function mapGemelFundToDto(f) {
  const id = f._id ?? f.id;
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
    ytdReturn: f.ytdReturn ?? null,
    activityStatus: f.activityStatus ?? null,
    status: f.status ?? 'active',
    isActive: f.isActive !== false && f.status !== 'closed',
    source: f.source,
  };
}

/**
 * GET /api/gemel/analysis — full gemel analysis (summary, market advice, findings, recommendations)
 */
async function getGemelAnalysis(req, res) {
  const skipLLM = req.query.skipLLM === 'true';
  const analysis = await buildGemelAnalysis(req.user._id, { skipLLM });
  return res.json({
    success: true,
    data: {
      ...analysis,
      summary: {
        ...analysis.summary,
        funds: (analysis.summary?.funds || []).map(mapGemelFundToDto),
      },
    },
  });
}

/**
 * GET /api/gemel/agent — agent-grade result (incl. optional LLM explanation)
 */
async function getGemelAgentResult(req, res) {
  const skipLLM = req.query.skipLLM === 'true';
  const result = await runGemelAgent(req.user._id, { skipLLM });
  return res.json({ success: true, data: result });
}

/**
 * GET /api/gemel/funds — list gemel-type holdings
 */
async function listGemelFunds(req, res) {
  const funds = await PensionFund.find({
    user: req.user._id,
    fundType: { $in: GEMEL_FUND_TYPES },
  })
    .sort({ createdAt: -1 })
    .lean();
  return res.json({ success: true, data: { funds: funds.map(mapGemelFundToDto) } });
}

/**
 * POST /api/gemel/funds — manual gemel fund entry
 */
async function createGemelFund(req, res) {
  const {
    fundName, fundType, provider, currentBalance,
    monthlyEmployeeDeposit, monthlyEmployerDeposit,
    managementFeeAccumulation, managementFeeDeposit, investmentTrack,
  } = req.body || {};

  if (!fundName || typeof fundName !== 'string' || !fundName.trim()) {
    throw new ValidationError('שם קופה נדרש');
  }
  if (!GEMEL_FUND_TYPES.includes(fundType)) {
    throw new ValidationError('סוג קופה חייב להיות קרן השתלמות או קופת גמל');
  }

  const fund = await PensionFund.create({
    user: req.user._id,
    fundName: fundName.trim(),
    fundType,
    provider: provider?.trim?.() || null,
    currentBalance: currentBalance ?? null,
    monthlyEmployeeDeposit: monthlyEmployeeDeposit ?? null,
    monthlyEmployerDeposit: monthlyEmployerDeposit ?? null,
    managementFeeAccumulation: managementFeeAccumulation ?? null,
    managementFeeDeposit: managementFeeDeposit ?? null,
    investmentTrack: investmentTrack || null,
    source: 'manual',
    status: 'active',
    isActive: true,
  });

  return res.status(201).json({ success: true, data: { fund: mapGemelFundToDto(fund) } });
}

/**
 * PATCH /api/gemel/funds/:id — update a gemel-type holding
 */
async function updateGemelFund(req, res) {
  const allowed = [
    'fundName', 'provider', 'currentBalance',
    'monthlyEmployeeDeposit', 'monthlyEmployerDeposit',
    'managementFeeAccumulation', 'managementFeeDeposit',
    'investmentTrack', 'status', 'isActive',
  ];
  const updates = {};
  for (const key of allowed) {
    if (req.body?.[key] !== undefined) updates[key] = req.body[key];
  }
  if (req.body?.fundType !== undefined) {
    if (!GEMEL_FUND_TYPES.includes(req.body.fundType)) {
      throw new ValidationError('סוג קופה חייב להיות קרן השתלמות או קופת גמל');
    }
    updates.fundType = req.body.fundType;
  }

  const fund = await PensionFund.findOneAndUpdate(
    { _id: req.params.id, user: req.user._id, fundType: { $in: GEMEL_FUND_TYPES } },
    { $set: updates },
    { new: true, runValidators: true },
  ).lean();

  if (!fund) throw new NotFoundError('קופה לא נמצאה');
  return res.json({ success: true, data: { fund: mapGemelFundToDto(fund) } });
}

/**
 * DELETE /api/gemel/funds/:id — remove a gemel-type holding
 */
async function deleteGemelFund(req, res) {
  const fund = await PensionFund.findOneAndDelete({
    _id: req.params.id,
    user: req.user._id,
    fundType: { $in: GEMEL_FUND_TYPES },
  }).lean();

  if (!fund) throw new NotFoundError('קופה לא נמצאה');
  return res.json({ success: true, data: { deleted: true } });
}

/**
 * GET /api/gemel/leading-funds?product=gemel|hishtalmut|investment_gemel&risk=low|medium|high&period=12|36|5y|combined&limit=5
 */
async function getGemelLeadingFunds(req, res) {
  const data = await marketComparisonService.getGemelMarketComparison({
    product: req.query.product,
    risk: req.query.risk,
    period: req.query.period,
    limit: req.query.limit,
    comparisonGroup: req.query.comparisonGroup || null,
  });
  return res.json({ success: true, data });
}

/**
 * POST /api/gemel/upload — upload user Excel with gemel/study fund accounts
 */
async function uploadGemelExcel(req, res) {
  if (!req.file?.buffer) {
    throw new ValidationError('קובץ Excel נדרש');
  }
  const result = await importUserExcelAccounts(req.user._id, req.file.buffer);
  return res.status(201).json({
    success: true,
    data: {
      imported: result.persistedCount,
      warnings: result.warnings,
      sheetName: result.sheetName,
      fundIds: result.fundIds?.map(String),
    },
  });
}

/**
 * POST /api/gemel/analyze — run full gemel advisor analysis
 */
async function analyzeGemel(req, res) {
  const skipLLM = req.query.skipLLM === 'true' || req.body?.skipLLM === true;
  const runId = `gemel_${req.user._id}_${Date.now()}`;
  const report = await buildGemelAdvisorReport(req.user._id, { skipLLM });
  await saveGemelAdvisorReport(req.user._id, runId, report);
  return res.json({ success: true, data: { runId, report } });
}

/**
 * GET /api/gemel/report — latest-style report (runs fresh analysis)
 */
async function getGemelReport(req, res) {
  const skipLLM = req.query.skipLLM === 'true';
  const runId = `gemel_${req.user._id}_${Date.now()}`;
  const report = await buildGemelAdvisorReport(req.user._id, { skipLLM });
  await saveGemelAdvisorReport(req.user._id, runId, report);
  return res.json({ success: true, data: { runId, report } });
}

/**
 * GET /api/gemel/report/pdf?runId= — PDF from cached report
 */
async function downloadGemelReportPdf(req, res) {
  const runId = req.query.runId;
  if (!runId) throw new ValidationError('נדרש runId — יש ליצור דוח לפני ההורדה.');
  const report = await getGemelAdvisorReport(req.user._id, runId);
  if (!report) throw new NotFoundError('הדוח לא נמצא או שפג תוקפו.');
  const pdfBuffer = await generateGemelAdvisorPdf(report);
  const date = new Date(report.generatedAt || Date.now()).toISOString().slice(0, 10);
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="FinGuide-Gemel-Report-${date}.pdf"`);
  return res.send(pdfBuffer);
}

module.exports = {
  getGemelAnalysis,
  getGemelAgentResult,
  listGemelFunds,
  createGemelFund,
  updateGemelFund,
  deleteGemelFund,
  getGemelLeadingFunds,
  uploadGemelExcel,
  analyzeGemel,
  getGemelReport,
  downloadGemelReportPdf,
  mapGemelFundToDto,
};
