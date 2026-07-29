'use strict';

const { labelCoverageFamily } = require('./insuranceCoverageTaxonomy');
const { COVERAGE_WHY_HE } = require('./insuranceCoverageGapService');

const CONFIDENCE_HE = {
  high: 'גבוהה',
  medium: 'בינונית',
  low: 'נמוכה',
  insufficient: 'לא מספיק נתונים',
};

const TYPE_LABELS = {
  life: 'ביטוח חיים',
  apartment: 'ביטוח דירה',
  car: 'ביטוח רכב',
  health_supplement: 'ביטוח בריאות משלים',
  disability: 'אובדן כושר עבודה',
  travel: 'ביטוח נסיעות',
};

/**
 * Build primary insurance recommendations — portfolio health only.
 * No premium_review / market-average price switching.
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
      whyItMatters: COVERAGE_WHY_HE.car,
    });
  }

  for (const finding of overlapFindings) {
    if (finding.coverageFamily === 'vehicle_packages') continue;
    if (recs.length >= 5) break;

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

  // Service quality — objective SWITCH signal (not price)
  const poorService = (marketAdvice.comparisonMatrix || []).filter(
    row => row.serviceTier === 'poor' || (row.serviceScore != null && row.serviceScore < 70),
  );
  if (poorService.length > 0 && recs.length < 5) {
    const row = poorService[0];
    recs.push({
      type: 'service_quality_review',
      category: 'service',
      title: `מדד שירות נמוך — ${row.provider || row.type}`,
      reason: `מדד השירות של ${row.provider || 'החברה'} הוא ${row.serviceScore}/100`
        + (row.claimPaymentRate != null ? ` (תשלום תביעות ~${row.claimPaymentRate}%)` : '')
        + '. זו אינדיקציה אובייקטיבית לבחינת חברה חלופית — לא על בסיס מחיר.',
      urgency: 'medium',
      financialImpact: null,
      confidenceScore: 0.75,
      confidenceLabelHe: CONFIDENCE_HE.medium,
      nextActionHe: 'השוו מדד שירות ואחוז תשלום תביעות מול חברות אחרות עם סוכן מורשה.',
      missingInputs: [],
    });
  }

  const disabilityGap = (analysis.gapFindings || []).find(g => g.type === 'disability');
  if (disabilityGap && recs.length < 5) {
    recs.push({
      type: 'coverage_gap_review',
      category: 'gap',
      title: 'בדיקת כיסוי אובדן כושר עבודה',
      reason: disabilityGap.messageHe,
      whyItMatters: disabilityGap.whyItMatters || COVERAGE_WHY_HE.disability,
      urgency: 'medium',
      financialImpact: null,
      confidenceScore: 0.45,
      confidenceLabelHe: CONFIDENCE_HE.insufficient,
      nextActionHe: 'בדוק בקרן הפנסיה, בביטוח מנהלים ובהסדר המעסיק לפני רכישת פוליסה חדשה.',
      missingInputs: disabilityGap.missingInputs || [],
    });
  }

  for (const gap of (analysis.gapFindings || []).filter(g => g.type !== 'disability')) {
    if (recs.length >= 5) break;
    if (gap.status !== 'missing_needed' && gap.status !== 'missing_optional') continue;
    recs.push({
      type: `missing_${gap.type}`,
      category: 'gap',
      title: `כיסוי חסר — ${TYPE_LABELS[gap.type] || gap.type}`,
      reason: gap.messageHe,
      whyItMatters: gap.whyItMatters || COVERAGE_WHY_HE[gap.type] || null,
      urgency: gap.status === 'missing_needed' ? 'medium' : 'low',
      financialImpact: null,
      confidenceScore: gap.confidence === 'high' ? 0.8 : 0.55,
      confidenceLabelHe: CONFIDENCE_HE[gap.confidence] || CONFIDENCE_HE.medium,
      nextActionHe: 'אמת מול המעסיק, קופת החולים או סוכן מורשה — רק אם הפרופיל מצביע על צורך.',
      missingInputs: gap.missingInputs || [],
    });
  }

  // Explicit "not needed" insights (profile-aware, not generic push)
  for (const assessment of (analysis.needAssessments || []).filter(a => a.status === 'not_recommended')) {
    if (recs.length >= 6) break;
    recs.push({
      type: `need_assessment_${assessment.type}`,
      category: 'need_assessment',
      title: assessment.titleHe,
      reason: assessment.messageHe,
      whyItMatters: assessment.whyItMatters || null,
      urgency: 'low',
      financialImpact: null,
      confidenceScore: 0.7,
      confidenceLabelHe: CONFIDENCE_HE.medium,
      nextActionHe: 'אין פעולת רכישה מומלצת כרגע — עדכנו את הפרופיל אם המצב השתנה.',
      missingInputs: [],
    });
  }

  // Incomplete coverage summaries
  const incomplete = (marketAdvice.coverageSummaries || []).filter(c => c.manualReviewRecommended);
  if (incomplete.length > 0 && recs.length < 6) {
    recs.push({
      type: 'coverage_details_review',
      category: 'data_quality',
      title: 'פרטי כיסוי חלקיים',
      reason: `${incomplete.length} פוליסות חסרות מידע (סכום כיסוי / חברה / תוקף) — מומלץ אימות ידני.`,
      urgency: 'low',
      financialImpact: null,
      confidenceScore: 0.6,
      confidenceLabelHe: CONFIDENCE_HE.medium,
      nextActionHe: 'פנו למבטח או לסוכן להשלמת פרטי הכיסוי.',
      missingInputs: ['coverageAmount', 'policyDates'],
    });
  }

  return recs.slice(0, 6);
}

module.exports = {
  buildPrimaryInsuranceRecommendations,
  CONFIDENCE_HE,
};
