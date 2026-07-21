import { describe, expect, it } from "@jest/globals";
import type { PensionAnalysisData } from "../api/pension.api";
import {
  combinedRecommendationDisclaimer,
  shouldShowLegacyRecommendations,
  shouldShowStructuredInsightsPanel,
  shouldShowUnifiedRecommendations,
} from "./pensionRecommendationDisplay";

const baseData = (): PensionAnalysisData => ({
  summary: { hasData: true, currentAccumulation: 0, retirementAge: 67 } as PensionAnalysisData["summary"],
  projection: null,
  recommendations: [{
    type: "fees",
    title: "Legacy",
    reason: "r",
    urgency: "high",
    financialImpact: null,
    confidenceScore: 70,
  }],
  structuredInsights: [{ id: "1", category: "fees", severity: "high", title: "Structured", finding: "f" }],
});

describe("pensionRecommendationDisplay", () => {
  it("prefers unified recommendations over legacy and structured panels", () => {
    const data = {
      ...baseData(),
      primaryRecommendations: [{
        insightId: "u1",
        title: "Unified",
        explanation: "e",
      }],
    };
    expect(shouldShowUnifiedRecommendations(data)).toBe(true);
    expect(shouldShowLegacyRecommendations(data)).toBe(false);
    expect(shouldShowStructuredInsightsPanel(data)).toBe(false);
  });

  it("shows legacy recommendations only when unified cards are absent", () => {
    const data = baseData();
    expect(shouldShowUnifiedRecommendations(data)).toBe(false);
    expect(shouldShowLegacyRecommendations(data)).toBe(true);
  });

  it("combines general and product disclaimers once", () => {
    const disclaimer = combinedRecommendationDisclaimer({
      ...baseData(),
      disclaimer: "כללי",
      productDisclaimer: "פנסיה",
    });
    expect(disclaimer).toBe("כללי פנסיה");
  });
});
