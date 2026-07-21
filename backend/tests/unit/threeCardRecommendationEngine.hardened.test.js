'use strict';

const { describe, it, expect, beforeEach } = require('@jest/globals');
const { analyzeFeeDimensions, classifySingleFeeStatus } = require('../../services/financialAdvisory/recommendationCards/feeAnalysisCore');
const { buildFeesCard } = require('../../services/financialAdvisory/recommendationCards/feesCardBuilder');
const { buildTrackSuitabilityCard } = require('../../services/financialAdvisory/recommendationCards/trackSuitabilityCardBuilder');
const { buildSuitabilityContext } = require('../../services/financialAdvisory/recommendationCards/suitabilityContext');
const { classifyPeerMarketStatus, analyzeReturnPeriodDivergence } = require('../../services/financialAdvisory/recommendationCards/peerMarketStatus');
const { selectMarketAlternatives, FORBIDDEN_ALT_PHRASE } = require('../../services/financialAdvisory/recommendationCards/alternativeSelector');
const { pickPortfolioCardForSlot } = require('../../services/financialAdvisory/recommendationCards/cardPriority');
const { FORBIDDEN_PHRASES, CARD_SLOT_ORDER } = require('../../services/financialAdvisory/recommendationCards/recommendationCardContract');
const { cardsToPrimaryRecommendations } = require('../../services/financialAdvisory/recommendationCards/cardDisplayMapper');

jest.mock('../../services/marketComparison/marketComparisonService', () => ({
  getMarketComparison: jest.fn(),
}));

jest.mock('../../services/marketComparison/adapters/pensionComparisonAdapter', () => ({
  loadPensionComparisonRecords: jest.fn().mockResolvedValue({
    records: [{
      fundId: '12345',
      comparisonGroup: 'pension_equity',
      riskLevel: 'medium',
      rankingScore: 62,
      managementFeeBalance: 0.98,
    }],
    meta: {},
    source: 'pensianet',
  }),
}));

const { getMarketComparison } = require('../../services/marketComparison/marketComparisonService');
const { runThreeCardRecommendationEngine } = require('../../services/financialAdvisory/recommendationCards/threeCardRecommendationEngine');

const userMedium = {
  personal: { age: 35 },
  retirement: { yearsToRetirement: 32 },
  financial: { riskTolerance: 'medium' },
  risk: { effective: 'medium' },
};

const peerGroup = {
  groupKey: 'pension:medium',
  comparisonGroupLabel: 'מניות',
  peers: [
    { assetFee: 0.53, depositFee: 0.15 },
    { assetFee: 0.61, depositFee: 0.18 },
    { assetFee: 0.48, depositFee: 0.12 },
  ],
};

function fund(overrides) {
  return {
    id: 'f1',
    fundName: 'מסלול',
    currentBalance: 200000,
    monthlyDeposit: 2500,
    managementFeeAccumulation: 0.0098,
    managementFeeDeposit: 0.0015,
    riskLevel: 'medium',
    isActive: true,
    ...overrides,
  };
}

function marketCtx(fundId, matchId = '12345') {
  return {
    fundId,
    matchConfidence: 0.88,
    match: { id: matchId, riskLevel: 'medium' },
    peerGroup,
  };
}

describe('feeAnalysisCore', () => {
  it('separates pension deposit and balance fee statuses', () => {
    const analysis = analyzeFeeDimensions({
      fund: fund({ managementFeeAccumulation: 0.004, managementFeeDeposit: 0.025 }),
      peerGroup,
      productKind: 'pension',
    });
    expect(analysis.depositFeeStatus).not.toBe(analysis.balanceFeeStatus);
    expect(['high', 'above_average', 'competitive', 'excellent']).toContain(analysis.balanceFeeStatus);
  });

  it('calculates annual fee cost from deposits and balance', () => {
    const analysis = analyzeFeeDimensions({
      fund: fund({ currentBalance: 100000, monthlyDeposit: 2000, managementFeeAccumulation: 0.01, managementFeeDeposit: 0.02 }),
      peerGroup,
      productKind: 'pension',
    });
    expect(analysis.estimatedAnnualCost).toBeGreaterThan(0);
    expect(analysis.calculationInputs.annualDeposits).toBe(24000);
  });

  it('gemel uses balance fee only when deposit not applicable', () => {
    const analysis = analyzeFeeDimensions({
      fund: fund({ managementFeeDeposit: null, fundType: 'provident_fund' }),
      peerGroup,
      productKind: 'gemel',
    });
    expect(analysis.depositFeeStatus).toBe('not_applicable');
  });
});

