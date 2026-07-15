/**
 * Gemel controller — קופות גמל וקרנות השתלמות.
 *
 * Holdings live in PensionFund (fundType: study_fund | provident_fund);
 * market data comes from GemelNetFund (גמל-נט, data.gov.il).
 */

const PensionFund = require('../models/PensionFund');
const { buildGemelAnalysis } = require('../services/gemelAnalysisService');
const { runGemelAgent } = require('../ai/agents/gemelAgent');
const { getLeadingGovFunds } = require('../services/govFundQueryService');
const { GEMEL_FUND_TYPES } = require('../ai/tools/gemelTools');
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
  const analysis = await buildGemelAnalysis(req.user._id);
  const { summary, marketAdvice, payslipFindings, recommendations } = analysis;
  return res.json({
    success: true,
    data: {
      summary: { ...summary, funds: (summary.funds || []).map(mapGemelFundToDto) },
      marketAdvice,
      payslipFindings,
      recommendations,
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
 * GET /api/gemel/leading-funds — top Gemel-Net market funds
 */
async function getGemelLeadingFunds(req, res) {
  const data = await getLeadingGovFunds('gemel', {
    limit: Number(req.query.limit) || 10,
    classification: req.query.classification,
  });
  return res.json({ success: true, data });
}

module.exports = {
  getGemelAnalysis,
  getGemelAgentResult,
  listGemelFunds,
  createGemelFund,
  updateGemelFund,
  deleteGemelFund,
  getGemelLeadingFunds,
  mapGemelFundToDto,
};
