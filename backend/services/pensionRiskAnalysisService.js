'use strict';

const { buildPensionInsight } = require('../utils/pensionInsightBuilder');
const { median, percentileRank } = require('../utils/pensionStats');
const config = require('../config/pensionAnalysisConfig');

/**
 * Deliverable #3 — return vs risk (Sharpe, std dev; alpha if unavailable → limitation).
 */
function analyzeReturnVsRisk(fund, ctx) {
  const { match, peerGroup } = ctx;
  if (!match || (peerGroup?.peers?.length || 0) < config.minPeerGroupSize) return [];

  const peers = peerGroup.peers;
  const userSharpe = match.sharpeRatio;
  const userStd = match.standardDeviation36m;
  const userAlpha = match.alpha;
  const peerSharpes = peers.map(p => p.sharpeRatio).filter(v => v != null);
  const peerStds = peers.map(p => p.standardDeviation36m).filter(v => v != null);
  const peerAlphas = peers.map(p => p.alpha).filter(v => v != null);

  const insights = [];
  const limitations = [];
  if (userAlpha == null && !peerAlphas.length) {
    limitations.push('אין נתוני אלפא — לא בוצע חישוב אלפא');
  }

  if (userSharpe != null && peerSharpes.length >= config.minPeerGroupSize) {
    const sharpePct = percentileRank(userSharpe, peerSharpes);
    const medSharpe = median(peerSharpes);
    let finding;
    let severity = 'info';

    if (userSharpe < medSharpe && userStd != null && userStd > median(peerStds)) {
      finding = 'המסלול לקח סיכון גבוה יחסית (סטיית תקן) אך מדד שארפ נמוך מהחציון — ייתכן שלא התקבלה תשואה עודפת ביחס לסיכון.';
      severity = 'medium';
    } else if (userSharpe > medSharpe && userStd != null && userStd <= median(peerStds)) {
      finding = 'המסלול השיג מדד שארפ טוב יחסית עם תנודתיות נמוכה מהממוצע — יחס תשואה/סיכון נראה טוב.';
    } else if (userSharpe <= medSharpe) {
      finding = `מדד שארפ (${userSharpe.toFixed(2)}) נמוך או דומה לחציון הקבוצה (${medSharpe?.toFixed(2)}).`;
      severity = 'low';
    } else {
      finding = `מדד שארפ (${userSharpe.toFixed(2)}) מעל חציון הקבוצה.`;
    }

    insights.push(buildPensionInsight({
      category: 'return_vs_risk',
      severity,
      title: `תשואה ביחס לסיכון — ${fund.fundName}`,
      finding,
      personalDataUsed: ['fund.fundName'],
      marketDataUsed: ['pensia_net.SHARPE_RATIO', 'pensia_net.STIAT_TEKEN_36_HODASHIM'],
      benchmark: { group: peerGroup.groupKey, median: medSharpe, percentile: sharpePct },
      recommendedAction: 'כדאי לבחון האם רמת הסיכון והתשואה תואמות את אופק ההשקעה שלך.',
      confidence: 0.7,
      limitations,
      fundId: ctx.fundId,
      legacyType: 'return_vs_risk',
    }));
  }

  if (userAlpha != null && peerAlphas.length >= config.minPeerGroupSize) {
    const alphaMed = median(peerAlphas);
    let finding;
    let severity = 'info';
    if (userAlpha < 0 && userStd != null && userStd > median(peerStds)) {
      finding = `אלפא שלילי (${userAlpha.toFixed(2)}) עם סיכון גבוה — ייתכן שלא התקבלה תשואה עודפת ביחס לסיכון.`;
      severity = 'medium';
    } else if (userAlpha > alphaMed) {
      finding = `אלפא (${userAlpha.toFixed(2)}) מעל חציון הקבוצה (${alphaMed?.toFixed(2)}).`;
    } else {
      finding = `אלפא (${userAlpha.toFixed(2)}) נמוך או דומה לחציון הקבוצה.`;
    }
    insights.push(buildPensionInsight({
      category: 'return_vs_risk',
      severity,
      title: `אלפא ביחס לקבוצה — ${fund.fundName}`,
      finding,
      personalDataUsed: ['fund.fundName'],
      marketDataUsed: ['pensia_net.ALPHA'],
      benchmark: { group: peerGroup.groupKey, median: alphaMed },
    recommendedAction: 'כדאי לבחון האם התשואה העודפת מצדיקה את רמת הסיכון.',
      confidence: 0.7,
      fundId: ctx.fundId,
      legacyType: 'alpha_vs_peers',
    }));
  }

  return insights;
}

module.exports = { analyzeReturnVsRisk };
