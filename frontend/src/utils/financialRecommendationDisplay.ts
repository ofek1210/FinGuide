/** Shared display rules for LLM-formatted advisory cards (pension + gemel). */
export type AdvisoryRecommendationDisplayData = {
  primaryRecommendations?: unknown[] | null;
  recommendations?: unknown[] | null;
  structuredInsights?: unknown[] | null;
  disclaimer?: string | null;
  productDisclaimer?: string | null;
};

export function shouldShowUnifiedRecommendations(
  data: AdvisoryRecommendationDisplayData | null | undefined,
): boolean {
  return (data?.primaryRecommendations?.length ?? 0) > 0;
}

export function shouldShowLegacyRecommendations(
  data: AdvisoryRecommendationDisplayData | null | undefined,
): boolean {
  if (shouldShowUnifiedRecommendations(data)) return false;
  return (data?.recommendations?.length ?? 0) > 0;
}

export function shouldShowStructuredInsightsPanel(
  data: AdvisoryRecommendationDisplayData | null | undefined,
): boolean {
  if (shouldShowUnifiedRecommendations(data)) return false;
  return (data?.structuredInsights?.length ?? 0) > 0;
}

export function combinedRecommendationDisclaimer(
  data: AdvisoryRecommendationDisplayData | null | undefined,
): string | null {
  const parts = [data?.disclaimer, data?.productDisclaimer].filter(Boolean) as string[];
  if (!parts.length) return null;
  return [...new Set(parts)].join(" ");
}
