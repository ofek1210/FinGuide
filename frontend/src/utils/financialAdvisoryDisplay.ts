import type {
  CardOutcome,
  ConfidenceLevel,
  FeeCardMetrics,
  MarketCardMetrics,
  PrimaryRecommendation,
  RecommendationCard,
  SuitabilityCardMetrics,
  ThreeCardAdvisoryData,
} from "../api/financialAdvisory.types";
import { formatCurrencyOrDash } from "./formatters";

export const CARD_SLOT_ORDER = [
  "management_fees",
  "track_suitability",
  "market_comparison",
] as const;

export const OUTCOME_LABELS: Record<CardOutcome, string> = {
  actionable: "ניתן לפעול",
  monitoring: "מעקב",
  information_required: "נדרש מידע",
  insufficient_data: "נתונים לא מספיקים",
};

export const OUTCOME_TONE: Record<CardOutcome, { bg: string; fg: string; border: string }> = {
  actionable: { bg: "var(--peach-soft)", fg: "var(--peach-ink)", border: "rgba(214,120,80,.25)" },
  monitoring: { bg: "var(--mint-soft)", fg: "var(--mint-ink)", border: "rgba(47,156,98,.22)" },
  information_required: { bg: "var(--butter-soft)", fg: "var(--butter-ink)", border: "rgba(185,139,22,.28)" },
  insufficient_data: { bg: "var(--surface-sunken)", fg: "var(--text-muted)", border: "var(--border-hair)" },
};

export const CONFIDENCE_TONE: Record<ConfidenceLevel, string> = {
  high: "var(--mint-ink)",
  medium: "var(--butter-ink)",
  low: "var(--lav-600)",
  insufficient_data: "var(--text-faint)",
};

export const BLOCKER_LABELS: Record<string, string> = {
  missing_risk_tolerance: "העדפת סיכון בפרופיל",
  missing_age: "גיל / אופק פרישה",
  missing_product_horizon: "אופק משיכה / נזילות",
};

export const RISK_LABELS: Record<string, string> = {
  low: "נמוך",
  medium: "בינוני",
  high: "גבוה",
};

export function hasDisplayValue(value: unknown): boolean {
  if (value == null) return false;
  if (typeof value === "number") return Number.isFinite(value);
  if (typeof value === "string") {
    const t = value.trim();
    if (!t || t === "undefined" || t === "null" || t === "Unknown") return false;
    return true;
  }
  if (Array.isArray(value)) return value.length > 0;
  return true;
}

export function formatPercent(value: number | null | undefined, digits = 2): string | null {
  if (!hasDisplayValue(value)) return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  const pct = n <= 1 && n >= 0 ? n * 100 : n;
  return `${pct.toFixed(digits)}%`;
}

export function formatRankLine(metrics: MarketCardMetrics | undefined): string | null {
  if (!metrics?.userRank || !metrics?.rankedRecordsInGroup) return null;
  return `דירוג ${metrics.userRank} מתוך ${metrics.rankedRecordsInGroup} בקבוצת ההשוואה הרלוונטית`;
}

export function sumAnnualSavings(data: ThreeCardAdvisoryData | null | undefined): number {
  if (!data) return 0;
  const feeCard = data.recommendationCards.find(c => c.slot === "management_fees");
  const feeMetrics = feeCard?.metrics as FeeCardMetrics | undefined;
  if (hasDisplayValue(feeMetrics?.estimatedAnnualSaving)) {
    return feeMetrics!.estimatedAnnualSaving!;
  }
  return (data.primaryRecommendations ?? []).reduce((sum, rec) => {
    if (rec.financialImpact?.period === "annual" && hasDisplayValue(rec.financialImpact.amount)) {
      return sum + (rec.financialImpact!.amount as number);
    }
    return sum;
  }, 0);
}

export function sortCards(cards: RecommendationCard[]): RecommendationCard[] {
  const order = new Map(CARD_SLOT_ORDER.map((s, i) => [s, i]));
  return [...cards].sort(
    (a, b) => (order.get(a.slot) ?? 99) - (order.get(b.slot) ?? 99),
  );
}

export function combinedAdvisoryDisclaimer(data: Partial<ThreeCardAdvisoryData> | null | undefined): string | null {
  if (!data) return null;
  const parts = [data.disclaimer, data.productDisclaimer].filter(hasDisplayValue) as string[];
  if (!parts.length) return null;
  return [...new Set(parts)].join(" ");
}

export function feeMetricsOf(card: RecommendationCard): FeeCardMetrics {
  return (card.metrics ?? {}) as FeeCardMetrics;
}

export function suitabilityMetricsOf(card: RecommendationCard): SuitabilityCardMetrics {
  return (card.metrics ?? {}) as SuitabilityCardMetrics;
}

export function marketMetricsOf(card: RecommendationCard): MarketCardMetrics {
  return (card.metrics ?? {}) as MarketCardMetrics;
}

export function formatCurrency(value: number | null | undefined): string | null {
  if (!hasDisplayValue(value) || value === 0) return null;
  return formatCurrencyOrDash(value);
}

export function countActionableCards(data: ThreeCardAdvisoryData | null | undefined): number {
  return (data?.recommendationCards ?? []).filter(c => c.cardOutcome === "actionable").length;
}

export function topPrimaryRecommendation(
  data: ThreeCardAdvisoryData | null | undefined,
): PrimaryRecommendation | null {
  return data?.primaryRecommendations?.[0] ?? null;
}
