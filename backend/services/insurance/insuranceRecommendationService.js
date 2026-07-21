'use strict';

const { labelCoverageFamily } = require('./insuranceCoverageTaxonomy');

const CONFIDENCE_HE = {
  high: 'גבוהה',
  medium: 'בינונית',
  low: 'נמוכה',
  insufficient: 'לא מספיק נתונים',
};

/**
 * Build up to 3 primary insurance recommendations (overlap, premium, gap).
 */
function buildPrimaryInsuranceRecommendations(analysis, marketAdvice = {}) {
  const recs = [];

  const vehiclePackages = analysis.vehiclePackages || [];
  const overlapFindings = (analysis.duplicateFindings || analysis.duplicates || [])
    .filter(d => d.status === 'possible_overlap' || d.status === 'likely_duplicate' || d.status === 'insufficient_data');

  if (analysis.vehicleVerificationNeeded || vehiclePackages.length > 1) {
    const pkgCount = vehiclePackages.length;
    const vehicleFinding = (analysis.duplicateFindings || analysis.duplicates || [])
      .find(d => (d.coverageFamily || d.type) === 'vehicle_packages');
    const vehiclePremiumReview = vehicleFinding?.premiumUnderReviewMonthly ?? null;
    recs.push({
      type: 'coverage_overlap_review',
      category: 'overlap',
      title: 'בדיקת פוליסות הרכב',
      reason: analysis.vehicleVerificationNeeded
        ? `נמצאו כ-${pkgCount} חבילות ביטוח רכב אפשריות. לא ניתן לקבוע כרגע אם קיימת כפילות, משום שחסר מספר הרכבים הרשומים על שמך.`
        : `נמצאו ${pkgCount} חבילות ביטוח רכב אפשריות — יש לוודא שכל חבילה משויכת לרכב נפרד.`,
      urgency: 'medium',
      financialImpact: vehiclePremiumReview
        ? `פרמיה חודשית לבדיקה: ₪${Math.round(vehiclePremiumReview).toLocaleString('he-IL')}`
        : null,
      confidenceScore: analysis.vehicleVerificationNeeded ? 0.35 : 0.5,
      confidenceLabelHe: analysis.vehicleVerificationNeeded ? CONFIDENCE_HE.low : CONFIDENCE_HE.medium,
      nextActionHe: 'השלם את מספר הרכבים ושייך כל פוליסה לרכב המתאים.',
      missingInputs: analysis.vehicleVerificationNeeded ? ['vehiclesOwned'] : ['vehiclePolicyAssignment'],
    });
  }

  for (const finding of overlapFindings) {
    if (finding.coverageFamily === 'vehicle_packages') continue;
    if (recs.length >= 3) break;

    recs.push({
      type: 'coverage_overlap_review',
      category: 'overlap',
      title: `בדיקת חפיפה — ${finding.typeLabelHe || labelCoverageFamily(finding.coverageFamily || finding.type)}`,
      reason: finding.reasonHe || 'נמצאו מספר כיסויים הדורשים בדיקה.',
      urgency: finding.status === 'likely_duplicate' ? 'high' : 'medium',
      financialImpact: finding.premiumUnderReviewMonthly
        ? `פרמיה חודשית לבדיקה: ₪${Math.round(finding.premiumUnderReviewMonthly).toLocaleString('he-IL')}`
        : null,
      confidenceScore: finding.confidence === 'high' ? 0.85 : finding.confidence === 'medium' ? 0.6 : 0.4,
      confidenceLabelHe: CONFIDENCE_HE[finding.confidence] || CONFIDENCE_HE.low,
      nextActionHe: (finding.missingInputs || []).includes('benefitAmounts')
        ? 'השווה סכומי כיסוי ותנאים לפני קביעת כפילות.'
        : 'בדוק את מטרת כל פוליסה ואת סכומי הכיסוי.',
      missingInputs: finding.missingInputs || [],
    });
  }

  const comparablePremiums = (marketAdvice.comparisonMatrix || []).filter(
    row => row.comparisonQuality === 'comparable' && (row.premiumVsMarket === 'above_market' || row.premiumVsMarket === 'high'),
  );
  if (comparablePremiums.length > 0 && recs.length < 3) {
    const row = comparablePremiums[0];
    recs.push({
      type: 'premium_review',
      category: 'premium',
      title: `בדיקת פרמיה — ${row.type}`,
      reason: `הפרמיה שלך (₪${row.userCost}) גבוהה מהממוצע בהשוואה מותאמת (${row.type}).`,
      urgency: 'medium',
      financialImpact: null,
      confidenceScore: 0.7,
      confidenceLabelHe: CONFIDENCE_HE.medium,
      nextActionHe: 'השווה הצעות עם גורם מורשה — לאחר אימות גורמי הסיכון.',
      missingInputs: [],
    });
  }

  const disabilityGap = (analysis.gapFindings || []).find(g => g.type === 'disability');
  if (disabilityGap && recs.length < 3) {
    recs.push({
      type: 'coverage_gap_review',
      category: 'gap',
      title: 'בדיקת כיסוי אובדן כושר עבודה',
      reason: disabilityGap.messageHe,
      urgency: 'medium',
      financialImpact: null,
      confidenceScore: 0.45,
      confidenceLabelHe: CONFIDENCE_HE.insufficient,
      nextActionHe: 'בדוק בקרן הפנסיה, בביטוח מנהלים ובהסדר המעסיק לפני רכישת פוליסה חדשה.',
      missingInputs: disabilityGap.missingInputs || [],
    });
  }

  for (const missing of analysis.missingCoverage || []) {
    if (recs.length >= 3) break;
    if (missing === 'disability') continue;
    recs.push({
      type: `missing_${missing}`,
      category: 'gap',
      title: `כיסוי לבדיקה — ${missing}`,
      reason: 'לפי הפרופיל — מומלץ לבדוק אם הכיסוי קיים במקור אחר.',
      urgency: analysis.missingUrgency || 'low',
      financialImpact: null,
      confidenceScore: 0.5,
      confidenceLabelHe: CONFIDENCE_HE.low,
      nextActionHe: 'אמת מול המעסיק, קופת החולים או סוכן מורשה.',
      missingInputs: [],
    });
  }

  return recs.slice(0, 3);
}

module.exports = {
  buildPrimaryInsuranceRecommendations,
  CONFIDENCE_HE,
};
