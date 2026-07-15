

function toPensionSummary(analysis) {
  if (!analysis?.summary?.hasData) return null;
  return {
    healthScore: analysis.healthCheck?.score ?? null,
    totalPotentialSavings: analysis.benchmark?.summary?.totalPotentialSavings ?? 0,
    topRecs: (analysis.recommendations || []).slice(0, 3).map(r => r.title),
    hasData: true,
    fundCount: analysis.summary.fundCount ?? 0,
    recommendedRiskLevel: analysis.benchmark?.summary?.recommendedRiskLevel ?? null,
  };
}

function toInsuranceSummary(analysis) {
  if (!analysis?.hasImportedPolicies && !analysis?.summary?.hasData) return null;
  return {
    healthScore: analysis.healthCheck?.score ?? null,
    duplicateCount: analysis.analysis?.duplicateCount ?? 0,
    totalMonthlyWaste: analysis.analysis?.totalMonthlyWaste ?? 0,
    topRecs: (analysis.recommendations || []).slice(0, 3).map(r => r.title),
    hasData: Boolean(analysis?.hasImportedPolicies || analysis?.summary?.hasData),
  };
}

function toGemelSummary(analysis) {
  if (!analysis?.summary?.hasData) return null;
  const s = analysis.summary;
  return {
    totalBalance: s.totalBalance ?? 0,
    fundCount: s.fundCount ?? 0,
    hasStudyFund: Boolean(s.hasStudyFund),
    overallVerdictLabelHe: analysis.marketAdvice?.overallVerdictLabelHe ?? null,
    topRecs: (analysis.recommendations || []).slice(0, 3).map(r => r.title),
    hasData: true,
  };
}

function toPayslipSummary(payslip) {
  if (!payslip) return { latestGross: null, insightCount: 0, topInsights: [], hasData: false };
  return {
    latestGross: payslip.meta?.avgGross ?? payslip.moneyFlow?.avgGross ?? null,
    insightCount: payslip.insights?.length ?? 0,
    topInsights: (payslip.insights || []).slice(0, 3).map(i => i.title),
    hasData: Boolean(payslip.insights?.length),
  };
}

function buildNarrativeHints(pension, insurance, payslipSummary, gemel) {
  const hints = [];
  if (pension?.healthScore != null && pension.healthScore < 50) {
    hints.push(`ציון בריאות פנסיונית: ${pension.healthScore}/100`);
  }
  if (pension?.totalPotentialSavings > 0) {
    hints.push(`חיסכון פנסיוני עד פרישה: ₪${Math.round(pension.totalPotentialSavings).toLocaleString('he-IL')}`);
  }
  if (insurance?.healthScore != null && insurance.duplicateCount > 0) {
    hints.push(`כפילויות ביטוח: ${insurance.duplicateCount}`);
  }
  if (payslipSummary?.latestGross) {
    hints.push(`ברוטו ממוצע: ₪${Math.round(payslipSummary.latestGross).toLocaleString('he-IL')}`);
  }
  if (gemel?.hasData && gemel.totalBalance > 0) {
    hints.push(`צבירה בגמל והשתלמות: ₪${Math.round(gemel.totalBalance).toLocaleString('he-IL')}`);
  }
  if (gemel?.overallVerdictLabelHe && gemel.overallVerdictLabelHe !== 'הישאר') {
    hints.push(`גמל והשתלמות: ${gemel.overallVerdictLabelHe}`);
  }
  return hints;
}

function buildUnifiedSummaryFromInsights({ pension, insurance, payslip }) {
  const pensionSummary = pension?.meta
    ? {
        healthScore: pension.meta.healthScore ?? null,
        totalPotentialSavings: pension.meta.totalPotentialSavings ?? 0,
        topRecs: (pension.insights || []).slice(0, 3).map(i => i.title),
        hasData: Boolean(pension.meta.fundCount || pension.meta.activeFundCount),
      }
    : { healthScore: null, totalPotentialSavings: 0, topRecs: [], hasData: false };

  const insuranceSummary = insurance?.meta
    ? {
        healthScore: insurance.meta.healthScore ?? null,
        duplicateCount: insurance.meta.duplicateCount ?? 0,
        totalMonthlyWaste: insurance.meta.totalMonthlyWaste ?? 0,
        topRecs: (insurance.insights || []).slice(0, 3).map(i => i.title),
        hasData: Boolean(insurance.meta.policyCount || insurance.meta.activePolicies),
      }
    : { healthScore: null, duplicateCount: 0, totalMonthlyWaste: 0, topRecs: [], hasData: false };

  const payslipSummary = toPayslipSummary(payslip);

  return {
    pension: pensionSummary,
    insurance: insuranceSummary,
    payslip: payslipSummary,
    narrativeHints: buildNarrativeHints(pensionSummary, insuranceSummary, payslipSummary),
  };
}

module.exports = {
  toPensionSummary,
  toInsuranceSummary,
  toGemelSummary,
  toPayslipSummary,
  buildNarrativeHints,
  buildUnifiedSummaryFromInsights,
};
