'use strict';

/**
 * Run three-card engine against representative fixtures — outputs JSON for review.
 * Usage: node backend/scripts/run-three-card-fixtures.js
 */

const path = require('path');

const marketComparisonPath = path.join(__dirname, '../services/marketComparison/marketComparisonService.js');
const pensionAdapterPath = path.join(__dirname, '../services/marketComparison/adapters/pensionComparisonAdapter.js');
const gemelAdapterPath = path.join(__dirname, '../services/marketComparison/adapters/gemelComparisonAdapter.js');
const hishtalmutAdapterPath = path.join(__dirname, '../services/marketComparison/adapters/hishtalmutComparisonAdapter.js');
const investmentGemelAdapterPath = path.join(__dirname, '../services/marketComparison/adapters/investmentGemelComparisonAdapter.js');
const original = require(marketComparisonPath);
const pensionAdapter = require(pensionAdapterPath);
const gemelAdapter = require(gemelAdapterPath);
const hishtalmutAdapter = require(hishtalmutAdapterPath);
const investmentGemelAdapter = require(investmentGemelAdapterPath);

require('dotenv').config({ path: path.join(__dirname, '../.env') });
const mongoose = require('mongoose');

const stubRecords = [
  { fundId: '12345', comparisonGroup: 'pension_equity', riskLevel: 'medium' },
  { fundId: '999', comparisonGroup: 'pension_equity', riskLevel: 'medium' },
  { fundId: '888', comparisonGroup: 'pension_equity', riskLevel: 'medium' },
  { fundId: '777', comparisonGroup: 'pension_equity', riskLevel: 'medium' },
  { fundId: '666', comparisonGroup: 'pension_equity', riskLevel: 'medium' },
];

const stubLoader = async () => ({ records: stubRecords, meta: {}, source: 'stub' });
pensionAdapter.loadPensionComparisonRecords = stubLoader;
gemelAdapter.loadGemelComparisonRecords = stubLoader;
hishtalmutAdapter.loadHishtalmutComparisonRecords = stubLoader;
investmentGemelAdapter.loadInvestmentGemelComparisonRecords = stubLoader;

function stubMarketComparison(overrides = {}) {
  original.getMarketComparison = async () => ({
    groups: [{
      comparisonGroup: 'pension_equity',
      rankedRecords: 10,
      funds: [
        {
          fundId: '12345',
          rank: 8,
          rankingScore: 62,
          rankingStatus: 'ranked',
          fundName: 'מסלול רשמי',
          managingCompany: 'חברה',
          managementFeeBalance: 0.55,
          riskLevel: 'medium',
          return5YearsAnnualized: 5.5,
          return36MonthsAnnualized: 4.2,
          return12Months: 3.1,
        },
        {
          fundId: '999',
          rank: 1,
          rankingScore: 91,
          rankingStatus: 'ranked',
          fundName: 'מסלול א',
          managingCompany: 'חברה א',
          managementFeeBalance: 0.45,
          riskLevel: 'medium',
          return5YearsAnnualized: 6.8,
          return12Months: 4.5,
        },
        {
          fundId: '888',
          rank: 9,
          rankingScore: 15,
          rankingStatus: 'ranked',
          fundName: 'מסלול חלש',
          managingCompany: 'חברה ב',
          managementFeeBalance: 0.5,
          riskLevel: 'medium',
          return5YearsAnnualized: 1.8,
          return12Months: -2,
        },
        {
          fundId: '777',
          rank: 2,
          rankingScore: 88,
          rankingStatus: 'ranked',
          fundName: 'מסלול חזק',
          managingCompany: 'חברה ג',
          managementFeeBalance: 0.42,
          riskLevel: 'medium',
          return5YearsAnnualized: 7.2,
          return12Months: 11,
        },
        {
          fundId: '666',
          rank: 5,
          rankingScore: 52,
          rankingStatus: 'ranked',
          fundName: 'שנה בלבד',
          managingCompany: 'חברה ד',
          managementFeeBalance: 0.5,
          riskLevel: 'medium',
          return12Months: 4,
        },
        ...(overrides.extraFunds || []),
      ],
    }],
    dataQuality: { lastUpdated: new Date().toISOString() },
  });
}

stubMarketComparison();

const { runThreeCardRecommendationEngine } = require('../services/financialAdvisory/recommendationCards/threeCardRecommendationEngine');

