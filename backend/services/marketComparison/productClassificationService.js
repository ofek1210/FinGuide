'use strict';

const { PUBLIC_GEMEL_PRODUCT_SET } = require('./comparisonContract');

/**
 * Exact-match SUG_KRN → normalized product type.
 * Do not infer product type from fund name when SUG_KRN is missing or unrecognized.
 */
const EXACT_SUG_KRN_TO_PRODUCT = Object.freeze({
  'תגמולים ואישית לפיצויים': 'gemel',
  'קרנות השתלמות': 'hishtalmut',
  'קופת גמל להשקעה': 'investment_gemel',
  'קופת גמל להשקעה - חסכון לילד': 'child_savings',
  'מרכזית לפיצויים': 'central_severance',
  'מטרה אחרת': 'unknown',
});

const EMPTY_SUG_REASON = 'empty_sug_krn';
const EXACT_MATCH_REASON = 'exact_sug_krn';
const OTHER_PURPOSE_REASON = 'other_purpose';
const UNRECOGNIZED_SUG_REASON = 'unrecognized_sug_krn';

function normalizeSugKrn(value) {
  if (value == null) return '';
  return String(value).trim();
}

/**
 * @param {{ SUG_KRN?: string | null }} record
 * @returns {{
 *   productType: string,
 *   isPublicLeaderboard: boolean,
 *   classificationReason: string,
 *   rawSugKrn: string,
 * }}
 */
function classifyGemelNetProduct(record) {
  const rawSugKrn = normalizeSugKrn(record?.SUG_KRN);

  if (!rawSugKrn) {
    return {
      productType: 'unknown',
      isPublicLeaderboard: false,
      classificationReason: EMPTY_SUG_REASON,
      rawSugKrn,
    };
  }

  const mapped = EXACT_SUG_KRN_TO_PRODUCT[rawSugKrn];
  if (mapped) {
    return {
      productType: mapped,
      isPublicLeaderboard: PUBLIC_GEMEL_PRODUCT_SET.has(mapped),
      classificationReason: mapped === 'unknown' ? OTHER_PURPOSE_REASON : EXACT_MATCH_REASON,
      rawSugKrn,
    };
  }

  return {
    productType: 'unknown',
    isPublicLeaderboard: false,
    classificationReason: UNRECOGNIZED_SUG_REASON,
    rawSugKrn,
  };
}

function isPublicGemelProduct(productType) {
  return PUBLIC_GEMEL_PRODUCT_SET.has(productType);
}

module.exports = {
  EXACT_SUG_KRN_TO_PRODUCT,
  EMPTY_SUG_REASON,
  EXACT_MATCH_REASON,
  OTHER_PURPOSE_REASON,
  UNRECOGNIZED_SUG_REASON,
  normalizeSugKrn,
  classifyGemelNetProduct,
  isPublicGemelProduct,
};
