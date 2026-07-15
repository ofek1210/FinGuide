'use strict';

/**
 * Generic gov-fund market comparison (gemel-net / bituah-net / pensia-net shape).
 */
const {
  matchMarketFund,
  inferRiskProfile,
  project30YearLoss,
  MIN_RETURN_GAP_FOR_SWITCH,
} = require('./pensionComparisonEngine');

const VERDICT = {
  LEAVE: 'LEAVE',
  NEGOTIATE: 'NEGOTIATE',
  SWITCH: 'SWITCH',
  REVIEW: 'REVIEW',
};

const VERDICT_HE = {
  LEAVE: 'הישאר במסלול',
  NEGOTIATE: 'נהל משא ומתן',
  SWITCH: 'שקול מעבר',
  REVIEW: 'בדוק מחדש',
};

function median(values) {
  const nums = values.filter(v => v != null && Number.isFinite(v)).sort((a, b) => a - b);
  if (!nums.length) return null;
  const mid = Math.floor(nums.length / 2);
  return nums.length % 2 ? nums[mid] : (nums[mid - 1] + nums[mid]) / 2;
}

function percentileRank(value, cohort) {
  if (value == null || !cohort.length) return null;
  const below = cohort.filter(v => v <= value).length;
  return Math.round((below / cohort.length) * 100);
}

function getAssetFee(fund) {
  if (!fund) return null;
  return fund.SHIUR_D_NIHUL_AHARON_TTVURAH ?? fund.SHIUR_D_NIHUL_MEANUAL ?? null;
}

function stockExposurePct(fund) {
  if (!fund) return null;
  const v = fund.CHSHIF_MNUIOT;
  if (v == null) return null;
  return Math.abs(v) <= 1 ? v * 100 : v;
}

function findAlternatives(userFund, marketFunds, userReturn, filterFn) {
  if (userReturn == null) return [];
  const pool = filterFn ? marketFunds.filter(filterFn) : marketFunds;
  return pool
    .filter(f => f.ID !== userFund?.ID)
    .filter(f => f.TSUA_SHNATIT_MEMUZAAT_5_SHANIM != null)
    .filter(f => f.TSUA_SHNATIT_MEMUZAAT_5_SHANIM >= userReturn + MIN_RETURN_GAP_FOR_SWITCH)
    .sort((a, b) => b.TSUA_SHNATIT_MEMUZAAT_5_SHANIM - a.TSUA_SHNATIT_MEMUZAAT_5_SHANIM)
    .slice(0, 3)
    .map(f => ({
      id: f.ID,
      fundName: f.SHM_KRN,
      companyName: f.SHM_TAAGID_MENAEL || f.SHM_TAAGID_SHOLET || '',
      return5Years: f.TSUA_SHNATIT_MEMUZAAT_5_SHANIM,
      sharpeRatio: f.SHARPE_RATIO,
    }));
}

function decideVerdict({ returnPercentile, feeVsMarket, switchGain, isOldPolicy }) {
  if (isOldPolicy && feeVsMarket === 'high') return VERDICT.REVIEW;
  if (returnPercentile != null && returnPercentile < 30 && switchGain > 0) return VERDICT.SWITCH;
  if (feeVsMarket === 'high') return VERDICT.NEGOTIATE;
  if (returnPercentile != null && returnPercentile < 45) return VERDICT.REVIEW;
  return VERDICT.LEAVE;
}

