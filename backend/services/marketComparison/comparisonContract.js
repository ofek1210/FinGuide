'use strict';

/** Public market-comparison products exposed via API. */
const PUBLIC_COMPARISON_PRODUCTS = Object.freeze([
  'pension',
  'gemel',
  'hishtalmut',
  'investment_gemel',
]);

/** GemelNet-only internal/excluded product types (data-quality only). */
const EXCLUDED_GEMEL_PRODUCT_TYPES = Object.freeze([
  'child_savings',
  'central_severance',
  'unknown',
]);

const GEMEL_PRODUCT_TYPES = Object.freeze([
  'gemel',
  'hishtalmut',
  'investment_gemel',
  ...EXCLUDED_GEMEL_PRODUCT_TYPES,
]);

const PUBLIC_GEMEL_PRODUCT_TYPES = Object.freeze([
  'gemel',
  'hishtalmut',
  'investment_gemel',
]);

const PUBLIC_GEMEL_PRODUCT_SET = new Set(PUBLIC_GEMEL_PRODUCT_TYPES);

const FUTURE_GEMEL_PRODUCT_TYPES = Object.freeze(['child_savings']);

const RISK_LEVELS = Object.freeze(['low', 'medium', 'high', 'unclassified']);

const COMPARISON_PERIODS = Object.freeze(['12', '36', '5y', 'combined']);

const RETURN_FIELD_BY_PERIOD = Object.freeze({
  '12': 'return12Months',
  '36': 'return36MonthsAnnualized',
  '5y': 'return5YearsAnnualized',
});

const COMBINED_PERIOD_WEIGHTS = Object.freeze({
  return12Months: 0.2,
  return36MonthsAnnualized: 0.35,
  return5YearsAnnualized: 0.45,
});

const MINIMUM_PERIODS_FOR_COMBINED = 2;

const RANKING_METHOD = 'peer_group_percentile';

const RANKING_STATUS = Object.freeze({
  RANKED: 'ranked',
  INSUFFICIENT_HISTORY: 'insufficient_history',
  EXCLUDED: 'excluded',
});

const DEFAULT_LIMIT = 5;
const MAX_LIMIT = 50;

/** Future fee/performance composite slots — not used in Step 3 ranking. */
const FUTURE_SCORE_FIELDS = Object.freeze([
  'performanceScore',
  'feeScore',
  'riskAdjustedScore',
  'marketScore',
]);

module.exports = {
  PUBLIC_COMPARISON_PRODUCTS,
  EXCLUDED_GEMEL_PRODUCT_TYPES,
  GEMEL_PRODUCT_TYPES,
  PUBLIC_GEMEL_PRODUCT_TYPES,
  PUBLIC_GEMEL_PRODUCT_SET,
  FUTURE_GEMEL_PRODUCT_TYPES,
  RISK_LEVELS,
  COMPARISON_PERIODS,
  RETURN_FIELD_BY_PERIOD,
  COMBINED_PERIOD_WEIGHTS,
  MINIMUM_PERIODS_FOR_COMBINED,
  RANKING_METHOD,
  RANKING_STATUS,
  DEFAULT_LIMIT,
  MAX_LIMIT,
  FUTURE_SCORE_FIELDS,
};
