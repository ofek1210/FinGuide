'use strict';

const {
  COMBINED_PERIOD_WEIGHTS,
  MINIMUM_PERIODS_FOR_COMBINED,
  RANKING_METHOD,
  RANKING_STATUS,
  RETURN_FIELD_BY_PERIOD,
} = require('./comparisonContract');

const RETURN_FIELDS = [
  'return12Months',
  'return36MonthsAnnualized',
  'return5YearsAnnualized',
];

function isValidReturn(value) {
  return value != null && Number.isFinite(value);
}

function percentileInGroup(value, peerValues) {
  const valid = peerValues.filter(isValidReturn);
  if (!isValidReturn(value) || valid.length === 0) return null;

  const less = valid.filter((peer) => peer < value).length;
  const equal = valid.filter((peer) => peer === value).length;
  const avgRank = less + (equal + 1) / 2;
  return (avgRank / valid.length) * 100;
}

function computeEffectiveWeights(availableFields) {
  const baseWeightSum = availableFields.reduce(
    (sum, field) => sum + COMBINED_PERIOD_WEIGHTS[field],
    0,
  );
  const effectiveWeights = {};
  for (const field of availableFields) {
    effectiveWeights[field] = COMBINED_PERIOD_WEIGHTS[field] / baseWeightSum;
  }
  return effectiveWeights;
}

function computeCombinedScore(percentiles) {
  const available = RETURN_FIELDS.filter((field) => isValidReturn(percentiles[field]));

  if (available.length < MINIMUM_PERIODS_FOR_COMBINED) {
    return {
      rankingScore: null,
      rankingStatus: RANKING_STATUS.INSUFFICIENT_HISTORY,
      effectiveWeights: {},
    };
  }

  const effectiveWeights = computeEffectiveWeights(available);
  let rankingScore = 0;
  for (const field of available) {
    rankingScore += percentiles[field] * effectiveWeights[field];
  }

  return {
    rankingScore,
    rankingStatus: RANKING_STATUS.RANKED,
    effectiveWeights,
  };
}

function computeSinglePeriodScore(period, percentiles) {
  const field = RETURN_FIELD_BY_PERIOD[period];
  const score = percentiles[field];
  if (!isValidReturn(score)) {
    return {
      rankingScore: null,
      rankingStatus: RANKING_STATUS.INSUFFICIENT_HISTORY,
      effectiveWeights: {},
    };
  }

  return {
    rankingScore: score,
    rankingStatus: RANKING_STATUS.RANKED,
    effectiveWeights: { [field]: 1 },
  };
}

function compareFundsForRanking(a, b) {
  const scoreDiff = (b.rankingScore ?? -Infinity) - (a.rankingScore ?? -Infinity);
  if (scoreDiff !== 0) return scoreDiff;

  const r5 = (b.return5YearsAnnualized ?? -Infinity) - (a.return5YearsAnnualized ?? -Infinity);
  if (r5 !== 0) return r5;

  const r3 = (b.return36MonthsAnnualized ?? -Infinity) - (a.return36MonthsAnnualized ?? -Infinity);
  if (r3 !== 0) return r3;

  const r1 = (b.return12Months ?? -Infinity) - (a.return12Months ?? -Infinity);
  if (r1 !== 0) return r1;

  const assets = (b.assetsUnderManagement ?? -Infinity) - (a.assetsUnderManagement ?? -Infinity);
  if (assets !== 0) return assets;

  return String(a.fundId).localeCompare(String(b.fundId), 'he');
}

function assignCompetitionRanks(sortedFunds) {
  let rank = 0;
  let index = 0;
  let previous = null;

  return sortedFunds.map((fund) => {
    index += 1;
    if (
      previous == null
      || fund.rankingScore !== previous.rankingScore
      || fund.return5YearsAnnualized !== previous.return5YearsAnnualized
      || fund.return36MonthsAnnualized !== previous.return36MonthsAnnualized
      || fund.return12Months !== previous.return12Months
      || fund.assetsUnderManagement !== previous.assetsUnderManagement
    ) {
      rank = index;
    }
    previous = fund;
    return { ...fund, rank };
  });
}

function rankSingleComparisonGroup(groupFunds, { period = 'combined' } = {}) {
  if (!groupFunds.length) {
    return { ranked: [], insufficient: [] };
  }

  const percentilesByFundId = new Map();
  for (const fund of groupFunds) {
    const percentiles = {};
    for (const field of RETURN_FIELDS) {
      percentiles[field] = percentileInGroup(
        fund[field],
        groupFunds.map((peer) => peer[field]),
      );
    }
    percentilesByFundId.set(fund.fundId, percentiles);
  }

  const ranked = [];
  const insufficient = [];

  for (const fund of groupFunds) {
    const percentiles = percentilesByFundId.get(fund.fundId) || {};
    const scoreResult = period === 'combined'
      ? computeCombinedScore(percentiles)
      : computeSinglePeriodScore(period, percentiles);

    const enriched = {
      ...fund,
      rankingScore: scoreResult.rankingScore,
      rankingStatus: scoreResult.rankingStatus,
      rankingMethod: RANKING_METHOD,
      effectiveWeights: scoreResult.effectiveWeights,
    };

    if (scoreResult.rankingStatus === RANKING_STATUS.RANKED) {
      ranked.push(enriched);
    } else {
      insufficient.push(enriched);
    }
  }

  ranked.sort(compareFundsForRanking);
  return {
    ranked: assignCompetitionRanks(ranked),
    insufficient,
  };
}

/**
 * Rank each comparison group independently. Never merge peer groups into one global list.
 */
function rankFundsByComparisonGroups(funds, {
  period = 'combined',
  comparisonGroup = null,
  limit = null,
} = {}) {
  const targetGroups = comparisonGroup
    ? [comparisonGroup]
    : [...new Set(funds.map((fund) => fund.comparisonGroup).filter(Boolean))].sort();

  const groups = [];
  let totalRanked = 0;
  let totalInsufficient = 0;

  for (const groupKey of targetGroups) {
    const eligibleInGroup = funds.filter((fund) => fund.comparisonGroup === groupKey);
    const { ranked, insufficient } = rankSingleComparisonGroup(eligibleInGroup, { period });
    const limitedRanked = limit != null ? ranked.slice(0, limit) : ranked;

    groups.push({
      comparisonGroup: groupKey,
      eligibleRecords: eligibleInGroup.length,
      rankedRecords: ranked.length,
      insufficientHistoryRecords: insufficient.length,
      funds: limitedRanked,
    });

    totalRanked += ranked.length;
    totalInsufficient += insufficient.length;
  }

  return {
    groups,
    totalRanked,
    totalInsufficient,
  };
}

/** @deprecated Use rankFundsByComparisonGroups — kept for tests migrating off global merge. */
function rankFundsWithinGroups(funds, options = {}) {
  const result = rankFundsByComparisonGroups(funds, options);
  const ranked = result.groups.flatMap((group) => group.funds);
  const insufficient = [];
  return { ranked, insufficient, groups: result.groups };
}

module.exports = {
  percentileInGroup,
  computeEffectiveWeights,
  computeCombinedScore,
  computeSinglePeriodScore,
  rankSingleComparisonGroup,
  rankFundsByComparisonGroups,
  rankFundsWithinGroups,
  compareFundsForRanking,
  assignCompetitionRanks,
};
