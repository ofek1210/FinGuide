'use strict';

const { RANKING_STATUS } = require('../../marketComparison/comparisonContract');
const { peerStatusLabelHe } = require('./peerMarketStatus');

const FORBIDDEN_ALT_PHRASE = 'הקופה שכדאי לעבור אליה';

/**
 * Rank and gate market alternatives — max 3, never "switch to this fund".
 */
function selectMarketAlternatives({
  group,
  userFundEntry,
  officialRecord,
  suitabilityConfidence,
  peerStatus,
  historyComplete,
  matchConfidencePct,
  feesHigh = false,
}) {
  if (!group?.funds?.length || !userFundEntry || !officialRecord) return [];

  const gating = {
    exactProduct: Boolean(officialRecord.comparisonGroup),
    exactGroup: Boolean(officialRecord.comparisonGroup),
    compatibleRisk: officialRecord.riskLevel && officialRecord.riskLevel !== 'unclassified',
    mediumSuitability: suitabilityConfidence === 'high' || suitabilityConfidence === 'medium',
    longTermHistory: historyComplete !== false && userFundEntry.rankingStatus === RANKING_STATUS.RANKED,
    officialData: Boolean(group.rankedRecords),
    adequateMatch: matchConfidencePct == null || matchConfidencePct >= 55,
  };

  const weakStatuses = new Set(['bottom_peer_group', 'below_peer_median']);
  const needsAlternatives = weakStatuses.has(peerStatus) || feesHigh;

  if (!needsAlternatives) return [];

  const allGatesForWeak = Object.values(gating).every(Boolean);
  const gatesForFeeCase = gating.exactProduct && gating.exactGroup && gating.compatibleRisk
    && gating.officialData && gating.adequateMatch && feesHigh;

  if (!allGatesForWeak && !gatesForFeeCase) return [];
  if (peerStatus === 'insufficient_history' || peerStatus === 'short_term_only') return [];
  if (!gating.longTermHistory && !feesHigh) return [];

  const userId = String(userFundEntry.fundId);
  const candidates = group.funds
    .filter(f => String(f.fundId) !== userId && f.rankingStatus === RANKING_STATUS.RANKED)
    .map(f => ({
      rank: f.rank,
      fundId: f.fundId,
      fundName: f.fundName,
      managingCompany: f.managingCompany,
      combinedScore: f.rankingScore,
      managementFeeBalance: f.managementFeeBalance,
      return5YearsAnnualized: f.return5YearsAnnualized,
      return36MonthsAnnualized: f.return36MonthsAnnualized,
      dataFreshness: f.lastReportDate || null,
      assetsUnderManagement: f.assetsUnderManagement,
      score: scoreAlternative(f, userFundEntry, feesHigh),
      reasons: buildAlternativeReasons(f, userFundEntry, feesHigh),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);

  return candidates.map(({ score, ...rest }) => rest);
}

function scoreAlternative(alt, user, feesHigh) {
  let s = (alt.rankingScore ?? 0) * 0.5;
  if (alt.return5YearsAnnualized != null) s += alt.return5YearsAnnualized * 2;
  if (alt.return36MonthsAnnualized != null) s += alt.return36MonthsAnnualized;
  if (feesHigh && alt.managementFeeBalance != null && user.managementFeeBalance != null) {
    s += Math.max(0, user.managementFeeBalance - alt.managementFeeBalance) * 10;
  }
  if (alt.assetsUnderManagement != null) s += Math.log10(Math.max(alt.assetsUnderManagement, 1)) * 0.5;
  return s;
}

function buildAlternativeReasons(alt, user, feesHigh) {
  const reasons = ['אותה קבוצת השוואה'];
  if (alt.rankingScore != null && user.rankingScore != null && alt.rankingScore > user.rankingScore) {
    reasons.push('דירוג ארוך-טווח גבוה יותר בקבוצה');
  }
  if (feesHigh && alt.managementFeeBalance != null && user.managementFeeBalance != null
    && alt.managementFeeBalance < user.managementFeeBalance) {
    reasons.push('דמי ניהול נמוכים יותר');
  }
  if (alt.riskLevel && user.riskLevel && alt.riskLevel === user.riskLevel) {
    reasons.push('אותה רמת סיכון');
  }
  return reasons.slice(0, 4);
}

function alternativesSectionLabel() {
  return 'אפשרויות שכדאי להשוות';
}

module.exports = {
  selectMarketAlternatives,
  alternativesSectionLabel,
  FORBIDDEN_ALT_PHRASE,
};
