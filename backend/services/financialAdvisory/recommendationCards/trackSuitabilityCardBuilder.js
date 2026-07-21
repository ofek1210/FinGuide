'use strict';

const { normalizeFundRiskLevel, riskLevelFullLabel } = require('../../../utils/pensionShared');
const {
  TRACK_STATUSES,
  CARD_SLOTS,
  CARD_OUTCOMES,
  assertNoForbiddenPhrases,
} = require('./recommendationCardContract');
const { buildBaseConfidenceFactors, confidenceLabelHe } = require('./confidenceModel');
const { buildSuitabilityContext, isRiskWithinRange } = require('./suitabilityContext');
const { accountRef } = require('./cardPriority');
const advisoryConfig = require('../../../config/financialAdvisoryConfig');

function officialFundRisk(fund, marketCtx) {
  const fromMatch = marketCtx?.match?.riskLevel;
  if (fromMatch && fromMatch !== 'unknown' && fromMatch !== 'unclassified') return fromMatch;
  return normalizeFundRiskLevel(fund?.riskLevel || fund?.investmentTrack);
}

function canSuggestHigherRisk(suitability, confidence, marketCtx) {
  if (!suitability.userRisk) return false;
  if (confidence.level !== 'high' && confidence.level !== 'medium') return false;
  if (suitability.blockers.includes('near_term_withdrawal')) return false;
  if (suitability.blockers.includes('high_liquidity_need')) return false;
  if (suitability.blockers.includes('low_loss_capacity')) return false;
  if (suitability.blockers.includes('missing_product_horizon')) return false;
  const matchPct = (marketCtx?.matchConfidence ?? 0) > 1
    ? marketCtx.matchConfidence
    : (marketCtx?.matchConfidence ?? 0) * 100;
  if (matchPct < advisoryConfig.matchConfidence.acceptableMin) return false;
  return true;
}

