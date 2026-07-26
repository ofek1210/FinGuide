'use strict';

const { describe, it, expect, beforeEach } = require('@jest/globals');
const { buildFeesCard } = require('../../services/financialAdvisory/recommendationCards/feesCardBuilder');
const { buildTrackSuitabilityCard } = require('../../services/financialAdvisory/recommendationCards/trackSuitabilityCardBuilder');
const { cardsToPrimaryRecommendations } = require('../../services/financialAdvisory/recommendationCards/cardDisplayMapper');
const { CARD_SLOT_ORDER } = require('../../services/financialAdvisory/recommendationCards/recommendationCardContract');
const { classifySingleFeeStatus } = require('../../services/financialAdvisory/recommendationCards/feeAnalysisCore');

jest.mock('../../services/marketComparison/marketComparisonService', () => ({
  getMarketComparison: jest.fn(),
}));

jest.mock('../../services/marketComparison/adapters/pensionComparisonAdapter', () => ({
  loadPensionComparisonRecords: jest.fn().mockResolvedValue({
    records: [{ fundId: '12345', comparisonGroup: 'pension_equity', riskLevel: 'medium' }],
    meta: {},
    source: 'pensianet',
  }),
}));

const { getMarketComparison } = require('../../services/marketComparison/marketComparisonService');
const { runThreeCardRecommendationEngine } = require('../../services/financialAdvisory/recommendationCards/threeCardRecommendationEngine');

const baseUserContext = {
  personal: { age: 35 },
  retirement: { yearsToRetirement: 32 },
  financial: { riskTolerance: 'medium' },
  risk: { effective: 'medium', fromOnboarding: 'medium' },
};

const baseFund = {
  id: 'f1',
  fundName: 'מסלול בדיקה',
  currentBalance: 250000,
  managementFeeAccumulation: 0.0098,
  managementFeeDeposit: 0.0015,
  riskLevel: 'medium',
  isActive: true,
};

const baseMarketCtx = {
  fundId: 'f1',
  matchConfidence: 0.85,
  match: { id: '12345', fundName: 'מסלול בדיקה רשמי', riskLevel: 'medium' },
  peerGroup: {
    groupKey: 'pension:medium:cohort',
    comparisonGroupLabel: 'מניות',
    peers: [
      { assetFee: 0.53, depositFee: 0.15, return5Y: 6.1 },
      { assetFee: 0.61, depositFee: 0.18, return5Y: 5.8 },
      { assetFee: 0.55, depositFee: 0.16, return5Y: 5.9 },
    ],
  },
};

describe('feesCardBuilder', () => {
  it('classifies high fees and suggests negotiation not switching', () => {
    const card = buildFeesCard({
      primaryFund: { ...baseFund, managementFeeAccumulation: 0.018, managementFeeDeposit: 0.004 },
      marketCtx: baseMarketCtx,
      userContext: baseUserContext,
      productType: 'PENSION',
    });

    expect(['high', 'above_average']).toContain(card.status);
    expect(card.recommendation).toMatch(/משא ומתן/);
    expect(card.metrics.depositFeeStatus).toBeTruthy();
    expect(card.metrics.balanceFeeStatus).toBeTruthy();
  });
});

describe('threeCardRecommendationEngine', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getMarketComparison.mockResolvedValue({
      groups: [{
        comparisonGroup: 'pension_equity',
        rankedRecords: 10,
        funds: [
          { fundId: '12345', rank: 8, rankingScore: 62, rankingStatus: 'ranked', fundName: 'מסלול', riskLevel: 'medium', return5YearsAnnualized: 5, return12Months: 3 },
        ],
      }],
      dataQuality: { lastUpdated: new Date().toISOString() },
    });
  });

  it('always returns exactly three portfolio cards in fixed order', async () => {
    const result = await runThreeCardRecommendationEngine({
      productType: 'PENSION',
      funds: [baseFund],
      userContext: baseUserContext,
      marketContexts: [baseMarketCtx],
      allInsights: [{ id: 'x1', category: 'deposits', severity: 'medium', title: 'פער הפקדות' }],
    });

    expect(result.recommendationCards).toHaveLength(3);
    expect(result.recommendationCards.map(c => c.slot)).toEqual(CARD_SLOT_ORDER);
    expect(result.accountAnalyses).toHaveLength(1);
    expect(result.meta.engineVersion).toBe('three_card_v5');
  });
});

describe('classifySingleFeeStatus', () => {
  it('maps fee percentiles to status buckets', () => {
    expect(classifySingleFeeStatus(0.4, [0.5, 0.55, 0.6, 0.65])).toBe('excellent');
    expect(classifySingleFeeStatus(0.55, [0.5, 0.55, 0.6, 0.65])).toBe('competitive');
  });
});
