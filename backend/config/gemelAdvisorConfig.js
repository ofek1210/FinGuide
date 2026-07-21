'use strict';

/** Minimum match confidence (0–100) to use for peer comparison and alternatives. */
const MIN_MATCH_CONFIDENCE = 70;

/** Fuzzy match below this is rejected for recommendations. */
const MIN_FUZZY_CONFIDENCE = 55;

/** Maximum alternatives per account. */
const MAX_ALTERNATIVES = 3;

/** Alternative ranking weights (must sum to 1). */
const ALTERNATIVE_WEIGHTS = {
  suitability: 0.25,
  feeCompetitiveness: 0.20,
  performance5Y: 0.20,
  performance3Y: 0.15,
  consistency: 0.10,
  dataQuality: 0.10,
};

/** Fee classification thresholds vs peer median (percentage points). */
const FEE_CLASSIFICATION = {
  significantlyBelow: -0.15,
  below: -0.05,
  near: 0.05,
  above: 0.15,
};

/** Provider priority when official sources conflict (newer period wins first). */
const OFFICIAL_PROVIDER_PRIORITY = ['gemelnet', 'data.gov.il'];

module.exports = {
  MIN_MATCH_CONFIDENCE,
  MIN_FUZZY_CONFIDENCE,
  MAX_ALTERNATIVES,
  ALTERNATIVE_WEIGHTS,
  FEE_CLASSIFICATION,
  OFFICIAL_PROVIDER_PRIORITY,
  ALGORITHM_VERSION: '1.0.0',
};