const peerGroupRich = {
  groupKey: 'pension:medium',
  comparisonGroupLabel: 'מניות',
  peers: [
    { assetFee: 0.55, depositFee: 0.15 },
    { assetFee: 0.48, depositFee: 0.12 },
    { assetFee: 0.61, depositFee: 0.18 },
  ],
};

const SCENARIOS = [
  {
    id: 1,
    label: 'multi_pension_gemel_accounts',
    productType: 'PENSION',
    userContext: {
      personal: { age: 38 },
      retirement: { yearsToRetirement: 29 },
      financial: { riskTolerance: 'medium' },
      risk: { effective: 'medium' },
    },
    funds: [
      { id: 'p-high-fee', fundName: 'פנסיה א — דמי גבוהים', currentBalance: 400000, managementFeeAccumulation: 0.015, managementFeeDeposit: 0.004, monthlyDeposit: 3000, riskLevel: 'medium' },
      { id: 'p-low-fee', fundName: 'פנסיה ב — דמי נמוך', currentBalance: 80000, managementFeeAccumulation: 0.004, managementFeeDeposit: 0.001, monthlyDeposit: 2000, riskLevel: 'low' },
      { id: 'g1', fundName: 'גמל — מסלול כללי', fundType: 'provident_fund', currentBalance: 95000, managementFeeAccumulation: 0.006, riskLevel: 'medium' },
    ],
    marketContexts: [
      { fundId: 'p-high-fee', matchConfidence: 0.92, match: { id: '888', riskLevel: 'medium' }, peerGroup: peerGroupRich },
      { fundId: 'p-low-fee', matchConfidence: 0.88, match: { id: '999', riskLevel: 'low' }, peerGroup: peerGroupRich },
      { fundId: 'g1', matchConfidence: 0.86, match: { id: '12345', riskLevel: 'medium' }, peerGroup: peerGroupRich },
    ],
  },
  {
    id: 2,
    label: 'young_high_risk_tolerance',
    productType: 'PENSION',
    userContext: {
      personal: { age: 28 },
      retirement: { yearsToRetirement: 37 },
      financial: { riskTolerance: 'high' },
      risk: { effective: 'high' },
    },
    funds: [{ id: 'y1', fundName: 'פנסיה צעיר', currentBalance: 50000, managementFeeAccumulation: 0.007, riskLevel: 'low' }],
    marketContexts: [{ fundId: 'y1', matchConfidence: 0.85, match: { id: '12345', riskLevel: 'low' }, peerGroup: peerGroupRich }],
  },
  {
    id: 3,
    label: 'young_missing_risk_tolerance',
    productType: 'PENSION',
    userContext: { personal: { age: 26 }, retirement: { yearsToRetirement: 39 }, financial: {}, risk: { effective: null } },
    funds: [{ id: 'y2', fundName: 'פנסיה ללא פרופיל', currentBalance: 30000, riskLevel: 'medium' }],
    marketContexts: [{ fundId: 'y2', matchConfidence: 0.8, match: { id: '12345', riskLevel: 'medium' }, peerGroup: { peers: [] } }],
  },
  {
    id: 4,
    label: 'hishtalmut_two_year_horizon',
    productType: 'HISHTALMUT',
    userContext: {
      personal: { age: 34 },
      financial: { riskTolerance: 'medium' },
      risk: { effective: 'medium' },
    },
    funds: [{ id: 'h1', fundName: 'השתלמות', fundType: 'study_fund', currentBalance: 120000, managementFeeAccumulation: 0.006, riskLevel: 'high', rawData: { expectedLiquidityDate: new Date(Date.now() + 400 * 86400000).toISOString() } }],
    marketContexts: [{ fundId: 'h1', matchConfidence: 0.75, match: { id: '12345', riskLevel: 'high' }, peerGroup: { peers: [{ assetFee: 0.4 }] } }],
  },
  {
    id: 5,
    label: 'high_fee_strong_performance',
    productType: 'PENSION',
    userContext: { personal: { age: 42 }, retirement: { yearsToRetirement: 25 }, financial: { riskTolerance: 'medium' }, risk: { effective: 'medium' } },
    funds: [{ id: 'hf-sp', fundName: 'דמי גבוהים + ביצועים חזקים', currentBalance: 320000, managementFeeAccumulation: 0.018, managementFeeDeposit: 0.003, monthlyDeposit: 4000, riskLevel: 'medium' }],
    marketContexts: [{ fundId: 'hf-sp', matchConfidence: 0.9, match: { id: '777', riskLevel: 'medium' }, peerGroup: peerGroupRich }],
  },
  {
    id: 6,
    label: 'low_fee_weak_long_term_performance',
    productType: 'PENSION',
    userContext: { personal: { age: 44 }, retirement: { yearsToRetirement: 23 }, financial: { riskTolerance: 'medium' }, risk: { effective: 'medium' } },
    funds: [{ id: 'lf-wp', fundName: 'דמי נמוכים + חמש שנים חלשות', currentBalance: 210000, managementFeeAccumulation: 0.004, managementFeeDeposit: 0.001, monthlyDeposit: 3500, riskLevel: 'medium' }],
    marketContexts: [{ fundId: 'lf-wp', matchConfidence: 0.88, match: { id: '888', riskLevel: 'medium' }, peerGroup: peerGroupRich }],
  },
  {
    id: 7,
    label: 'unmatched_account',
    productType: 'PENSION',
    userContext: { personal: { age: 40 }, retirement: { yearsToRetirement: 27 }, financial: { riskTolerance: 'medium' }, risk: { effective: 'medium' } },
    funds: [{ id: 'u1', fundName: 'לא מותאם', currentBalance: 10000, riskLevel: 'medium' }],
    marketContexts: [{ fundId: 'u1', matchConfidence: 0.2, match: null, peerGroup: null }],
  },
  {
    id: 8,
    label: 'only_one_year_history',
    productType: 'PENSION',
    userContext: { personal: { age: 33 }, retirement: { yearsToRetirement: 34 }, financial: { riskTolerance: 'medium' }, risk: { effective: 'medium' } },
    funds: [{ id: 'y1h', fundName: 'היסטוריה של שנה', currentBalance: 60000, managementFeeAccumulation: 0.007, riskLevel: 'medium' }],
    marketContexts: [{ fundId: 'y1h', matchConfidence: 0.82, match: { id: '666', riskLevel: 'medium' }, peerGroup: peerGroupRich }],
  },
];

