'use strict';

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
} = require('./trackPatternUtils');

const UNCLASSIFIED_GROUP = 'unclassified';

/**
 * Comparison-group rules derived from live GemelNet SPECIALIZATION / SUB_SPECIALIZATION
 * and PensiaNet SHM_KRN patterns (see scripts/inspect-market-comparison-fields.js).
 *
 * Groups are prefixed by product type so cross-product ranking never occurs.
 */

function withProductPrefix(productType, suffix) {
  if (!suffix || suffix === UNCLASSIFIED_GROUP) return UNCLASSIFIED_GROUP;
  return `${productType}_${suffix}`;
}

function classifyPensionComparisonGroup(record) {
  const productType = 'pension';
  const trackName = normalizeText(record?.SHM_KRN);

  if (detectAnnuity(trackName)) {
    return { comparisonGroup: UNCLASSIFIED_GROUP, reason: 'pension_annuity_excluded' };
  }

  const ageBucket = detectAgeBucket(trackName);
  if (ageBucket === 'under_50') {
    return { comparisonGroup: withProductPrefix(productType, 'age_under_50'), reason: 'pension_age_under_50' };
  }
  if (ageBucket === '50_60') {
    return { comparisonGroup: withProductPrefix(productType, 'age_50_60'), reason: 'pension_age_50_60' };
  }
  if (ageBucket === 'over_60') {
    return { comparisonGroup: withProductPrefix(productType, 'age_over_60'), reason: 'pension_age_over_60' };
  }

  if (detectSp500(trackName)) {
    return { comparisonGroup: withProductPrefix(productType, 'sp500'), reason: 'pension_sp500_track' };
  }

  if (detectBondName(trackName)) {
    return { comparisonGroup: withProductPrefix(productType, 'bonds'), reason: 'pension_bond_track' };
  }

  if (detectEquityName(trackName)) {
    return { comparisonGroup: withProductPrefix(productType, 'equity'), reason: 'pension_equity_track' };
  }

  if (detectHalacha(trackName)) {
    return { comparisonGroup: withProductPrefix(productType, 'halacha'), reason: 'pension_halacha_track' };
  }

  if (detectGeneralName(trackName)) {
    return { comparisonGroup: withProductPrefix(productType, 'general'), reason: 'pension_general_track' };
  }

  const stockExposure = record?.stockExposurePct;
  const exposureGroup = stockExposureRiskLevel(stockExposure);
  if (exposureGroup === 'high') {
    return { comparisonGroup: withProductPrefix(productType, 'equity'), reason: 'pension_equity_exposure' };
  }
  if (exposureGroup === 'low') {
    return { comparisonGroup: withProductPrefix(productType, 'bonds'), reason: 'pension_bond_exposure' };
  }
  if (exposureGroup === 'medium') {
    return { comparisonGroup: withProductPrefix(productType, 'general'), reason: 'pension_general_exposure' };
  }

  return { comparisonGroup: UNCLASSIFIED_GROUP, reason: 'pension_unclassified_group' };
}

