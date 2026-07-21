import type { PensionAnalysisData } from "../api/pension.api";
import {
  combinedRecommendationDisclaimer,
  shouldShowLegacyRecommendations,
  shouldShowStructuredInsightsPanel,
  shouldShowUnifiedRecommendations,
  type AdvisoryRecommendationDisplayData,
} from "./financialRecommendationDisplay";

export {
  combinedRecommendationDisclaimer,
  shouldShowLegacyRecommendations,
  shouldShowStructuredInsightsPanel,
  shouldShowUnifiedRecommendations,
};
export type { AdvisoryRecommendationDisplayData };

/** Unified LLM/deterministic cards take precedence over legacy recommendation lists. */
export function shouldShowPensionUnifiedRecommendations(data: PensionAnalysisData | null | undefined): boolean {
  return shouldShowUnifiedRecommendations(data);
}

export function shouldShowPensionLegacyRecommendations(data: PensionAnalysisData | null | undefined): boolean {
  return shouldShowLegacyRecommendations(data);
}

export function shouldShowPensionStructuredInsightsPanel(data: PensionAnalysisData | null | undefined): boolean {
  return shouldShowStructuredInsightsPanel(data);
}

export function combinedPensionRecommendationDisclaimer(data: PensionAnalysisData | null | undefined): string | null {
  return combinedRecommendationDisclaimer(data);
}
