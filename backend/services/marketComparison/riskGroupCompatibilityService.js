'use strict';

const { withProductPrefix, UNCLASSIFIED_GROUP } = require('./comparisonGroupService');
const { stockExposureRiskLevel, ageBucketRiskLevel } = require('./trackPatternUtils');

/**
 * Expected risk for fixed track-type comparison groups.
 * Age-based and Halacha groups use official exposure instead of a fixed risk.
 */
const GROUP_SUFFIX_EXPECTED_RISK = Object.freeze({
  bonds: 'low',
  general: 'medium',
  equity: 'high',
  sp500: 'high',
});

const AGE_GROUP_SUFFIXES = Object.freeze([
  'age_under_50',
  'age_50_60',
  'age_over_60',
]);

const EXPOSURE_DRIVEN_SUFFIXES = new Set([...AGE_GROUP_SUFFIXES, 'halacha']);

function extractGroupSuffix(comparisonGroup) {
  if (!comparisonGroup || comparisonGroup === UNCLASSIFIED_GROUP) return null;

  const orderedSuffixes = [
    'age_under_50',
    'age_50_60',
    'age_over_60',
    'sp500',
    'equity',
    'bonds',
    'general',
    'halacha',
  ];

  for (const suffix of orderedSuffixes) {
    if (comparisonGroup === suffix || comparisonGroup.endsWith(`_${suffix}`)) {
      return suffix;
    }
  }

  return null;
}

function riskToGroupSuffix(riskLevel) {
  if (riskLevel === 'high') return 'equity';
  if (riskLevel === 'low') return 'bonds';
  if (riskLevel === 'medium') return 'general';
  return null;
}

function ageSuffixDefaultRisk(suffix) {
  if (suffix === 'age_under_50') return 'high';
  if (suffix === 'age_50_60') return 'medium';
  if (suffix === 'age_over_60') return 'low';
  return null;
}

/**
 * Validate and reconcile riskLevel vs comparisonGroup.
 * Exposure is authoritative for risk; fixed groups must align or be corrected/unclassified.
 */
function validateRiskGroupCompatibility(record) {
  const productType = record.productType || 'pension';
  let { riskLevel, comparisonGroup } = record;
  const suffix = extractGroupSuffix(comparisonGroup);
  const exposureRisk = stockExposureRiskLevel(record.stockExposurePct);

  if (!suffix || comparisonGroup === UNCLASSIFIED_GROUP) {
    return {
      compatible: true,
      riskLevel,
      comparisonGroup,
      action: 'unchanged',
      reason: 'no_fixed_group_norm',
    };
  }

  if (EXPOSURE_DRIVEN_SUFFIXES.has(suffix)) {
    if (exposureRisk) {
      if (riskLevel !== exposureRisk) {
        return {
          compatible: false,
          riskLevel: exposureRisk,
          comparisonGroup,
          action: 'risk_corrected_from_exposure',
          reason: `${suffix}_risk_from_exposure`,
        };
      }
      return {
        compatible: true,
        riskLevel,
        comparisonGroup,
        action: 'unchanged',
        reason: `${suffix}_exposure_matches_risk`,
      };
    }

    const ageDefault = ageSuffixDefaultRisk(suffix);
    if (ageDefault && riskLevel !== ageDefault) {
      return {
        compatible: false,
        riskLevel: ageDefault,
        comparisonGroup,
        action: 'risk_corrected_age_default',
        reason: `${suffix}_default_without_exposure`,
      };
    }

    return {
      compatible: true,
      riskLevel,
      comparisonGroup,
      action: 'unchanged',
      reason: `${suffix}_exposure_driven_or_default`,
    };
  }

  const expectedRisk = GROUP_SUFFIX_EXPECTED_RISK[suffix];
  if (!expectedRisk) {
    return {
      compatible: true,
      riskLevel,
      comparisonGroup,
      action: 'unchanged',
      reason: 'unknown_suffix',
    };
  }

  if (riskLevel === expectedRisk) {
    return {
      compatible: true,
      riskLevel,
      comparisonGroup,
      action: 'unchanged',
      reason: 'group_risk_aligned',
    };
  }

  if (exposureRisk) {
    const exposureGroupSuffix = riskToGroupSuffix(exposureRisk);
    if (exposureGroupSuffix && exposureGroupSuffix !== suffix) {
      return {
        compatible: false,
        riskLevel: exposureRisk,
        comparisonGroup: withProductPrefix(productType, exposureGroupSuffix),
        action: 'group_corrected_to_match_exposure',
        reason: `exposure_${exposureRisk}_conflicts_with_${suffix}`,
      };
    }

    if (exposureRisk === expectedRisk) {
      return {
        compatible: false,
        riskLevel: expectedRisk,
        comparisonGroup,
        action: 'risk_corrected_to_group_norm',
        reason: `risk_aligned_to_${suffix}`,
      };
    }
  }

  return {
    compatible: false,
    riskLevel: 'unclassified',
    comparisonGroup: UNCLASSIFIED_GROUP,
    action: 'unclassified',
    reason: `risk_${riskLevel}_conflicts_with_${suffix}`,
  };
}

function findRiskGroupContradictions(records) {
  const contradictions = [];

  for (const record of records) {
    const suffix = extractGroupSuffix(record.comparisonGroup);
    const expected = suffix ? GROUP_SUFFIX_EXPECTED_RISK[suffix] : null;
    const validation = validateRiskGroupCompatibility(record);

    if (!validation.compatible || validation.action !== 'unchanged') {
      contradictions.push({
        fundId: record.fundId,
        fundName: record.fundName,
        productType: record.productType,
        beforeRisk: record.riskLevel,
        beforeGroup: record.comparisonGroup,
        afterRisk: validation.riskLevel,
        afterGroup: validation.comparisonGroup,
        action: validation.action,
        reason: validation.reason,
        stockExposurePct: record.stockExposurePct ?? null,
        expectedRiskForGroup: expected,
      });
    } else if (expected && record.riskLevel !== expected) {
      contradictions.push({
        fundId: record.fundId,
        fundName: record.fundName,
        productType: record.productType,
        beforeRisk: record.riskLevel,
        beforeGroup: record.comparisonGroup,
        afterRisk: record.riskLevel,
        afterGroup: record.comparisonGroup,
        action: 'unchanged',
        reason: 'residual_mismatch',
        stockExposurePct: record.stockExposurePct ?? null,
        expectedRiskForGroup: expected,
      });
    }
  }

  return contradictions;
}

function applyRiskGroupCompatibility(record) {
  const validation = validateRiskGroupCompatibility(record);
  return {
    ...record,
    riskLevel: validation.riskLevel,
    comparisonGroup: validation.comparisonGroup,
    riskGroupCompatible: validation.compatible || validation.action !== 'unclassified',
    riskGroupValidation: validation.reason,
    riskGroupAction: validation.action,
  };
}

module.exports = {
  GROUP_SUFFIX_EXPECTED_RISK,
  AGE_GROUP_SUFFIXES,
  EXPOSURE_DRIVEN_SUFFIXES,
  extractGroupSuffix,
  validateRiskGroupCompatibility,
  findRiskGroupContradictions,
  applyRiskGroupCompatibility,
};
