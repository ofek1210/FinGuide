'use strict';

const FUND_TYPE_LABELS = {
  pension_comprehensive: 'קרנות פנסיה מקיפות',
  pension_old: 'קרנות פנסיה ותיקות',
  managers_insurance: 'ביטוח מנהלים',
  provident_fund: 'קופות גמל',
  study_fund: 'קרנות השתלמות',
  other: 'מסלולי פנסיה',
};

const RISK_LABELS = {
  low: 'סיכון נמוך',
  medium: 'סיכון בינוני',
  high: 'סיכון גבוה',
};

/**
 * User-facing label for internal comparison group key.
 * @param {string|null|undefined} groupKey — e.g. "pension_comprehensive:medium:קרנות חדשות"
 * @param {string|null} [classification]
 */
function formatComparisonGroupLabel(groupKey, classification) {
  if (!groupKey) {
    return classification ? `מסלולים דומים (${classification})` : 'מסלולים דומים באותה קבוצה';
  }

  const parts = String(groupKey).split(':');
  const fundType = parts[0] || 'other';
  const risk = parts[1];
  const classPart = classification || parts[2];

  const typeLabel = FUND_TYPE_LABELS[fundType] || 'מסלולי פנסיה';
  const riskLabel = RISK_LABELS[risk];

  if (classPart && /חדשות|כלליות|ותיק/i.test(classPart)) {
    return `${typeLabel} (${classPart}) במסלולים דומים`;
  }
  if (riskLabel) {
    return `${typeLabel} — ${riskLabel} — במסלולים דומים`;
  }
  return `${typeLabel} במסלולים דומים`;
}

module.exports = { formatComparisonGroupLabel, FUND_TYPE_LABELS };
