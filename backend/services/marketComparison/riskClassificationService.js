'use strict';

const { normalizeExposurePercent } = require('../../utils/normalizePercentage');
const { RISK_LEVELS } = require('./comparisonContract');
const {
  normalizeText,
  detectAgeBucket,
  detectSp500,
  detectEquityName,
  detectBondName,
  detectGeneralName,
  detectHalacha,
  detectCash,
  detectAnnuity,
  stockExposureRiskLevel,
  ageBucketRiskLevel,
} = require('./trackPatternUtils');
const { extractGroupSuffix } = require('./riskGroupCompatibilityService');

const VALID_RISK = new Set(RISK_LEVELS);

function classifyRiskFromExposure(record, domain) {
  const stockExposure = normalizeExposurePercent(
    record?.CHSHIF_MNUIOT,
    record?.YITRAT_NECHASIM,
  ).value;
  const exposureRisk = stockExposureRiskLevel(stockExposure);
  if (exposureRisk) {
    return { riskLevel: exposureRisk, reason: `${domain}_stock_exposure_primary` };
  }
  return null;
}

function classifyAgeGroupFallback(comparisonGroup, domain) {
  const suffix = extractGroupSuffix(comparisonGroup);
  if (suffix === 'age_under_50') {
    return { riskLevel: ageBucketRiskLevel('under_50'), reason: `${domain}_age_default_under_50` };
  }
  if (suffix === 'age_50_60') {
    return { riskLevel: ageBucketRiskLevel('50_60'), reason: `${domain}_age_default_50_60` };
  }
  if (suffix === 'age_over_60') {
    return { riskLevel: ageBucketRiskLevel('over_60'), reason: `${domain}_age_default_over_60` };
  }
  return null;
}

/**
 * Pension risk — exposure first; age label does not set risk unless exposure is missing
 * and the comparison group is age-based.
 */
function classifyPensionRisk(record, { comparisonGroup = null } = {}) {
  const trackName = normalizeText(record?.SHM_KRN);
  const classification = normalizeText(record?.SUG_KRN);

  if (detectAnnuity(trackName)) {
    return { riskLevel: 'low', reason: 'pension_annuity_track_name' };
  }

  const exposureFirst = classifyRiskFromExposure(record, 'pension');
  if (exposureFirst) return exposureFirst;

  if (detectSp500(trackName)) {
    return { riskLevel: 'high', reason: 'pension_sp500_track_name' };
  }
  if (detectBondName(trackName)) {
    return { riskLevel: 'low', reason: 'pension_bond_track_name' };
  }
  if (detectEquityName(trackName)) {
    return { riskLevel: 'high', reason: 'pension_equity_track_name' };
  }

  const ageFallback = classifyAgeGroupFallback(comparisonGroup, 'pension');
  if (ageFallback) return ageFallback;

  if (detectAgeBucket(trackName)) {
    return {
      riskLevel: ageBucketRiskLevel(detectAgeBucket(trackName)),
      reason: 'pension_age_track_without_exposure',
    };
  }

  if (detectHalacha(trackName)) {
    return { riskLevel: 'unclassified', reason: 'pension_halacha_requires_exposure' };
  }

  if (detectGeneralName(trackName)) {
    return { riskLevel: 'medium', reason: 'pension_general_track_name' };
  }

  if (classification.includes('קרנות חדשות') || classification.includes('קרנות כלליות')) {
    return { riskLevel: 'medium', reason: 'pension_fund_classification_default' };
  }

  const foreignExposure = normalizeExposurePercent(record?.BETA_HUTZ_LAARETZ).value;
  const foreignRisk = stockExposureRiskLevel(foreignExposure);
  if (foreignRisk) {
    return { riskLevel: foreignRisk, reason: 'pension_foreign_exposure' };
  }

  return { riskLevel: 'unclassified', reason: 'pension_unclassified' };
}

/**
 * GemelNet risk — exposure first; Halacha is not auto-medium; age defaults only without exposure.
 */
function classifyGemelRisk(record, { comparisonGroup = null } = {}) {
  const specialization = normalizeText(record?.SPECIALIZATION);
  const subSpecialization = normalizeText(record?.SUB_SPECIALIZATION);
  const trackName = normalizeText(record?.SHM_KRN);
  const combinedSpec = normalizeText(record?.SPECIALIZATION, record?.SUB_SPECIALIZATION);

  const exposureFirst = classifyRiskFromExposure(record, 'gemel');
  if (exposureFirst) return exposureFirst;

  if (detectSp500(combinedSpec) || detectSp500(trackName)) {
    return { riskLevel: 'high', reason: 'gemel_sp500_specialization' };
  }

  if (specialization === 'מניות' || (detectEquityName(subSpecialization) && !detectBondName(subSpecialization))) {
    return { riskLevel: 'high', reason: 'gemel_equity_specialization' };
  }

  if (
    specialization.includes('אג"ח')
    || subSpecialization.includes('אג"ח')
    || subSpecialization.includes('אשרא')
    || specialization === 'שיקלי'
    || detectCash(combinedSpec)
  ) {
    return { riskLevel: 'low', reason: 'gemel_bond_specialization' };
  }

  if (specialization === 'כללי' || subSpecialization === 'כללי') {
    return { riskLevel: 'medium', reason: 'gemel_general_specialization' };
  }

  if (specialization.includes('עוקבי מדדים') || specialization === 'מדד') {
    if (detectBondName(subSpecialization)) {
      return { riskLevel: 'low', reason: 'gemel_index_bond_specialization' };
    }
    if (detectEquityName(subSpecialization) || detectSp500(subSpecialization)) {
      return { riskLevel: 'high', reason: 'gemel_index_equity_specialization' };
    }
    return { riskLevel: 'medium', reason: 'gemel_index_specialization' };
  }

  const ageFallback = classifyAgeGroupFallback(comparisonGroup, 'gemel');
  if (ageFallback) return ageFallback;

  if (detectHalacha(combinedSpec)) {
    return { riskLevel: 'unclassified', reason: 'gemel_halacha_requires_exposure' };
  }

  if (detectBondName(trackName)) {
    return { riskLevel: 'low', reason: 'gemel_bond_track_name' };
  }
  if (detectEquityName(trackName)) {
    return { riskLevel: 'high', reason: 'gemel_equity_track_name' };
  }

  return { riskLevel: 'unclassified', reason: 'gemel_unclassified' };
}

function classifyRisk(record, { domain = 'gemel', comparisonGroup = null } = {}) {
  const result = domain === 'pension'
    ? classifyPensionRisk(record, { comparisonGroup })
    : classifyGemelRisk(record, { comparisonGroup });

  if (!VALID_RISK.has(result.riskLevel)) {
    return { riskLevel: 'unclassified', reason: `${domain}_invalid_risk_fallback` };
  }
  return result;
}

module.exports = {
  classifyPensionRisk,
  classifyGemelRisk,
  classifyRisk,
};
