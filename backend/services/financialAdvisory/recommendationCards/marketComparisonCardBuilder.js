'use strict';

const { getMarketComparison } = require('../../marketComparison/marketComparisonService');
const { loadPensionComparisonRecords } = require('../../marketComparison/adapters/pensionComparisonAdapter');
const { loadGemelComparisonRecords } = require('../../marketComparison/adapters/gemelComparisonAdapter');
const { loadHishtalmutComparisonRecords } = require('../../marketComparison/adapters/hishtalmutComparisonAdapter');
const { loadInvestmentGemelComparisonRecords } = require('../../marketComparison/adapters/investmentGemelComparisonAdapter');
const { labelComparisonGroupHe } = require('./comparisonGroupLabels');
const {
  MARKET_STATUSES,
  CARD_SLOTS,
  CARD_OUTCOMES,
  RANKING_FORMULA_DOC_HE,
  assertNoForbiddenPhrases,
} = require('./recommendationCardContract');
const { buildBaseConfidenceFactors, confidenceLabelHe } = require('./confidenceModel');
const {
  classifyPeerMarketStatus,
  peerStatusLabelHe,
  analyzeReturnPeriodDivergence,
} = require('./peerMarketStatus');
const { selectMarketAlternatives, alternativesSectionLabel } = require('./alternativeSelector');
const { accountRef } = require('./cardPriority');
const advisoryConfig = require('../../../config/financialAdvisoryConfig');

const PRODUCT_LOADERS = {
  pension: loadPensionComparisonRecords,
  gemel: loadGemelComparisonRecords,
  hishtalmut: loadHishtalmutComparisonRecords,
  investment_gemel: loadInvestmentGemelComparisonRecords,
};

function resolveComparisonProduct(productType, fund) {
  if (productType === 'PENSION') return 'pension';
  if (productType === 'HISHTALMUT') return 'hishtalmut';
  if (fund?.fundType === 'study_fund') return 'hishtalmut';
  if (fund?.fundType === 'investment_gemel') return 'investment_gemel';
  return 'gemel';
}

async function findOfficialRecord(productKey, matchId) {
  if (!matchId) return null;
  const loader = PRODUCT_LOADERS[productKey];
  if (!loader) return null;
  const { records } = await loader();
  return records.find(r => String(r.fundId) === String(matchId)) || null;
}

function insufficientMarketCard({ fund, productType, summary, recommendation, why, status = MARKET_STATUSES.UNMATCHED }) {
  const ref = accountRef(fund);
  return {
    slot: CARD_SLOTS.MARKET_COMPARISON,
    icon: 'market',
    title: 'השוואת שוק',
    status,
    statusLabelHe: peerStatusLabelHe(status),
    cardOutcome: CARD_OUTCOMES.INSUFFICIENT_DATA,
    summary,
    recommendation,
    confidence: 'insufficient_data',
    confidenceLabelHe: confidenceLabelHe('insufficient_data'),
    confidenceScore: 0.15,
    why,
    accountId: ref.accountId,
    accountLabel: ref.accountLabel,
    metrics: { fundName: fund?.fundName || null, accountId: ref.accountId, rankingFormula: RANKING_FORMULA_DOC_HE },
    alternatives: [],
    alternativesLabelHe: alternativesSectionLabel(),
    productType,
  };
}

