

/**
 * Pension recommendation engines (Pensia-Net backed):
 *   A — Fee checker ("האם אתה פראייר?")
 *   B — Top performer alternatives ("החברות שמניבות יותר כסף")
 *   C — Actuarial leak checker ("האותיות הקטנות")
 */
const PensiaNetFund = require('../models/PensiaNetFund');
const config = require('../config/pensiaNetConfig');
const { NotFoundError } = require('../utils/appErrors');

const RISK_LABELS = {
  low: 'נמוכה',
  medium: 'בינונית',
  high: 'גבוהה',
};

const TARGET_YEAR_PATTERNS = {
  low: /\b20(2[89]|30)\b/,
  medium: /\b20(4[5-9]|5[0-5])\b/,
};

function round2(n) {
  return Math.round(n * 100) / 100;
}

function extractTargetYear(fundName) {
  const match = String(fundName || '').match(/\b(20\d{2})\b/);
  return match ? Number(match[1]) : null;
}

function foreignExposureDecimal(fund) {
  const v = fund.BETA_HUTZ_LAARETZ;
  if (v == null) return 0;
  return v > 1 ? v / 100 : v;
}

function percentile(values, pct) {
  const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (!sorted.length) return null;
  const idx = Math.ceil((pct / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
}

function median(values) {
  const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (!sorted.length) return null;
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/** Engine A — compare user deposit fee vs fund average */
function runFeeChecker(currentFund, userManagementFee) {
  const currentFundAverage = currentFund?.SHIUR_D_NIHUL_AHARON_HAFKADOT;

  if (currentFundAverage == null || userManagementFee == null) {
    return {
      isPayingTooMuch: false,
      difference: 0,
      currentFundAverage: currentFundAverage ?? null,
    };
  }

  const isPayingTooMuch = userManagementFee > currentFundAverage;
  const difference = isPayingTooMuch
    ? round2(userManagementFee - currentFundAverage)
    : 0;

  return {
    isPayingTooMuch,
    difference,
    currentFundAverage: round2(currentFundAverage),
  };
}

/** Engine B — risk-filtered top 3 by 5-year return */
function filterByRiskPreference(funds, riskPreference) {
  const stdValues = funds.map(f => f.STIAT_TEKEN_36_HODASHIM).filter(Number.isFinite);
  const sharpeValues = funds.map(f => f.SHARPE_RATIO).filter(Number.isFinite);
  const lowStdThreshold = percentile(stdValues, config.lowRiskStdDevPercentile);
  const medianSharpe = median(sharpeValues) ?? config.lowRiskMinSharpe;

  return funds.filter(fund => {
    const name = fund.SHM_KRN || '';
    const foreign = foreignExposureDecimal(fund);
    const targetYear = extractTargetYear(name);

    if (riskPreference === 'high') {
      return foreign >= 0.5 || /מניות/.test(name);
    }

    if (riskPreference === 'low') {
      const lowVolatility = lowStdThreshold != null
        && fund.STIAT_TEKEN_36_HODASHIM != null
        && fund.STIAT_TEKEN_36_HODASHIM <= lowStdThreshold;
      const stableSharpe = fund.SHARPE_RATIO != null && fund.SHARPE_RATIO >= Math.max(medianSharpe, config.lowRiskMinSharpe);
      const nearRetirementTarget = TARGET_YEAR_PATTERNS.low.test(name)
        || (targetYear != null && targetYear <= 2030);
      return lowVolatility || stableSharpe || nearRetirementTarget;
    }

    // medium — balanced allocation or long-term target years
    const balancedName = /(כללי|מאוזן|balanced)/i.test(name);
    const longTermTarget = TARGET_YEAR_PATTERNS.medium.test(name)
      || (targetYear != null && targetYear >= 2045 && targetYear <= 2055);
    const moderateExposure = foreign >= 0.15 && foreign < 0.5;
    return balancedName || longTermTarget || moderateExposure;
  });
}

function sortByFiveYearReturn(funds) {
  return [...funds].sort((a, b) => {
    const aRet = a.TSUA_SHNATIT_MEMUZAAT_5_SHANIM ?? -Infinity;
    const bRet = b.TSUA_SHNATIT_MEMUZAAT_5_SHANIM ?? -Infinity;
    return bRet - aRet;
  });
}

function buildRecommendationReason(fund, riskPreference) {
  const riskHe = RISK_LABELS[riskPreference] || RISK_LABELS.medium;
  const ret = fund.TSUA_SHNATIT_MEMUZAAT_5_SHANIM;
  const sharpe = fund.SHARPE_RATIO;
  const parts = [
    `בהתאם להעדפת הסיכון ${riskHe} שלך,`,
    `הקרן "${fund.SHM_KRN}" של ${fund.SHM_TAAGID_MENAEL || fund.SHM_TAAGID_SHOLET}`,
  ];

  if (ret != null) {
    parts.push(`הציגה תשואה שנתית ממוצעת של ${round2(ret)}% ב-5 השנים האחרונות`);
  }
  if (sharpe != null) {
    parts.push(`עם יחס שארפ ${round2(sharpe)} — מדד יעילות תשואה מול סיכון`);
  }
  parts.push('(מקור: נתוני פנסיה-נט, רשות שוק ההון).');
  return parts.join(' ');
}

/** Engine C — actuarial surplus flag */
function hasActuarialBonus(fund) {
  return fund.ODEF_GIRAON_ACTUARI_LETKUFA != null && fund.ODEF_GIRAON_ACTUARI_LETKUFA > 0;
}

function mapRecommendedFund(fund, riskPreference) {
  const actuarialBonus = hasActuarialBonus(fund);
  let recommendationReason = buildRecommendationReason(fund, riskPreference);

  if (actuarialBonus) {
    recommendationReason += ` בונוס: לקרן זו עודף אקטוארי חיובי (${round2(fund.ODEF_GIRAON_ACTUARI_LETKUFA)}%) — surplus שהוחזר לחוסכים השנה.`;
  }

  return {
    id: fund.ID,
    fundName: fund.SHM_KRN,
    companyName: fund.SHM_TAAGID_MENAEL || fund.SHM_TAAGID_SHOLET || '',
    return5Years: fund.TSUA_SHNATIT_MEMUZAAT_5_SHANIM != null
      ? round2(fund.TSUA_SHNATIT_MEMUZAAT_5_SHANIM)
      : null,
    sharpeRatio: fund.SHARPE_RATIO != null ? round2(fund.SHARPE_RATIO) : null,
    actuarialBonus,
    recommendationReason,
  };
}

/**
 * Main recommendation orchestrator.
 * @param {{ currentFundId: string, userManagementFee: number, riskPreference: 'low'|'medium'|'high' }} input
 */
async function buildPensionRecommendations(input) {
  const { currentFundId, userManagementFee, riskPreference } = input;

  const currentFund = await PensiaNetFund.findOne({ ID: String(currentFundId) }).lean();
  if (!currentFund) {
    throw new NotFoundError(`קרן פנסיה עם מזהה ${currentFundId} לא נמצאה במאגר פנסיה-נט`);
  }

  const feeAnalysis = runFeeChecker(currentFund, userManagementFee);

  const allFunds = await PensiaNetFund.find({
    ID: { $ne: String(currentFundId) },
    TSUA_SHNATIT_MEMUZAAT_5_SHANIM: { $ne: null },
  }).lean();

  const riskFiltered = filterByRiskPreference(allFunds, riskPreference);
  const pool = riskFiltered.length >= 3 ? riskFiltered : allFunds;
  const topThree = sortByFiveYearReturn(pool).slice(0, 3);

  const recommendedFunds = topThree.map(f => mapRecommendedFund(f, riskPreference));

  return { feeAnalysis, recommendedFunds };
}

module.exports = {
  buildPensionRecommendations,
  runFeeChecker,
  filterByRiskPreference,
  sortByFiveYearReturn,
  hasActuarialBonus,
  mapRecommendedFund,
  buildRecommendationReason,
};
