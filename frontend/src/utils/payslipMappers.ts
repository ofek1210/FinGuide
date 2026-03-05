import type { DocumentItem } from "../api/documents.api";
import type {
  PayslipDetail,
  PayslipHistoryItem,
  PayslipHistoryResponse,
  PayslipLineItem,
} from "../types/payslip";

/** Backend analysisData schema 1.5 (from payslipOcr.js) */
export interface AnalysisDataSchema15 {
  schema_version?: string;
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
  parties?: {
    employer_name?: string;
    employee_name?: string;
    employee_id?: string;
  };
}

const HEBREW_MONTHS: Record<number, string> = {
  1: "ינואר",
  2: "פברואר",
  3: "מרץ",
  4: "אפריל",
  5: "מאי",
  6: "יוני",
  7: "יולי",
  8: "אוגוסט",
  9: "ספטמבר",
  10: "אוקטובר",
  11: "נובמבר",
  12: "דצמבר",
};

const COMPONENT_TYPE_LABELS: Record<string, string> = {
  base_salary: "משכורת בסיס",
  global_overtime: "שעות נוספות",
  travel_expenses: "נסיעות",
};

const DEDUCTION_LABELS: Record<string, string> = {
  income_tax: "מס הכנסה",
  national_insurance: "ביטוח לאומי",
  health_insurance: "ביטוח בריאות",
};

function periodMonthToLabel(monthStr: string | undefined): string {
  if (!monthStr || !/^\d{4}-\d{2}$/.test(monthStr)) return "תלוש משכורת";
  const [y, m] = monthStr.split("-").map(Number);
  const monthName = HEBREW_MONTHS[m];
  return monthName ? `${monthName} ${y}` : `${monthStr}`;
}

function periodMonthToDate(monthStr: string | undefined): string {
  if (!monthStr || !/^\d{4}-\d{2}$/.test(monthStr)) return "";
  return `${monthStr}-01`;
}

function getDownloadUrl(documentId: string, baseUrl: string): string {
  const base = baseUrl.replace(/\/$/, "");
  const path = base.startsWith("http") ? `${base}/api/documents/${documentId}/download` : `/api/documents/${documentId}/download`;
  return path;
}

