/**
 * Pension Agent Tools
 * Flow: Agent → Tool → Service → DTO
 */

'use strict';

const UserProfile = require('../../models/UserProfile');
const Document = require('../../models/Document');
const { projectPensionIncome, calculateMgmtFeeSavings } = require('../engines/calculationEngine');
const { runPensionContributionRules } = require('../engines/ruleEngine');

// ── Tool: getPensionSummary ───────────────────────────────────────────────────

/**
 * Build pension summary from UserProfile + payslips.
 * @param {string} userId
 * @returns {Promise<PensionSummaryDTO>}
 */
async function getPensionSummary(userId) {
  if (!userId) throw new Error('userId is required');

  const [profile, latestPayslip] = await Promise.all([
    UserProfile.findOne({ user: userId }).lean(),
    Document.findOne({
      user: userId,
      status: 'completed',
      $or: [
        { 'metadata.category': 'payslip' },
        { 'analysisData.summary.pensionEmployee': { $exists: true, $ne: null } },
      ],
    })
      .sort({ uploadedAt: -1 })
      .lean(),
  ]);

  const s = latestPayslip?.analysisData?.summary || {};
  const ret = profile?.retirement || {};
  const personal = profile?.personal || {};

  const grossSalary = s.grossSalary ?? null;
  const pensionEmployee = s.pensionEmployee ?? null;
  const pensionEmployer = s.pensionEmployer ?? null;
  const totalMonthlyContribution = (pensionEmployee || 0) + (pensionEmployer || 0);

  return {
    hasData: Boolean(grossSalary),
    grossSalary,
    pensionEmployee,
    pensionEmployer,
    pensionSeverance: s.pensionSeverance ?? null,
    totalMonthlyContribution,
    // Profile-based
    currentAge: personal.age ?? null,
    retirementAge: ret.plannedRetirementAge ?? 67,
    currentAccumulation: ret.currentPensionAccumulation ?? 0,
    currentFundName: ret.pensionFundName ?? null,
    currentMgmtFee: ret.pensionMgmtFee ?? null,
  };
}

// ── Tool: projectRetirementIncome ─────────────────────────────────────────────

/**
 * Run retirement income projection.
 * @param {PensionSummaryDTO} pensionSummary
 * @returns {PensionProjectionDTO}
 */
function projectRetirementIncome(pensionSummary) {
  if (!pensionSummary.currentAge) {
    return { available: false, reason: 'גיל לא מוגדר בפרופיל' };
  }

  const projection = projectPensionIncome({
    currentAge: pensionSummary.currentAge,
    retirementAge: pensionSummary.retirementAge,
    currentAccumulation: pensionSummary.currentAccumulation,
    monthlyContribution: pensionSummary.totalMonthlyContribution,
    mgmtFeeAccumulation: pensionSummary.currentMgmtFee || 0.003,
  });

  const contributionRules = runPensionContributionRules(
    pensionSummary.grossSalary,
    pensionSummary.pensionEmployee,
  );

  // Management fee savings scenario
  let mgmtFeeSavings = null;
  if (pensionSummary.currentMgmtFee && pensionSummary.currentMgmtFee > 0.002) {
    const yearsRemaining = (pensionSummary.retirementAge - pensionSummary.currentAge);
    if (yearsRemaining > 0) {
      mgmtFeeSavings = calculateMgmtFeeSavings(
        pensionSummary.currentAccumulation,
        pensionSummary.totalMonthlyContribution,
        yearsRemaining,
        pensionSummary.currentMgmtFee,
        0.002,
      );
    }
  }

  return {
    available: true,
    monthsToRetirement: projection.monthsToRetirement,
    projectedAccumulation: projection.projectedAccumulation,
    monthlyPensionEstimate: projection.monthlyPensionEstimate,
    scenarios: projection.scenarios,
    contributionRules,
    mgmtFeeSavings,
    replacementRatio: pensionSummary.grossSalary
      ? Math.round((projection.monthlyPensionEstimate / pensionSummary.grossSalary) * 100)
      : null,
  };
}

// ── Tool: generatePensionRecommendations ──────────────────────────────────────

/**
 * @param {PensionSummaryDTO} summary
 * @param {PensionProjectionDTO} projection
 * @returns {Array<RecommendationDTO>}
 */
function generatePensionRecommendations(summary, projection) {
  const recs = [];

  if (projection.contributionRules?.belowMinimum) {
    recs.push({
      type: 'pension_below_minimum',
      title: 'הפרשת פנסיה מתחת למינימום',
      reason: `שיעור ההפרשה ${projection.contributionRules.rate}% — נמוך מ-6% הנדרש.`,
      urgency: 'high',
      financialImpact: 'השפעה ישירה על קצבת הפרישה',
      confidenceScore: 98,
    });
  }

  if (projection.mgmtFeeSavings?.additionalMonthlyPension > 100) {
    recs.push({
      type: 'high_mgmt_fee',
      title: 'דמי ניהול גבוהים',
      reason: `החלפת קרן עשויה להוסיף ₪${projection.mgmtFeeSavings.additionalMonthlyPension}/חודש לקצבה.`,
      urgency: 'medium',
      financialImpact: `₪${projection.mgmtFeeSavings.additionalMonthlyPension}/חודש נוסף בפרישה`,
      confidenceScore: 82,
    });
  }

  if (projection.replacementRatio !== null && projection.replacementRatio < 60) {
    recs.push({
      type: 'low_replacement_ratio',
      title: 'יחס תחלופת שכר נמוך',
      reason: `הקצבה הצפויה היא ${projection.replacementRatio}% מהשכר הנוכחי — מתחת ל-70% המומלץ.`,
      urgency: 'medium',
      financialImpact: `הגדלת ההפרשה ב-1% משפרת את הקצבה בכ-₪${Math.round((summary.grossSalary || 0) * 0.01 * 1.5)}/חודש`,
      confidenceScore: 78,
    });
  }

  return recs;
}

module.exports = {
  getPensionSummary,
  projectRetirementIncome,
  generatePensionRecommendations,
};
