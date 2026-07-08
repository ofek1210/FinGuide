

/**
 * Pension Comparison Engine — compares user pension products vs Pensia-Net market data.
 * Analysis A: management fee gap + 30-year loss projection (4% compound).
 * Analysis B: 5-year return underperformance + top-3 switch alternatives.
 */
const PensiaNetFund = require('../models/PensiaNetFund');
const { filterPensionProducts } = require('../utils/pensionProductNormalizer');
const { ValidationError } = require('../utils/appErrors');

const ANNUAL_RETURN_ASSUMPTION = 0.04;
const PROJECTION_YEARS = 30;
const MIN_RETURN_GAP_FOR_SWITCH = 1.0;
const PENSION_CLASSIFICATION = /קרנות חדשות|קרנות כלליות|פנסיה|pension/i;

function round2(n) {
  return Math.round(n * 100) / 100;
}

function normalizeText(s) {
  return String(s || '')
    .replace(/[\u200e\u200f\uFEFF]/g, '')
    .replace(/["']/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function companyTokens(name) {
  return normalizeText(name)
    .replace(/בע["']?מ/g, '')
    .split(/\s+/)
    .filter(t => t.length > 1);
}

function companyMatchScore(userCompany, marketCompany) {
  const a = normalizeText(userCompany);
  const b = normalizeText(marketCompany);
  if (!a || !b) return 0;
  if (a.includes(b) || b.includes(a)) return 100;
  const tokensA = companyTokens(userCompany);
  const tokensB = companyTokens(marketCompany);
  const hits = tokensA.filter(t => tokensB.some(u => u.includes(t) || t.includes(u))).length;
  return hits > 0 ? 50 + hits * 10 : 0;
}

function inferRiskProfile(productName) {
  const name = String(productName || '');
  if (/עוקב מדדי מניות|מדדי מניות|מניות(?!.*אג)/i.test(name)) return 'equity_index';
  if (/מניות|high|גבוה/i.test(name)) return 'equity';
  if (/מדדי אג|אג"ח|סוליד|שמרני/i.test(name)) return 'conservative';
  if (/כללי|מאוזן|balanced/i.test(name)) return 'balanced';
  if (/\b20(2[89]|30)\b/.test(name)) return 'conservative';
  if (/\b20(4[5-9]|5[0-5])\b/.test(name)) return 'balanced';
  return 'balanced';
}

function riskProfileMatches(marketFund, profile) {
  const name = marketFund.SHM_KRN || '';
  const foreign = marketFund.BETA_HUTZ_LAARETZ ?? 0;
  const foreignPct = foreign > 1 ? foreign : foreign * 100;

  switch (profile) {
    case 'equity_index':
      return /עוקב|מדד.*מניות|מדדי מניות/i.test(name);
    case 'equity':
      return /מניות/i.test(name) || foreignPct >= 40;
    case 'conservative':
      return /סוליד|אג"ח|שמרני/i.test(name) || foreignPct < 25;
    case 'balanced':
    default:
      return /כללי|מאוזן/i.test(name) || (foreignPct >= 15 && foreignPct < 50);
  }
}

function nameMatchScore(userProduct, marketName) {
  const a = normalizeText(userProduct);
  const b = normalizeText(marketName);
  if (!a || !b) return 0;
  if (a === b) return 100;
  if (b.includes(a) || a.includes(b)) return 80;
  const words = a.split(/\s+/).filter(w => w.length > 2);
  const hits = words.filter(w => b.includes(w)).length;
  return hits * 15;
}

function getMarketAssetFee(fund) {
  return fund.SHIUR_D_NIHUL_AHARON_TTVURAH
    ?? fund.SHIUR_D_NIHUL_MEANUAL
    ?? null;
}

/**
 * Match user product to best Pensia-Net fund row (same company + risk/name).
 */
function matchMarketFund(userProduct, marketFunds) {
  const profile = inferRiskProfile(userProduct.productName);
  const companyCandidates = marketFunds
    .map(f => ({ fund: f, companyScore: companyMatchScore(userProduct.companyName, f.SHM_TAAGID_MENAEL) }))
    .filter(x => x.companyScore >= 50);

  const pool = companyCandidates.length
    ? companyCandidates
    : marketFunds.map(f => ({ fund: f, companyScore: companyMatchScore(userProduct.companyName, f.SHM_TAAGID_MENAEL) }));

  let best = null;
  let bestScore = -1;

  for (const { fund, companyScore } of pool) {
    const riskBonus = riskProfileMatches(fund, profile) ? 25 : 0;
    const nameScore = nameMatchScore(userProduct.productName, fund.SHM_KRN);
    const score = companyScore + nameScore + riskBonus;
    if (score > bestScore) {
      bestScore = score;
      best = fund;
    }
  }

  return bestScore >= 40 ? best : null;
}

/**
 * Project wealth loss from excess annual asset fee over PROJECTION_YEARS at 4% gross return.
 * @param {number} balance
 * @param {number} excessFeePct — percentage points (e.g. 0.3 = 0.3%)
 */
function project30YearLoss(balance, excessFeePct) {
  if (!balance || balance <= 0 || !excessFeePct || excessFeePct <= 0) return 0;
  const excessDec = excessFeePct / 100;
  const fvBaseline = balance * ((1 + ANNUAL_RETURN_ASSUMPTION) ** PROJECTION_YEARS);
  const fvWithDrag = balance * ((1 + Math.max(ANNUAL_RETURN_ASSUMPTION - excessDec, 0)) ** PROJECTION_YEARS);
  return round2(Math.max(0, fvBaseline - fvWithDrag));
}

function buildFeeInsight({
  isPayingTooMuch, depositDiff, assetDiff, projected30YearLoss, productName, companyName,
}) {
  if (!isPayingTooMuch) {
    return `דמי הניהול ב"${productName}" (${companyName}) מסתמנים בתוך הממוצע בשוק לקרן מקבילה — אין חריגה משמעותית.`;
  }
  const parts = [`אתה משלם דמי ניהול גבוהים מהממוצע בקרן "${productName}" (${companyName}).`];
  if (depositDiff > 0) parts.push(`פער מהפקדה: ${round2(depositDiff)}%.`);
  if (assetDiff > 0) parts.push(`פער מצבירה: ${round2(assetDiff)}%.`);
  if (projected30YearLoss > 0) {
    parts.push(`הפסד צפוי של כ-${projected30YearLoss.toLocaleString('he-IL')} ₪ לאורך ${PROJECTION_YEARS} שנה (בהנחת תשואה שנתית ${ANNUAL_RETURN_ASSUMPTION * 100}% לפני עודף דמי ניהול).`);
  }
  return parts.join(' ');
}

function buildReturnInsight(userReturn, alternatives, productName) {
  if (!alternatives.length) {
    if (userReturn == null) {
      return `לא נמצאו נתוני תשואה 5 שנים לקרן "${productName}" במאגר פנסיה-נט — לא ניתן להמליץ על החלפה כרגע.`;
    }
    return `לא נמצאו חלופות פנסיוניות עם יתרון תשואה של ${MIN_RETURN_GAP_FOR_SWITCH}% ומעלה על הקרן הנוכחית (${round2(userReturn)}% ל-5 שנים).`;
  }

  const lines = alternatives.map((alt, i) =>
    `${i + 1}. ${alt.fundName} (${alt.companyName}) — תשואה ממוצעת 5 שנים: ${round2(alt.return5Years)}%`,
  );
  return [
    `לפי נתוני פנסיה-נט, קיימות קרנות עם תשואה גבוהה ב-${MIN_RETURN_GAP_FOR_SWITCH}%+ מהקרן "${productName}" (${round2(userReturn ?? 0)}% ל-5 שנים):`,
    ...lines,
    'שקול לבדוק מעבר רק לאחר בדיקת דמי ניהול, כיסויים ביטוחיים ותקופת אכשרה.',
  ].join(' ');
}

function findSwitchAlternatives(userFund, marketFunds, userReturn) {
  if (userReturn == null) return [];

  const profile = inferRiskProfile(userFund.SHM_KRN || userFund.productName);
  const userId = userFund.ID;

  return marketFunds
    .filter(f => f.ID !== userId)
    .filter(f => PENSION_CLASSIFICATION.test(f.SUG_KRN || '') || /פנסיה|pension/i.test(f.SHM_KRN || ''))
    .filter(f => riskProfileMatches(f, profile))
    .filter(f => f.TSUA_SHNATIT_MEMUZAAT_5_SHANIM != null)
    .filter(f => f.TSUA_SHNATIT_MEMUZAAT_5_SHANIM >= userReturn + MIN_RETURN_GAP_FOR_SWITCH)
    .sort((a, b) => b.TSUA_SHNATIT_MEMUZAAT_5_SHANIM - a.TSUA_SHNATIT_MEMUZAAT_5_SHANIM)
    .slice(0, 3)
    .map(f => ({
      id: f.ID,
      fundName: f.SHM_KRN,
      companyName: f.SHM_TAAGID_MENAEL || f.SHM_TAAGID_SHOLET || '',
      return5Years: f.TSUA_SHNATIT_MEMUZAAT_5_SHANIM,
    }));
}

function analyzeSingleProduct(userProduct, marketFunds) {
  const marketFund = matchMarketFund(userProduct, marketFunds);

  const marketDeposit = marketFund?.SHIUR_D_NIHUL_AHARON_HAFKADOT ?? null;
  const marketAsset = marketFund ? getMarketAssetFee(marketFund) : null;
  const userDeposit = userProduct.depositFee;
  const userAsset = userProduct.assetFee;

  const depositDiff = (userDeposit != null && marketDeposit != null && userDeposit > marketDeposit)
    ? round2(userDeposit - marketDeposit)
    : 0;
  const assetDiff = (userAsset != null && marketAsset != null && userAsset > marketAsset)
    ? round2(userAsset - marketAsset)
    : 0;

  const isPayingTooMuch = depositDiff > 0 || assetDiff > 0;
  const dominantExcess = Math.max(depositDiff, assetDiff);
  const projected30YearLoss = project30YearLoss(userProduct.totalSavings, dominantExcess);

  const userReturn = marketFund?.TSUA_SHNATIT_MEMUZAAT_5_SHANIM ?? null;
  const alternatives = marketFund
    ? findSwitchAlternatives({ ...marketFund, productName: userProduct.productName }, marketFunds, userReturn)
    : [];

  return {
    fundName: userProduct.productName,
    companyName: userProduct.companyName,
    isPayingTooMuch,
    feeDifference: { deposit: depositDiff, asset: assetDiff },
    projected30YearLoss,
    marketFundId: marketFund?.ID ?? null,
    userReturn5Years: userReturn != null ? round2(userReturn) : null,
    switchAlternatives: alternatives,
    recommendations: {
      feeInsight: buildFeeInsight({
        isPayingTooMuch,
        depositDiff,
        assetDiff,
        projected30YearLoss,
        productName: userProduct.productName,
        companyName: userProduct.companyName,
      }),
      returnInsight: buildReturnInsight(userReturn, alternatives, userProduct.productName),
    },
  };
}

/**
 * @param {object[]} products — sanitized product rows (Hebrew or English keys)
 * @returns {Promise<{ totalPensionSavings: number, pensionInsights: object[] }>}
 */
async function comparePensionProducts(products) {
  const pensionOnly = filterPensionProducts(products);

  if (!pensionOnly.length) {
    throw new ValidationError('לא נמצאו מוצרי פנסיה פעילים בקלט — ודא ש"סוג מוצר" או "שם מוצר" מכילים "פנסיה"');
  }

  const marketFunds = await PensiaNetFund.find({
    TSUA_SHNATIT_MEMUZAAT_5_SHANIM: { $ne: null },
  }).lean();

  if (!marketFunds.length) {
    throw new ValidationError('מאגר פנסיה-נט ריק — הרץ סנכרון נתונים (npm run sync:pensianet) לפני השוואה');
  }

  const pensionInsights = pensionOnly.map(p => analyzeSingleProduct(p, marketFunds));
  const totalPensionSavings = round2(
    pensionOnly.reduce((sum, p) => sum + (p.totalSavings || 0), 0),
  );

  return { totalPensionSavings, pensionInsights };
}

module.exports = {
  comparePensionProducts,
  filterPensionProducts,
  matchMarketFund,
  project30YearLoss,
  inferRiskProfile,
  MIN_RETURN_GAP_FOR_SWITCH,
  PROJECTION_YEARS,
  ANNUAL_RETURN_ASSUMPTION,
};