/** Parse number from API (might be string from JSON/Mongo). */
function toNum(v: unknown): number {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = Number(v.replace(/\s|,/g, ""));
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

/**
 * Map backend document (with analysisData schema 1.5) to PayslipDetail.
 * Use getDocument(id) response; returns fallback if analysisData missing or invalid.
 */
export function documentToPayslipDetail(
  document: DocumentItem,
  options?: { apiBaseUrl?: string }
): PayslipDetail {
  const id = document._id;
  const data = document.analysisData as AnalysisDataSchema15 | undefined;
  const apiBaseUrl = options?.apiBaseUrl ?? "";
  const downloadUrl = getDownloadUrl(id, apiBaseUrl);

  if (!data?.salary || typeof data.salary !== "object") {
    if (import.meta.env?.DEV && document.analysisData) {
      console.warn("[payslip] document has no salary in analysisData:", {
        keys: Object.keys(document.analysisData as object),
        sample: JSON.stringify(document.analysisData).slice(0, 300),
      });
    }
    return {
      id,
      periodLabel: "תלוש משכורת",
      periodDate: "",
      earnings: [],
      deductions: [],
      grossSalary: 0,
      netSalary: 0,
      downloadUrl,
    };
  }

  const month = data.period?.month;
  const periodLabel = periodMonthToLabel(month);
  const periodDate = periodMonthToDate(month);

  const earnings: PayslipLineItem[] = (data.salary.components ?? [])
    .filter((c) => c != null && (typeof c.amount === "number" || typeof c.amount === "string"))
    .map((c) => {
      const amount = toNum(c.amount);
      return amount >= 0
        ? { label: COMPONENT_TYPE_LABELS[(c as { type?: string }).type ?? ""] ?? (c as { type?: string }).type ?? "הכנסה", amount }
        : null;
    })
    .filter((x): x is PayslipLineItem => x != null);

  const mandatory = data.deductions?.mandatory ?? {};
  const deductions: PayslipLineItem[] = [];
  const incomeTax = toNum(mandatory.income_tax);
  const nationalIns = toNum(mandatory.national_insurance);
  const healthIns = toNum(mandatory.health_insurance);
  if (incomeTax > 0) deductions.push({ label: DEDUCTION_LABELS.income_tax, amount: incomeTax });
  if (nationalIns > 0) deductions.push({ label: DEDUCTION_LABELS.national_insurance, amount: nationalIns });
  if (healthIns > 0) deductions.push({ label: DEDUCTION_LABELS.health_insurance, amount: healthIns });

  const grossSalary = toNum(data.salary.gross_total);
  const netSalary = toNum(data.salary.net_payable);

  if (import.meta.env?.DEV && (grossSalary === 0 || netSalary === 0)) {
    const raw = (document.analysisData as { raw?: { rawText?: string; extractionMethod?: string } })?.raw;
    const rawTextSnippet = raw?.rawText?.slice(0, 1200) ?? "(no rawText in analysisData)";
    console.warn(
      "[payslip] ברוטו/נטו לא זוהו. הטקסט שהבאק חילץ מהתלוש (להשוואה ל'שכר ברוטו' / 'שכר נטו לתשלום'):",
      rawTextSnippet
    );
    console.log("[payslip] raw salary:", {
      gross_total: data.salary.gross_total,
      net_payable: data.salary.net_payable,
      extractionMethod: raw?.extractionMethod,
    });
  }

  return {
    id,
    periodLabel,
    periodDate,
    employerName: data.parties?.employer_name,
    employeeName: data.parties?.employee_name,
    employeeId: data.parties?.employee_id,
    earnings,
    deductions,
    grossSalary,
    netSalary,
    downloadUrl,
  };
}

/**
 * Map list of documents (status completed with analysisData) to PayslipHistoryResponse.
 * Filters by status === 'completed' and valid analysisData; sorts by period descending.
 */
export function documentsToPayslipHistoryResponse(
  documents: DocumentItem[],
  options?: { apiBaseUrl?: string }
): PayslipHistoryResponse {
  if (!documents || !Array.isArray(documents)) {
    return { stats: { averageNet: 0, averageGross: 0, totalPayslips: 0 }, items: [] };
  }
  const completed = documents.filter((d) => {
    if (d.status !== "completed" || !d.analysisData || typeof d.analysisData !== "object") return false;
    const salary = (d.analysisData as AnalysisDataSchema15).salary;
    return salary != null && typeof salary === "object";
  });

  const items: PayslipHistoryItem[] = completed
    .map((doc) => {
      const detail = documentToPayslipDetail(doc, options);
      const periodSort = (doc.analysisData as AnalysisDataSchema15)?.period?.month ?? "";
      return { doc, detail, periodSort };
    })
    .sort((a, b) => b.periodSort.localeCompare(a.periodSort))
    .map(({ detail }, index) => ({
      id: detail.id,
      periodLabel: detail.periodLabel,
      periodDate: detail.periodDate,
      netSalary: detail.netSalary,
      grossSalary: detail.grossSalary,
      isLatest: index === 0,
      downloadUrl: detail.downloadUrl ?? null,
    }));

  const totalPayslips = items.length;
  const averageNet = totalPayslips ? Math.round(items.reduce((s, i) => s + i.netSalary, 0) / totalPayslips) : 0;
  const averageGross = totalPayslips ? Math.round(items.reduce((s, i) => s + i.grossSalary, 0) / totalPayslips) : 0;

  return {
    stats: { averageNet, averageGross, totalPayslips },
    items,
  };
}
