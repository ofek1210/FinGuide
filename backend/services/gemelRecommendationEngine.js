'use strict';

const PensionFund = require('../models/PensionFund');
const { GEMEL_FUND_TYPES, findGemelHoldings } = require('../ai/tools/gemelTools');
const { loadPensionUserContext } = require('./pensionUserProfileService');
const { loadRelevantGemelMarketData } = require('./gemelMarketDataService');
const advisoryConfig = require('../config/financialAdvisoryConfig');
const {
  analyzeGemelFees,
  analyzeGemelPerformance,
  analyzeGemelLiquidity,
  analyzeGemelInactive,
  analyzeGemelDeposits,
  analyzeGemelRiskFit,
  analyzeGemelDataQuality,
  analyzeGemelFragmentation,
  productTypeForFund,
} = require('./gemelAnalyzers');

const PER_FUND_ANALYZERS = [
  analyzeGemelFees,
  analyzeGemelPerformance,
  analyzeGemelLiquidity,
  analyzeGemelInactive,
  analyzeGemelDeposits,
  analyzeGemelRiskFit,
  analyzeGemelDataQuality,
];

/**
 * @param {string} userId
 * @param {object} [options]
 * @param {'GEMEL'|'HISHTALMUT'|null} [options.productTypeFilter]
 * @returns {Promise<{ insights: object[], meta: object, missingData: object[] }>}
 */
async function runGemelRecommendationEngine(userId, options = {}) {
  const startedAt = Date.now();
  const allFunds = options.funds || await findGemelHoldings(userId);

  let funds = allFunds;
  if (options.productTypeFilter === 'HISHTALMUT') {
    funds = allFunds.filter(f => f.fundType === 'study_fund');
  } else if (options.productTypeFilter === 'GEMEL') {
    funds = allFunds.filter(f => f.fundType === 'provident_fund');
  }

  const missingData = [];
  const userContext = await loadPensionUserContext(userId, options.summary);

  if (!userContext.personal.age) {
    missingData.push({ field: 'age', message: 'גיל המשתמש לא זמין — חלק מהבדיקות מוגבלות.' });
  }
  if (!userContext.financial.riskTolerance) {
    missingData.push({ field: 'riskTolerance', message: 'העדפת סיכון מהאונבורדינג לא זמינה.' });
  }

  const meta = {
    fundCount: funds.length,
    analyzersRun: [],
    marketMatches: [],
    missingData,
    generatedAt: new Date().toISOString(),
    ruleVersion: advisoryConfig.ruleVersion,
    disclaimer: advisoryConfig.disclaimers.gemel,
  };

  if (!funds.length) {
    missingData.push({ field: 'funds', message: 'לא נמצאו מוצרי גמל/השתלמות — יש להעלות דוח מסלקה או להזין ידנית.' });
    return { insights: [], meta, missingData };
  }

  let marketContexts = [];
  try {
    marketContexts = await loadRelevantGemelMarketData(userId, funds);
    meta.marketMatches = marketContexts.map(m => ({
      fundId: m.fundId,
      matchConfidence: m.matchConfidence ?? 0,
      allowPeerRanking: m.productMatch?.allowPeerRanking ?? false,
      peerGroupSize: m.peerGroup?.size ?? 0,
    }));
  } catch (err) {
    console.error('[runGemelRecommendationEngine] market data failed:', err.message);
    meta.marketDataError = err.message;
    missingData.push({ field: 'market_data', message: 'שגיאה בטעינת נתוני גמל-נט.' });
  }

  const insights = [];

  for (let i = 0; i < funds.length; i += 1) {
    const fund = funds[i];
    const marketCtx = marketContexts[i] || {};
    const ctx = {
      fundId: fund._id?.toString?.() || fund.id,
      userContext,
      match: marketCtx.match,
      peerGroup: marketCtx.peerGroup,
      productMatch: marketCtx.productMatch,
      matchConfidence: marketCtx.matchConfidence,
    };

    for (const analyzer of PER_FUND_ANALYZERS) {
      try {
        const batch = analyzer(fund, ctx);
        if (batch?.length) {
          insights.push(...batch);
          meta.analyzersRun.push(analyzer.name);
        }
      } catch (err) {
        console.error(`[runGemelRecommendationEngine] ${analyzer.name}:`, err.message);
      }
    }
  }

  if (options.productTypeFilter !== 'HISHTALMUT') {
    insights.push(...analyzeGemelFragmentation(funds, f => f.fundType === 'provident_fund'));
  }
  if (options.productTypeFilter !== 'GEMEL') {
    insights.push(...analyzeGemelFragmentation(funds, f => f.fundType === 'study_fund'));
  }

  meta.durationMs = Date.now() - startedAt;
  meta.dataCompleteness = {
    hasOnboardingProfile: Boolean(userContext.profile),
    hasAge: userContext.personal.age != null,
    hasRiskTolerance: Boolean(userContext.financial.riskTolerance),
    marketMatchRate: marketContexts.filter(m => m.match).length / Math.max(funds.length, 1),
  };

  return { insights, meta, missingData };
}

module.exports = {
  runGemelRecommendationEngine,
  productTypeForFund,
};
