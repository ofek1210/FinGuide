/**
 * Pension Agent Tools
 * Flow: Agent → Tool → Service → DTO
 */

'use strict';

const UserProfile = require('../../models/UserProfile');
const Document = require('../../models/Document');
const PensionFund = require('../../models/PensionFund');
const { projectPensionIncome, calculateMgmtFeeSavings } = require('../engines/calculationEngine');
const { runPensionContributionRules } = require('../engines/ruleEngine');
const {
  DEFAULT_MARKET_MGMT_FEE,
  LEGAL_RETIREMENT_AGE,
  FEE_STATUS_LABELS,
  normalizeFundRiskLevel,
  riskLevelShortLabel,
  weightedAvgMgmtFee,
} = require('../../utils/pensionShared');

function parseImpactAmount(financialImpact) {
  if (financialImpact == null) return 0;
  const nums = String(financialImpact).match(/[\d,]+/g);
  if (!nums?.length) return 0;
  const n = parseInt(nums.join('').replace(/,/g, ''), 10);
  return Number.isFinite(n) ? n : 0;
}

function withImpact(rec) {
  return {
    ...rec,
    impactAmount: rec.impactAmount ?? parseImpactAmount(rec.financialImpact),
  };
}

// ── Tool: getPensionSummary ───────────────────────────────────────────────────

/**
 * Build pension summary from PensionFund imports, UserProfile + payslips.
 * @param {string} userId
 * @returns {Promise<PensionSummaryDTO>}
 */
