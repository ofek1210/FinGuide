'use strict';

const config = require('../../config/financialAdvisoryConfig');

/**
 * Normalize product match result to shared contract.
 */
function buildProductMatchResult({
  matchedProductId = null,
  matchedProductName = null,
  matchConfidence = 0,
  matchMethod = 'none',
  matchedFields = [],
  missingFields = [],
  comparisonGroup = null,
}) {
  let matchTier = 'none';
  if (matchConfidence >= config.matchConfidence.strongMin) matchTier = 'strong';
  else if (matchConfidence >= config.matchConfidence.acceptableMin) matchTier = 'acceptable';
  else if (matchConfidence >= config.matchConfidence.weakMin) matchTier = 'weak';

  const allowPeerRanking = matchConfidence >= config.matchConfidence.peerRankingMin;

  return {
    matchedProductId,
    matchedProductName,
    matchConfidence: Math.round(matchConfidence),
    matchMethod,
    matchTier,
    allowPeerRanking,
    matchedFields,
    missingFields,
    comparisonGroup,
  };
}

/**
 * Map pension market context to shared match shape.
 */
function fromPensionMarketContext(ctx) {
  const conf = Math.round((ctx.matchConfidence ?? 0) * 100);
  return buildProductMatchResult({
    matchedProductId: ctx.match?.id ?? null,
    matchedProductName: ctx.match?.fundName ?? null,
    matchConfidence: conf,
    matchMethod: ctx.matchMethod ?? 'none',
    matchedFields: ['provider', 'fundName', 'investmentTrack', 'fundType'].filter(f => ctx.match?.[f] != null),
    missingFields: ctx.match ? [] : ['market_match'],
    comparisonGroup: ctx.peerGroup?.groupKey ?? null,
  });
}

module.exports = {
  buildProductMatchResult,
  fromPensionMarketContext,
};
