

const { MOCK_DASHBOARD_SUMMARY } = require('../ai/mock/mockData');
const Document = require('../models/Document');
const UserProfile = require('../models/UserProfile');
const InsurancePolicy = require('../models/InsurancePolicy');
const Recommendation = require('../models/Recommendation');
const { buildPensionAnalysis } = require('../services/pensionAnalysisService');
const { buildGemelAnalysis } = require('../services/gemelAnalysisService');
const { buildInsuranceAnalysis } = require('../services/insuranceAnalysisService');
const { isDemoRequest } = require('../utils/demoMode');

/**
 * GET /api/dashboard/summary
 * Lightweight summary for the dashboard header — no LLM, pure DB aggregation.
 */
async function getDashboardSummary(req, res) {
  if (isDemoRequest(req)) {
    return res.json({ success: true, data: MOCK_DASHBOARD_SUMMARY });
  }

  const userId = req.user._id;

  const [docs, profile, policies, recommendations] = await Promise.all([
    Document.find({ user: userId }).select('status analysisData metadata createdAt').lean(),
    UserProfile.findOne({ user: userId }).lean(),
    InsurancePolicy.find({ user: userId, status: { $ne: 'cancelled' } }).lean(),
    Recommendation.find({ user: userId, dismissed: { $ne: true } })
      .sort({ createdAt: -1 })
      .limit(5)
      .lean(),
  ]);

  const completed = docs.filter(d => d.status === 'completed');
  const failed    = docs.filter(d => d.status === 'failed');
  const pending   = docs.filter(d => ['pending', 'processing', 'uploaded'].includes(d.status));

  // ── Payslip score (0-100) ─────────────────────────────────────────────────
  let payslipScore = null;
  if (completed.length > 0) {
    const withData = completed.filter(d => d.analysisData && typeof d.analysisData === 'object');
    let anomalies = 0;
    let hasPensionContrib = 0;
    for (const doc of withData) {
      const a = doc.analysisData;
      if (a.contributions?.pension_employee?.amount > 0 || a.contributions?.pension_employer?.amount > 0) {
        hasPensionContrib++;
      }
      if (Array.isArray(a.anomalies) && a.anomalies.length > 0) anomalies++;
    }
    const pensionRatio = withData.length > 0 ? hasPensionContrib / withData.length : 0;
    const anomalyRatio = withData.length > 0 ? anomalies / withData.length : 0;
    payslipScore = Math.round(60 + (pensionRatio * 25) - (anomalyRatio * 20));
    payslipScore = Math.max(0, Math.min(100, payslipScore));
  }

  // ── Insurance score (0-100) ───────────────────────────────────────────────
  let insuranceScore = null;
  try {
    const insuranceAnalysis = await buildInsuranceAnalysis(userId);
    if (insuranceAnalysis?.hasImportedPolicies && insuranceAnalysis.healthCheck?.score != null) {
      insuranceScore = insuranceAnalysis.healthCheck.score;
    }
  } catch {
    // fallback to profile heuristic below
  }
  if (insuranceScore == null && profile?.insurance) {
    const ins = profile.insurance;
    const checks = [
      ins.hasLifeInsurance,
      ins.hasHealthInsurance,
      ins.hasDisabilityInsurance,
    ];
    const owned = checks.filter(Boolean).length;
    const base = Math.round((owned / checks.length) * 70);
    const importBonus = policies.length > 0 ? 15 : 0;
    const mortgageBonus = profile.assets?.hasMortgage && ins.hasApartmentInsurance ? 10 : 0;
    const carBonus = profile.assets?.ownsCar && ins.hasCarInsurance ? 5 : 0;
    insuranceScore = Math.min(100, base + importBonus + mortgageBonus + carBonus);
  }

  // ── Pension score (0-100) ─────────────────────────────────────────────────
  let pensionScore = null;
  try {
    const pensionAnalysis = await buildPensionAnalysis(userId);
    if (pensionAnalysis?.summary?.hasData && pensionAnalysis.healthCheck?.score != null) {
      pensionScore = pensionAnalysis.healthCheck.score;
    }
  } catch {
    // fallback to profile heuristic below
  }
  if (pensionScore == null && profile?.retirement) {
    const ret = profile.retirement;
    const emp = profile.employment;
    let score = 0;
    if (ret.hasPension) score += 40;
    if (emp?.pensionEmployeeRate != null && emp.pensionEmployeeRate >= 6) score += 25;
    if (emp?.pensionEmployerRate != null && emp.pensionEmployerRate >= 6.5) score += 20;
    if (ret.hasStudyFund) score += 10;
    if (ret.plannedRetirementAge) score += 5;
    pensionScore = Math.min(100, score);
  }

  // ── Gemel score (0-100) — provident/study funds ───────────────────────────
  let gemelScore = null;
  try {
    const gemelAnalysis = await buildGemelAnalysis(userId);
    if (gemelAnalysis?.summary?.hasData) {
      const s = gemelAnalysis.summary;
      let score = 0;
      if (s.hasStudyFund) score += 45;
      if (s.hasProvidentFund) score += 10;
      if (s.fundCount > 0) score += 15;
      if (!s.depositMismatch) score += 10;
      const verdict = gemelAnalysis.marketAdvice?.overallVerdict;
      if (verdict === 'LEAVE') score += 20;
      else if (verdict === 'NEGOTIATE' || verdict === 'REVIEW') score += 10;
      gemelScore = Math.min(100, score);
    }
  } catch {
    // no gemel score without data
  }

  // ── Overall health score ──────────────────────────────────────────────────
  const validScores = [payslipScore, insuranceScore, pensionScore, gemelScore].filter(s => s != null);
  const overallScore = validScores.length > 0
    ? Math.round(validScores.reduce((a, b) => a + b, 0) / validScores.length)
    : null;

  // ── Warnings ─────────────────────────────────────────────────────────────
  const warnings = [];
  if (failed.length > 0) warnings.push(`${failed.length} תלוש/ים לא עובדו בהצלחה`);
  if (completed.length === 0) warnings.push('לא הועלו תלושי שכר');
  if (profile?.retirement?.hasPension === false) warnings.push('פנסיה לא פעילה');
  if (profile?.insurance?.hasDisabilityInsurance === false) warnings.push('חסר ביטוח אכ"ע');

  return res.json({
    success: true,
    data: {
      scores: {
        overall: overallScore,
        payslip: payslipScore,
        insurance: insuranceScore,
        pension: pensionScore,
        gemel: gemelScore,
      },
      documents: {
        total: docs.length,
        completed: completed.length,
        failed: failed.length,
        pending: pending.length,
      },
      profile: {
        hasProfile: !!profile,
        hasInsuranceData: policies.length > 0 || !!profile?.insurance,
        hasPensionData: !!profile?.retirement?.hasPension || !!profile?.retirement?.currentPensionAccumulation,
        importedPolicies: policies.length,
      },
      warnings,
      topRecommendations: recommendations.map(r => ({
        id: r._id.toString(),
        title: r.title,
        importance: r.importance,
        category: r.category,
      })),
    },
  });
}

module.exports = { getDashboardSummary };
