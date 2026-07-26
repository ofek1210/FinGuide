/**
 * Insurance health score — temporarily disabled until evidence-backed dimensions exist.
 */

function runInsuranceHealthCheck(profileDTO, analysis) {
  const policyCount = profileDTO.policies?.length ?? analysis.aggregatedPolicies?.length ?? 0;
  const overlapReviews = analysis.duplicateCount ?? 0;
  const needsVehicleInfo = analysis.vehicleVerificationNeeded;

  return {
    score: null,
    scoreDisabled: true,
    level: {
      level: 'pending',
      label: 'נדרשת השלמת מידע',
    },
    headlineHe: 'מצב התיק הביטוחי',
    messageHe: 'נדרשת השלמת מידע כדי לבדוק כפילויות, מחירים ופערי כיסוי.',
    categories: [],
    meta: {
      policyCount,
      overlapReviewCount: overlapReviews,
      needsVehicleInfo,
      premiumUnderReviewMonthly: analysis.premiumUnderReviewMonthly ?? null,
    },
    disclaimer: 'ציון מספרי מושבת זמנית — לא יוצג ציון שלילי על בסיס מידע חסר או חפיפות לא מאומתות.',
  };
}

module.exports = { runInsuranceHealthCheck };