async function buildMarketComparisonCardAsync({ primaryFund: fund, marketCtx, userContext, productType, trackCard = null, feeCard = null }) {
  const ref = accountRef(fund);
  const match = marketCtx?.match;
  const matchConfidence = marketCtx?.matchConfidence ?? 0;
  const matchPct = matchConfidence > 1 ? matchConfidence : matchConfidence * 100;

  if (!fund || !match?.id || matchPct < advisoryConfig.matchConfidence.weakMin) {
    return insufficientMarketCard({
      fund,
      productType,
      summary: 'לא ניתן להשוות את המסלול שלך לדירוג הרשמי בקבוצת ההשוואה.',
      recommendation: 'כדאי לוודא ששם המסלול והגוף המנהל תואמים לדיווח הרשמי.',
      why: 'התאמה לנתוני פנסיה-נט/גמל-נט אינה מספקת.',
      status: MARKET_STATUSES.UNMATCHED,
    });
  }

  const productKey = resolveComparisonProduct(productType, fund);
  const officialRecord = await findOfficialRecord(productKey, match.id);

  if (!officialRecord?.comparisonGroup || !officialRecord?.riskLevel
    || officialRecord.riskLevel === 'unclassified') {
    return insufficientMarketCard({
      fund,
      productType,
      summary: 'לא זוהתה קבוצת השוואה רשמית למסלול שלך.',
      recommendation: 'כדאי לבדוק את פרטי המסלול מול הגוף המנהל.',
      why: 'ללא קבוצת השוואה ורמת סיכון רשמית, לא ניתן לדרג מול מסלולים דומים.',
    });
  }

  const comparison = await getMarketComparison({
    product: productKey,
    risk: officialRecord.riskLevel,
    period: 'combined',
    limit: 15,
    comparisonGroup: officialRecord.comparisonGroup,
  });

  const group = comparison.groups.find(g => g.comparisonGroup === officialRecord.comparisonGroup)
    || comparison.groups[0];

  if (!group?.funds?.length) {
    return insufficientMarketCard({
      fund,
      productType,
      summary: 'אין מספיק נתוני היסטוריה לדירוג משולב בקבוצת המסלולים שלך.',
      recommendation: 'אפשר לחזור לבדיקה לאחר עדכון דיווח רשמי.',
      why: RANKING_FORMULA_DOC_HE,
      status: MARKET_STATUSES.INSUFFICIENT_HISTORY,
    });
  }

  const userFundEntry = group.funds.find(f => String(f.fundId) === String(match.id));
  const divergence = analyzeReturnPeriodDivergence(userFundEntry);
  const peerStatus = classifyPeerMarketStatus({
    rankingScore: userFundEntry?.rankingScore,
    rankingStatus: userFundEntry?.rankingStatus,
    historyMeta: { only12Months: divergence.only12Months },
  });

  let confidence = buildBaseConfidenceFactors({
    userContext,
    matchConfidence: matchPct,
    comparisonGroupCertain: true,
    hasReturnHistory: userFundEntry?.rankingStatus === 'ranked' && !divergence.only12Months,
    marketFresh: Boolean(comparison.dataQuality?.lastUpdated),
  });

  if (divergence.divergence) {
    confidence.blockers.push('return_period_divergence');
    confidence.level = confidence.level === 'high' ? 'medium' : confidence.level;
    confidence.labelHe = confidenceLabelHe(confidence.level);
  }
  if (peerStatus === MARKET_STATUSES.SHORT_TERM_ONLY) {
    confidence.blockers.push('short_term_only');
    confidence.level = 'low';
    confidence.labelHe = confidenceLabelHe('low');
  }

  const feesHigh = feeCard?.status === 'high' || feeCard?.status === 'above_average';
  const suitabilityConfidence = trackCard?.confidence || 'insufficient_data';

  const alternatives = selectMarketAlternatives({
    group,
    userFundEntry,
    officialRecord,
    suitabilityConfidence,
    peerStatus,
    historyComplete: !divergence.only12Months && userFundEntry?.return5YearsAnnualized != null,
    matchConfidencePct: matchPct,
    feesHigh,
  });

  let summary;
  let recommendation;
  let why = `${RANKING_FORMULA_DOC_HE} ${divergence.noteHe || ''}`.trim();
  let cardOutcome = CARD_OUTCOMES.MONITORING;

  if (peerStatus === MARKET_STATUSES.INSUFFICIENT_HISTORY || peerStatus === MARKET_STATUSES.SHORT_TERM_ONLY) {
    summary = peerStatus === MARKET_STATUSES.SHORT_TERM_ONLY
      ? 'קיים דירוג לטווח קצר בלבד — אין מספיק היסטוריה ארוכה.'
      : 'לא קיימת היסטוריה מספקת לדירוג המסלול בקבוצה.';
    recommendation = 'עקוב לאורך זמן לפני מסקנות — לא להגיב לתקופה קצרה בלבד.';
    cardOutcome = CARD_OUTCOMES.INSUFFICIENT_DATA;
  } else if (peerStatus === MARKET_STATUSES.TOP_PEER_GROUP) {
    summary = 'המסלול שלך בחלק העליון של קבוצת ההשוואה — לא "הטוב בשוק".';
    recommendation = 'אין חלופה ברורה על בסיס דירוג רשמי בלבד.';
    cardOutcome = CARD_OUTCOMES.MONITORING;
  } else if (peerStatus === MARKET_STATUSES.ABOVE_PEER_MEDIAN) {
    summary = 'המסלול מעל חציון הקבוצה — לא בהכרח מוביל.';
    recommendation = alternatives.length
      ? `${alternativesSectionLabel()} — לא המלצה לעבור.`
      : 'המשך מעקב — הביצועים סביב/מעל הממוצע.';
    cardOutcome = alternatives.length ? CARD_OUTCOMES.ACTIONABLE : CARD_OUTCOMES.MONITORING;
  } else if (peerStatus === MARKET_STATUSES.AROUND_PEER_MEDIAN) {
    summary = 'המסלול סביב חציון הקבוצה.';
    recommendation = feesHigh && alternatives.length
      ? 'ביצועים סביב הממוצע — אך דמי ניהול גבוהים; שווה להשוות חלופות.'
      : 'אין פעולה דחופה על בסיס דירוג בלבד.';
    cardOutcome = feesHigh && alternatives.length ? CARD_OUTCOMES.ACTIONABLE : CARD_OUTCOMES.MONITORING;
  } else {
    summary = `המסלול ${peerStatusLabelHe(peerStatus)} בקבוצת ההשוואה.`;
    recommendation = alternatives.length
      ? `${alternativesSectionLabel()} — לבדיקה, לא החלפה אוטומטית.`
      : 'לא ניתן להציע חלופות — חסרים תנאי גating (היסטוריה/התאמה/ביטחון).';
    cardOutcome = alternatives.length ? CARD_OUTCOMES.ACTIONABLE : CARD_OUTCOMES.INFORMATION_REQUIRED;
  }

  assertNoForbiddenPhrases(`${summary} ${recommendation} ${why}`);

  return {
    slot: CARD_SLOTS.MARKET_COMPARISON,
    icon: 'market',
    title: 'השוואת שוק',
    status: peerStatus,
    statusLabelHe: peerStatusLabelHe(peerStatus),
    cardOutcome,
    summary,
    recommendation,
    confidence: confidence.level,
    confidenceLabelHe: confidence.labelHe,
    confidenceScore: confidence.score,
    why,
    accountId: ref.accountId,
    accountLabel: ref.accountLabel,
    metrics: {
      fundName: fund?.fundName || null,
      accountId: ref.accountId,
      fundId: match.id,
      comparisonGroup: officialRecord.comparisonGroup,
      comparisonGroupLabel: labelComparisonGroupHe(officialRecord.comparisonGroup),
      riskLevel: officialRecord.riskLevel,
      userRank: userFundEntry?.rank,
      userCombinedScore: userFundEntry?.rankingScore,
      rankedRecordsInGroup: group.rankedRecords || group.funds.length,
      rankingScope: 'within_comparison_group_only',
      rankingFormula: RANKING_FORMULA_DOC_HE,
      returnDivergence: divergence.divergence || false,
    },
    alternatives,
    alternativesLabelHe: alternativesSectionLabel(),
    productType,
  };
}

module.exports = {
  buildMarketComparisonCardAsync,
  resolveComparisonProduct,
};
