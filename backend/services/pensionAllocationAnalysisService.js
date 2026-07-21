'use strict';

const { normalizeExposurePercent } = require('../utils/normalizePercentage');
const { formatComparisonGroupLabel } = require('../utils/comparisonGroupLabel');
const { buildPensionInsight } = require('../utils/pensionInsightBuilder');
const { median, percentileRank } = require('../utils/pensionStats');
const config = require('../config/pensionAnalysisConfig');

const HIGH_EQUITY_THRESHOLD = config.highEquityThreshold ?? 55;

function riskProfileToLevel(riskTolerance) {
  const r = String(riskTolerance || '').toLowerCase();
  if (/low|נמוך|שמר/i.test(r)) return 'low';
  if (/high|גבוה|אגר/i.test(r)) return 'high';
  return 'medium';
}

/**
 * Deliverable #5 — asset allocation vs peer group (limited to Pensia-Net fields).
 */
function analyzeAssetAllocation(fund, ctx) {
  const { match, peerGroup, userContext } = ctx;
  if (!match) return [];

  const totalAssets = match.totalAssets;
  const stockNorm = normalizeExposurePercent(match.stockExposure, totalAssets);
  const foreignNorm = normalizeExposurePercent(match.foreignExposure, totalAssets);

  if (!stockNorm.valid && !foreignNorm.valid) return [];

  const peers = peerGroup?.peers || [];
  const peerStocks = peers
    .map(p => normalizeExposurePercent(p.stockExposure, p.totalAssets))
    .filter(r => r.valid)
    .map(r => r.value);
  const peerForeign = peers
    .map(p => normalizeExposurePercent(p.foreignExposure, p.totalAssets))
    .filter(r => r.valid)
    .map(r => r.value);

  const stockPct = stockNorm.valid ? stockNorm.value : null;
  const foreignPct = foreignNorm.valid ? foreignNorm.value : null;
  const stockMed = median(peerStocks);
  const foreignMed = median(peerForeign);
  const stockPctile = stockPct != null && peerStocks.length >= config.minPeerGroupSize
    ? percentileRank(stockPct, peerStocks)
    : null;

  const parts = [];
  if (stockPct != null) parts.push(`חשיפה למניות ${stockPct.toFixed(1)}%`);
  if (foreignPct != null) parts.push(`חשיפה לחו"ל ${foreignPct.toFixed(1)}%`);

  let finding = `${parts.join(', ')}.`;
  if (stockMed != null && stockPct != null) {
    const diff = Math.abs(stockPct - stockMed);
    if (diff >= 10) {
      finding += ` חשיפת המניות ${stockPct > stockMed ? 'גבוהה' : 'נמוכה'} מהחציון (${stockMed.toFixed(1)}%).`;
    } else {
      finding += ` חשיפת המניות קרובה לחציון הקבוצה (${stockMed.toFixed(1)}%).`;
    }
  }

  const userRisk = riskProfileToLevel(userContext?.financial?.riskTolerance);
  const profileConflict = userRisk === 'low' && stockPct != null && stockPct > HIGH_EQUITY_THRESHOLD;
  const comparisonGroupLabel = formatComparisonGroupLabel(peerGroup?.groupKey, match.classification);

  let severity = 'info';
  if (profileConflict) severity = 'medium';

  return [buildPensionInsight({
    category: 'asset_allocation',
    severity,
    title: `הרכב נכסים — ${fund.fundName}`,
    finding,
    personalDataUsed: ['fund.investmentTrack', 'fund.riskLevel', 'profile.financial.riskTolerance'],
    marketDataUsed: ['pensia_net.STOCK_MARKET_EXPOSURE', 'pensia_net.FOREIGN_EXPOSURE'],
    benchmark: {
      group: peerGroup?.groupKey,
      comparisonGroupLabel,
      median: stockMed,
      percentile: stockPctile,
      foreignMedian: foreignMed,
      stockExposurePct: stockPct,
      foreignExposurePct: foreignPct,
    },
    recommendedAction: profileConflict
      ? 'ייתכן שחשיפת המניות גבוהה ביחס לפרופיל הסיכון שהוגדר — כדאי לבדוק התאמה עם בעל רישיון.'
      : 'מידע להשוואה — אין צורך בפעולה רק בגלל חשיפה מעל חציון הקבוצה.',
    confidence: 0.65,
    limitations: ['נתוני אג"ח ממשלתי/קונצרני/מזומן אינם זמינים בפנסיה-נט — ניתוח חלקי'],
    fundId: ctx.fundId,
    legacyType: 'asset_allocation',
  })];
}

module.exports = { analyzeAssetAllocation, riskProfileToLevel };
