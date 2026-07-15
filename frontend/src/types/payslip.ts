export type PayslipHistoryItem = {
  id: string;
  periodLabel: string;
  periodDate: string;
  periodMonth?: string;
  periodYear?: number;
  periodMonthNumber?: number;
  netSalary: number | null;
  grossSalary: number | null;
  tax?: number | null;
  nationalInsurance?: number | null;
  healthInsurance?: number | null;
  pensionEmployee?: number | null;
  pensionEmployer?: number | null;
  pensionSeverance?: number | null;
  isLatest: boolean;
  /** True when extraction flagged this payslip (needs_review or missing critical fields). */
  needsReview?: boolean;
  /** Critical fields the OCR/LLM could not extract (e.g. grossSalary, netSalary). */
  missingCritical?: string[];
  downloadUrl?: string | null;
};

export type PayslipHistoryStats = {
  year: number | null;
  averageNet: number;
  averageGross: number;
  totalPayslips: number;
  monthsPresent: number[];
  missingMonths: number[];
  coveragePercent: number;
  grossTotal: number;
  netTotal: number;
  taxPaidTotal: number;
};

export type PayslipYearStat = {
  year: number;
  averageNet: number;
  averageGross: number;
  monthsPresent: number[];
  missingMonths: number[];
  coveragePercent: number;
  grossTotal: number;
  netTotal: number;
  taxPaidTotal: number;
};

export type PayslipTaxAdjustment = {
  year: number;
  status: "complete" | "partial" | "insufficient_data";
  expectedAnnualTax: number;
  actualTaxWithheld: number;
  estimatedRefundOrDue: number;
  confidence: number;
  assumptions: string[];
};

export type PayslipHistoryResponse = {
  stats: PayslipHistoryStats;
  items: PayslipHistoryItem[];
  years: PayslipYearStat[];
  selectedYear: number | null;
  taxAdjustment: PayslipTaxAdjustment | null;
  dataQualityWarnings: string[];
};

/** Line item for earnings or deductions (for detail view; will come from OCR/API) */
export type PayslipLineItem = {
  label: string;
  amount: number;
};

/** Backend status of the extraction pipeline for this payslip. */
export type PayslipExtractionStatus =
  | "completed"
  | "needs_review"
  | "failed"
  | "processing"
  | "pending";

/** Single payslip detail – structure ready for backend OCR/API */
export type PayslipDetail = {
  id: string;
  periodLabel: string;
  periodDate: string;
  paymentDate?: string;
  /** Extraction pipeline outcome; "needs_review" means the schema gate flagged at least one critical field. */
  extractionStatus?: PayslipExtractionStatus;
  /** Human-readable explanation when extractionStatus is "needs_review" or "failed". */
  extractionMessage?: string | null;
  employerName?: string;
  employeeName?: string;
  employeeId?: string;
  /** אחוז משרה (0–100) */
  jobPercent?: number | null;
  /** ימי עבודה בחודש */
  workingDays?: number | null;
  /** שעות עבודה */
  workingHours?: number | null;
  /** יתרת/ימי חופשה */
  vacationDays?: number | null;
  /** יתרת/ימי מחלה */
  sickDays?: number | null;
  earnings: PayslipLineItem[];
  deductions: PayslipLineItem[];
  grossSalary: number | null;
  netSalary: number | null;
  /** הפרשת עובד לפנסיה */
  pensionEmployee?: number | null;
  /** הפרשת מעסיק לפנסיה */
  pensionEmployer?: number | null;
  /** סה"כ שנכנס לקרן הפנסיה (עובד + מעסיק) */
  pensionTotal?: number | null;
  /** נקודות זיכוי ממס */
  taxCreditPoints?: number | null;
  /** זיכוי אישי — סכום הפחתת מס בש"ח */
  personalCredit?: number | null;
  downloadUrl?: string | null;
};
