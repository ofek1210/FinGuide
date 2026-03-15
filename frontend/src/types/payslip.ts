export type PayslipHistoryItem = {
  id: string;
  periodLabel: string;
  periodDate: string;
  netSalary: number | null;
  grossSalary: number | null;
  isLatest: boolean;
  downloadUrl?: string | null;
};

export type PayslipHistoryStats = {
  averageNet: number;
  averageGross: number;
  totalPayslips: number;
};

export type PayslipHistoryResponse = {
  stats: PayslipHistoryStats;
  items: PayslipHistoryItem[];
};

/** Line item for earnings or deductions (for detail view; will come from OCR/API) */
export type PayslipLineItem = {
  label: string;
  amount: number;
};

/** Single payslip detail – structure ready for backend OCR/API */
export type PayslipDetail = {
  id: string;
  periodLabel: string;
  periodDate: string;
  paymentDate?: string;
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
  downloadUrl?: string | null;
};