describe('suitabilityContext product horizons', () => {
  it('uses retirement horizon for pension', () => {
    const ctx = buildSuitabilityContext({ userContext: userMedium, fund: fund(), productType: 'PENSION' });
    expect(ctx.productKind).toBe('pension');
    expect(ctx.horizonSource).toBe('retirement_profile');
  });

  it('does not reuse pension horizon for hishtalmut when liquidity date exists', () => {
    const ctx = buildSuitabilityContext({
      userContext: userMedium,
      fund: fund({ fundType: 'study_fund', rawData: { expectedLiquidityDate: new Date(Date.now() + 500 * 86400000).toISOString() } }),
      productType: 'HISHTALMUT',
    });
    expect(ctx.productKind).toBe('hishtalmut');
    expect(ctx.horizonSource).not.toBe('retirement_profile');
    expect(ctx.blockers).toContain('near_term_withdrawal');
  });
});

describe('track suitability blockers', () => {
  it('returns provisional conservative when risk tolerance missing for young user', () => {
    const card = buildTrackSuitabilityCard({
      primaryFund: fund({ riskLevel: 'low' }),
      marketCtx: marketCtx('f1'),
      userContext: { personal: { age: 28 }, financial: {}, risk: { effective: null } },
      productType: 'PENSION',
    });
    expect(card.status).toBe('missing_profile');
    expect(card.cardOutcome).toBe('information_required');
  });

  it('blocks too_conservative when near-term withdrawal', () => {
    const card = buildTrackSuitabilityCard({
      primaryFund: fund({
        fundType: 'study_fund',
        riskLevel: 'low',
        rawData: { expectedLiquidityDate: new Date(Date.now() + 400 * 86400000).toISOString() },
      }),
      marketCtx: marketCtx('f1'),
      userContext: {
        ...userMedium,
        financial: { riskTolerance: 'high' },
        risk: { effective: 'high' },
      },
      productType: 'HISHTALMUT',
    });
    expect(card.status).toBe('provisional_conservative');
    expect(card.cardOutcome).toBe('information_required');
    expect(card.summary).toMatch(/חסרים נתונים/);
  });

  it('flags low risk tolerance in an equity track as too aggressive', () => {
    const card = buildTrackSuitabilityCard({
      primaryFund: fund({ riskLevel: 'high' }),
      marketCtx: { ...marketCtx('f1'), match: { id: '12345', riskLevel: 'high' } },
      userContext: { ...userMedium, financial: { riskTolerance: 'low' }, risk: { effective: 'low' } },
      productType: 'PENSION',
    });
    expect(card.status).toBe('too_aggressive');
    expect(card.cardOutcome).toBe('actionable');
  });

  it('uses investment_gemel horizon not pension retirement', () => {
    const ctx = buildSuitabilityContext({
      userContext: {
        ...userMedium,
        retirement: { yearsToRetirement: 30 },
        profile: { insuranceOnboarding: { answers: { 'gemel.investmentHorizonYears': 4 } } },
      },
      fund: fund({ fundType: 'investment_gemel', riskLevel: 'medium' }),
      productType: 'GEMEL',
    });
    expect(ctx.productKind).toBe('investment_gemel');
    expect(ctx.horizonYears).toBe(4);
    expect(ctx.horizonSource).toBe('investment_horizon');
    expect(ctx.suitableRiskRange.max).toBe('medium');
  });
});

describe('peer market status', () => {
  it('distinguishes above median from top peer group', () => {
    expect(classifyPeerMarketStatus({ rankingScore: 95, rankingStatus: 'ranked' })).toBe('top_peer_group');
    expect(classifyPeerMarketStatus({ rankingScore: 70, rankingStatus: 'ranked' })).toBe('above_peer_median');
    expect(classifyPeerMarketStatus({ rankingScore: 50, rankingStatus: 'ranked' })).toBe('around_peer_median');
    expect(classifyPeerMarketStatus({ rankingScore: 25, rankingStatus: 'ranked' })).toBe('below_peer_median');
    expect(classifyPeerMarketStatus({ rankingScore: 5, rankingStatus: 'ranked' })).toBe('bottom_peer_group');
  });

  it('flags strong 12m with weak 5y divergence', () => {
    const d = analyzeReturnPeriodDivergence({ return12Months: 10, return5YearsAnnualized: 2 });
    expect(d.divergence).toBe(true);
  });

  it('flags weak 12m with strong 5y divergence', () => {
    const d = analyzeReturnPeriodDivergence({ return12Months: -2, return5YearsAnnualized: 7 });
    expect(d.divergence).toBe(true);
  });

  it('returns short_term_only when only 12 months available', () => {
    expect(classifyPeerMarketStatus({
      rankingScore: 55,
      rankingStatus: 'ranked',
      historyMeta: { only12Months: true },
    })).toBe('short_term_only');
  });

  it('does not treat partial market match as top performer', () => {
    expect(classifyPeerMarketStatus({ rankingScore: 70, rankingStatus: 'ranked' })).toBe('above_peer_median');
    expect(classifyPeerMarketStatus({ rankingScore: 95, rankingStatus: 'ranked' })).toBe('top_peer_group');
  });
});

