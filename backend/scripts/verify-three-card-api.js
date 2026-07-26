'use strict';

/**
 * Verify three-card engine is active via runFinancialAdvisoryAgent (same path as GET /api/pension/analysis).
 * Usage: node backend/scripts/verify-three-card-api.js
 */

const path = require('path');

const marketComparisonPath = path.join(__dirname, '../services/marketComparison/marketComparisonService.js');
const pensionAdapterPath = path.join(__dirname, '../services/marketComparison/adapters/pensionComparisonAdapter.js');
const marketComparison = require(marketComparisonPath);
const pensionAdapter = require(pensionAdapterPath);

marketComparison.getMarketComparison = async () => ({
  groups: [{
    comparisonGroup: 'pension_equity',
    rankedRecords: 10,
    funds: [{
      fundId: '12345',
      rank: 5,
      rankingScore: 55,
      rankingStatus: 'ranked',
      fundName: 'מסלול רשמי',
      riskLevel: 'medium',
      return5YearsAnnualized: 5.5,
      return12Months: 3,
    }],
  }],
  dataQuality: { lastUpdated: new Date().toISOString() },
});

pensionAdapter.loadPensionComparisonRecords = async () => ({
  records: [{
    fundId: '12345',
    comparisonGroup: 'pension_equity',
    riskLevel: 'medium',
  }],
  meta: {},
  source: 'stub',
});

require('dotenv').config({ path: path.join(__dirname, '../.env') });
const mongoose = require('mongoose');

const { runFinancialAdvisoryAgent } = require('../services/financialAdvisory/runFinancialAdvisoryAgent');

const peerGroup = {
  groupKey: 'pension:medium',
  comparisonGroupLabel: 'מניות',
  peers: [
    { assetFee: 0.53, depositFee: 0.15 },
    { assetFee: 0.61, depositFee: 0.18 },
    { assetFee: 0.48, depositFee: 0.12 },
  ],
};

const funds = [
  {
    id: 'verify-fund-1',
    fundName: 'פנסיה לאימות מנוע',
    currentBalance: 180000,
    monthlyDeposit: 2500,
    managementFeeAccumulation: 0.0098,
    managementFeeDeposit: 0.0015,
    riskLevel: 'medium',
    isActive: true,
  },
];

const userContext = {
  personal: { age: 36 },
  retirement: { yearsToRetirement: 31 },
  financial: { riskTolerance: 'medium' },
  risk: { effective: 'medium' },
};

async function main() {
  const flag = process.env.USE_THREE_CARD_RECOMMENDATIONS;
  await mongoose.connect(process.env.MONGODB_URI);

  const response = await runFinancialAdvisoryAgent({
    userId: 'verify-three-card-user',
    productType: 'PENSION',
    skipLLM: true,
    precomputed: {
      unifiedInsights: [],
      engineMeta: {
        userContext,
        marketContexts: [{
          fundId: 'verify-fund-1',
          matchConfidence: 0.88,
          match: { id: '12345', riskLevel: 'medium' },
          peerGroup,
        }],
        fundCount: funds.length,
      },
      funds,
      matchResults: [{ matchConfidence: 88 }],
      rawStructured: [],
    },
    legacyFields: {},
    summaryOverride: { totalProducts: funds.length },
  });

  const proof = {
    verifiedAt: new Date().toISOString(),
    USE_THREE_CARD_RECOMMENDATIONS: flag === undefined ? '(unset → enabled)' : flag,
    recommendationEngine: response.recommendationEngine,
    recommendationCardCount: response.recommendationCards?.length ?? 0,
    accountAnalysisCount: response.accountAnalyses?.length ?? 0,
    slots: (response.recommendationCards || []).map(c => ({
      slot: c.slot,
      accountId: c.accountId,
      cardOutcome: c.cardOutcome,
      confidence: c.confidence,
    })),
    engineMeta: response.threeCardMeta,
  };

  console.log(JSON.stringify(proof, null, 2));

  if (response.recommendationEngine !== 'three_card_v5') {
    process.exitCode = 1;
  }

  await mongoose.disconnect();
}

if (require.main === module) {
  main().catch(err => {
    console.error(err);
    process.exit(1);
  });
}

module.exports = { main };