function analyzeProduct(userProduct, marketFunds, options = {}) {
  const marketFund = matchMarketFund(userProduct, marketFunds);
  const cohortReturns = marketFunds.map(f => f.TSUA_SHNATIT_MEMUZAAT_5_SHANIM).filter(v => v != null);
  const cohortFees = marketFunds.map(f => getAssetFee(f)).filter(v => v != null);

  const marketReturn5Y = marketFund?.TSUA_SHNATIT_MEMUZAAT_5_SHANIM ?? median(cohortReturns);
  const marketFee = getAssetFee(marketFund) ?? median(cohortFees);
  const userReturn = marketFund?.TSUA_SHNATIT_MEMUZAAT_5_SHANIM ?? null;
  const userFee = userProduct.assetFee ?? getAssetFee(marketFund);
  const userDepositFee = userProduct.depositFee ?? marketFund?.SHIUR_D_NIHUL_AHARON_HAFKADOT ?? null;

  const returnPercentile = percentileRank(userReturn, cohortReturns.length ? cohortReturns : [marketReturn5Y]);

  let feeVsMarket = 'unknown';
  if (userFee != null && marketFee != null) {
    if (userFee <= marketFee * 1.05) feeVsMarket = 'fair';
    else if (userFee <= marketFee * 1.25) feeVsMarket = 'above_market';
    else feeVsMarket = 'high';
  }

  const depositDiff = (userDepositFee != null && marketFund?.SHIUR_D_NIHUL_AHARON_HAFKADOT != null
    && userDepositFee > marketFund.SHIUR_D_NIHUL_AHARON_HAFKADOT)
    ? userDepositFee - marketFund.SHIUR_D_NIHUL_AHARON_HAFKADOT
    : 0;

  const assetDiff = (userFee != null && marketFee != null && userFee > marketFee)
    ? userFee - marketFee
    : 0;

  const projectedLoss = project30YearLoss(userProduct.totalSavings || 0, Math.max(depositDiff, assetDiff));
  const annualSavingsEstimate = Math.round((userProduct.totalSavings || 0) * (Math.max(depositDiff, assetDiff) / 100));

  const isOldPolicy = options.oldPolicyPattern
    ? options.oldPolicyPattern.test(userProduct.productType || marketFund?.SUG_KRN || '')
    : false;

  const alternatives = marketFund
    ? findAlternatives(marketFund, marketFunds, userReturn, options.cohortFilter)
    : [];

  const bestSharpe = Math.max(...marketFunds.map(f => f.SHARPE_RATIO ?? 0));
  const userSharpe = marketFund?.SHARPE_RATIO ?? null;

  const verdict = decideVerdict({
    returnPercentile,
    feeVsMarket,
    switchGain: projectedLoss,
    isOldPolicy,
  });

  const stockExp = stockExposurePct(marketFund);
  const age = options.userAge;
  let riskNote = null;
  if (age != null && age < 40 && stockExp != null && stockExp < 15) {
    riskNote = `בגיל ${age} — חשיפה למניות ${stockExp.toFixed(1)}% בלבד; שקול מסלול מנייתי`;
  }

  return {
    productName: userProduct.productName,
    companyName: userProduct.companyName,
    marketFundId: marketFund?.ID ?? null,
    verdict,
    verdictLabelHe: VERDICT_HE[verdict],
    returnPercentile,
    userReturn5Y: userReturn,
    marketReturn5Y,
    userFee,
    marketFee,
    userDepositFee,
    marketDepositFee: marketFund?.SHIUR_D_NIHUL_AHARON_HAFKADOT ?? null,
    feeVsMarket,
    sharpeRatio: userSharpe,
    marketBestSharpe: bestSharpe || null,
    stockExposure: stockExp,
    projected30YearLoss: projectedLoss,
    annualSavingsEstimate,
    alternatives,
    riskNote,
    policyGeneration: marketFund?.POLICY_GENERATION || marketFund?.SUG_KRN || null,
    specialization: marketFund?.SPECIALIZATION || null,
    summaryHe: buildSummaryHe({
      verdict,
      userProduct,
      userReturn,
      marketReturn5Y,
      returnPercentile,
      userFee,
      marketFee,
      userSharpe,
      bestSharpe,
      riskNote,
      isOldPolicy,
      annualSavingsEstimate,
      alternatives,
    }),
  };
}

