'use strict';

/**
 * Unified gemel analysis builder — קופות גמל וקרנות השתלמות.
 * Mirrors pensionAnalysisService.js with shared advisory orchestration.
 */

const UserProfile = require('../models/UserProfile');
const User = require('../models/User');
const Document = require('../models/Document');
const PensionFund = require('../models/PensionFund');
const {
  getGemelSummary,
  generateGemelRecommendations,
  findGemelHoldings,
} = require('../ai/tools/gemelTools');
const { buildGemelMarketAdvice } = require('./gemelNetAdvisorService');
const { buildFundDepositFindings } = require('../utils/detectFundWithoutDeposit');
const { buildContributionRateGapFindings } = require('../utils/detectContributionRateGap');
const { buildDepositContinuityFindings } = require('../utils/detectDepositContinuityGap');
const { runGemelRecommendationEngine } = require('./gemelRecommendationEngine');
const { runFinancialAdvisoryAgent } = require('./financialAdvisory/runFinancialAdvisoryAgent');
const { generateClearinghouseInsightRecommendations } = require('./pensionClearinghouseInsights');
const {
  clearinghouseRecsToUnifiedInsights,
  filterClearinghouseRecsByDomain,
} = require('../utils/clearinghouseInsightBridge');
const {
  sanitizeFormattedRecommendation,
  sanitizePensionDisplayInsight,
  sanitizeBenchmarkForClient,
  sanitizeEvidenceForClient,
} = require('../utils/sanitizeClientInsights');
const {
  isThreeCardAnalysis,
  buildThreeCardClientPayload,
} = require('./financialAdvisory/threeCardAnalysisPayload');

function isGemelFinding(finding) {
  const id = finding?.id || '';
  return id.startsWith('study_fund') || id === 'onboarding_study_fund_mismatch';
}

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

function unifiedToGemelDisplay(ins) {
  if (!ins) return null;
  if (ins._legacy) return ins._legacy;
  return {
    id: ins.id,
    category: ins.code || ins.category,
    severity: ins.severity,
    title: ins.title,
    finding: ins.reason,
    recommendedAction: ins.suggestedAction,
    confidence: ins.confidence,
    benchmark: sanitizeBenchmarkForClient(ins.evidence?.benchmark),
    estimatedImpact: ins.financialImpact ? {
      annual: ins.financialImpact.period === 'annual' ? ins.financialImpact.amount : null,
      retirement: ins.financialImpact.period === 'retirement' ? ins.financialImpact.amount : null,
      currency: ins.financialImpact.currency || 'ILS',
    } : undefined,
    fundId: ins.productId ?? undefined,
  };
}

/**
 * @param {string|import('mongoose').Types.ObjectId} userId
 * @param {object} [options]
 * @param {'GEMEL'|'HISHTALMUT'|null} [options.productTypeFilter]
 * @returns {Promise<object>}
 */
