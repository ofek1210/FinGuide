'use strict';

/** Hebrew labels for comparison group suffixes (mirrors frontend marketComparisonLabels). */
const SUFFIX_LABELS = {
  equity: 'מניות',
  general: 'כללי',
  bonds: 'אג"ח ואשראי',
  sp500: 'עוקב S&P 500',
  age_under_50: 'מסלול לבני 50 ומטה',
  age_50_60: 'מסלול לבני 50–60',
  age_over_60: 'מסלול לבני 60 ומעלה',
  halacha: 'מסלול הלכתי',
};

const ORDERED_SUFFIXES = [
  'age_under_50',
  'age_50_60',
  'age_over_60',
  'sp500',
  'equity',
  'bonds',
  'general',
  'halacha',
];

function extractSuffix(comparisonGroup) {
  if (!comparisonGroup || comparisonGroup === 'unclassified') return comparisonGroup;
  for (const suffix of ORDERED_SUFFIXES) {
    if (comparisonGroup === suffix || comparisonGroup.endsWith(`_${suffix}`)) return suffix;
  }
  return comparisonGroup.split('_').slice(-1)[0] ?? comparisonGroup;
}

function labelComparisonGroupHe(comparisonGroup) {
  const suffix = extractSuffix(comparisonGroup);
  return SUFFIX_LABELS[suffix] ?? suffix.replace(/_/g, ' ');
}

module.exports = {
  labelComparisonGroupHe,
  extractSuffix,
};
