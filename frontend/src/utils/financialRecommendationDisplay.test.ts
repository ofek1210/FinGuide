import { describe, expect, it } from "@jest/globals";
import type { GemelAnalysisData } from "../api/gemel.api";
import {
  combinedRecommendationDisclaimer,
  shouldShowLegacyRecommendations,
  shouldShowStructuredInsightsPanel,
  shouldShowUnifiedRecommendations,
} from "./financialRecommendationDisplay";

const baseData = (): GemelAnalysisData => ({
  summary: { hasData: true, fundCount: 1, totalBalance: 1000 } as GemelAnalysisData["summary"],
  marketAdvice: { hasData: false, overallVerdict: null },
  payslipFindings: [],
  recommendations: [{
    type: "fees",
    title: "Legacy",
    reason: "r",
    urgency: "high",
    financialImpact: null,
    confidenceScore: 70,
  }],
  structuredInsights: [{
    id: "1",
    code: "fees",
    productType: "GEMEL",
    category: "fees",
    severity: "high",
    title: "Structured",
    reason: "f",
    suggestedAction: "a",
    confidence: 0.8,
  }],
});

describe("financialRecommendationDisplay", () => {
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
      productDisclaimer: "גמל",
    });
    expect(disclaimer).toBe("כללי גמל");
  });
});
