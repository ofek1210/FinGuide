'use strict';

/**
 * Pension Fund Advisor — actuarial verdict engine (LEAVE | NEGOTIATE | SWITCH).
 * Compares user funds vs live/static gov market data.
 */
const { projectPensionIncome, calculateMgmtFeeSavings } = require('../ai/engines/calculationEngine');
const { loadGovTracks, getCohortTracks, matchUserFundToGovTrack } = require('./pensionGovDataService');
const { TOP_QUARTILE } = require('../config/pensionBenchmarkTables');
const {
  recommendedRiskLevel,
  resolveRetirementAge,
  normalizeFundRiskLevel,
} = require('../utils/pensionShared');

const VERDICT = {
  LEAVE: 'LEAVE',
  NEGOTIATE: 'NEGOTIATE',
  SWITCH: 'SWITCH',
};

const VERDICT_HE = {
  LEAVE: 'הישאר בקרן הנוכחית',
  NEGOTIATE: 'נהל משא ומרת',
  SWITCH: 'שקול קרן',
};

const SWITCH_SAVINGS_THRESHOLD = 50000;
const NEGOTIATE_FEE_RATIO = 1.12;

function median(values) {
  const nums = values.filter(v => v != null && Number.isFinite(v)).sort((a, b) => a - b);
  if (!nums.length) return null;
  const mid = Math.floor(nums.length / 2);
  return nums.length % 2 ? nums[mid] : (nums[mid - 1] + nums[mid]) / 2;
}

function percentileRank(value, cohortValues) {
  if (value == null || !cohortValues.length) return null;
  const below = cohortValues.filter(v => v <= value).length;
  return Math.round((below / cohortValues.length) * 100);
}

function projectBalanceAtRetirement({
  balance,
  monthlyDeposit,
  yearsToRetirement,
  annualReturnPct,
  mgmtFeeAccumulation,
}) {
  if (yearsToRetirement <= 0) return balance || 0;
  const result = projectPensionIncome({
    currentAge: 67 - yearsToRetirement,
    retirementAge: 67,
    currentAccumulation: balance || 0,
    monthlyContribution: monthlyDeposit || 0,
    annualReturnRate: (annualReturnPct ?? 5.5) / 100,
    mgmtFeeAccumulation: mgmtFeeAccumulation ?? TOP_QUARTILE.mgmtFeeAccumulation,
  });
  return result.projectedAccumulation;
}

function pickAlternatives(cohort, userTrack, limit = 2) {
  const userId = userTrack?.id;
  return [...cohort]
    .filter(t => t.id !== userId)
    .sort((a, b) => {
      const scoreA = (a.return5Y ?? a.return3Y ?? a.return1Y ?? 0) - (a.mgmtFeeAccumulation ?? 0.01) * 100;
      const scoreB = (b.return5Y ?? b.return3Y ?? b.return1Y ?? 0) - (b.mgmtFeeAccumulation ?? 0.01) * 100;
      return scoreB - scoreA;
    })
    .slice(0, limit)
    .map(t => ({
      provider: t.provider,
      fundName: t.name,
      return1Y: t.return1Y,
      return3Y: t.return3Y,
      return5Y: t.return5Y,
      mgmtFeeAccumulation: t.mgmtFeeAccumulation,
      mgmtFeeDeposit: t.mgmtFeeDeposit,
      isDefaultSelected: Boolean(t.isDefaultSelected),
      rationale: t.isDefaultSelected
        ? 'קרן ברירת מחדל — מסלול מפוקח עם דמי ניהול תחרותיים'
        : `תשואה 5 שנים ${t.return5Y ?? '—'}%, דמי ניהול ${((t.mgmtFeeAccumulation ?? 0) * 100).toFixed(2)}%`,
    }));
}

function decideVerdict({
  returnPercentile,
  feeVsMarket,
  userFee,
  marketFee,
  switchGainVsBest,
  negotiateGain,
  riskMismatch,
  matchConfidence,
}) {
  const highFees = feeVsMarket === 'above_market' || feeVsMarket === 'high'
    || (userFee != null && marketFee != null && userFee > marketFee * NEGOTIATE_FEE_RATIO);

  if (switchGainVsBest >= SWITCH_SAVINGS_THRESHOLD && returnPercentile != null && returnPercentile < 55) {
    return VERDICT.SWITCH;
  }
  if (switchGainVsBest >= SWITCH_SAVINGS_THRESHOLD * 0.6 && highFees) {
    return VERDICT.SWITCH;
  }
  if (highFees && returnPercentile != null && returnPercentile >= 45 && negotiateGain > 15000) {
    return VERDICT.NEGOTIATE;
  }
  if (highFees && returnPercentile != null && returnPercentile >= 50 && matchConfidence >= 40) {
    return VERDICT.NEGOTIATE;
  }
  if (returnPercentile != null && returnPercentile < 30 && !riskMismatch) {
    return VERDICT.SWITCH;
  }
  return VERDICT.LEAVE;
}