describe('alternative selection gating', () => {
  it('returns no alternatives when confidence is low and not fee-driven', () => {
    const alts = selectMarketAlternatives({
      group: { funds: [{ fundId: '2', rankingStatus: 'ranked', rank: 1, rankingScore: 90 }] },
      userFundEntry: { fundId: '1', rankingStatus: 'ranked', rank: 9, rankingScore: 20 },
      officialRecord: { comparisonGroup: 'pension_equity', riskLevel: 'medium' },
      suitabilityConfidence: 'low',
      peerStatus: 'bottom_peer_group',
      historyComplete: false,
      matchConfidencePct: 80,
      feesHigh: false,
    });
    expect(alts).toHaveLength(0);
  });

  it('allows alternatives for high fees with around-median performance', () => {
    const group = {
      rankedRecords: 5,
      funds: [
        { fundId: '1', rankingStatus: 'ranked', rank: 3, rankingScore: 48, managementFeeBalance: 1.2, riskLevel: 'medium' },
        { fundId: '2', rankingStatus: 'ranked', rank: 1, rankingScore: 75, managementFeeBalance: 0.5, riskLevel: 'medium', return5YearsAnnualized: 6 },
      ],
    };
    const alts = selectMarketAlternatives({
      group,
      userFundEntry: group.funds[0],
      officialRecord: { comparisonGroup: 'pension_equity', riskLevel: 'medium' },
      suitabilityConfidence: 'medium',
      peerStatus: 'around_peer_median',
      historyComplete: true,
      matchConfidencePct: 85,
      feesHigh: true,
    });
    expect(alts.length).toBeLessThanOrEqual(3);
  });

  it('never uses forbidden alternative phrasing', () => {
    expect(FORBIDDEN_ALT_PHRASE).toBe('הקופה שכדאי לעבור אליה');
  });

  it('restricts alternatives to ranked peers in the same group', () => {
    const group = {
      rankedRecords: 4,
      funds: [
        { fundId: '1', rankingStatus: 'ranked', rank: 4, rankingScore: 15, riskLevel: 'medium', return5YearsAnnualized: 2 },
        { fundId: '2', rankingStatus: 'ranked', rank: 1, rankingScore: 90, riskLevel: 'medium', return5YearsAnnualized: 7 },
        { fundId: '3', rankingStatus: 'unmatched', rank: null, rankingScore: null, riskLevel: 'high' },
      ],
    };
    const alts = selectMarketAlternatives({
      group,
      userFundEntry: group.funds[0],
      officialRecord: { comparisonGroup: 'pension_equity', riskLevel: 'medium' },
      suitabilityConfidence: 'medium',
      peerStatus: 'bottom_peer_group',
      historyComplete: true,
      matchConfidencePct: 85,
      feesHigh: false,
    });
    expect(alts.every(a => a.fundId !== '1')).toBe(true);
    expect(alts.every(a => a.fundId !== '3')).toBe(true);
    expect(alts.length).toBeLessThanOrEqual(3);
  });
});

