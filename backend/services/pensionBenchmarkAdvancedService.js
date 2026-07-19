'use strict';

const { buildPensionInsight } = require('../utils/pensionInsightBuilder');
const { median, average, percentileRank } = require('../utils/pensionStats');
const config = require('../config/pensionAnalysisConfig');

function feePercent(fee) {
  if (fee == null) return null;
  return fee <= 0.05 ? fee * 100 : fee;
}

function fmtPct(value) {
  if (value == null || !Number.isFinite(value)) return null;
  return `${value.toFixed(2)}%`;
}

function compoundedNarrative(compounded, peerBenchmark) {
  if (!compounded?.return12M?.complete) return null;

  const user12 = compounded.return12M.compoundedReturnPct;
  const med12 = peerBenchmark?.median12M;
  const pct12 = peerBenchmark?.percentile12M;

  const parts = [`תשואה מצטברת 12 חודשים: ${fmtPct(user12)}`];
  if (med12 != null) parts.push(`חציון קבוצה: ${fmtPct(med12)}`);
  if (pct12 != null) parts.push(`אחוזון ${pct12}`);

  if (compounded.return36M?.complete) {
    const user36 = compounded.return36M.compoundedReturnPct;
    const med36 = peerBenchmark?.median36M;
    const pct36 = peerBenchmark?.percentile36M;
    parts.push(`36 חודשים: ${fmtPct(user36)}`);
    if (med36 != null) parts.push(`חציון 36 ח': ${fmtPct(med36)}`);
    if (pct36 != null) parts.push(`אחוזון 36 ח': ${pct36}`);
  }

  return parts.join(', ');
}

function consistencySeverity({ percentile12M, aboveMedianRate, trend }) {
  if (percentile12M != null && percentile12M < 30) return 'medium';
  if (aboveMedianRate != null && aboveMedianRate < 40) return 'medium';
  if (trend === 'declining') return 'medium';
  return 'info';
}

/**
 * Deliverable #1 — rank fund vs peer group (same product type + risk bucket).
 * @param {object} fund
 * @param {object} ctx — { match, peerGroup, userContext, trackPerformance }
 * @returns {object[]}
 */
function analyzeFundRanking(fund, ctx) {
  const insights = [];
  const { match, peerGroup, trackPerformance } = ctx;
  const peers = peerGroup?.peers || [];

  if (peers.length < config.minPeerGroupSize) {
    return insights;
  }

  const userReturn5Y = fund.historicalReturn5Y ?? match?.return5Y ?? null;
  const userReturn1Y = fund.historicalReturn1Y ?? fund.ytdReturn ?? match?.return1Y ?? null;
  const userAssetFee = feePercent(fund.managementFeeAccumulation);
  const userDepositFee = feePercent(fund.managementFeeDeposit);

  const peerReturn5Y = peers.map(p => p.return5Y);
  const peerReturn1Y = peers.map(p => p.return1Y).filter(v => v != null);
  const peerAssetFees = peers.map(p => p.assetFee).filter(v => v != null);
  const peerStockExp = peers.map(p => p.stockExposure).filter(v => v != null);

  const return5YPercentile = percentileRank(userReturn5Y, peerReturn5Y);
  const return1YPercentile = peerReturn1Y.length ? percentileRank(userReturn1Y, peerReturn1Y) : null;
  const compounded12MPercentile = trackPerformance?.peerBenchmark?.percentile12M ?? null;
  const feePercentile = userAssetFee != null ? percentileRank(userAssetFee, peerAssetFees) : null;
  const riskPercentile = match?.stockExposure != null && peerStockExp.length
    ? percentileRank(match.stockExposure, peerStockExp)
    : null;

  const parts = [];
  if (compounded12MPercentile != null) {
    parts.push(`אחוזון ${compounded12MPercentile} בתשואה מצטברת 12 חודשים (נתוני פנסיה-נט)`);
  }
  if (return5YPercentile != null) {
    parts.push(`אחוזון ${return5YPercentile} בתשואה לחמש שנים`);
  }
  if (return1YPercentile != null) {
    parts.push(`אחוזון ${return1YPercentile} בתשואה לשנה`);
  }
  if (feePercentile != null) {
    parts.push(`אחוזון ${feePercentile} בדמי ניהול מצבירה`);
  }
  if (riskPercentile != null) {
    parts.push(`אחוזון ${riskPercentile} ברמת הסיכון (חשיפה למניות)`);
  }

  if (parts.length) {
    const marketDataUsed = ['pensia_net.peer_group', 'pensia_net.TSUA_SHNATIT_MEMUZAAT_5_SHANIM', 'pensia_net.CHSIF_MNUIOT'];
    if (compounded12MPercentile != null) {
      marketDataUsed.push('pensia_net.MONTHLY_YIELD_COMPOUNDED_12M');
    }

    insights.push(buildPensionInsight({
      category: 'fund_ranking',
      severity: (compounded12MPercentile != null && compounded12MPercentile < 30)
        || (return5YPercentile != null && return5YPercentile < 30)
        ? 'medium'
        : 'info',
      title: `דירוג המסלול מול מסלולים דומים — ${fund.fundName}`,
      finding: `המסלול שלך נמצא ${parts.join(', ')} ביחס לקבוצת השוואה (${peerGroup.groupKey}, ${peers.length} מסלולים).`,
      personalDataUsed: ['fund.fundType', 'fund.investmentTrack', 'fund.managementFeeAccumulation', 'fund.historicalReturn5Y'],
      marketDataUsed,
      benchmark: {
        group: peerGroup.groupKey,
        average: average(peerReturn5Y),
        median: median(peerReturn5Y),
        percentile: return5YPercentile,
        return1YPercentile,
        compounded12MPercentile,
        compounded12MReturn: trackPerformance?.compounded?.return12M?.compoundedReturnPct ?? null,
        compounded12MMedian: trackPerformance?.peerBenchmark?.median12M ?? null,
        feePercentile,
        riskPercentile,
      },
      recommendedAction: 'כדאי לבחון האם המסלול מתאים לפרופילך, לאחר השוואה למסלולים מאותה קבוצה.',
      confidence: compounded12MPercentile != null ? 0.78 : (ctx.matchConfidence || 0.65),
      limitations: peerReturn1Y.length === 0 ? ['תשואת שנה אינה זמינה לכל המסלולים בפנסיה-נט'] : [],
      fundId: ctx.fundId,
      legacyType: 'track_benchmark_ranking',
    }));
  }

  return insights;
}