function buildVerdictNarrative(verdict, ctx) {
  const { fundName, returnPercentile, userFee, marketFee, switchGainVsBest, alternatives } = ctx;
  const feePct = userFee != null ? `${(userFee * 100).toFixed(2)}%` : '—';
  const marketPct = marketFee != null ? `${(marketFee * 100).toFixed(2)}%` : '—';

  if (verdict === VERDICT.LEAVE) {
    return `הקרן "${fundName}" מדורגת באחוזון ${returnPercentile ?? '—'} מול השוק, עם דמי ניהול ${feePct} (ממוצע: ${marketPct}). אין הצדקה מספקת להחלפת מעבר עלויות — מומלץ להישאר, לעקוב אחרי ביצועים ולוודא התאמת מסלול סיכון.`;
  }
  if (verdict === VERDICT.NEGOTIATE) {
    return `הקרן "${fundName}" מציגה ביצועים סבירים (אחוזון ${returnPercentile ?? '—'}), אך דמי הניהול ${feePct} גבוהים מהממוצע ${marketPct}. ניתן לחסוך עד ₪${Math.round(ctx.negotiateGain).toLocaleString('he-IL')} עד פרישה במשא ומרת על דמי הניהול — ללא חייבים לעבור קרן.`;
  }
  const altNames = (alternatives || []).map(a => `${a.provider} — ${a.fundName}`).join('; ');
  return `הקרן "${fundName}" מתחת לממוצע (${returnPercentile ?? '—'} אחוזון) ו/או דמי ניהול גבוהים. מעבר לעבור, שקלי: ${altNames || 'קרן ברירת מחדל במסלול מתאים'}. פוטנציאל לשיפור צבירה: ₪${Math.round(switchGainVsBest).toLocaleString('he-IL')} עד פרישה.`;
}

function analyzeFund(fund, tracks, profile) {
  const age = profile?.currentAge ?? profile?.personal?.age ?? null;
  const retirementAge = profile?.retirementAge ?? resolveRetirementAge(profile);
  const yearsToRetirement = age != null ? Math.max(0, retirementAge - age) : 25;

  const risk = normalizeFundRiskLevel(fund.riskLevel || 'medium');
  const productType = fund.fundType || 'pension_comprehensive';
  const cohort = getCohortTracks(tracks, productType, risk);
  const { track: matched, confidence: matchConfidence } = matchUserFundToGovTrack(fund, tracks);

  const cohortReturns5Y = cohort.map(t => t.return5Y).filter(v => v != null);
  const cohortFees = cohort.map(t => t.mgmtFeeAccumulation).filter(v => v != null);
  const marketFee = median(cohortFees) ?? matched?.mgmtFeeAccumulation ?? TOP_QUARTILE.mgmtFeeAccumulation;
  const marketReturn5Y = median(cohortReturns5Y) ?? matched?.return5Y ?? 5.5;

  const userReturn5Y = fund.historicalReturn5Y ?? matched?.return5Y ?? marketReturn5Y;
  const userFee = fund.managementFeeAccumulation ?? matched?.mgmtFeeAccumulation ?? null;

  const returnPercentile = percentileRank(userReturn5Y, cohortReturns5Y.length ? cohortReturns5Y : [marketReturn5Y]);

  let feeVsMarket = 'unknown';
  if (userFee != null && marketFee != null) {
    if (userFee <= TOP_QUARTILE.mgmtFeeAccumulation) feeVsMarket = 'excellent';
    else if (userFee <= marketFee * 1.05) feeVsMarket = 'fair';
    else if (userFee <= marketFee * 1.25) feeVsMarket = 'above_market';
    else feeVsMarket = 'high';
  }

  const recommendedRisk = recommendedRiskLevel(age, yearsToRetirement);
  const riskMismatch = recommendedRisk && risk !== 'unknown' && risk !== recommendedRisk;

  const balance = fund.currentBalance || 0;
  const monthlyDeposit = (fund.monthlyEmployeeDeposit || 0) + (fund.monthlyEmployerDeposit || 0);

  const remainAtRetirement = projectBalanceAtRetirement({
    balance,
    monthlyDeposit,
    yearsToRetirement,
    annualReturnPct: userReturn5Y,
    mgmtFeeAccumulation: userFee ?? marketFee,
  });

  const defaultAlt = cohort.find(t => t.isDefaultSelected)
    || cohort.sort((a, b) => (b.return5Y ?? 0) - (a.return5Y ?? 0))[0]
    || matched;

  const bestAlt = cohort
    .filter(t => t.id !== matched?.id)
    .sort((a, b) => (b.return5Y ?? 0) - (a.return5Y ?? 0))[0] || defaultAlt;

  const switchAtRetirement = projectBalanceAtRetirement({
    balance,
    monthlyDeposit,
    yearsToRetirement,
    annualReturnPct: bestAlt?.return5Y ?? marketReturn5Y,
    mgmtFeeAccumulation: bestAlt?.mgmtFeeAccumulation ?? TOP_QUARTILE.mgmtFeeAccumulation,
  });

  const switchGainVsBest = Math.max(0, switchAtRetirement - remainAtRetirement);

  let negotiateGain = 0;
  if (userFee != null && userFee > TOP_QUARTILE.mgmtFeeAccumulation && yearsToRetirement > 0) {
    negotiateGain = calculateMgmtFeeSavings(
      balance,
      monthlyDeposit,
      yearsToRetirement,
      userFee,
      Math.max(TOP_QUARTILE.mgmtFeeAccumulation, marketFee),
    ).savingsByRetirement;
  }

  const alternatives = pickAlternatives(cohort, matched, 2);
  const verdict = decideVerdict({
    returnPercentile,
    feeVsMarket,
    userFee,
    marketFee,
    switchGainVsBest,
    negotiateGain,
    riskMismatch,
    matchConfidence,
  });

  return {
    fundId: fund._id?.toString?.() || fund.id,
    fundName: fund.fundName,
    provider: fund.provider,
    fundType: productType,
    riskLevel: risk,
    recommendedRiskLevel: recommendedRisk,
    riskMismatch,
    matchedGovTrack: matched
      ? { provider: matched.provider, name: matched.name, source: matched.source }
      : null,
    matchConfidence,
    marketComparison: {
      return1Y: matched?.return1Y ?? null,
      return3Y: matched?.return3Y ?? null,
      return5Y: marketReturn5Y,
      userReturn5Y,
      returnPercentile,
      marketAvgFee: marketFee,
      userFee,
      feeVsMarket,
      cohortSize: cohort.length,
    },
    financialImpact: {
      yearsToRetirement,
      projectedAtRetirementRemain: remainAtRetirement,
      projectedAtRetirementSwitch: switchAtRetirement,
      gainIfSwitch: switchGainVsBest,
      gainIfNegotiateFees: negotiateGain,
      monthlyDeposit,
      currentBalance: balance,
    },
    verdict,
    verdictLabelHe: VERDICT_HE[verdict],
    summaryHe: buildVerdictNarrative(verdict, {
      fundName: fund.fundName,
      returnPercentile,
      userFee,
      marketFee,
      switchGainVsBest,
      negotiateGain,
      alternatives,
    }),
    alternatives: verdict === VERDICT.SWITCH ? alternatives : [],
  };
}

