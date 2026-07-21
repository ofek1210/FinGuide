/**
 * Gemel Agent Tools — קופות גמל וקרנות השתלמות
 * Flow: Agent → Tool → Service → DTO (mirrors pensionTools.js)
 */

const UserProfile = require('../../models/UserProfile');
const Document = require('../../models/Document');
const PensionFund = require('../../models/PensionFund');
const { weightedAvgMgmtFee } = require('../../utils/pensionShared');

/** PensionFund.fundType values that belong to the gemel domain */
const GEMEL_FUND_TYPES = ['study_fund', 'provident_fund'];

function hasGemelHoldingData(fund) {
  const balance = Number(fund?.currentBalance) || 0;
  const deposits = (Number(fund?.monthlyEmployeeDeposit) || 0)
    + (Number(fund?.monthlyEmployerDeposit) || 0)
    + (Number(fund?.monthlyDeposit) || 0);
  return balance > 0 || deposits > 0;
}

/**
 * Har HaKesef imports may mark gemel holdings as closed/inactive even when
 * balances exist — include any gemel-type row with analyzable data.
 */
function isAnalyzableGemelHolding(fund) {
  if (!fund || !GEMEL_FUND_TYPES.includes(fund.fundType)) return false;
  if (fund.status !== 'closed' && fund.isActive !== false) return true;
  return hasGemelHoldingData(fund);
}

async function findGemelHoldings(userId) {
  if (!userId) return [];
  const funds = await PensionFund.find({
    user: userId,
    fundType: { $in: GEMEL_FUND_TYPES },
  }).lean();
  return funds.filter(isAnalyzableGemelHolding);
}

/** Typical study-fund contribution rates (percent of salary) */
const STUDY_FUND_EMPLOYEE_RATE = 2.5;
const STUDY_FUND_EMPLOYER_RATE = 7.5;
/** Monthly salary ceiling for the study-fund tax benefit (תקרת הפקדה מוטבת) */
const STUDY_FUND_MONTHLY_SALARY_CEILING = 15712;
/** Annual tax-free deposit ceiling for a salaried employee */
const STUDY_FUND_ANNUAL_TAX_FREE_DEPOSIT = 20520;

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

// ── Tool: getGemelSummary ─────────────────────────────────────────────────────

/**
 * Build gemel summary from PensionFund gemel-type imports, UserProfile + payslips.
 * @param {string} userId
 * @returns {Promise<GemelSummaryDTO>}
 */