function buildSummaryHe(ctx) {
  const {
    verdict, userProduct, userReturn, marketReturn5Y, returnPercentile,
    userFee, marketFee, userSharpe, bestSharpe, riskNote, isOldPolicy,
    annualSavingsEstimate, alternatives,
  } = ctx;

  const name = userProduct.productName || 'המוצר';
  const parts = [];

  if (verdict === VERDICT.NEGOTIATE && userFee != null && marketFee != null) {
    parts.push(`${name} — דמ"נ ${userFee.toFixed(2)}% מול ממוצע שוק ${marketFee.toFixed(2)}% → NEGOTIATE${annualSavingsEstimate ? `, חיסכון ~₪${annualSavingsEstimate.toLocaleString('he-IL')}/שנה` : ''}`);
  } else if (verdict === VERDICT.SWITCH && userReturn != null) {
    const alts = alternatives.map(a => a.companyName).filter(Boolean).slice(0, 2).join(' / ');
    parts.push(`${name} — תשואה 5y ${userReturn.toFixed(1)}% (אחוזון ${returnPercentile ?? '—'}) → SWITCH${alts ? ` ל-${alts}` : ''}`);
  } else if (verdict === VERDICT.REVIEW && isOldPolicy) {
    parts.push(`${name} — דור פוליסה ישן, דמ"נ גבוהים → REVIEW מול פוליסות 2004+`);
  } else if (userSharpe != null && bestSharpe != null && userSharpe < bestSharpe - 0.1) {
    parts.push(`${name} — Sharpe ${userSharpe.toFixed(2)} מול מוביל ${bestSharpe.toFixed(2)} → מסלול פחות יעיל`);
  } else if (userReturn != null && marketReturn5Y != null) {
    parts.push(`${name} — תשואה 5y ${userReturn.toFixed(1)}% מול ממוצע ${marketReturn5Y.toFixed(1)}% — ${VERDICT_HE[verdict]}`);
  }

  if (riskNote) parts.push(riskNote);
  return parts.join('. ') || `${name} — ${VERDICT_HE[verdict]}`;
}

async function buildGovFundAdvice(userProducts, Model, options = {}) {
  const active = (userProducts || []).filter(p => p.isActive !== false);
  if (!active.length) {
    return { hasData: false, funds: [], overallVerdict: null, message: options.emptyMessage };
  }

  const marketFunds = await Model.find({ TSUA_SHNATIT_MEMUZAAT_5_SHANIM: { $ne: null } }).lean();
  if (!marketFunds.length) {
    return {
      hasData: false,
      funds: [],
      overallVerdict: null,
      message: options.syncHint || 'מאגר שוק ריק — הרץ סנכרון gov',
    };
  }

  const funds = active.map(p => analyzeProduct(p, marketFunds, options));
  const verdictCounts = funds.reduce((acc, f) => {
    acc[f.verdict] = (acc[f.verdict] || 0) + 1;
    return acc;
  }, {});

  const overallVerdict = verdictCounts[VERDICT.SWITCH]
    ? VERDICT.SWITCH
    : verdictCounts[VERDICT.NEGOTIATE]
      ? VERDICT.NEGOTIATE
      : verdictCounts[VERDICT.REVIEW]
        ? VERDICT.REVIEW
        : VERDICT.LEAVE;

  return {
    hasData: true,
    dataSource: options.dataSource || 'gov_db',
    sourceName: options.sourceName,
    funds,
    overallVerdict,
    overallVerdictLabelHe: VERDICT_HE[overallVerdict],
    summary: { fundCount: funds.length, verdictCounts },
    disclaimer: options.disclaimer || 'המידע מבוסס על נתוני data.gov.il — אינו ייעוץ מקצועי.',
  };
}

module.exports = {
  VERDICT,
  VERDICT_HE,
  analyzeProduct,
  buildGovFundAdvice,
  stockExposurePct,
};