async function getPensionSummary(userId) {
  if (!userId) throw new Error('userId is required');

  const [profile, latestPayslip, funds] = await Promise.all([
    UserProfile.findOne({ user: userId }).lean(),
    Document.findOne({
      user: userId,
      status: 'completed',
      $or: [
        { 'metadata.category': 'payslip' },
        { 'analysisData.summary.grossSalary': { $exists: true, $ne: null } },
      ],
    })
      .sort({ uploadedAt: -1 })
      .lean(),
    PensionFund.find({
      user: userId,
      status: { $ne: 'closed' },
      isActive: { $ne: false },
    }).lean(),
  ]);

  const s = latestPayslip?.analysisData?.summary || {};
  const ret = profile?.retirement || {};
  const personal = profile?.personal || {};

  const grossSalary = s.grossSalary ?? null;
  const pensionEmployee = s.pensionEmployee ?? null;
  const pensionEmployer = s.pensionEmployer ?? null;
  const payslipContribution = (pensionEmployee || 0) + (pensionEmployer || 0);

  const expectedMinEmployee = grossSalary ? Math.round(grossSalary * 0.06) : null;
  const expectedMinEmployer = grossSalary ? Math.round(grossSalary * 0.065) : null;
  const expectedSeverance = grossSalary ? Math.round(grossSalary * 0.06) : null;
  const hasMissingPension = grossSalary && !pensionEmployee && !pensionEmployer;

  const activeFunds = funds.filter(f => f.status !== 'closed');
  const hasImportedFunds = activeFunds.length > 0;

  if (hasImportedFunds) {
    const currentAccumulation = activeFunds.reduce((sum, f) => sum + (f.currentBalance || 0), 0);
    const fundContribution = activeFunds.reduce(
      (sum, f) => sum + (f.monthlyEmployeeDeposit || 0) + (f.monthlyEmployerDeposit || 0),
      0,
    );
    const totalMonthlyContribution = fundContribution || payslipContribution
      || ((expectedMinEmployee || 0) + (expectedMinEmployer || 0));
    const currentMgmtFee = weightedAvgMgmtFee(activeFunds) ?? ret.pensionMgmtFee ?? null;
    const hasStudyFund = activeFunds.some(f => f.fundType === 'study_fund');
    const hasHarKesefSource = activeFunds.some(f => f.source === 'har_hakesef');
    const hasQuarterlySource = activeFunds.some(f => f.source === 'quarterly_report');
    const parseWarnings = [];

    if (payslipContribution > 0 && fundContribution > 0) {
      const diff = Math.abs(fundContribution - payslipContribution);
      const tolerance = Math.max(200, payslipContribution * 0.15);
      if (diff > tolerance) {
        parseWarnings.push(
          `פער הפקדות: דוח ₪${fundContribution.toLocaleString('he-IL')}/חודש vs תלוש ₪${payslipContribution.toLocaleString('he-IL')}/חודש`,
        );
      }
    }

    return {
      hasData: true,
      dataSource: hasHarKesefSource ? 'har_hakesef' : hasQuarterlySource ? 'quarterly_report' : 'manual',
      grossSalary,
      pensionEmployee,
      pensionEmployer,
      pensionSeverance: s.pensionSeverance ?? null,
      totalMonthlyContribution,
      expectedMinEmployee,
      expectedMinEmployer,
      expectedSeverance,
      hasMissingPension: Boolean(hasMissingPension),
      currentAge: personal.age ?? null,
      retirementAge: ret.plannedRetirementAge ?? LEGAL_RETIREMENT_AGE,
      currentAccumulation: currentAccumulation || ret.currentPensionAccumulation || 0,
      currentFundName: activeFunds[0]?.fundName ?? ret.pensionFundName ?? null,
      currentMgmtFee,
      fundCount: activeFunds.length,
      hasStudyFund,
      parseWarnings,
      payslipContribution: payslipContribution || null,
      fundContribution: fundContribution || null,
      depositMismatch: parseWarnings.length > 0,
      funds: activeFunds,
    };
  }

  return {
    hasData: Boolean(grossSalary),
    dataSource: grossSalary ? 'payslip' : null,
    grossSalary,
    pensionEmployee,
    pensionEmployer,
    pensionSeverance: s.pensionSeverance ?? null,
    totalMonthlyContribution: payslipContribution || ((expectedMinEmployee || 0) + (expectedMinEmployer || 0)),
    expectedMinEmployee,
    expectedMinEmployer,
    expectedSeverance,
    hasMissingPension: Boolean(hasMissingPension),
    currentAge: personal.age ?? null,
    retirementAge: ret.plannedRetirementAge ?? LEGAL_RETIREMENT_AGE,
    currentAccumulation: ret.currentPensionAccumulation ?? 0,
    currentFundName: ret.pensionFundName ?? null,
    currentMgmtFee: ret.pensionMgmtFee ?? null,
    fundCount: 0,
    hasStudyFund: ret.hasStudyFund ?? null,
    parseWarnings: [],
    funds: [],
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
 * @param {object} [options]
 * @param {object} [options.profile]
 * @returns {Array<RecommendationDTO>}
 */
function generatePensionRecommendations(summary, projection, { profile, benchmark } = {}) {
  const recs = [];

  if (summary.hasMissingPension) {
    recs.push(withImpact({
      type: 'missing_pension_contributions',
      title: 'לא זוהו הפרשות פנסיה בתלוש',
      reason: `בתלוש השכר לא זוהו הפרשות פנסיה. לפי חוק, על המעסיק להפריש לפחות 6.5% ועל העובד 6% מהשכר (₪${summary.expectedMinEmployee}/חודש עובד + ₪${summary.expectedMinEmployer}/חודש מעסיק).`,
      urgency: 'high',
      financialImpact: `הפרשה חסרה של ₪${(summary.expectedMinEmployee || 0) + (summary.expectedMinEmployer || 0)}/חודש`,
      impactAmount: ((summary.expectedMinEmployee || 0) + (summary.expectedMinEmployer || 0)) * 12,
      confidenceScore: 95,
    }));
  }

  if (benchmark?.funds?.length) {
    for (const bf of benchmark.funds) {
      if (bf.feeVsMarket === 'above_market' || bf.feeVsMarket === 'high') {
        const savings = bf.potentialSavingsToRetirement || 0;
        recs.push(withImpact({
          type: 'fee_above_market',
          title: `דמי ניהול מעל השוק — ${bf.fundName}`,
          reason: bf.matchedTrack
            ? `דמי ניהול ${((bf.userFee || 0) * 100).toFixed(2)}% vs ממוצע שוק ${((bf.marketAvgFee || 0) * 100).toFixed(2)}% (${FEE_STATUS_LABELS[bf.feeVsMarket] || bf.feeVsMarket}). מסלול מזוהה: ${bf.matchedTrack.name}.`
            : `דמי ניהול ${((bf.userFee || 0) * 100).toFixed(2)}% — ${FEE_STATUS_LABELS[bf.feeVsMarket] || 'מעל ממוצע השוק'}.`,
          urgency: savings > 50000 ? 'high' : 'medium',
          financialImpact: savings > 0 ? `₪${Math.round(savings).toLocaleString('he-IL')} חיסכון עד פרישה` : 'השפעה על הצבירה לטווח ארוך',
          impactAmount: savings,
          confidenceScore: bf.matchConfidence >= 60 ? 90 : 75,
        }));
      }

      if (bf.rankLabel === 'below_average') {
        recs.push(withImpact({
          type: 'track_underperforming',
          title: `מסלול מתחת לממוצע — ${bf.fundName}`,
          reason: bf.matchedTrack
            ? `המסלול "${bf.matchedTrack.name}" מדורג באחוזון ${bf.marketRankPercentile ?? '—'} מול מסלולים דומים בשוק.`
            : 'המסלול מדורג מתחת לממוצע השוק באותה רמת סיכון.',
          urgency: 'medium',
          financialImpact: bf.potentialSavingsToRetirement > 0
            ? `עד ₪${Math.round(bf.potentialSavingsToRetirement).toLocaleString('he-IL')} בבחירת מסלול חלופי`
            : 'שיפור תשואה ארוכת טווח',
          impactAmount: bf.potentialSavingsToRetirement || 0,
          confidenceScore: bf.matchConfidence >= 50 ? 82 : 68,
        }));
      }

      if (bf.riskMismatch) {
        recs.push(withImpact({
          type: 'risk_wrong_for_age',
          title: `מסלול סיכון לא מתאים לגיל — ${bf.fundName}`,
          reason: `מסלול ${riskLevelShortLabel(bf.riskLevel)} בגיל ${summary.currentAge} — מומלץ מסלול ${riskLevelShortLabel(bf.recommendedRiskLevel)}.`,
          urgency: summary.currentAge && summary.currentAge < 45 ? 'high' : 'medium',
          financialImpact: 'התאמת סיכון משפרת את יחס הסיכון/תשואה לטווח ארוך',
          impactAmount: 0,
          confidenceScore: 85,
        }));
      }
    }
  }

  if (projection.contributionRules?.belowMinimum) {
    recs.push(withImpact({
      type: 'pension_below_minimum',
      title: 'הפרשת פנסיה מתחת למינימום',
      reason: `שיעור ההפרשה ${projection.contributionRules.rate}% — נמוך מ-6% הנדרש.`,
      urgency: 'high',
      financialImpact: 'השפעה ישירה על קצבת הפרישה',
      impactAmount: 0,
      confidenceScore: 98,
    }));
  }

  if (summary.fundCount > 2) {
    const estimatedDuplicateFees = 600 * (summary.fundCount - 1);
    recs.push(withImpact({
      type: 'multiple_funds',
      title: `ריבוי קרנות — ${summary.fundCount} קרנות פעילות`,
      reason: 'ניהול מספר קרנות במקביל פירושו ריבוי דמי ניהול. מומלץ לרכז ל-1-2 קרנות.',
      urgency: 'medium',
      financialImpact: `חיסכון משוער ~₪${estimatedDuplicateFees.toLocaleString('he-IL')}/שנה`,
      impactAmount: estimatedDuplicateFees,
      confidenceScore: 80,
    }));
  }

  if (summary.funds?.length) {
    const lowEmployer = summary.funds.filter(f => {
      if (f.status === 'closed') return false;
      if (!f.monthlyEmployerDeposit || !f.monthlyEmployeeDeposit) return false;
      const total = f.monthlyEmployerDeposit + f.monthlyEmployeeDeposit;
      const ratio = f.monthlyEmployerDeposit / total;
      return ratio < 0.45 && ratio > 0;
    });
    if (lowEmployer.length > 0) {
      recs.push(withImpact({
        type: 'employer_contribution_low',
        title: 'הפרשת מעסיק לפנסיה נמוכה',
        reason: 'הפרשת המעסיק נראית נמוכה מהמינימום החוקי (6.5% + 8.33% פיצויים). בדוק את חוזה ההעסקה ואת תלוש השכר.',
        urgency: 'high',
        financialImpact: null,
        impactAmount: 0,
        confidenceScore: 88,
      }));
    }
  }

  if (summary.hasStudyFund === false && summary.hasData) {
    recs.push(withImpact({
      type: 'no_study_fund',
      title: 'לא זוהתה קרן השתלמות',
      reason: 'קרן השתלמות היא כלי חיסכון יעיל לטווח בינוני — עד ₪20,520/שנה פטורים ממס.',
      urgency: 'medium',
      financialImpact: 'עד ₪20,520/שנה פטור ממס',
      impactAmount: 20520,
      confidenceScore: 78,
    }));
  }

  if (summary.depositMismatch && summary.payslipContribution && summary.fundContribution) {
    recs.push(withImpact({
      type: 'deposit_mismatch_payslip_vs_import',
      title: 'פער הפקדות בין תלוש לדוח',
      reason: `הדוח מציג ₪${summary.fundContribution.toLocaleString('he-IL')}/חודש והתלוש ₪${summary.payslipContribution.toLocaleString('he-IL')}/חודש — בדוק מול המעסיק.`,
      urgency: 'medium',
      financialImpact: `פער של ₪${Math.abs(summary.fundContribution - summary.payslipContribution).toLocaleString('he-IL')}/חודש`,
      impactAmount: Math.abs(summary.fundContribution - summary.payslipContribution) * 12,
      confidenceScore: 85,
    }));
  }

  if (summary.parseWarnings?.length) {
    recs.push(withImpact({
      type: 'partial_import_data',
      title: 'נתונים חלקיים מהדוח',
      reason: `חלק מהשדות לא זוהו בייבוא (${summary.parseWarnings.length} אזהרות). השלם ידנית או העלה תלוש לעדכון.`,
      urgency: 'low',
      financialImpact: null,
      impactAmount: 0,
      confidenceScore: 70,
    }));
  }

  if (summary.currentMgmtFee != null && summary.currentMgmtFee > DEFAULT_MARKET_MGMT_FEE) {
    const hasBenchmarkFeeRec = recs.some(r => r.type === 'fee_above_market');
    const benchmarkCoversFees = (benchmark?.summary?.fundsAboveMarketFee ?? 0) > 0
      || (benchmark?.funds?.length ?? 0) > 0
      || hasBenchmarkFeeRec;
    if (!benchmarkCoversFees) {
      const feePct = (summary.currentMgmtFee * 100).toFixed(2);
      recs.push(withImpact({
        type: 'high_mgmt_fee',
        title: 'דמי ניהול גבוהים',
        reason: projection.mgmtFeeSavings?.additionalMonthlyPension > 100
          ? `דמי ניהול ממוצעים ${feePct}% — החלפת קרן עשויה להוסיף ₪${projection.mgmtFeeSavings.additionalMonthlyPension}/חודש לקצבה.`
          : `דמי ניהול ממוצעים ${feePct}% — גבוהים מממוצע השוק (~0.35%).`,
        urgency: 'medium',
        financialImpact: projection.mgmtFeeSavings?.additionalMonthlyPension > 100
          ? `₪${projection.mgmtFeeSavings.additionalMonthlyPension}/חודש נוסף בפרישה`
          : null,
        impactAmount: projection.mgmtFeeSavings?.savingsByRetirement || 0,
        confidenceScore: 82,
      }));
    } else if (projection.mgmtFeeSavings?.additionalMonthlyPension > 100 && !hasBenchmarkFeeRec) {
      recs.push(withImpact({
        type: 'high_mgmt_fee',
        title: 'דמי ניהול גבוהים',
        reason: `החלפת קרן עשויה להוסיף ₪${projection.mgmtFeeSavings.additionalMonthlyPension}/חודש לקצבה.`,
        urgency: 'medium',
        financialImpact: `₪${projection.mgmtFeeSavings.additionalMonthlyPension}/חודש נוסף בפרישה`,
        impactAmount: projection.mgmtFeeSavings.savingsByRetirement || 0,
        confidenceScore: 82,
      }));
    }
  } else if (projection.mgmtFeeSavings?.additionalMonthlyPension > 100
    && !(benchmark?.summary?.fundsAboveMarketFee ?? 0)
    && !recs.some(r => r.type === 'fee_above_market')) {
    recs.push(withImpact({
      type: 'high_mgmt_fee',
      title: 'דמי ניהול גבוהים',
      reason: `החלפת קרן עשויה להוסיף ₪${projection.mgmtFeeSavings.additionalMonthlyPension}/חודש לקצבה.`,
      urgency: 'medium',
      financialImpact: `₪${projection.mgmtFeeSavings.additionalMonthlyPension}/חודש נוסף בפרישה`,
      impactAmount: projection.mgmtFeeSavings.savingsByRetirement || 0,
      confidenceScore: 82,
    }));
  }

  if (projection.replacementRatio !== null && projection.replacementRatio < 60) {
    recs.push(withImpact({
      type: 'low_replacement_ratio',
      title: 'יחס תחלופת שכר נמוך',
      reason: `הקצבה הצפויה היא ${projection.replacementRatio}% מהשכר הנוכחי — מתחת ל-70% המומלץ.`,
      urgency: 'medium',
      financialImpact: `הגדלת ההפרשה ב-1% משפרת את הקצבה בכ-₪${Math.round((summary.grossSalary || 0) * 0.01 * 1.5)}/חודש`,
      impactAmount: Math.round((summary.grossSalary || 0) * 0.01 * 1.5) * 12,
      confidenceScore: 78,
    }));
  }

  const seenTitles = new Set();
  const uniqueRecs = recs.filter(r => {
    if (seenTitles.has(r.title)) return false;
    seenTitles.add(r.title);
    return true;
  });

  uniqueRecs.sort((a, b) => (b.impactAmount || 0) - (a.impactAmount || 0));
  return uniqueRecs.map(({ impactAmount, ...rest }) => rest);
}

module.exports = {
  getPensionSummary,
  projectRetirementIncome,
  generatePensionRecommendations,
};