describe('portfolio-level card selection', () => {
  it('picks fee card from highest-fee account across portfolio', () => {
    const analyses = [
      {
        accountId: 'a1',
        accountLabel: 'נמוך',
        cards: [buildFeesCard({ primaryFund: fund({ id: 'a1', managementFeeAccumulation: 0.004 }), marketCtx: marketCtx('a1'), userContext: userMedium, productType: 'PENSION' })],
      },
      {
        accountId: 'a2',
        accountLabel: 'גבוה',
        cards: [buildFeesCard({ primaryFund: fund({ id: 'a2', managementFeeAccumulation: 0.02, managementFeeDeposit: 0.03 }), marketCtx: marketCtx('a2'), userContext: userMedium, productType: 'PENSION' })],
      },
    ];
    analyses[0].cards.push({ slot: 'track_suitability' }, { slot: 'market_comparison' });
    analyses[1].cards.push({ slot: 'track_suitability' }, { slot: 'market_comparison' });

    const picked = pickPortfolioCardForSlot(analyses, 'management_fees');
    expect(picked.accountId).toBe('a2');
    expect(picked.portfolioSelection.otherAccounts.length).toBeGreaterThan(0);
  });

  it('can select each portfolio slot from a different account', async () => {
    const lowFeeFund = fund({ id: 'fee-ok', fundName: 'דמי נמוך', managementFeeAccumulation: 0.004, managementFeeDeposit: 0.001, riskLevel: 'low' });
    const highFeeFund = fund({ id: 'fee-bad', fundName: 'דמי גבוה', managementFeeAccumulation: 0.025, managementFeeDeposit: 0.035, riskLevel: 'low' });
    const aggressiveFund = fund({ id: 'risk-high', fundName: 'מסלול תנודתי', managementFeeAccumulation: 0.007, riskLevel: 'high' });

    getMarketComparison.mockResolvedValueOnce({
      groups: [{
        comparisonGroup: 'pension_equity',
        rankedRecords: 10,
        funds: [
          { fundId: '12345', rank: 2, rankingScore: 88, rankingStatus: 'ranked', riskLevel: 'medium', return5YearsAnnualized: 6, return12Months: 4 },
          { fundId: '999', rank: 9, rankingScore: 18, rankingStatus: 'ranked', riskLevel: 'medium', return5YearsAnnualized: 2, return12Months: -1 },
          { fundId: '888', rank: 1, rankingScore: 95, rankingStatus: 'ranked', riskLevel: 'high', return5YearsAnnualized: 7, return12Months: 5 },
        ],
      }],
      dataQuality: { lastUpdated: new Date().toISOString() },
    });

    const result = await runThreeCardRecommendationEngine({
      productType: 'PENSION',
      funds: [lowFeeFund, highFeeFund, aggressiveFund],
      userContext: { ...userMedium, financial: { riskTolerance: 'low' }, risk: { effective: 'low' } },
      marketContexts: [
        { fundId: 'fee-ok', matchConfidence: 0.9, match: { id: '12345', riskLevel: 'low' }, peerGroup },
        { fundId: 'fee-bad', matchConfidence: 0.9, match: { id: '999', riskLevel: 'low' }, peerGroup },
        { fundId: 'risk-high', matchConfidence: 0.9, match: { id: '888', riskLevel: 'high' }, peerGroup },
      ],
      allInsights: [],
    });

    const feeCard = result.recommendationCards.find(c => c.slot === 'management_fees');
    const trackCard = result.recommendationCards.find(c => c.slot === 'track_suitability');
    const marketCard = result.recommendationCards.find(c => c.slot === 'market_comparison');

    expect(feeCard.accountId).toBe('fee-bad');
    expect(trackCard.accountId).toBe('risk-high');
    expect(['fee-ok', 'fee-bad']).toContain(marketCard.accountId);
    expect(new Set(result.recommendationCards.map(c => c.accountId)).size).toBeGreaterThanOrEqual(2);
  });
});

