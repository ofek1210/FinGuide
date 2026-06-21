import { listDocuments, type DocumentItem } from "../api/documents.api";
import type { PayslipDetail } from "../types/payslip";
import { documentToPayslipDetail, isPayslipDocument } from "./documentToPayslip";
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
  avgStudyFundEmployee: number | null;
  avgVacationDays: number | null;
  avgSickDays: number | null;
  breakdown: Array<{ label: string; avgAmount: number }>;
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

export function buildAnalysisSummary(docs: DocumentItem[], limit = 3): PayslipAnalysisSummary {
  const valid = docs.filter((doc) => {
    if (!isPayslipDocument(doc)) return false;
    const cat = doc.metadata?.category;
    if (cat && cat !== "payslip") return false;
    return true;
  });

  const byUpload = [...valid].sort((a, b) => {
    const ta = new Date(a.uploadedAt || a.createdAt || 0).getTime();
    const tb = new Date(b.uploadedAt || b.createdAt || 0).getTime();
    return tb - ta;
  });

  const recent = byUpload.slice(0, limit);
  const enriched = recent.map(enrichPayslipFromDoc);
  const moneyFlow = buildMoneyFlow(enriched);

  const rows: PayslipRow[] = recent
    .map((doc, i) => {
      const detail = documentToPayslipDetail(doc);
      if (!detail) return null;
      const e = enriched[i];
      return {
        ...detail,
        grossSalary: e?.grossSalary ?? detail.grossSalary,
        netSalary: e?.netSalary ?? detail.netSalary,
        vacationDays: e?.vacationDays ?? detail.vacationDays,
        sickDays: e?.sickDays ?? detail.sickDays,
        uploadedAt: doc.uploadedAt || doc.createdAt,
        displayLabel: displayLabelFor(doc, detail),
      };
    })
    .filter((r): r is PayslipRow => r !== null);

  const breakdown = moneyFlow
    ? moneyFlow.items.map(i => ({ label: i.label, avgAmount: i.avgAmount }))
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
    avgStudyFundEmployee: avgEnriched(enriched, "studyFundEmployee"),
    avgVacationDays: avgEnriched(enriched, "vacationDays"),
    avgSickDays: avgEnriched(enriched, "sickDays"),
    breakdown,
    moneyFlow,
    rows,
  };
}

export async function fetchLastPayslipAnalysis(limit = 3): Promise<PayslipAnalysisSummary> {
  const response = await listDocuments();
  if (!response.success) {
    throw new Error(response.message || "לא הצלחנו לטעון מסמכים");
  }
  return buildAnalysisSummary(response.data ?? [], limit);
}

export type { MoneyFlow, MoneyFlowItem } from "./payslipEnrichment";