/**
 * Deliverable #2 — performance consistency using compounded monthly returns + peer benchmark.
 */
function analyzePerformanceConsistency(fund, ctx) {
  const { match, peerGroup, trackPerformance, monthlyConsistency } = ctx;
  const peers = peerGroup?.peers || [];
  if (!match || peers.length < config.minPeerGroupSize) return [];

  const mc = trackPerformance?.monthlyConsistency ?? monthlyConsistency;
  const compounded = trackPerformance?.compounded;
  const peerBenchmark = trackPerformance?.peerBenchmark;
  const hasCompounded12M = compounded?.return12M?.complete;
  const hasMonthly = mc?.monthsCompared >= 3;

  if (hasCompounded12M || hasMonthly) {
    const findingParts = [];

    const compoundedText = compoundedNarrative(compounded, peerBenchmark);
    if (compoundedText) findingParts.push(compoundedText);

    if (hasMonthly) {
      const { monthsAboveMedian, monthsBelowMedian, monthsCompared, aboveMedianRate, trend } = mc;
      findingParts.push(
        `ב-${monthsCompared} חודשים אחרונים: ${monthsAboveMedian} מעל חציון הקבוצה, ${monthsBelowMedian} מתחת (${aboveMedianRate}% מעל החציון).`,
      );

      if (aboveMedianRate != null && aboveMedianRate < 40) {
        findingParts.push('ייתכן הידרדרות בביצועים יחסית לקבוצה.');
      } else if (aboveMedianRate != null && aboveMedianRate >= 60) {
        findingParts.push('עקביות יחסית טובה לאורך זמן.');
      }

      if (trend === 'declining') findingParts.push('מגמת 12 חודשים אחרונים: ירידה.');
      else if (trend === 'improving') findingParts.push('מגמת 12 חודשים אחרונים: שיפור.');
    } else if (hasCompounded12M) {
      const pct12 = peerBenchmark?.percentile12M;
      const user12 = compounded.return12M.compoundedReturnPct;
      const med12 = peerBenchmark?.median12M;
      if (pct12 != null && pct12 < 40) {
        findingParts.push('התשואה המצטברת ל-12 חודשים נמוכה יחסית לקבוצת השוואה.');
      } else if (pct12 != null && pct12 >= 60) {
        findingParts.push('התשואה המצטברת ל-12 חודשים גבוהה יחסית לקבוצת השוואה.');
      } else if (user12 != null && med12 != null) {
        findingParts.push(user12 >= med12
          ? 'התשואה המצטברת ל-12 חודשים בטווח חציון הקבוצה ומעלה.'
          : 'התשואה המצטברת ל-12 חודשים מתחת לחציון הקבוצה.');
      }
    }

    const severity = consistencySeverity({
      percentile12M: peerBenchmark?.percentile12M,
      aboveMedianRate: mc?.aboveMedianRate,
      trend: mc?.trend,
    });

    const marketDataUsed = ['pensia_net.peer_group'];
    if (hasCompounded12M) marketDataUsed.push('pensia_net.MONTHLY_YIELD_COMPOUNDED');
    if (hasMonthly) marketDataUsed.push('pensia_net.MONTHLY_YIELD', 'pensia_net.peer_group_monthly');

    return [buildPensionInsight({
      category: 'performance_consistency',
      severity,
      title: `עקביות ביצועים — ${fund.fundName}`,
      finding: findingParts.join(' '),
      personalDataUsed: ['fund.fundName'],
      marketDataUsed,
      benchmark: {
        group: peerGroup.groupKey,
        percentile: peerBenchmark?.percentile12M ?? mc?.aboveMedianRate ?? null,
        median: peerBenchmark?.median12M ?? 50,
        compounded12M: compounded?.return12M?.compoundedReturnPct ?? null,
        compounded36M: compounded?.return36M?.compoundedReturnPct ?? null,
        compounded60M: compounded?.return60M?.compoundedReturnPct ?? null,
        peerMedian12M: peerBenchmark?.median12M ?? null,
        peerMedian36M: peerBenchmark?.median36M ?? null,
        monthsAboveMedian: mc?.monthsAboveMedian ?? null,
        monthsBelowMedian: mc?.monthsBelowMedian ?? null,
        aboveMedianRate: mc?.aboveMedianRate ?? null,
      },
      recommendedAction: peerBenchmark?.percentile12M != null && peerBenchmark.percentile12M < 35
        ? 'מומלץ לבדוק עם בעל רישיון האם מסלול חלופי מאותה קבוצה עשוי להתאים טוב יותר לטווח ארוך.'
        : 'מומלץ לבדוק עם בעל רישיון האם מגמת הביצועים תואמת את ציפיותיך לטווח ארוך.',
      confidence: hasCompounded12M ? 0.82 : 0.75,
      assumptions: ['תשואות מצטברות מחושבות מכפלת תשואות חודשיות רצופות (לא סכום)'],
      limitations: !hasMonthly ? ['אין מספיק חודשים להשוואה חודשית מול חציון הקבוצה'] : [],
      fundId: ctx.fundId,
      legacyType: 'performance_consistency',
    })];
  }

  const user5Y = fund.historicalReturn5Y ?? match.return5Y;
  const user1Y = fund.historicalReturn1Y ?? fund.ytdReturn ?? match.return1Y;
  const med5Y = median(peers.map(p => p.return5Y));
  const med1Y = median(peers.map(p => p.return1Y).filter(v => v != null));

  const limitations = ['אין נתוני תשואה חודשיים — הבדיקה מבוססת על תשואות תקופתיות בלבד'];

  let finding = '';
  let severity = 'info';

  if (user5Y != null && med5Y != null && user1Y != null && med1Y != null) {
    const strongLongWeakShort = user5Y >= med5Y && user1Y < med1Y;
    const weakLongStrongShort = user5Y < med5Y && user1Y >= med1Y;
    if (strongLongWeakShort) {
      finding = 'הביצועים לחמש שנים מעל חציון הקבוצה, אך לשנה האחרונה מתחת לחציון — ייתכן שהביצועים הטובים מרוכזים בעבר.';
      severity = 'medium';
    } else if (weakLongStrongShort) {
      finding = 'הביצועים לשנה האחרונה מעל חציון הקבוצה, אך לחמש שנים מתחת — ייתכן שיפור לאחרונה בלבד.';
      severity = 'medium';
    } else if (user5Y >= med5Y && user1Y >= med1Y) {
      finding = 'הביצועים לשנה ולחמש שנים מעל או ליד חציון הקבוצה — עקביות יחסית לאורך זמן.';
    } else if (user5Y < med5Y && user1Y < med1Y) {
      finding = 'הביצועים לשנה ולחמש שנים מתחת לחציון הקבוצה — ייתכן הידרדרות בביצועים.';
      severity = 'medium';
    } else {
      finding = 'הביצועים מעורבים ביחס לחציון הקבוצה בין תקופות שונות.';
    }
  } else if (user5Y != null && med5Y != null) {
    finding = user5Y >= med5Y
      ? 'תשואה לחמש שנים מעל חציון הקבוצה.'
      : 'תשואה לחמש שנים מתחת לחציון הקבוצה.';
    severity = user5Y < med5Y ? 'medium' : 'info';
  } else {
    return [];
  }

  return [buildPensionInsight({
    category: 'performance_consistency',
    severity,
    title: `עקביות ביצועים — ${fund.fundName}`,
    finding,
    personalDataUsed: ['fund.historicalReturn5Y', 'fund.ytdReturn'],
    marketDataUsed: ['pensia_net.peer_group_returns'],
    benchmark: { group: peerGroup.groupKey, median: med5Y, average: average(peers.map(p => p.return5Y)) },
    recommendedAction: 'מומלץ לבדוק עם בעל רישיון האם מגמת הביצועים תואמת את ציפיותיך לטווח ארוך.',
    confidence: 0.55,
    limitations,
    fundId: ctx.fundId,
    legacyType: 'performance_consistency',
  })];
}

module.exports = { analyzeFundRanking, analyzePerformanceConsistency };