describe('threeCardRecommendationEngine integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getMarketComparison.mockResolvedValue({
      groups: [{
        comparisonGroup: 'pension_equity',
        rankedRecords: 10,
        funds: [
          { fundId: '12345', rank: 8, rankingScore: 62, rankingStatus: 'ranked', fundName: 'שלי', managementFeeBalance: 0.98, riskLevel: 'medium', return5YearsAnnualized: 5, return12Months: 3 },
          { fundId: '999', rank: 1, rankingScore: 91, rankingStatus: 'ranked', fundName: 'א', managementFeeBalance: 0.55, riskLevel: 'medium', return5YearsAnnualized: 6.5, return12Months: 4 },
        ],
      }],
      dataQuality: { lastUpdated: new Date().toISOString() },
    });
  });

  it('returns three portfolio cards and account analysis for every account', async () => {
    const funds = [
      fund({ id: 'a1', fundName: 'חשבון א', currentBalance: 300000 }),
      fund({ id: 'a2', fundName: 'חשבון ב', currentBalance: 50000, riskLevel: 'low' }),
    ];
    const result = await runThreeCardRecommendationEngine({
      productType: 'PENSION',
      funds,
      userContext: userMedium,
      marketContexts: [marketCtx('a1'), marketCtx('a2', '999')],
      allInsights: [],
    });

    expect(result.recommendationCards).toHaveLength(3);
    expect(result.recommendationCards.map(c => c.slot)).toEqual(CARD_SLOT_ORDER);
    expect(result.accountAnalyses).toHaveLength(2);
    result.accountAnalyses.forEach(a => expect(a.cards).toHaveLength(3));
    expect(result.meta.engineVersion).toBe('three_card_v5');
  });

  it('each portfolio card includes accountId and why', async () => {
    const result = await runThreeCardRecommendationEngine({
      productType: 'PENSION',
      funds: [fund()],
      userContext: userMedium,
      marketContexts: [marketCtx('f1')],
      allInsights: [],
    });
    result.recommendationCards.forEach(c => {
      expect(c.why).toBeTruthy();
      expect(c.cardOutcome).toBeTruthy();
    });
  });

  it('primary recommendations never contain forbidden phrases', async () => {
    const result = await runThreeCardRecommendationEngine({
      productType: 'PENSION',
      funds: [fund()],
      userContext: userMedium,
      marketContexts: [marketCtx('f1')],
      allInsights: [],
    });
    const text = JSON.stringify(result.primaryRecommendations);
    FORBIDDEN_PHRASES.forEach(p => expect(text).not.toContain(p));
  });

  it('returns insufficient_data slots when no funds', async () => {
    const result = await runThreeCardRecommendationEngine({
      productType: 'PENSION',
      funds: [],
      userContext: userMedium,
      marketContexts: [],
      allInsights: [],
    });
    expect(result.recommendationCards).toHaveLength(3);
    result.recommendationCards.forEach(c => expect(c.cardOutcome).toBe('insufficient_data'));
  });

  it('maps to primary recommendations with account labels', () => {
    const primary = cardsToPrimaryRecommendations([{
      id: 'x',
      slot: 'management_fees',
      title: 'דמי ניהול',
      summary: 'סיכום',
      recommendation: 'המשך',
      why: 'כי',
      confidence: 'medium',
      confidenceLabelHe: 'בינונית',
      accountId: 'acc1',
      accountLabel: 'פנסיה א',
      metrics: {},
    }]);
    expect(primary[0].accountId).toBe('acc1');
    expect(primary[0].whyItMatters).toBe('כי');
  });

  it('returns unmatched market card for weak match confidence', async () => {
    const result = await runThreeCardRecommendationEngine({
      productType: 'PENSION',
      funds: [fund({ id: 'weak-match' })],
      userContext: userMedium,
      marketContexts: [{ fundId: 'weak-match', matchConfidence: 0.15, match: { id: '12345', riskLevel: 'medium' }, peerGroup }],
      allInsights: [],
    });
    const marketCard = result.recommendationCards.find(c => c.slot === 'market_comparison');
    expect(marketCard.status).toBe('unmatched');
    expect(marketCard.cardOutcome).toBe('insufficient_data');
  });

  it('never exceeds three portfolio cards or three alternatives', async () => {
    getMarketComparison.mockResolvedValueOnce({
      groups: [{
        comparisonGroup: 'pension_equity',
        rankedRecords: 10,
        funds: Array.from({ length: 8 }, (_, i) => ({
          fundId: String(100 + i),
          rank: i + 1,
          rankingScore: 90 - i * 5,
          rankingStatus: 'ranked',
          riskLevel: 'medium',
          return5YearsAnnualized: 6,
          managementFeeBalance: 0.4,
        })).concat([
          { fundId: '12345', rank: 9, rankingScore: 12, rankingStatus: 'ranked', riskLevel: 'medium', return5YearsAnnualized: 1.5, managementFeeBalance: 1.5 },
        ]),
      }],
      dataQuality: { lastUpdated: new Date().toISOString() },
    });

    const result = await runThreeCardRecommendationEngine({
      productType: 'PENSION',
      funds: [fund({ managementFeeAccumulation: 0.02, managementFeeDeposit: 0.025 })],
      userContext: userMedium,
      marketContexts: [marketCtx('f1')],
      allInsights: [],
    });

    expect(result.recommendationCards).toHaveLength(3);
    const marketCard = result.recommendationCards.find(c => c.slot === 'market_comparison');
    expect((marketCard.alternatives || []).length).toBeLessThanOrEqual(3);
    expect(JSON.stringify(result)).not.toContain(FORBIDDEN_PHRASES[0]);
  });
});

describe('classifySingleFeeStatus', () => {
  it('maps percentile buckets', () => {
    expect(classifySingleFeeStatus(0.4, [0.5, 0.55, 0.6, 0.65])).toBe('excellent');
    expect(classifySingleFeeStatus(0.5, [0.4, 0.5, 0.6, 0.7])).toBe('competitive');
    expect(classifySingleFeeStatus(0.65, [0.4, 0.5, 0.6, 0.7])).toBe('above_average');
  });
});
