/**
 * Normalize unified financial insights for display in shared UI components.
 */
import type { PensionStructuredInsightDTO, PensionInsightSeverity } from "../api/pension.api";
import type { FinancialStructuredInsightDTO } from "../api/gemel.api";

const SEV_MAP: Record<string, PensionInsightSeverity> = {
  critical: "high",
  high: "high",
  medium: "medium",
  low: "low",
  info: "info",
};

export function normalizeStructuredInsight(
  ins: FinancialStructuredInsightDTO | PensionStructuredInsightDTO,
): PensionStructuredInsightDTO {
  const unified = ins as FinancialStructuredInsightDTO;
  if ("finding" in ins && ins.finding) {
    return ins as PensionStructuredInsightDTO;
  }
  return {
    id: unified.id,
    category: unified.code || unified.category,
    severity: SEV_MAP[unified.severity] || "info",
    title: unified.title,
    finding: unified.reason,
    recommendedAction: unified.suggestedAction,
    personalDataUsed: unified.evidence?.personalDataUsed as string[] | undefined,
    marketDataUsed: unified.sources,
    benchmark: unified.evidence?.benchmark as PensionStructuredInsightDTO["benchmark"],
    estimatedImpact: unified.financialImpact
      ? {
          annual: unified.financialImpact.period === "annual" ? unified.financialImpact.amount : null,
          retirement: unified.financialImpact.period === "retirement" ? unified.financialImpact.amount : null,
          currency: unified.financialImpact.currency || "ILS",
        }
      : undefined,
    confidence: unified.confidence,
    assumptions: unified.evidence?.assumptions as string[] | undefined,
    limitations: unified.evidence?.limitations as string[] | undefined,
    requiresLicensedAdvisor: true,
    disclaimer: unified.disclaimers?.[0] ?? undefined,
    fundId: unified.productId ?? undefined,
  };
}

export function normalizeStructuredInsights(
  insights?: Array<FinancialStructuredInsightDTO | PensionStructuredInsightDTO> | null,
): PensionStructuredInsightDTO[] {
  return (insights ?? []).map(normalizeStructuredInsight);
}