/**
 * Full portfolio fund advice for a user.
 * @param {object[]} funds
 * @param {object} profile
 * @param {object} [options]
 */
async function buildFundAdvice(funds, profile, options = {}) {
  const activeFunds = (funds || []).filter(f => f.status !== 'closed' && f.isActive !== false);
  if (!activeFunds.length) {
    return {
      hasData: false,
      message: 'לא נמצאו קרנות פנסיה לניתוח. ייבא דוח הר הכסף או הזן קרן ידנית.',
      funds: [],
      overallVerdict: null,
      dataSource: null,
    };
  }

  const { tracks, source, cached, warning } = await loadGovTracks({
    forceRefresh: Boolean(options.forceRefresh),
  });

  const fundAdvice = activeFunds.map(f => analyzeFund(f, tracks, profile));
  const verdictCounts = fundAdvice.reduce((acc, f) => {
    acc[f.verdict] = (acc[f.verdict] || 0) + 1;
    return acc;
  }, {});

  const overallVerdict = verdictCounts[VERDICT.SWITCH]
    ? VERDICT.SWITCH
    : verdictCounts[VERDICT.NEGOTIATE]
      ? VERDICT.NEGOTIATE
      : VERDICT.LEAVE;

  const totalSwitchGain = fundAdvice.reduce((s, f) => s + (f.financialImpact?.gainIfSwitch || 0), 0);
  const totalNegotiateGain = fundAdvice.reduce((s, f) => s + (f.financialImpact?.gainIfNegotiateFees || 0), 0);

  return {
    hasData: true,
    role: 'Senior Pension & Actuarial Expert',
    dataSource: source,
    dataCached: Boolean(cached),
    dataWarning: warning || null,
    funds: fundAdvice,
    overallVerdict,
    overallVerdictLabelHe: VERDICT_HE[overallVerdict],
    summary: {
      fundCount: fundAdvice.length,
      verdictCounts,
      totalGainIfSwitch: totalSwitchGain,
      totalGainIfNegotiate: totalNegotiateGain,
    },
    disclaimer: 'לפני ביצוע שינויים בקרן הפנסיה — יש להתייעץ עם יועץ פנסיוני מורשה.',
  };
}

module.exports = {
  VERDICT,
  VERDICT_HE,
  buildFundAdvice,
  analyzeFund,
  projectBalanceAtRetirement,
};