function formatCard(c) {
  return {
    slot: c.slot,
    selectedAccount: { accountId: c.accountId, accountLabel: c.accountLabel },
    status: c.status,
    statusLabelHe: c.statusLabelHe,
    cardOutcome: c.cardOutcome,
    confidence: c.confidence,
    confidenceLabelHe: c.confidenceLabelHe,
    summary: c.summary,
    recommendation: c.recommendation,
    why: c.why,
    evidence: c.metrics,
    alternatives: (c.alternatives || []).map(a => ({
      fundId: a.fundId,
      fundName: a.fundName,
      reasons: a.reasons,
    })),
    alternativesLabelHe: c.alternativesLabelHe,
    portfolioSelection: c.portfolioSelection,
  };
}

async function summarizeScenario(scenario) {
  const result = await runThreeCardRecommendationEngine({
    productType: scenario.productType,
    funds: scenario.funds,
    userContext: scenario.userContext,
    marketContexts: scenario.marketContexts,
    allInsights: [],
  });

  return {
    scenario: scenario.label,
    recommendationEngine: 'three_card_v5',
    portfolioCards: result.recommendationCards.map(formatCard),
    accountAnalyses: result.accountAnalyses.map(a => ({
      accountId: a.accountId,
      accountLabel: a.accountLabel,
      cards: a.cards.map(formatCard),
    })),
  };
}

async function main() {
  await mongoose.connect(process.env.MONGODB_URI);
  const outputs = [];
  for (const scenario of SCENARIOS) {
    outputs.push(await summarizeScenario(scenario));
  }
  console.log(JSON.stringify({
    generatedAt: new Date().toISOString(),
    recommendationEngine: 'three_card_v5',
    USE_THREE_CARD_RECOMMENDATIONS: process.env.USE_THREE_CARD_RECOMMENDATIONS ?? '(unset → enabled)',
    outputs,
  }, null, 2));
  await mongoose.disconnect();
}

if (require.main === module) {
  main().catch(err => {
    console.error(err);
    process.exit(1);
  });
}

module.exports = { main, SCENARIOS };
