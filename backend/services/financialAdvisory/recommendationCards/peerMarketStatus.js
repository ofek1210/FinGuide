'use strict';

const { RANKING_STATUS } = require('../../marketComparison/comparisonContract');

/** Configurable peer-group percentile thresholds (0–100 ranking score). */
const PEER_STATUS_THRESHOLDS = Object.freeze([
  { min: 90, status: 'top_peer_group' },
  { min: 60, status: 'above_peer_median' },
  { min: 40, status: 'around_peer_median' },
  { min: 10, status: 'below_peer_median' },
  { min: 0, status: 'bottom_peer_group' },
]);

const PEER_STATUS_LABELS_HE = Object.freeze({
  top_peer_group: 'בחלק העליון של הקבוצה',
  above_peer_median: 'מעל חציון הקבוצה',
  around_peer_median: 'סביב חציון הקבוצה',
  below_peer_median: 'מתחת לחציון הקבוצה',
  bottom_peer_group: 'בחלק התחתון של הקבוצה',
  insufficient_history: 'היסטוריה לא מספקת',
  unmatched: 'לא הותאם לקבוצה',
  short_term_only: 'נתון לטווח קצר בלבד',
});

function classifyPeerMarketStatus({ rankingScore, rankingStatus, historyMeta = {} }) {
  if (historyMeta.only12Months) {
    return 'short_term_only';
  }
  if (rankingStatus === RANKING_STATUS.INSUFFICIENT_HISTORY) {
    return 'insufficient_history';
  }
  if (rankingScore == null || rankingStatus !== RANKING_STATUS.RANKED) {
    return 'unmatched';
  }
  for (const t of PEER_STATUS_THRESHOLDS) {
    if (rankingScore >= t.min) return t.status;
  }
  return 'bottom_peer_group';
}

function peerStatusLabelHe(status) {
  return PEER_STATUS_LABELS_HE[status] || status;
}

/**
 * Detect divergence: strong 12m + weak 5y or opposite — affects confidence.
 */
function analyzeReturnPeriodDivergence(fundEntry) {
  if (!fundEntry) return { divergence: false, noteHe: null };
  const r1 = fundEntry.return12Months;
  const r5 = fundEntry.return5YearsAnnualized;
  if (r1 == null || r5 == null) {
    return {
      divergence: false,
      only12Months: r1 != null && r5 == null && fundEntry.return36MonthsAnnualized == null,
      noteHe: r1 != null && r5 == null ? 'זמין דירוג ל-12 חודשים בלבד — לא מספיק לטווח ארוך.' : null,
    };
  }
  const strong1y = r1 >= 8;
  const weak5y = r5 < 3;
  const weak1y = r1 < 0;
  const strong5y = r5 >= 6;
  if (strong1y && weak5y) {
    return {
      divergence: true,
      noteHe: 'תשואת 12 חודשים חזקה אך 5 שנים חלשות — לא להסתמך על טווח קצר.',
    };
  }
  if (weak1y && strong5y) {
    return {
      divergence: true,
      noteHe: 'שנה אחרונה חלשה אך 5 שנים חזקות — בדיקה לטווח ארוך, לא מגיבים לשנה בודדת.',
    };
  }
  return { divergence: false, noteHe: null };
}

module.exports = {
  PEER_STATUS_THRESHOLDS,
  PEER_STATUS_LABELS_HE,
  classifyPeerMarketStatus,
  peerStatusLabelHe,
  analyzeReturnPeriodDivergence,
};
