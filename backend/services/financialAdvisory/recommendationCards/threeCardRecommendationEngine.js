'use strict';

const { randomUUID } = require('crypto');
const { CARD_SLOT_ORDER } = require('./recommendationCardContract');
const { buildFeesCard } = require('./feesCardBuilder');
const { buildTrackSuitabilityCard } = require('./trackSuitabilityCardBuilder');
const { buildMarketComparisonCardAsync } = require('./marketComparisonCardBuilder');
const { cardsToPrimaryRecommendations, cardsToCentralInsights } = require('./cardDisplayMapper');
const { pickPortfolioCardForSlot, accountRef } = require('./cardPriority');

function isActiveFund(fund) {
  if (!fund) return false;
  if (fund.isActive === false) return false;
  if (fund.status === 'closed') return false;
  if (fund.activityStatus && /לא פעיל|סגור/i.test(String(fund.activityStatus))) return false;
  return true;
}

function findMarketContextForFund(fund, marketContexts) {
  if (!fund || !marketContexts?.length) return null;
  const fundId = fund._id?.toString?.() || fund.id;
  return marketContexts.find(m => m.fundId === fundId) || null;
}

async function buildAccountAnalysis(fund, { userContext, productType, marketContexts }) {
  const marketCtx = findMarketContextForFund(fund, marketContexts);
  const ref = accountRef(fund);

  const feeCard = buildFeesCard({ primaryFund: fund, marketCtx, userContext, productType });
  const trackCard = buildTrackSuitabilityCard({ primaryFund: fund, marketCtx, userContext, productType });
  const marketCard = await buildMarketComparisonCardAsync({
    primaryFund: fund,
    marketCtx,
    userContext,
    productType,
    trackCard,
    feeCard,
  });

  const cards = [feeCard, trackCard, marketCard].map(c => ({ ...c, id: c.id || randomUUID() }));

  return {
    accountId: ref.accountId,
    accountLabel: ref.accountLabel,
    fundName: fund.fundName,
    productType,
    cards,
  };
}

/**
 * Portfolio-level: pick highest-priority card per slot across all accounts.
 * Account-level: full 3-card analysis for every active account.
 */
async function runThreeCardRecommendationEngine({
  productType,
  funds = [],
  userContext,
  marketContexts = [],
  allInsights = [],
}) {
  const activeFunds = (funds || []).filter(isActiveFund);
  const pool = activeFunds.length ? activeFunds : (funds || []);

  const accountAnalyses = [];
  for (const fund of pool) {
    accountAnalyses.push(await buildAccountAnalysis(fund, { userContext, productType, marketContexts }));
  }

  const portfolioCards = CARD_SLOT_ORDER.map(slot => {
    const picked = pickPortfolioCardForSlot(accountAnalyses, slot);
    return picked || buildEmptySlotCard(slot, productType);
  }).map(card => ({ ...card, id: card.id || randomUUID() }));

  const cardInsightIds = new Set(portfolioCards.map(c => c.id));
  const moreFindings = (allInsights || []).filter(ins => {
    if (cardInsightIds.has(ins.id)) return false;
    if (['fees', 'performance', 'risk'].includes(ins.category)) {
      return ins.severity === 'critical' || ins.severity === 'high';
    }
    return true;
  });

  return {
    recommendationCards: portfolioCards.slice(0, 3),
    accountAnalyses,
    primaryRecommendations: cardsToPrimaryRecommendations(portfolioCards.slice(0, 3)),
    centralRecommendations: cardsToCentralInsights(portfolioCards.slice(0, 3)),
    moreFindings,
    meta: {
      engineVersion: 'three_card_v5',
      accountCount: accountAnalyses.length,
      cardCount: Math.min(portfolioCards.length, 3),
      moreFindingsCount: moreFindings.length,
      portfolioSelection: portfolioCards.slice(0, 3).map(c => c.portfolioSelection),
    },
  };
}

function buildEmptySlotCard(slot, productType) {
  return {
    slot,
    icon: slot === 'management_fees' ? 'fees' : slot === 'track_suitability' ? 'track' : 'market',
    title: slot === 'management_fees' ? 'דמי ניהול' : slot === 'track_suitability' ? 'התאמת מסלול' : 'השוואת שוק',
    status: 'insufficient_data',
    statusLabelHe: 'אין נתונים',
    cardOutcome: 'insufficient_data',
    summary: 'לא נמצאו חשבונות פעילים לניתוח.',
    recommendation: 'ייבאו דוח או הוסיפו חשבון.',
    confidence: 'insufficient_data',
    confidenceLabelHe: 'נתונים לא מספיקים',
    confidenceScore: 0,
    why: 'ללא חשבון פעיל אין בסיס להמלצה.',
    metrics: {},
    alternatives: [],
    productType,
  };
}

module.exports = {
  runThreeCardRecommendationEngine,
  buildAccountAnalysis,
  isActiveFund,
  findMarketContextForFund,
};
