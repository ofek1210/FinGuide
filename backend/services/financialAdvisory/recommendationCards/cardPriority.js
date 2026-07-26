'use strict';

const { CARD_SLOTS, FEE_STATUSES, TRACK_STATUSES, MARKET_STATUSES } = require('./recommendationCardContract');

const FEE_PRIORITY = {
  [FEE_STATUSES.HIGH]: 100,
  [FEE_STATUSES.ABOVE_AVERAGE]: 80,
  [FEE_STATUSES.UNKNOWN]: 50,
  [FEE_STATUSES.COMPETITIVE]: 20,
  [FEE_STATUSES.EXCELLENT]: 10,
};

const TRACK_PRIORITY = {
  [TRACK_STATUSES.TOO_AGGRESSIVE]: 90,
  [TRACK_STATUSES.PROVISIONAL_CONSERVATIVE]: 70,
  [TRACK_STATUSES.TOO_CONSERVATIVE]: 85,
  [TRACK_STATUSES.MISSING_PROFILE]: 60,
  [TRACK_STATUSES.UNKNOWN]: 40,
  [TRACK_STATUSES.WELL_MATCHED]: 10,
};

/** Severity among officially matched / ranked market comparisons. */
const MARKET_MATCHED_PRIORITY = {
  [MARKET_STATUSES.BOTTOM_PEER_GROUP]: 100,
  [MARKET_STATUSES.BELOW_PEER_MEDIAN]: 85,
  [MARKET_STATUSES.SHORT_TERM_ONLY]: 55,
  [MARKET_STATUSES.INSUFFICIENT_HISTORY]: 45,
  [MARKET_STATUSES.AROUND_PEER_MEDIAN]: 30,
  [MARKET_STATUSES.ABOVE_PEER_MEDIAN]: 15,
  [MARKET_STATUSES.TOP_PEER_GROUP]: 5,
};

const CONFIDENCE_BONUS = {
  high: 30,
  medium: 20,
  low: 10,
  insufficient_data: 0,
};

const RANKED_MARKET_STATUSES = new Set(Object.keys(MARKET_MATCHED_PRIORITY));

function accountRef(fund) {
  return {
    accountId: fund?._id?.toString?.() || fund?.id || null,
    accountLabel: fund?.fundName || fund?.providerName || 'חשבון',
  };
}

function hasValidMarketComparison(card) {
  if (!card || card.slot !== CARD_SLOTS.MARKET_COMPARISON) return false;
  if (card.status === MARKET_STATUSES.UNMATCHED) return false;
  if (card.metrics?.userRank != null || card.metrics?.userCombinedScore != null) return true;
  return RANKED_MARKET_STATUSES.has(card.status);
}

function scoreMarketCardForPortfolio(card) {
  if (card.status === MARKET_STATUSES.UNMATCHED) {
    return 1;
  }

  let base = MARKET_MATCHED_PRIORITY[card.status] ?? 0;
  base += CONFIDENCE_BONUS[card.confidence] ?? 0;

  if (card.metrics?.userRank != null) {
    base += 15;
  }

  if (card.cardOutcome === 'actionable') {
    base += 5;
  }

  if (card.cardOutcome === 'insufficient_data' || card.cardOutcome === 'information_required') {
    base = Math.min(base, 49);
  }

  return base;
}

function scoreCardForPortfolio(card) {
  if (!card) return -1;

  if (card.slot === CARD_SLOTS.MARKET_COMPARISON) {
    return scoreMarketCardForPortfolio(card);
  }

  let base = 0;
  if (card.slot === CARD_SLOTS.MANAGEMENT_FEES) {
    base = FEE_PRIORITY[card.status] ?? 0;
    if (card.metrics?.estimatedAnnualSaving > 0) base += 10;
  } else if (card.slot === CARD_SLOTS.TRACK_SUITABILITY) {
    base = TRACK_PRIORITY[card.status] ?? 0;
  }

  if (card.cardOutcome === 'actionable') base += 5;
  if (card.cardOutcome === 'insufficient_data') base = Math.min(base, 49);

  return base;
}

function pickPortfolioCardForSlot(accountAnalyses, slot) {
  let best = null;
  let bestScore = -1;
  const candidates = [];

  for (const account of accountAnalyses || []) {
    const card = account.cards?.find(c => c.slot === slot);
    if (!card) continue;
    const score = scoreCardForPortfolio(card);
    candidates.push({
      accountId: account.accountId,
      accountLabel: account.accountLabel,
      score,
      card,
    });
  }

  if (!candidates.length) return null;

  let pool = candidates;
  if (slot === CARD_SLOTS.MARKET_COMPARISON) {
    const matched = candidates.filter(c => hasValidMarketComparison(c.card));
    if (matched.length) {
      pool = matched;
    }
  }

  for (const candidate of pool) {
    if (candidate.score > bestScore) {
      bestScore = candidate.score;
      best = candidate;
    }
  }

  const selected = {
    ...best.card,
    accountId: best.accountId,
    accountLabel: best.accountLabel,
    portfolioSelection: {
      selectedAccountId: best.accountId,
      selectedAccountLabel: best.accountLabel,
      priorityScore: bestScore,
      otherAccounts: candidates
        .filter(c => c.accountId !== best.accountId)
        .map(c => ({
          accountId: c.accountId,
          accountLabel: c.accountLabel,
          priorityScore: c.score,
          reasonNotSelected: c.score < bestScore
            ? 'ממצא בעדיפות נמוכה יותר לכרטיס זה'
            : 'נבחר חשבון אחר',
        })),
    },
  };

  return selected;
}

module.exports = {
  scoreCardForPortfolio,
  scoreMarketCardForPortfolio,
  hasValidMarketComparison,
  pickPortfolioCardForSlot,
  accountRef,
};
