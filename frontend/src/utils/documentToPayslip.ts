/**
 * Payslip mapping layer: converts backend document + analysisData into UI-facing payslip types.
 * Keeps raw backend shape internal; only PayslipHistoryItem / PayslipDetail are consumed by UI.
 */

import type { DocumentItem } from "../api/documents.api";
import type {
  PayslipDetail,
  PayslipHistoryItem,
  PayslipHistoryResponse,
  PayslipHistoryStats,
  PayslipLineItem,
} from "../types/payslip";

// ---------------------------------------------------------------------------
// Minimal backend analysisData shape (mapper layer only – not exposed to UI)
// ---------------------------------------------------------------------------

interface DocumentPayslipAnalysis {
  period?: { month?: string };
  salary?: {
    gross_total?: number;
    net_payable?: number;
    components?: Array<{ type?: string; amount?: number }>;
  };
  deductions?: {
    mandatory?: {
      total?: number;
      income_tax?: number;
      national_insurance?: number;
      health_insurance?: number;
    };
  };
  contributions?: {
    pension?: { employee?: number; employer?: number };
    study_fund?: { employee?: number; employer?: number };
  };
  parties?: {
    employer_name?: string;
    employee_name?: string;
    employee_id?: string;
  };
}

function getAnalysisData(doc: DocumentItem): DocumentPayslipAnalysis | null {
  const raw = doc.analysisData;
  if (raw == null || typeof raw !== "object") return null;
  return raw as DocumentPayslipAnalysis;
}

// ---------------------------------------------------------------------------
// Valid payslip detection: include every completed document with analysisData
// ---------------------------------------------------------------------------

export function isPayslipDocument(doc: DocumentItem): boolean {
  if (doc.status !== "completed") return false;
  const analysis = getAnalysisData(doc);
  return analysis !== null && typeof analysis === "object";
}

// ---------------------------------------------------------------------------
// Sorting by latest payslip (period desc, then uploadedAt desc)
// ---------------------------------------------------------------------------

function parsePeriodMonth(month?: string): number {
  if (!month || typeof month !== "string") return 0;
  const [y, m] = month.split("-").map(Number);
  if (!Number.isFinite(y) || !Number.isFinite(m)) return 0;
  return y * 12 + (m - 1);
}

export function sortPayslipDocuments(docs: DocumentItem[]): DocumentItem[] {
  return [...docs].sort((a, b) => {
    const analysisA = getAnalysisData(a);
    const analysisB = getAnalysisData(b);
    const periodA = parsePeriodMonth(analysisA?.period?.month);
    const periodB = parsePeriodMonth(analysisB?.period?.month);
    if (periodA !== periodB) return periodB - periodA;
    const uploadedA = a.uploadedAt ? new Date(a.uploadedAt).getTime() : 0;
    const uploadedB = b.uploadedAt ? new Date(b.uploadedAt).getTime() : 0;
    return uploadedB - uploadedA;
  });
}

// ---------------------------------------------------------------------------
// Period parsing and formatting
// ---------------------------------------------------------------------------

const FALLBACK_PERIOD_LABEL = "תלוש משכורת";
const PERIOD_LOCALE = "he-IL";

/** Format "YYYY-MM" as Hebrew month + year (e.g. "מרץ 2025"). Invalid/missing → fallback label. */
export function formatPeriodLabel(month?: string): string {
  if (!month || typeof month !== "string") return FALLBACK_PERIOD_LABEL;
  const [y, m] = month.split("-").map(Number);
  if (!Number.isFinite(y) || !Number.isFinite(m) || m < 1 || m > 12) return FALLBACK_PERIOD_LABEL;
  const date = new Date(y, m - 1, 1);
  if (Number.isNaN(date.getTime())) return FALLBACK_PERIOD_LABEL;
  return new Intl.DateTimeFormat(PERIOD_LOCALE, {
    month: "long",
    year: "numeric",
  }).format(date);
}

/** "YYYY-MM" → "YYYY-MM-01" for periodDate. Invalid/missing → "". */
export function periodMonthToDate(month?: string): string {
  if (!month || typeof month !== "string") return "";
  const [y, m] = month.split("-").map(Number);
  if (!Number.isFinite(y) || !Number.isFinite(m) || m < 1 || m > 12) return "";
  const mm = String(m).padStart(2, "0");
  return `${y}-${mm}-01`;
}

// ---------------------------------------------------------------------------
// Hebrew labels for earnings and deductions
// ---------------------------------------------------------------------------

const EARNINGS_LABELS: Record<string, string> = {
  base_salary: "משכורת בסיס",
  global_overtime: "שעות נוספות",
  travel_expenses: "נסיעות",
};

const DEDUCTION_LABELS: Record<string, string> = {
  income_tax: "מס הכנסה",
  national_insurance: "ביטוח לאומי",
  health_insurance: "ביטוח בריאות",
  pension_employee: "הפקדה לפנסיה (עובד)",
  pension_employer: "הפקדה לפנסיה (מעסיק)",
  study_fund_employee: "קרן השתלמות (עובד)",
  study_fund_employer: "קרן השתלמות (מעסיק)",
};

function earningsLabel(type?: string): string {
  if (!type) return "פריט אחר";
  return EARNINGS_LABELS[type] ?? type;
}

