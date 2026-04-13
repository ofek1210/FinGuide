const {
  buildCanonicalPayslip,
  buildCanonicalPayslipHistory,
  getValidatedPayslipAnalysis,
} = require('../services/payslipAnalysisService');

const serializePayslipDetail = document => {
  const payslip = buildCanonicalPayslip(document);
  if (!payslip) {
    return null;
  }

  return {
    id: payslip.id,
    periodLabel: payslip.periodLabel,
    periodDate: payslip.periodDate,
    paymentDate: payslip.paymentDate,
    employerName: payslip.employerName,
    employeeName: payslip.employeeName,
    employeeId: payslip.employeeId,
    jobPercent: payslip.jobPercent,
    workingDays: payslip.workingDays,
    workingHours: payslip.workingHours,
    vacationDays: payslip.vacationDays,
    sickDays: payslip.sickDays,
    earnings: payslip.earnings,
    deductions: payslip.deductions,
    grossSalary: payslip.grossSalary,
    netSalary: payslip.netSalary,
  };
};

const serializePayslipHistory = documents => {
  const history = buildCanonicalPayslipHistory(documents);

  return {
    stats: history.stats,
    items: history.items.map((item, index) => ({
      id: item.id,
      periodLabel: item.periodLabel,
      periodDate: item.periodDate,
      netSalary: item.netSalary,
      grossSalary: item.grossSalary,
      isLatest: index === 0,
      downloadUrl: null,
    })),
  };
};

module.exports = {
  getValidatedPayslipAnalysis,
  serializePayslipDetail,
  serializePayslipHistory,
};
