/**
 * Payslip Agent Tools
 *
 * Each tool: validates input → calls backend service → returns DTO.
 * NEVER expose raw Mongoose documents.
 * NEVER call MongoDB directly — always go through services.
 *
 * Flow: Agent → Tool → Service → MongoDB → DTO → LLM
 */



const Document = require('../../models/Document');
const { runSalaryAnomalyRules, runPensionGapRules } = require('../engines/ruleEngine');
const { calculateSalaryTrend } = require('../engines/calculationEngine');
const { selectRecentPayslipDocuments } = require('../../utils/selectRecentPayslipDocuments');
const { resolvePayslipPeriod } = require('../../utils/payslipPeriod');

// ── Tool: getPayslipSummaries ─────────────────────────────────────────────────

/**
 * Fetch latest completed payslips for a user and return safe DTOs.
 *
 * @param {string} userId
 * @param {number} [limit=6]
 * @returns {Promise<{
 *   count: number,
 *   payslips: Array<PayslipDTO>,
 *   latestPeriod: string|null
 * }>}
 */
async function getPayslipSummaries(userId, limit = 6) {
  if (!userId) throw new Error('userId is required');

  const docs = await Document.find({
    user: userId,
    status: { $in: ['completed', 'needs_review'] },
    analysisData: { $exists: true, $ne: null },
  })
    .sort({ uploadedAt: -1 })
    .limit(50)
    .lean();

  const recent = selectRecentPayslipDocuments(docs, limit);

  const payslips = recent.map((doc) => {
    const s = doc.analysisData?.summary || {};
    const period = resolvePayslipPeriod(doc);
    const periodLabel = period.incompletePeriod
      ? `${doc.metadata?.periodMonth || '?'}/${doc.metadata?.periodYear || '?'}`
      : `${String(period.month).padStart(2, '0')}/${period.year}`;
    return {
      documentId: doc._id.toString(),
      period: periodLabel,
      grossSalary: s.grossSalary ?? null,
      netSalary: s.netSalary ?? null,
      baseSalary: s.baseSalary ?? null,
      tax: s.tax ?? null,
      nationalInsurance: s.nationalInsurance ?? null,
      healthInsurance: s.healthInsurance ?? null,
      pensionEmployee: s.pensionEmployee ?? null,
      pensionEmployer: s.pensionEmployer ?? null,
      trainingFundEmployee: s.trainingFundEmployee ?? null,
      vacationDays: s.vacationDays ?? null,
      sickDays: s.sickDays ?? null,
      employerName: s.employerName ?? null,
      uploadedAt: doc.uploadedAt,
    };
  });

  return {
    count: payslips.length,
    payslips,
    latestPeriod: payslips[0]?.period ?? null,
  };
}

// ── Tool: analyzeSalary ───────────────────────────────────────────────────────

/**
 * Run salary analysis rules + trend on fetched payslip DTOs.
 *
 * @param {Array<PayslipDTO>} payslips
 * @returns {{
 *   trend: object,
 *   anomalies: object,
 *   pensionGaps: object[],
 *   latestGross: number|null,
 *   latestNet: number|null
 * }}
 */
function analyzeSalary(payslips) {
  if (!Array.isArray(payslips) || payslips.length === 0) {
    return { trend: null, anomalies: { hasAnomalies: false, anomalies: [] }, pensionGaps: [], latestGross: null, latestNet: null };
  }

  const latest = payslips[0];
  const trend = calculateSalaryTrend(payslips);
  const anomalies = runSalaryAnomalyRules(payslips);

  return {
    trend,
    anomalies,
    pensionGaps: [],
    latestGross: latest.grossSalary,
    latestNet: latest.netSalary,
  };
}

// ── Tool: generatePayslipRecommendations ──────────────────────────────────────

/**
 * Generate structured payslip recommendations as DTOs.
 *
 * @param {object} analysisResult - from analyzeSalary
 * @param {Array<PayslipDTO>} payslips
 * @returns {Array<RecommendationDTO>}
 */
function generatePayslipRecommendations(analysisResult, payslips) {
  const recs = [];
  const latest = payslips?.[0];

  if (!latest) return recs;

  // Pension rate check
  if (latest.grossSalary && latest.pensionEmployee !== null) {
    const rate = latest.pensionEmployee / latest.grossSalary;
    if (rate < 0.06) {
      recs.push({
        type: 'pension_low',
        title: 'שיעור הפרשת פנסיה נמוך',
        reason: `שיעור ההפרשה הנוכחי הוא ${(rate * 100).toFixed(1)}%, מתחת לסף המינימלי של 6%.`,
        urgency: 'high',
        financialImpact: `${Math.round((0.06 - rate) * latest.grossSalary)} ₪/חודש הפרש פנסיה`,
        confidenceScore: 95,
      });
    }
  }

  // Anomaly warnings
  if (analysisResult.anomalies?.hasAnomalies) {
    recs.push({
      type: 'salary_anomaly',
      title: 'חריגה בשכר זוהתה',
      reason: (analysisResult.anomalies.anomalies || []).join('; '),
      urgency: 'medium',
      financialImpact: null,
      confidenceScore: 70,
    });
  }

  // Missing training fund
  if (latest.grossSalary && latest.trainingFundEmployee === null) {
    recs.push({
      type: 'missing_training_fund',
      title: 'לא זוהתה קרן השתלמות',
      reason: 'לא נמצאה הפרשה לקרן השתלמות בתלוש האחרון.',
      urgency: 'medium',
      financialImpact: 'קרן השתלמות חוסכת מס על 2.5% משכרך',
      confidenceScore: 80,
    });
  }

  return recs;
}

module.exports = {
  getPayslipSummaries,
  analyzeSalary,
  generatePayslipRecommendations,
};
