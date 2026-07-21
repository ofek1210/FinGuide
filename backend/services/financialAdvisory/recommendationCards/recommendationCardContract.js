'use strict';

/** Fixed recommendation card slots — always rendered in this order. */
const CARD_SLOTS = Object.freeze({
  MANAGEMENT_FEES: 'management_fees',
  TRACK_SUITABILITY: 'track_suitability',
  MARKET_COMPARISON: 'market_comparison',
});

const CARD_SLOT_ORDER = [
  CARD_SLOTS.MANAGEMENT_FEES,
  CARD_SLOTS.TRACK_SUITABILITY,
  CARD_SLOTS.MARKET_COMPARISON,
];

const FEE_STATUSES = Object.freeze({
  EXCELLENT: 'excellent',
  COMPETITIVE: 'competitive',
  ABOVE_AVERAGE: 'above_average',
  HIGH: 'high',
  UNKNOWN: 'unknown',
});

const TRACK_STATUSES = Object.freeze({
  WELL_MATCHED: 'well_matched',
  TOO_CONSERVATIVE: 'too_conservative',
  PROVISIONAL_CONSERVATIVE: 'provisional_conservative',
  TOO_AGGRESSIVE: 'too_aggressive',
  MISSING_PROFILE: 'missing_profile',
  UNKNOWN: 'unknown',
});

const MARKET_STATUSES = Object.freeze({
  TOP_PEER_GROUP: 'top_peer_group',
  ABOVE_PEER_MEDIAN: 'above_peer_median',
  AROUND_PEER_MEDIAN: 'around_peer_median',
  BELOW_PEER_MEDIAN: 'below_peer_median',
  BOTTOM_PEER_GROUP: 'bottom_peer_group',
  INSUFFICIENT_HISTORY: 'insufficient_history',
  SHORT_TERM_ONLY: 'short_term_only',
  UNMATCHED: 'unmatched',
  /** @deprecated use peer statuses */
  STRONG: 'strong',
  WEAK: 'weak',
  INSUFFICIENT_DATA: 'insufficient_data',
});

const CARD_OUTCOMES = Object.freeze({
  ACTIONABLE: 'actionable',
  MONITORING: 'monitoring',
  INFORMATION_REQUIRED: 'information_required',
  INSUFFICIENT_DATA: 'insufficient_data',
});

const RANKING_FORMULA_DOC_HE = 'ציון משולב = 45% אחוזון 5 שנים + 35% אחוזון 3 שנים + 20% אחוזון 12 חודשים (מנורמל לפי תקופות זמינות). דירוג 12 חודשים בלבד = ביטחון נמוך.';

const CONFIDENCE_LEVELS = Object.freeze({
  HIGH: 'high',
  MEDIUM: 'medium',
  LOW: 'low',
  INSUFFICIENT_DATA: 'insufficient_data',
});

const CARD_ICONS = Object.freeze({
  [CARD_SLOTS.MANAGEMENT_FEES]: 'fees',
  [CARD_SLOTS.TRACK_SUITABILITY]: 'track',
  [CARD_SLOTS.MARKET_COMPARISON]: 'market',
});

const FORBIDDEN_PHRASES = [
  'הקרן הטובה ביותר',
  'המסלול הטוב ביותר',
  'מומלץ לעבור ל',
  'עליך לעבור',
  'חובה לעבור',
  'תשואות עבר מבטיחות',
  'דמי ניהול נמוכים לכן כדאי להישאר',
  'הקופה שכדאי לעבור אליה',
  'כדאי לעבור ל',
];

function assertNoForbiddenPhrases(text) {
  if (!text) return;
  for (const phrase of FORBIDDEN_PHRASES) {
    if (text.includes(phrase)) {
      throw new Error(`Forbidden recommendation phrase detected: ${phrase}`);
    }
  }
}

module.exports = {
  CARD_SLOTS,
  CARD_SLOT_ORDER,
  FEE_STATUSES,
  TRACK_STATUSES,
  MARKET_STATUSES,
  CARD_OUTCOMES,
  CONFIDENCE_LEVELS,
  CARD_ICONS,
  FORBIDDEN_PHRASES,
  RANKING_FORMULA_DOC_HE,
  assertNoForbiddenPhrases,
};