async function getGemelSummary(userId) {
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
    findGemelHoldings(userId),
  ]);

  const s = latestPayslip?.analysisData?.summary || {};
  const ret = profile?.retirement || {};
  const emp = profile?.employment || {};
  const personal = profile?.personal || {};

  const grossSalary = s.grossSalary ?? null;
  const studyFundEmployee = s.trainingFundEmployee ?? null;
  const studyFundEmployer = s.trainingFundEmployer ?? null;
  const studyFundEmployeeRate = s.trainingFundEmployeeRate ?? emp.studyFundEmployeeRate ?? null;
  const studyFundEmployerRate = s.trainingFundEmployerRate ?? emp.studyFundEmployerRate ?? null;
  const payslipContribution = (studyFundEmployee || 0) + (studyFundEmployer || 0);
  const declaredStudyFund = ret.hasStudyFund ?? null;

  const activeFunds = funds;
  const studyFunds = activeFunds.filter(f => f.fundType === 'study_fund');
  const providentFunds = activeFunds.filter(f => f.fundType === 'provident_fund');
  const hasImportedFunds = activeFunds.length > 0;

  const salaryAboveCeiling = grossSalary != null && grossSalary > STUDY_FUND_MONTHLY_SALARY_CEILING;
  const eligibleBase = grossSalary != null
    ? Math.min(grossSalary, STUDY_FUND_MONTHLY_SALARY_CEILING)
    : null;
  const expectedEmployee = eligibleBase ? Math.round(eligibleBase * (STUDY_FUND_EMPLOYEE_RATE / 100)) : null;
  const expectedEmployer = eligibleBase ? Math.round(eligibleBase * (STUDY_FUND_EMPLOYER_RATE / 100)) : null;

  if (hasImportedFunds) {
    const totalBalance = activeFunds.reduce((sum, f) => sum + (f.currentBalance || 0), 0);
    const studyFundBalance = studyFunds.reduce((sum, f) => sum + (f.currentBalance || 0), 0);
    const providentBalance = providentFunds.reduce((sum, f) => sum + (f.currentBalance || 0), 0);
    const fundContribution = activeFunds.reduce(
      (sum, f) => sum + (f.monthlyEmployeeDeposit || 0) + (f.monthlyEmployerDeposit || 0)
        + (!f.monthlyEmployeeDeposit && !f.monthlyEmployerDeposit ? (f.monthlyDeposit || 0) : 0),
      0,
    );
    const totalMonthlyContribution = fundContribution || payslipContribution;
    const currentMgmtFee = weightedAvgMgmtFee(activeFunds);
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
      dataSource: activeFunds.some(f => f.source === 'har_hakesef')
        ? 'har_hakesef'
        : activeFunds.some(f => f.source === 'clearinghouse') ? 'clearinghouse' : 'manual',
      grossSalary,
      studyFundEmployee,
      studyFundEmployer,
      studyFundEmployeeRate,
      studyFundEmployerRate,
      expectedEmployee,
      expectedEmployer,
      payslipContribution: payslipContribution || null,
      declaredStudyFund,
      hasStudyFund: studyFunds.length > 0 || payslipContribution > 0,
      hasProvidentFund: providentFunds.length > 0,
      studyFundCount: studyFunds.length,
      providentFundCount: providentFunds.length,
      fundCount: activeFunds.length,
      totalBalance,
      studyFundBalance,
      providentBalance,
      totalMonthlyContribution,
      fundContribution: fundContribution || null,
      currentMgmtFee,
      currentAge: personal.age ?? null,
      salaryAboveCeiling,
      monthlySalaryCeiling: STUDY_FUND_MONTHLY_SALARY_CEILING,
      annualTaxFreeDeposit: STUDY_FUND_ANNUAL_TAX_FREE_DEPOSIT,
      depositMismatch: parseWarnings.length > 0,
      parseWarnings,
      funds: activeFunds,
    };
  }

  return {
    hasData: Boolean(grossSalary),
    dataSource: grossSalary ? 'payslip' : null,
    grossSalary,
    studyFundEmployee,
    studyFundEmployer,
    studyFundEmployeeRate,
    studyFundEmployerRate,
    expectedEmployee,
    expectedEmployer,
    payslipContribution: payslipContribution || null,
    declaredStudyFund,
    hasStudyFund: payslipContribution > 0 ? true : (declaredStudyFund ?? false),
    hasProvidentFund: false,
    studyFundCount: 0,
    providentFundCount: 0,
    fundCount: 0,
    totalBalance: 0,
    studyFundBalance: 0,
    providentBalance: 0,
    totalMonthlyContribution: payslipContribution,
    fundContribution: null,
    currentMgmtFee: null,
    currentAge: personal.age ?? null,
    salaryAboveCeiling,
    monthlySalaryCeiling: STUDY_FUND_MONTHLY_SALARY_CEILING,
    annualTaxFreeDeposit: STUDY_FUND_ANNUAL_TAX_FREE_DEPOSIT,
    depositMismatch: false,
    parseWarnings: [],
    funds: [],
  };
}

// ── Tool: generateGemelRecommendations ────────────────────────────────────────

const VERDICT_URGENCY = { SWITCH: 'high', NEGOTIATE: 'medium', REVIEW: 'medium' };

/**
 * @param {GemelSummaryDTO} summary
 * @param {object} [options]
 * @param {object} [options.marketAdvice] — result of buildGemelMarketAdvice
 * @returns {Array<RecommendationDTO>}
 */
