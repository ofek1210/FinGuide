/** Shared display rules for three_card_v5 advisory UI. */
import { isThreeCardAdvisory, type ThreeCardAdvisoryData } from "../api/financialAdvisory.types";
import { combinedAdvisoryDisclaimer } from "./financialAdvisoryDisplay";

export type AdvisoryRecommendationDisplayData = Partial<ThreeCardAdvisoryData> | null | undefined;

export function shouldShowThreeCardAdvisory(
  data: { recommendationEngine?: string; recommendationCards?: unknown[] } | null | undefined,
): boolean {
  return isThreeCardAdvisory(data);
}

/** @deprecated use shouldShowThreeCardAdvisory */
export function shouldShowUnifiedRecommendations(data: AdvisoryRecommendationDisplayData): boolean {
  return shouldShowThreeCardAdvisory(data);
}

/** Legacy paths removed from pension/gemel UI */
export function shouldShowLegacyRecommendations(_data: AdvisoryRecommendationDisplayData): boolean {
  return false;
}

export function shouldShowStructuredInsightsPanel(_data: AdvisoryRecommendationDisplayData): boolean {
  return false;
}

export function combinedRecommendationDisclaimer(data: AdvisoryRecommendationDisplayData): string | null {
  return combinedAdvisoryDisclaimer(data);
}