function deductionLabel(key: string): string {
  return DEDUCTION_LABELS[key] ?? key;
}

// ---------------------------------------------------------------------------
// Map analysisData → earnings / deductions line items
// ---------------------------------------------------------------------------

function mapEarnings(analysis: DocumentPayslipAnalysis): PayslipLineItem[] {
  const components = analysis.salary?.components;
  if (Array.isArray(components) && components.length > 0) {
    return components
      .filter((c) => Number.isFinite(c.amount))
      .map((c) => ({ label: earningsLabel(c.type), amount: c.amount as number }));
  }
  const gross = analysis.salary?.gross_total;
  if (Number.isFinite(gross)) {
    return [{ label: "שכר ברוטו", amount: gross as number }];
  }
  return [];
}

function mapDeductions(analysis: DocumentPayslipAnalysis): PayslipLineItem[] {
  const items: PayslipLineItem[] = [];
  const mandatory = analysis.deductions?.mandatory;
  if (mandatory) {
    if (Number.isFinite(mandatory.income_tax)) {
      items.push({ label: deductionLabel("income_tax"), amount: mandatory.income_tax as number });
    }
    if (Number.isFinite(mandatory.national_insurance)) {
      items.push({
        label: deductionLabel("national_insurance"),
        amount: mandatory.national_insurance as number,
      });
    }
    if (Number.isFinite(mandatory.health_insurance)) {
      items.push({
        label: deductionLabel("health_insurance"),
        amount: mandatory.health_insurance as number,
      });
    }
  }
  const pension = analysis.contributions?.pension;
  if (Number.isFinite(pension?.employee)) {
    items.push({ label: deductionLabel("pension_employee"), amount: pension!.employee! });
  }
  if (Number.isFinite(pension?.employer)) {
    items.push({ label: deductionLabel("pension_employer"), amount: pension!.employer! });
  }
  const study = analysis.contributions?.study_fund;
  if (Number.isFinite(study?.employee)) {
    items.push({ label: deductionLabel("study_fund_employee"), amount: study!.employee! });
  }
  if (Number.isFinite(study?.employer)) {
    items.push({ label: deductionLabel("study_fund_employer"), amount: study!.employer! });
  }
  return items;
}

// ---------------------------------------------------------------------------
// Document → PayslipHistoryItem
// ---------------------------------------------------------------------------

export function documentToPayslipItem(doc: DocumentItem, index: number): PayslipHistoryItem {
  const analysis = getAnalysisData(doc)!;
  const month = analysis.period?.month;
  const periodLabel = formatPeriodLabel(month);
  const periodDate = periodMonthToDate(month) || "";
  const gross = analysis.salary?.gross_total;
  const net = analysis.salary?.net_payable;
  const isLatest = index === 0;

  return {
    id: doc._id,
    periodLabel,
    periodDate,
    netSalary: Number.isFinite(net) ? (net as number) : null,
    grossSalary: Number.isFinite(gross) ? (gross as number) : null,
    isLatest,
    downloadUrl: null,
  };
}

// ---------------------------------------------------------------------------
// Document → PayslipDetail
// ---------------------------------------------------------------------------

export function documentToPayslipDetail(doc: DocumentItem): PayslipDetail | null {
  if (!isPayslipDocument(doc)) return null;
  const analysis = getAnalysisData(doc)!;
  const month = analysis.period?.month;
  const gross = analysis.salary?.gross_total;
  const net = analysis.salary?.net_payable;

  return {
    id: doc._id,
    periodLabel: formatPeriodLabel(month),
    periodDate: periodMonthToDate(month) || "",
    employerName: analysis.parties?.employer_name ?? undefined,
    employeeName: analysis.parties?.employee_name ?? undefined,
    employeeId: analysis.parties?.employee_id ?? undefined,
    earnings: mapEarnings(analysis),
    deductions: mapDeductions(analysis),
    grossSalary: Number.isFinite(gross) ? (gross as number) : null,
    netSalary: Number.isFinite(net) ? (net as number) : null,
    downloadUrl: null,
  };
}

// ---------------------------------------------------------------------------
// Stats and full history from document list
// ---------------------------------------------------------------------------

export function computePayslipStats(items: PayslipHistoryItem[]): PayslipHistoryStats {
  const n = items.length;
  if (n === 0) {
    return { averageNet: 0, averageGross: 0, totalPayslips: 0 };
  }
  const sumNet = items.reduce((s, i) => s + (i.netSalary ?? 0), 0);
  const sumGross = items.reduce((s, i) => s + (i.grossSalary ?? 0), 0);
  return {
    averageNet: Math.round(sumNet / n),
    averageGross: Math.round(sumGross / n),
    totalPayslips: n,
  };
}

/**
 * Builds PayslipHistoryResponse from a list of documents: filters to valid payslips,
 * sorts by latest, maps to items, and computes stats.
 */
export function getPayslipHistoryFromDocuments(docs: DocumentItem[]): PayslipHistoryResponse {
  const valid = docs.filter(isPayslipDocument);
  const sorted = sortPayslipDocuments(valid);
  const items = sorted.map((doc, index) => documentToPayslipItem(doc, index));
  const stats = computePayslipStats(items);
  return { stats, items };
}