function generateGemelRecommendations(summary, { marketAdvice } = {}) {
  const recs = [];

  if (!summary.hasStudyFund && !summary.hasProvidentFund && summary.grossSalary) {
    recs.push(withImpact({
      type: 'no_study_fund',
      title: 'לא זוהתה קרן השתלמות',
      reason: `קרן השתלמות היא אפיק החיסכון היחיד שנותר פטור ממס רווחי הון — עד ₪${summary.annualTaxFreeDeposit.toLocaleString('he-IL')}/שנה. שווה לבדוק זכאות מול המעסיק (עובד ${STUDY_FUND_EMPLOYEE_RATE}% + מעסיק ${STUDY_FUND_EMPLOYER_RATE}%).`,
      urgency: 'medium',
      financialImpact: `עד ₪${summary.annualTaxFreeDeposit.toLocaleString('he-IL')}/שנה פטור ממס`,
      impactAmount: summary.annualTaxFreeDeposit,
      confidenceScore: 78,
    }));
  }

  if (summary.declaredStudyFund === true && !summary.payslipContribution && summary.studyFundCount === 0 && summary.grossSalary) {
    recs.push(withImpact({
      type: 'study_fund_declared_no_deposit',
      title: 'הצהרת על קרן השתלמות אך לא זוהתה הפקדה',
      reason: 'בפרופיל מוגדרת קרן השתלמות, אבל בתלוש האחרון לא זוהתה הפקדה. בדוק מול המעסיק שההפקדות אכן מבוצעות.',
      urgency: 'high',
      financialImpact: summary.expectedEmployer
        ? `הפקדה צפויה ~₪${(summary.expectedEmployee + summary.expectedEmployer).toLocaleString('he-IL')}/חודש`
        : null,
      impactAmount: ((summary.expectedEmployee || 0) + (summary.expectedEmployer || 0)) * 12,
      confidenceScore: 85,
    }));
  }

  if (marketAdvice?.hasData) {
    for (const f of marketAdvice.funds || []) {
      if (f.verdict === 'LEAVE' || !f.verdict) continue;
      recs.push(withImpact({
        type: `gemel_market_${f.verdict.toLowerCase()}`,
        title: `${f.verdictLabelHe} — ${f.productName}`,
        reason: f.summaryHe,
        urgency: VERDICT_URGENCY[f.verdict] || 'medium',
        financialImpact: f.annualSavingsEstimate
          ? `~₪${Math.round(f.annualSavingsEstimate).toLocaleString('he-IL')}/שנה`
          : (f.projected30YearLoss
            ? `~₪${Math.round(f.projected30YearLoss).toLocaleString('he-IL')} הפסד מצטבר לטווח ארוך`
            : null),
        impactAmount: f.annualSavingsEstimate || 0,
        confidenceScore: 80,
      }));
    }
  }

  if (summary.studyFundEmployerRate != null
    && summary.studyFundEmployerRate > 0
    && summary.studyFundEmployerRate < STUDY_FUND_EMPLOYER_RATE) {
    const gap = STUDY_FUND_EMPLOYER_RATE - summary.studyFundEmployerRate;
    const monthlyGap = summary.grossSalary
      ? Math.round(Math.min(summary.grossSalary, summary.monthlySalaryCeiling) * (gap / 100))
      : null;
    recs.push(withImpact({
      type: 'study_fund_employer_rate_low',
      title: 'הפרשת מעסיק לקרן השתלמות נמוכה מהמקובל',
      reason: `המעסיק מפריש ${summary.studyFundEmployerRate}% — המקובל במשק הוא ${STUDY_FUND_EMPLOYER_RATE}%. שווה לנהל משא ומתן במסגרת תנאי ההעסקה.`,
      urgency: 'medium',
      financialImpact: monthlyGap ? `₪${monthlyGap.toLocaleString('he-IL')}/חודש הפרש` : null,
      impactAmount: (monthlyGap || 0) * 12,
      confidenceScore: 82,
    }));
  }

  if (summary.salaryAboveCeiling && summary.payslipContribution > 0) {
    recs.push(withImpact({
      type: 'study_fund_above_ceiling',
      title: 'שכר מעל תקרת ההפקדה המוטבת',
      reason: `השכר גבוה מתקרת ₪${summary.monthlySalaryCeiling.toLocaleString('he-IL')}/חודש — הפקדות על החלק שמעל התקרה חייבות במס (זקיפת שווי). ודא שההפקדות מחושבות עד התקרה בלבד, או קח בחשבון את המס.`,
      urgency: 'low',
      financialImpact: null,
      impactAmount: 0,
      confidenceScore: 75,
    }));
  }

  if (summary.fundCount > 2) {
    const estimatedDuplicateFees = 400 * (summary.fundCount - 1);
    recs.push(withImpact({
      type: 'multiple_gemel_funds',
      title: `ריבוי קופות — ${summary.fundCount} קופות פעילות`,
      reason: 'ניהול מספר קופות גמל/השתלמות במקביל פירושו ריבוי דמי ניהול ואיבוד כוח מיקוח. מומלץ לרכז לקופה אחת-שתיים (ניוד גמל אינו אירוע מס).',
      urgency: 'medium',
      financialImpact: `חיסכון משוער ~₪${estimatedDuplicateFees.toLocaleString('he-IL')}/שנה`,
      impactAmount: estimatedDuplicateFees,
      confidenceScore: 78,
    }));
  }

  if (summary.depositMismatch && summary.payslipContribution && summary.fundContribution) {
    recs.push(withImpact({
      type: 'gemel_deposit_mismatch',
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
      reason: `חלק מהשדות לא זוהו בייבוא (${summary.parseWarnings.length} אזהרות). השלם ידנית או העלה דוח מעודכן.`,
      urgency: 'low',
      financialImpact: null,
      impactAmount: 0,
      confidenceScore: 70,
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
  getGemelSummary,
  generateGemelRecommendations,
  findGemelHoldings,
  isAnalyzableGemelHolding,
  hasGemelHoldingData,
  GEMEL_FUND_TYPES,
  STUDY_FUND_EMPLOYEE_RATE,
  STUDY_FUND_EMPLOYER_RATE,
  STUDY_FUND_MONTHLY_SALARY_CEILING,
  STUDY_FUND_ANNUAL_TAX_FREE_DEPOSIT,
};
