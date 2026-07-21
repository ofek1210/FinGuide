import { formatCurrencyOrDash } from "./formatters";
import type {
  PensionInsightBenchmarkDTO,
  PensionInsightEstimatedImpactDTO,
  PensionStructuredInsightDTO,
  PensionInsightSeverity,
} from "../api/pension.api";

export const INSIGHT_SEVERITY: Record<
  PensionInsightSeverity,
  { label: string; tone: "peach" | "butter" | "lavender" | "mint" }
> = {
  high: { label: "גבוהה", tone: "peach" },
  medium: { label: "בינונית", tone: "butter" },
  low: { label: "נמוכה", tone: "lavender" },
  info: { label: "מידע", tone: "mint" },
};

export const INSIGHT_TONE: Record<string, [string, string]> = {
  peach: ["var(--peach-soft)", "var(--peach-ink)"],
  butter: ["var(--butter-soft)", "var(--butter-ink)"],
  lavender: ["var(--lav-100)", "var(--lav-600)"],
  mint: ["var(--mint-soft)", "var(--mint-ink)"],
};

export const INSIGHT_CATEGORY_LABELS: Record<string, string> = {
  fund_ranking: "דירוג מול קבוצה",
  performance_consistency: "עקביות ביצועים",
  return_vs_risk: "תשואה מול סיכון",
  track_fit: "התאמת מסלול",
  asset_allocation: "הרכב נכסים",
  net_accumulation: "צבירה נטו",
  fund_size: "גודל מסלול",
  net_return_estimate: "תשואה נטו משוערת",
  fee_cost_projection: "עלות דמי ניהול",
  inactive_fund: "קרן לא פעילה",
  contribution_gap: "הפקדות",
  insurance_coverage: "כיסוי ביטוחי",
  survivor_coverage_fit: "התאמת כיסוי שארים",
};

export function hasDisplayValue(value: unknown): boolean {
  if (value == null) return false;
  if (typeof value === "string") return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "number") return Number.isFinite(value);
  return true;
}

export function insightCategoryLabel(category: string): string {
  return INSIGHT_CATEGORY_LABELS[category] ?? category;
}

export function formatBenchmarkLines(benchmark?: PensionInsightBenchmarkDTO | null): string[] {
  if (!benchmark) return [];
  const lines: string[] = [];
  if (hasDisplayValue(benchmark.group)) lines.push(`קבוצת השוואה: ${benchmark.group}`);
  if (hasDisplayValue(benchmark.percentile)) lines.push(`אחוזון: ${benchmark.percentile}`);
  if (hasDisplayValue(benchmark.median)) {
    const med = benchmark.median!;
    lines.push(typeof med === "number" && med <= 1 ? `חציון: ${(med * 100).toFixed(2)}%` : `חציון: ${med}`);
  }
  if (hasDisplayValue(benchmark.average)) {
    const avg = benchmark.average!;
    lines.push(typeof avg === "number" && avg <= 1 ? `ממוצע: ${(avg * 100).toFixed(2)}%` : `ממוצע: ${avg}`);
  }
  if (hasDisplayValue(benchmark.return1YPercentile)) lines.push(`אחוזון תשואה לשנה: ${benchmark.return1YPercentile}`);
  if (hasDisplayValue(benchmark.feePercentile)) lines.push(`אחוזון דמי ניהול: ${benchmark.feePercentile}`);
  if (hasDisplayValue(benchmark.riskPercentile)) lines.push(`אחוזון סיכון: ${benchmark.riskPercentile}`);
  if (hasDisplayValue(benchmark.foreignMedian)) lines.push(`חציון חשיפה לחו"ל: ${benchmark.foreignMedian}%`);
  return lines;
}

export function formatEstimatedImpactLines(impact?: PensionInsightEstimatedImpactDTO | null): string[] {
  if (!impact) return [];
  const lines: string[] = [];
  if (hasDisplayValue(impact.annual)) lines.push(`השפעה שנתית משוערת: ${formatCurrencyOrDash(impact.annual)}`);
  if (hasDisplayValue(impact.retirement)) lines.push(`השפעה עד פרישה: ${formatCurrencyOrDash(impact.retirement)}`);
  return lines;
}

export function sortStructuredInsights(insights: PensionStructuredInsightDTO[]): PensionStructuredInsightDTO[] {
  const order: Record<PensionInsightSeverity, number> = { high: 0, medium: 1, low: 2, info: 3 };
  return [...insights].sort((a, b) => (order[a.severity] ?? 4) - (order[b.severity] ?? 4));
}
