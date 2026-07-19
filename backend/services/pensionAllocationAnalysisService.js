'use strict';

const { buildPensionInsight } = require('../utils/pensionInsightBuilder');
const { median, percentileRank } = require('../utils/pensionStats');
const config = require('../config/pensionAnalysisConfig');

/**
 * Deliverable #5 — asset allocation vs peer group (limited to Pensia-Net fields).
 */
function analyzeAssetAllocation(fund, ctx) {
  const { match, peerGroup } = ctx;
  if (!match) return [];

  const stockPct = match.stockExposure;
  const foreignPct = match.foreignExposure;
  if (stockPct == null && foreignPct == null) return [];

  const peers = peerGroup?.peers || [];
  const peerStocks = peers.map(p => p.stockExposure).filter(v => v != null);
  const peerForeign = peers.map(p => p.foreignExposure).filter(v => v != null);

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
  if (foreignMed != null && foreignPct != null && Math.abs(foreignPct - foreignMed) >= 8) {
    finding += ` חשיפה לחו"ל ${foreignPct > foreignMed ? 'גבוהה' : 'נמוכה'} מהממוצע.`;
  }

  return [buildPensionInsight({
    category: 'asset_allocation',
    severity: stockPctile != null && (stockPctile <= 15 || stockPctile >= 85) ? 'low' : 'info',
    title: `הרכב נכסים — ${fund.fundName}`,
    finding,
    personalDataUsed: ['fund.investmentTrack', 'fund.riskLevel'],
    marketDataUsed: ['pensia_net.CHSHIF_MNUIOT', 'pensia_net.BETA_HUTZ_LAARETZ'],
    benchmark: {
      group: peerGroup?.groupKey,
      median: stockMed,
      percentile: stockPctile,
      foreignMedian: foreignMed,
    },
    recommendedAction: 'כדאי לבחון האם הרכב הנכסים תואם את אופק ההשקעה והסיכון שהוגדר.',
    confidence: 0.65,
    limitations: ['נתוני אג"ח ממשלתי/קונצרני/מזומן אינם זמינים בפנסיה-נט — ניתוח חלקי'],
    fundId: ctx.fundId,
    legacyType: 'asset_allocation',
  })];
}

module.exports = { analyzeAssetAllocation };
