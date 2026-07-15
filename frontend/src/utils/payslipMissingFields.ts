import type { PayslipDetail } from "../types/payslip";
import type { PayslipHistoryItem } from "../types/payslip";

const FALLBACK_PERIOD_LABEL = "תלוש משכורת";

function isMissingText(value: unknown): boolean {
  return typeof value !== "string" || value.trim().length === 0;
}

/** Field keys the user can fill manually in MissingFieldsModal. */
export function getPayslipMissingFieldKeys(payslip: PayslipDetail): string[] {
  const keys: string[] = [];
  if (
    isMissingText(payslip.periodLabel)
    || payslip.periodLabel === "לא זוהה"
    || payslip.periodLabel === FALLBACK_PERIOD_LABEL
  ) {
    keys.push("periodLabel");
  }
  if (isMissingText(payslip.employerName)) keys.push("employerName");
  if (isMissingText(payslip.employeeName)) keys.push("employeeName");
  if (isMissingText(payslip.employeeId)) keys.push("employeeId");
  if (isMissingText(payslip.paymentDate)) keys.push("paymentDate");
  if (payslip.grossSalary == null) keys.push("grossSalary");
  if (payslip.netSalary == null) keys.push("netSalary");
  return keys;
}

export function isPayslipUserCompletable(item: PayslipHistoryItem): boolean {
  if (item.missingCritical && item.missingCritical.length > 0) return true;
  if (item.grossSalary == null || item.netSalary == null) return true;
  if (!item.periodMonth) return true;
  return false;
}

export function isPayslipSystemReviewOnly(item: PayslipHistoryItem): boolean {
  return item.needsReview === true && !isPayslipUserCompletable(item);
}
