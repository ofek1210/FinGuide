import type { DocumentItem } from "../api/documents.api";
import type { PayslipDetail } from "../types/payslip";
import {
  documentToPayslipDetail,
  isPayslipDocument,
  parseCanonicalPeriod,
  sortPayslipDocuments,
} from "./documentToPayslip";
import {
  enrichPayslipFromDoc,
  buildMoneyFlow,
  avgEnriched,
  type MoneyFlow,
} from "./payslipEnrichment";

const MIN_PLAUSIBLE_YEAR = 2015;

export type PayslipRow = PayslipDetail & {
  uploadedAt?: string;
  displayLabel: string;
};

export type PayslipAnalysisSummary = {
  count: number;
  avgGross: number | null;
  avgNet: number | null;
  avgTax: number | null;
  avgNationalInsurance: number | null;
  avgHealthInsurance: number | null;
  avgPensionEmployee: number | null;
  avgPensionEmployer: number | null;
  avgPensionTotal: number | null;
  avgStudyFundEmployee: number | null;
  avgStudyFundEmployer: number | null;
  avgStudyFundTotal: number | null;
  avgVacationDays: number | null;
  avgSickDays: number | null;
  breakdown: Array<{ label: string; totalAmount: number }>;
  moneyFlow: MoneyFlow | null;
  rows: PayslipRow[];
};

function isPlausiblePeriodLabel(label: string): boolean {
  const match = label.match(/\d{4}/);
  if (!match) return false;
  const year = Number(match[0]);
  const now = new Date().getFullYear();
  return year >= MIN_PLAUSIBLE_YEAR && year <= now + 1;
}

function formatUploadLabel(uploadedAt?: string): string {
  if (!uploadedAt) return "תלוש שהועלה";
  try {
    return `הועלה ${new Date(uploadedAt).toLocaleDateString("he-IL", { day: "numeric", month: "short", year: "numeric" })}`;
  } catch {
    return "תלוש שהועלה";
  }
}

function displayLabelFor(doc: DocumentItem, detail: PayslipDetail): string {
  if (isPlausiblePeriodLabel(detail.periodLabel)) return detail.periodLabel;
  return formatUploadLabel(doc.uploadedAt || doc.createdAt);
}

function periodKeyFromDoc(doc: DocumentItem): string | null {
  const parsed = parseCanonicalPeriod(
    (doc.analysisData as { period?: { month?: string } } | undefined)?.period?.month,
  );
  if (parsed) return parsed.canonical;

  const meta = doc.metadata;
  if (meta?.periodYear && meta?.periodMonth) {
    return `${meta.periodYear}-${String(meta.periodMonth).padStart(2, "0")}`;
  }
  return null;
}

function docUploadTime(doc: DocumentItem): number {
  return new Date(doc.uploadedAt || doc.createdAt || 0).getTime();
}

/** Payslip usable for KPI / money-flow analysis. */
export function isAnalyzablePayslip(doc: DocumentItem): boolean {
  if (!isPayslipDocument(doc)) return false;
  const cat = doc.metadata?.category;
  if (cat && cat !== "payslip") return false;
  return true;
}

/**
 * Pick the N most recent payslips by salary period (dedupes same month).
 */
export function selectRecentPayslipDocuments(docs: DocumentItem[], limit = 3): DocumentItem[] {
  const valid = docs.filter(isAnalyzablePayslip);
  const byPeriod = new Map<string, DocumentItem>();
  const withoutPeriod: DocumentItem[] = [];

  for (const doc of valid) {
    const key = periodKeyFromDoc(doc);
    if (!key) {
      withoutPeriod.push(doc);
      continue;
    }
    const existing = byPeriod.get(key);
    if (!existing || docUploadTime(doc) >= docUploadTime(existing)) {
      byPeriod.set(key, doc);
    }
  }

  const deduped = sortPayslipDocuments([...byPeriod.values()]);
  const fallback = [...withoutPeriod].sort((a, b) => docUploadTime(b) - docUploadTime(a));
  const merged = [...deduped, ...fallback];
  if (limit == null || limit <= 0) return merged;
  return merged.slice(0, limit);
}