function buildTrackSuitabilityCard({ primaryFund: fund, marketCtx, userContext, productType }) {
  const slot = CARD_SLOTS.TRACK_SUITABILITY;
  const ref = accountRef(fund);
  const suitability = buildSuitabilityContext({ userContext, fund, productType });
  const fundRisk = officialFundRisk(fund, marketCtx) || suitability.fundRisk;

  const confidence = buildBaseConfidenceFactors({
    userContext,
    matchConfidence: marketCtx?.matchConfidence,
    comparisonGroupCertain: Boolean(marketCtx?.peerGroup?.groupKey),
    hasReturnHistory: true,
  });

  if (suitability.blockers.includes('missing_risk_tolerance') || suitability.age == null) {
    const text = {
      summary: 'נדרשים פרטי פרופיל נוספים כדי לבדוק האם המסלול הנוכחי מתאים לך.',
      recommendation: 'השלימו העדפת סיכון ופרטים בסיסיים באונבורדינג לקבלת בדיקת התאמה מדויקת יותר.',
      why: 'ללא העדפת סיכון מהפרופיל, לא ניתן להעריך התאמת מסלול בצורה אחראית.',
    };
    assertNoForbiddenPhrases(`${text.summary} ${text.recommendation}`);

    return {
      slot,
      icon: 'track',
      title: 'התאמת מסלול השקעה',
      status: TRACK_STATUSES.MISSING_PROFILE,
      statusLabelHe: 'פרופיל חסר',
      cardOutcome: CARD_OUTCOMES.INFORMATION_REQUIRED,
      ...text,
      confidence: 'insufficient_data',
      confidenceLabelHe: confidenceLabelHe('insufficient_data'),
      confidenceScore: 0.2,
      accountId: ref.accountId,
      accountLabel: ref.accountLabel,
      metrics: {
        fundName: fund?.fundName || null,
        accountId: ref.accountId,
        suitability,
      },
      productType,
    };
  }

  const within = isRiskWithinRange(fundRisk, suitability.suitableRiskRange);
  const riskOrder = { low: 0, medium: 1, high: 2 };
  const gap = fundRisk && suitability.userRisk
    ? (riskOrder[fundRisk] ?? 1) - (riskOrder[suitability.userRisk] ?? 1)
    : null;

  let status = TRACK_STATUSES.WELL_MATCHED;
  let cardOutcome = CARD_OUTCOMES.MONITORING;
  let summary;
  let recommendation;
  let why = `${suitability.suitableRiskRangeExplanation} userRisk=${suitability.userRisk || '—'} (מקור: ${suitability.userRiskSource}).`;

  if (fundRisk === 'unknown' || within == null) {
    status = TRACK_STATUSES.UNKNOWN;
    cardOutcome = CARD_OUTCOMES.INSUFFICIENT_DATA;
    summary = 'לא ניתן לסווג בוודאות את רמת הסיכון של המסלול הנוכחי.';
    recommendation = 'כדאי לבדוק מול הגוף המנהל את מאפייני המסלול והחשיפה לנכסים.';
  } else if (gap != null && gap <= -1) {
    if (canSuggestHigherRisk(suitability, confidence, marketCtx)) {
      status = TRACK_STATUSES.TOO_CONSERVATIVE;
      cardOutcome = CARD_OUTCOMES.ACTIONABLE;
      summary = 'ייתכן שהמסלול הנוכחי שמרני יותר מפרופיל ההשקעה שהוגדר.';
      recommendation = 'שווה להשוות מסלולים עם חשיפה גבוהה יותר — רק אם זה מתאים להעדפת הסיכון שלך.';
    } else {
      status = TRACK_STATUSES.PROVISIONAL_CONSERVATIVE;
      cardOutcome = CARD_OUTCOMES.INFORMATION_REQUIRED;
      summary = 'ייתכן שהמסלול שמרני ביחס לטווח החיסכון, אך חסרים נתונים כדי לקבוע אם חשיפה גבוהה יותר מתאימה לך.';
      recommendation = 'השלימו העדפת סיכון, צורך נזילות ואופק משיכה לפני שינוי מסלול.';
    }
    why += ` המסלול ${riskLevelFullLabel(fundRisk)} מול טווח מתאים ${suitability.suitableRiskRange.min}–${suitability.suitableRiskRange.max}.`;
  } else if (gap != null && gap >= 1) {
    status = TRACK_STATUSES.TOO_AGGRESSIVE;
    cardOutcome = CARD_OUTCOMES.ACTIONABLE;
    summary = 'ייתכן שהמסלול חושף אותך לתנודתיות גבוהה יותר מהעדפת הסיכון שהוגדרה.';
    recommendation = 'שקול לבדוק מסלול מתון יותר אם רמת התנודתיות אינה נוחה לך.';
    why += ` המסלול ${riskLevelFullLabel(fundRisk)} מול העדפה ${riskLevelFullLabel(suitability.userRisk)}.`;
  } else {
    summary = 'רמת הסיכון של המסלול נראית מתאימה לפרופיל ולטווח.';
    recommendation = 'אין צורך בשינוי מסלול מבחינת התאמת סיכון בשלב זה.';
    why += ` המסלול (${riskLevelFullLabel(fundRisk)}) בתוך טווח ${suitability.suitableRiskRange.min}–${suitability.suitableRiskRange.max}.`;
  }

  assertNoForbiddenPhrases(`${summary} ${recommendation} ${why}`);

  return {
    slot,
    icon: 'track',
    title: 'התאמת מסלול השקעה',
    status,
    statusLabelHe: status === TRACK_STATUSES.WELL_MATCHED ? 'מתאים לפרופיל'
      : status === TRACK_STATUSES.PROVISIONAL_CONSERVATIVE ? 'שמרני — נדרש מידע'
        : status === TRACK_STATUSES.TOO_CONSERVATIVE ? 'שמרני יחסית'
          : status === TRACK_STATUSES.TOO_AGGRESSIVE ? 'תנודתי יחסית'
            : 'לא ידוע',
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
      fundRiskLevel: fundRisk,
      userRiskLevel: suitability.userRisk,
      suitableRiskRange: suitability.suitableRiskRange,
      horizonYears: suitability.horizonYears,
      horizonSource: suitability.horizonSource,
      productKind: suitability.productKind,
      suitabilityBlockers: suitability.blockers,
    },
    productType,
  };
}

module.exports = {
  buildTrackSuitabilityCard,
};
