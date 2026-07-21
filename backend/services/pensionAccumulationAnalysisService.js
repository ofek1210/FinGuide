'use strict';

const { buildPensionInsight } = require('../utils/pensionInsightBuilder');
const { median, percentileRank } = require('../utils/pensionStats');
const config = require('../config/pensionAnalysisConfig');

/**
 * Deliverable #6 — net accumulation & fund size vs peers.
 */
function analyzeAccumulationAndSize(fund, ctx) {
  const { match, peerGroup } = ctx;
  const balance = fund.currentBalance;
  const marketAssets = match?.totalAssets;
  const actuarial = match?.actuarialSurplus;

  const peers = peerGroup?.peers || [];
  const peerAssets = peers.map(p => p.totalAssets).filter(v => v != null && v > 0);
  const sizePercentile = balance != null && peerAssets.length >= config.minPeerGroupSize
    ? percentileRank(balance, peerAssets)
    : null;

  const insights = [];

  if (sizePercentile != null) {
    insights.push(buildPensionInsight({
      category: 'fund_size',
      severity: 'info',
      title: `גודל המסלול ביחס לקבוצה — ${fund.fundName}`,
      finding: `יתרת נכסים ₪${(balance || 0).toLocaleString('he-IL')} — `
        + `אחוזון ${sizePercentile} בגודל המסלול מול ${peers.length} מסלולים דומים.`,
      personalDataUsed: ['fund.currentBalance'],
      marketDataUsed: ['pensia_net.YITRAT_NECHASIM'],
      benchmark: { group: peerGroup?.groupKey, median: median(peerAssets), percentile: sizePercentile },
      recommendedAction: 'גודל המסלול הוא אינדיקציה בלבד — אין משמעות אוטומטית לביצועים.',
      confidence: 0.7,
      fundId: ctx.fundId,
      legacyType: 'fund_size',
    }));
  }

  if (actuarial != null && Math.abs(actuarial) > 0.5) {
    insights.push(buildPensionInsight({
      category: 'net_accumulation',
      severity: 'info',
      title: `צבירה נטו / עודף אקטuarי — ${fund.fundName}`,
      finding: actuarial > 0
        ? `לפי פנסיה-נט, עודף אקטuarי חיובי (${actuarial.toFixed(2)}%) — ייתכן צבירה נטו חיובית בקבוצה.`
        : `לפי פנסיה-נט, גירעון אקטuarי (${actuarial.toFixed(2)}%) — מומלץ לבדוק מגמת צבירה.`,
      personalDataUsed: [],
      marketDataUsed: ['pensia_net.ODEF_GIRAON_ACTUARI_LETKUFA'],
      benchmark: { group: peerGroup?.groupKey },
      recommendedAction: 'יציאת כספים או גירעון אינם בהכרח מעידים על קרן גרועה — יש לבדוק הקשר מלא.',
      confidence: 0.5,
      limitations: ['נתוני הפקדות/משיכות אישיים אינם זמינים — ניתוח ברמת שוק בלבד'],
      fundId: ctx.fundId,
      legacyType: 'net_accumulation',
    }));
  }

  if (marketAssets != null && balance != null && balance > 0) {
    const monthly = fund.monthlyDeposit ?? 0;
    if (monthly === 0 && fund.isActive === false) {
      insights.push(buildPensionInsight({
        category: 'net_accumulation',
        severity: 'low',
        title: `ללא הפקדות — ${fund.fundName}`,
        finding: `קרן עם יתרה ₪${balance.toLocaleString('he-IL')} ללא הפקדות חודשיות — ייתכן צבירה נטו שלילית.`,
        personalDataUsed: ['fund.currentBalance', 'fund.monthlyDeposit', 'fund.isActive'],
        marketDataUsed: [],
        recommendedAction: 'אינדיקציה לבדיקה בלבד — לא מעיד אוטומטית על איכות הקרן.',
        confidence: 0.8,
        fundId: ctx.fundId,
        legacyType: 'no_deposits_balance',
      }));
    }
  }

  return insights;
}

module.exports = { analyzeAccumulationAndSize };