function classifyGemelComparisonGroup(record, productType) {
  const specialization = normalizeText(record?.SPECIALIZATION);
  const subSpecialization = normalizeText(record?.SUB_SPECIALIZATION);
  const trackName = normalizeText(record?.SHM_KRN);
  const combinedSpec = normalizeText(record?.SPECIALIZATION, record?.SUB_SPECIALIZATION);

  const subAgeBucket = detectAgeBucket(subSpecialization);
  const nameAgeBucket = detectAgeBucket(trackName);
  const ageBucket = subAgeBucket || nameAgeBucket;

  if (ageBucket === 'under_50') {
    return { comparisonGroup: withProductPrefix(productType, 'age_under_50'), reason: 'gemel_age_under_50' };
  }
  if (ageBucket === '50_60') {
    return { comparisonGroup: withProductPrefix(productType, 'age_50_60'), reason: 'gemel_age_50_60' };
  }
  if (ageBucket === 'over_60') {
    return { comparisonGroup: withProductPrefix(productType, 'age_over_60'), reason: 'gemel_age_over_60' };
  }

  if (detectSp500(combinedSpec) || detectSp500(trackName)) {
    return { comparisonGroup: withProductPrefix(productType, 'sp500'), reason: 'gemel_sp500' };
  }

  if (specialization === 'מניות' || (detectEquityName(subSpecialization) && !detectBondName(subSpecialization))) {
    return { comparisonGroup: withProductPrefix(productType, 'equity'), reason: 'gemel_equity_specialization' };
  }

  if (
    specialization.includes('אג"ח')
    || subSpecialization.includes('אג"ח')
    || subSpecialization.includes('אשרא')
    || specialization === 'שיקלי'
    || detectCash(combinedSpec)
  ) {
    return { comparisonGroup: withProductPrefix(productType, 'bonds'), reason: 'gemel_bonds_specialization' };
  }

  if (
    specialization.includes('מתמחים באפיקי')
    || subSpecialization.includes('משולב')
    || subSpecialization.includes('מניות סחיר')
  ) {
    const exposureGroup = stockExposureRiskLevel(record?.stockExposurePct);
    if (exposureGroup === 'high') {
      return { comparisonGroup: withProductPrefix(productType, 'equity'), reason: 'gemel_tradable_mixed_high_exposure' };
    }
    if (exposureGroup === 'low') {
      return { comparisonGroup: withProductPrefix(productType, 'bonds'), reason: 'gemel_tradable_mixed_low_exposure' };
    }
    if (exposureGroup === 'medium') {
      return { comparisonGroup: withProductPrefix(productType, 'general'), reason: 'gemel_tradable_mixed_medium_exposure' };
    }
  }

  if (specialization === 'כללי' || subSpecialization === 'כללי') {
    return { comparisonGroup: withProductPrefix(productType, 'general'), reason: 'gemel_general_specialization' };
  }

  if (specialization.includes('עוקבי מדדים') || specialization === 'מדד') {
    if (detectBondName(subSpecialization)) {
      return { comparisonGroup: withProductPrefix(productType, 'bonds'), reason: 'gemel_index_bonds' };
    }
    if (detectEquityName(subSpecialization)) {
      return { comparisonGroup: withProductPrefix(productType, 'equity'), reason: 'gemel_index_equity' };
    }
    return { comparisonGroup: withProductPrefix(productType, 'general'), reason: 'gemel_index_general' };
  }

  if (specialization === 'מדרגות') {
    return { comparisonGroup: UNCLASSIFIED_GROUP, reason: 'gemel_ladder_without_age_bucket' };
  }

  if (detectHalacha(combinedSpec)) {
    return { comparisonGroup: withProductPrefix(productType, 'halacha'), reason: 'gemel_halacha' };
  }

  const stockExposure = record?.stockExposurePct;
  const exposureGroup = stockExposureRiskLevel(stockExposure);
  if (exposureGroup === 'high') {
    return { comparisonGroup: withProductPrefix(productType, 'equity'), reason: 'gemel_equity_exposure' };
  }
  if (exposureGroup === 'low') {
    return { comparisonGroup: withProductPrefix(productType, 'bonds'), reason: 'gemel_bonds_exposure' };
  }
  if (exposureGroup === 'medium') {
    return { comparisonGroup: withProductPrefix(productType, 'general'), reason: 'gemel_general_exposure' };
  }

  if (detectBondName(trackName)) {
    return { comparisonGroup: withProductPrefix(productType, 'bonds'), reason: 'gemel_bond_track_name' };
  }
  if (detectEquityName(trackName)) {
    return { comparisonGroup: withProductPrefix(productType, 'equity'), reason: 'gemel_equity_track_name' };
  }

  return { comparisonGroup: UNCLASSIFIED_GROUP, reason: 'gemel_unclassified_group' };
}

function classifyComparisonGroup(record, { productType, domain = 'gemel' } = {}) {
  if (!productType) {
    return { comparisonGroup: UNCLASSIFIED_GROUP, reason: 'missing_product_type' };
  }

  if (domain === 'pension') {
    return classifyPensionComparisonGroup(record);
  }

  return classifyGemelComparisonGroup(record, productType);
}

module.exports = {
  UNCLASSIFIED_GROUP,
  withProductPrefix,
  classifyPensionComparisonGroup,
  classifyGemelComparisonGroup,
  classifyComparisonGroup,
};
