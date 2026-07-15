/**
 * Unified gemel analysis builder — קופות גמל וקרנות השתלמות.
 * Reused by API and agent (mirrors pensionAnalysisService.js).
 */

const UserProfile = require('../models/UserProfile');
const User = require('../models/User');
const Document = require('../models/Document');
const {
  getGemelSummary,
  generateGemelRecommendations,
} = require('../ai/tools/gemelTools');
const { buildGemelMarketAdvice } = require('./gemelNetAdvisorService');
const { buildFundDepositFindings } = require('../utils/detectFundWithoutDeposit');
const { buildContributionRateGapFindings } = require('../utils/detectContributionRateGap');
const { buildDepositContinuityFindings } = require('../utils/detectDepositContinuityGap');

/** Keep only findings that belong to the study-fund/gemel domain */
function isGemelFinding(finding) {
  const id = finding?.id || '';
  return id.startsWith('study_fund') || id === 'onboarding_study_fund_mismatch';
}

/**
 * Run the payslip-based detect utilities and keep study-fund findings only.
 * @returns {Promise<Array<object>>}
 */
async function buildGemelPayslipFindings(userId) {
  const [documents, user] = await Promise.all([
    Document.find({ user: userId })
      .select('originalName fileSize status updatedAt uploadedAt metadata analysisData')
      .lean(),
    User.findById(userId).select('onboarding').lean(),
  ]);

  if (!documents.length) return [];

  const continuityResult = buildDepositContinuityFindings(documents);
  const suppressPeriodKeysByFund = continuityResult.config?.suppressNoDepositWhenBreak
    ? continuityResult.breakPeriodKeysByFund
    : {};

  const fundFindings = buildFundDepositFindings(documents, user, {
    suppressPeriodKeysByFund,
  });
  const rateGapFindings = buildContributionRateGapFindings(documents);

  return [
    ...continuityResult.findings,
    ...fundFindings,
    ...rateGapFindings,
  ].filter(isGemelFinding);
}

/** Normalize a PensionFund gemel row to the market-advisor product shape */
function toGemelProduct(f) {
  return {
    companyName: f.provider,
    productName: f.fundName,
    productType: f.fundType,
    totalSavings: f.currentBalance,
    depositFee: f.managementFeeDeposit != null
      ? (f.managementFeeDeposit < 0.05 ? f.managementFeeDeposit * 100 : f.managementFeeDeposit)
      : null,
    assetFee: f.managementFeeAccumulation != null
      ? (f.managementFeeAccumulation < 0.05 ? f.managementFeeAccumulation * 100 : f.managementFeeAccumulation)
      : null,
    status: 'פעיל',
  };
}

/**
 * @param {string|import('mongoose').Types.ObjectId} userId
 * @returns {Promise<object>}
 */
async function buildGemelAnalysis(userId) {
  const [summary, profile, payslipFindings] = await Promise.all([
    getGemelSummary(userId),
    UserProfile.findOne({ user: userId }).lean(),
    buildGemelPayslipFindings(userId),
  ]);

  const gemelProducts = (summary.funds || []).map(toGemelProduct);
  const marketAdvice = await buildGemelMarketAdvice(gemelProducts, {
    ...profile,
    currentAge: summary.currentAge,
  });

  const recommendations = generateGemelRecommendations(summary, { marketAdvice });

  const findingRecs = payslipFindings
    .filter(f => f.severity === 'critical' || f.severity === 'warning')
    .map(f => ({
      type: f.id,
      title: f.title,
      reason: f.details,
      urgency: f.severity === 'critical' ? 'high' : 'medium',
      financialImpact: null,
      confidenceScore: 80,
    }));
  const recTypes = new Set(recommendations.map(r => r.type));

  return {
    summary,
    marketAdvice,
    payslipFindings,
    recommendations: [
      ...recommendations,
      ...findingRecs.filter(r => !recTypes.has(r.type)),
    ],
    profile,
  };
}

module.exports = { buildGemelAnalysis, buildGemelPayslipFindings };
