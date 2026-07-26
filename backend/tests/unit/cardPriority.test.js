'use strict';

const {
  CARD_SLOTS,
  MARKET_STATUSES,
  FEE_STATUSES,
  CONFIDENCE_LEVELS,
} = require('../../services/financialAdvisory/recommendationCards/recommendationCardContract');
const {
  hasValidMarketComparison,
  pickPortfolioCardForSlot,
  scoreMarketCardForPortfolio,
} = require('../../services/financialAdvisory/recommendationCards/cardPriority');

function marketCard(overrides = {}) {
  return {
    slot: CARD_SLOTS.MARKET_COMPARISON,
    status: MARKET_STATUSES.ABOVE_PEER_MEDIAN,
    confidence: CONFIDENCE_LEVELS.MEDIUM,
    cardOutcome: 'monitoring',
    metrics: { userRank: 13, peerCount: 47 },
    ...overrides,
  };
}

describe('cardPriority market portfolio selection', () => {
  it('prefers matched ranked account over unmatched account', () => {
    const analyses = [
      {
        accountId: 'ranked',
        accountLabel: 'Step5 Audit',
        cards: [marketCard({ status: MARKET_STATUSES.ABOVE_PEER_MEDIAN, metrics: { userRank: 13, peerCount: 47 } })],
      },
      {
        accountId: 'unmatched',
        accountLabel: 'הראל',
        cards: [marketCard({
          status: MARKET_STATUSES.UNMATCHED,
          confidence: CONFIDENCE_LEVELS.LOW,
          metrics: {},
        })],
      },
    ];

    const picked = pickPortfolioCardForSlot(analyses, CARD_SLOTS.MARKET_COMPARISON);
    expect(picked.accountId).toBe('ranked');
    expect(picked.status).not.toBe(MARKET_STATUSES.UNMATCHED);
    expect(picked.metrics.userRank).toBe(13);
  });

  it('ranks unmatched below matched comparisons', () => {
    const matchedScore = scoreMarketCardForPortfolio(marketCard({
      status: MARKET_STATUSES.ABOVE_PEER_MEDIAN,
      confidence: CONFIDENCE_LEVELS.HIGH,
      metrics: { userRank: 13 },
    }));
    const unmatchedScore = scoreMarketCardForPortfolio(marketCard({
      status: MARKET_STATUSES.UNMATCHED,
      confidence: CONFIDENCE_LEVELS.HIGH,
      metrics: {},
    }));

    expect(matchedScore).toBeGreaterThan(unmatchedScore);
  });

  it('prefers high-confidence matched over low-confidence matched', () => {
    const analyses = [
      {
        accountId: 'low',
        accountLabel: 'נמוך',
        cards: [marketCard({
          status: MARKET_STATUSES.BELOW_PEER_MEDIAN,
          confidence: CONFIDENCE_LEVELS.LOW,
          metrics: { userRank: 40, peerCount: 47 },
        })],
      },
      {
        accountId: 'high',
        accountLabel: 'גבוה',
        cards: [marketCard({
          status: MARKET_STATUSES.BOTTOM_PEER_GROUP,
          confidence: CONFIDENCE_LEVELS.HIGH,
          metrics: { userRank: 45, peerCount: 47 },
        })],
      },
    ];

    const picked = pickPortfolioCardForSlot(analyses, CARD_SLOTS.MARKET_COMPARISON);
    expect(picked.accountId).toBe('high');
  });

  it('falls back to unmatched only when no valid market comparison exists', () => {
    const analyses = [
      {
        accountId: 'only-unmatched',
        accountLabel: 'ללא התאמה',
        cards: [marketCard({ status: MARKET_STATUSES.UNMATCHED, metrics: {} })],
      },
    ];

    expect(hasValidMarketComparison(analyses[0].cards[0])).toBe(false);
    const picked = pickPortfolioCardForSlot(analyses, CARD_SLOTS.MARKET_COMPARISON);
    expect(picked.accountId).toBe('only-unmatched');
    expect(picked.status).toBe(MARKET_STATUSES.UNMATCHED);
  });

  it('still picks highest-fee account for fees slot', () => {
    const analyses = [
      {
        accountId: 'low',
        accountLabel: 'נמוך',
        cards: [{ slot: CARD_SLOTS.MANAGEMENT_FEES, status: FEE_STATUSES.COMPETITIVE, cardOutcome: 'monitoring' }],
      },
      {
        accountId: 'high',
        accountLabel: 'גבוה',
        cards: [{ slot: CARD_SLOTS.MANAGEMENT_FEES, status: FEE_STATUSES.HIGH, cardOutcome: 'actionable', metrics: { estimatedAnnualSaving: 5000 } }],
      },
    ];

    const picked = pickPortfolioCardForSlot(analyses, CARD_SLOTS.MANAGEMENT_FEES);
    expect(picked.accountId).toBe('high');
  });
});
