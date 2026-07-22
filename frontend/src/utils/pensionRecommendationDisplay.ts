import type { PensionAnalysisData } from "../api/pension.api";
import {
  combinedRecommendationDisclaimer,
  shouldShowLegacyRecommendations,
  shouldShowStructuredInsightsPanel,
  shouldShowThreeCardAdvisory,
  type AdvisoryRecommendationDisplayData,
} from "./financialRecommendationDisplay";

export {
  combinedRecommendationDisclaimer,
  shouldShowLegacyRecommendations,
  shouldShowStructuredInsightsPanel,
  shouldShowThreeCardAdvisory as shouldShowUnifiedRecommendations,
};
export type { AdvisoryRecommendationDisplayData };

export function shouldShowPensionUnifiedRecommendations(data: PensionAnalysisData | null | undefined): boolean {
  return shouldShowThreeCardAdvisory(data);
}

export function shouldShowPensionLegacyRecommendations(_data: PensionAnalysisData | null | undefined): boolean {
  return false;
}

export function shouldShowPensionStructuredInsightsPanel(_data: PensionAnalysisData | null | undefined): boolean {
  return false;
}

export function combinedPensionRecommendationDisclaimer(data: PensionAnalysisData | null | undefined): string | null {
  return combinedRecommendationDisclaimer(data);
}