function avgContributionTotal(
  enriched: ReturnType<typeof enrichPayslipFromDoc>[],
  employeeKey: "pensionEmployee" | "studyFundEmployee",
  employerKey: "pensionEmployer" | "studyFundEmployer",
): number | null {
  const totals = enriched
    .map(e => {
      const employee = e[employeeKey];
      const employer = e[employerKey];
      if (employee == null && employer == null) return null;
      return Math.round(((employee ?? 0) + (employer ?? 0)) * 100) / 100;
    })
    .filter((v): v is number => v != null);
  if (!totals.length) return null;
  return Math.round((totals.reduce((sum, v) => sum + v, 0) / totals.length) * 100) / 100;
}

/** Use all analyzable payslips (no cap) for dashboard KPIs. */
export const PAYSLIP_ANALYSIS_ALL = 0;

export function buildAnalysisSummary(docs: DocumentItem[], limit = PAYSLIP_ANALYSIS_ALL): PayslipAnalysisSummary {
  const recent = selectRecentPayslipDocuments(docs, limit);
  const enriched = recent.map(enrichPayslipFromDoc);
  const moneyFlow = buildMoneyFlow(enriched);

  const rows: PayslipRow[] = [];
  for (let i = 0; i < recent.length; i++) {
    const doc = recent[i]!;
    const detail = documentToPayslipDetail(doc);
    if (!detail) continue;
    const e = enriched[i];
    rows.push({
      ...detail,
      grossSalary: e?.grossSalary ?? detail.grossSalary,
      netSalary: e?.netSalary ?? detail.netSalary,
      vacationDays: e?.vacationDays ?? detail.vacationDays,
      sickDays: e?.sickDays ?? detail.sickDays,
      uploadedAt: doc.uploadedAt || doc.createdAt,
      displayLabel: displayLabelFor(doc, detail),
    });
  }

  const breakdown = moneyFlow
    ? moneyFlow.items.map(i => ({ label: i.label, totalAmount: i.totalAmount }))
    : [];

  return {
    count: rows.length,
    avgGross: moneyFlow?.avgGross ?? avgEnriched(enriched, "grossSalary"),
    avgNet: moneyFlow?.avgNet ?? avgEnriched(enriched, "netSalary"),
    avgTax: avgEnriched(enriched, "tax"),
    avgNationalInsurance: avgEnriched(enriched, "nationalInsurance"),
    avgHealthInsurance: avgEnriched(enriched, "healthInsurance"),
    avgPensionEmployee: avgEnriched(enriched, "pensionEmployee"),
    avgPensionEmployer: avgEnriched(enriched, "pensionEmployer"),
    avgPensionTotal: avgContributionTotal(enriched, "pensionEmployee", "pensionEmployer"),
    avgStudyFundEmployee: avgEnriched(enriched, "studyFundEmployee"),
    avgStudyFundEmployer: avgEnriched(enriched, "studyFundEmployer"),
    avgStudyFundTotal: avgContributionTotal(enriched, "studyFundEmployee", "studyFundEmployer"),
    avgVacationDays: avgEnriched(enriched, "vacationDays"),
    avgSickDays: avgEnriched(enriched, "sickDays"),
    breakdown,
    moneyFlow,
    rows,
  };
}

export async function fetchLastPayslipAnalysis(limit = PAYSLIP_ANALYSIS_ALL): Promise<PayslipAnalysisSummary> {
  const { listRecentPayslips } = await import("../api/documents.api");
  const response = await listRecentPayslips(limit);
  if (response.success && response.data?.documents) {
    return buildAnalysisSummary(response.data.documents, limit);
  }
  if (!response.success) {
    throw new Error(response.message || "לא הצלחנו לטעון מסמכים");
  }
  return buildAnalysisSummary([], limit);
}

export type { MoneyFlow, MoneyFlowItem } from "./payslipEnrichment";
