import {
  shouldShowLegacyRecommendations,
  shouldShowStructuredInsightsPanel,
  shouldShowThreeCardAdvisory,
} from "./financialRecommendationDisplay";

describe("financialRecommendationDisplay three_card_v5", () => {
  it("detects three card advisory", () => {
    expect(shouldShowThreeCardAdvisory({
      recommendationEngine: "three_card_v5",
      recommendationCards: [{ id: "1" }],
    })).toBe(true);
  });

  it("never shows legacy panels for pension/gemel UI", () => {
    expect(shouldShowLegacyRecommendations(null)).toBe(false);
    expect(shouldShowStructuredInsightsPanel(null)).toBe(false);
  });
});