async function buildGemelAnalysis(userId, options = {}) {
  const productType = options.productTypeFilter === 'HISHTALMUT'
    ? 'HISHTALMUT'
    : options.productTypeFilter === 'GEMEL'
      ? 'GEMEL'
      : 'GEMEL';

  const [summary, profile, payslipFindings] = await Promise.all([
    getGemelSummary(userId),
    UserProfile.findOne({ user: userId }).lean(),
    buildGemelPayslipFindings(userId),
  ]);

  const allClearinghouseRecs = await generateClearinghouseInsightRecommendations(userId);
  const clearinghouseRecs = filterClearinghouseRecsByDomain(allClearinghouseRecs, 'gemel');
  const clearinghouseTypes = new Set(clearinghouseRecs.map(r => r.type));

  let structuredInsights = [];
  let insightMeta = null;
  let advisoryEnvelope = null;

  try {
    const gemelFundsForAnalysis = await findGemelHoldings(userId);

    const engineResult = await runGemelRecommendationEngine(userId, {
      summary,
      funds: gemelFundsForAnalysis,
      productTypeFilter: options.productTypeFilter || null,
    });
    structuredInsights = engineResult.insights;
    insightMeta = engineResult.meta;

    const clearinghouseUnified = clearinghouseRecsToUnifiedInsights(
      clearinghouseRecs,
      gemelFundsForAnalysis,
      { domain: 'gemel' },
    );
    const mergedUnified = [...clearinghouseUnified, ...(engineResult.insights || [])];

    advisoryEnvelope = await runFinancialAdvisoryAgent({
      userId,
      productType: options.productTypeFilter === 'HISHTALMUT' ? 'HISHTALMUT' : 'GEMEL',
      skipLLM: options.skipLLM,
      options: { funds: gemelFundsForAnalysis },
      precomputed: {
        unifiedInsights: mergedUnified,
        engineMeta: engineResult.meta,
        funds: gemelFundsForAnalysis,
        matchResults: (engineResult.meta.marketMatches || []).map(m => ({
          matchConfidence: (m.matchConfidence ?? 0) * 100,
        })),
        missingData: engineResult.missingData,
        rawStructured: engineResult.insights,
      },
      legacyFields: {
        insightMeta: engineResult.meta,
      },
      summaryOverride: {
        totalProducts: gemelFundsForAnalysis.length,
        hasData: summary.hasData,
      },
    });
  } catch (err) {
    console.error('[buildGemelAnalysis] structured insights failed:', err.message);
  }

  if (isThreeCardAnalysis(advisoryEnvelope)) {
    return buildThreeCardClientPayload({
      advisoryEnvelope,
      summary,
      profile,
      productType: advisoryEnvelope.productType || productType,
    });
  }

  const gemelProducts = (summary.funds || []).map(f => ({
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
  }));
  const marketAdvice = await buildGemelMarketAdvice(gemelProducts, {
    ...profile,
    currentAge: summary.currentAge,
  });

  let recommendations = [
    ...clearinghouseRecs,
    ...generateGemelRecommendations(summary, { marketAdvice })
      .filter(r => !clearinghouseTypes.has(r.type)),
  ];

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
  recommendations = [
    ...recommendations,
    ...findingRecs.filter(r => !recTypes.has(r.type)),
  ].sort((a, b) => (b.impactAmount || 0) - (a.impactAmount || 0));

  const hasUnifiedRecs = (advisoryEnvelope?.primaryRecommendations?.length ?? 0) > 0;

  const displayPrimary = (advisoryEnvelope?.primaryRecommendations ?? []).map(rec => {
    const src = advisoryEnvelope?.centralRecommendations?.find(c => c.id === rec.insightId);
    return sanitizeFormattedRecommendation({
      ...rec,
      financialImpact: src?.financialImpact ?? rec.financialImpact ?? null,
      evidence: src?.evidence ?? rec.evidence ?? null,
    });
  });

  return {
    summary,
    marketAdvice,
    payslipFindings,
    recommendations: hasUnifiedRecs ? [] : recommendations,
    structuredInsights: hasUnifiedRecs ? undefined : structuredInsights,
    insightMeta,
    profile,
    productType: advisoryEnvelope?.productType || productType,
    ...(advisoryEnvelope ? {
      primaryRecommendations: displayPrimary,
      centralRecommendations: (advisoryEnvelope.centralRecommendations || []).map(c => ({
        ...c,
        evidence: sanitizeEvidenceForClient(c.evidence),
      })),
      positiveFindings: (advisoryEnvelope.positiveFindings || [])
        .map(i => sanitizePensionDisplayInsight(unifiedToGemelDisplay(i)))
        .filter(Boolean),
      additionalInsights: (advisoryEnvelope.additionalInsights || [])
        .map(i => sanitizePensionDisplayInsight(unifiedToGemelDisplay(i)))
        .filter(Boolean),
      secondaryInsights: advisoryEnvelope.secondaryInsights,
      marketData: advisoryEnvelope.marketData,
      dataQuality: advisoryEnvelope.dataQuality,
      missingData: advisoryEnvelope.missingData,
      llm: advisoryEnvelope.llm,
      analysisId: advisoryEnvelope.analysisId,
      disclaimer: advisoryEnvelope.disclaimer,
      productDisclaimer: advisoryEnvelope.productDisclaimer,
      prioritizationStats: advisoryEnvelope.summary?.prioritizationStats,
      llmSummary: advisoryEnvelope.llm?.summary,
      recommendationEngine: advisoryEnvelope.recommendationEngine ?? undefined,
    } : {}),
  };
}

module.exports = { buildGemelAnalysis, buildGemelPayslipFindings };
