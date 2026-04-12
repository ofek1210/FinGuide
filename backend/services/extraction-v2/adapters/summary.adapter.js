/**
 * Builds legacy-compatible summary shape from normalized analysis output.
 */
function buildPayslipSummaryV2(normalizedAnalysisData = {}) {
  if (!normalizedAnalysisData || typeof normalizedAnalysisData !== 'object') {
    throw new Error('buildPayslipSummaryV2 expects a normalized analysis object.');
  }

  const salary = normalizedAnalysisData.salary || {};
  const mandatory = normalizedAnalysisData.deductions?.mandatory || {};
  const pension = normalizedAnalysisData.contributions?.pension || {};
  const studyFund = normalizedAnalysisData.contributions?.study_fund || {};
  const employment = normalizedAnalysisData.employment || {};
  const parties = normalizedAnalysisData.parties || {};

  return {
    employeeName: parties.employee_name ?? null,
    date: normalizedAnalysisData.period?.month ?? null,
    grossSalary: salary.gross_total ?? null,
    netSalary: salary.net_payable ?? null,
    vacationDays: null,
    sickDays: null,
    pensionEmployee: pension.employee ?? null,
    pensionEmployer: pension.employer ?? null,
    trainingFundEmployee: studyFund.employee ?? null,
    trainingFundEmployer: studyFund.employer ?? null,
    tax: mandatory.income_tax ?? null,
    nationalInsurance: mandatory.national_insurance ?? null,
    healthInsurance: mandatory.health_insurance ?? null,
    jobPercentage: employment.job_percent ?? null,
    workingDays: null,
    workingHours: null,
  };
}

module.exports = {
  buildPayslipSummaryV2,
};
