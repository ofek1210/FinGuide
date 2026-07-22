import type { PensionAnalysisData, PensionSummaryDTO } from "../api/pension.api";
import { shouldShowPensionLegacyRecommendations, shouldShowPensionStructuredInsightsPanel, shouldShowPensionUnifiedRecommendations } from "./pensionRecommendationDisplay";

const threeCardData = (): PensionAnalysisData => ({
  recommendationEngine: "three_card_v5",
  recommendationCards: [{
    id: "1", slot: "management_fees", icon: "fees", title: "דמי ניהול", status: "high",
    statusLabelHe: "גבוה", cardOutcome: "actionable", summary: "s", recommendation: "r",
    confidence: "high", confidenceLabelHe: "גבוה", confidenceScore: 1, why: "w",
  }, {
    id: "2", slot: "track_suitability", icon: "track", title: "מסלול", status: "well_matched",
    statusLabelHe: "ok", cardOutcome: "monitoring", summary: "s", recommendation: "r",
    confidence: "high", confidenceLabelHe: "גבוה", confidenceScore: 1, why: "w",
  }, {
    id: "3", slot: "market_comparison", icon: "market", title: "שוק", status: "above_peer_median",
    statusLabelHe: "ok", cardOutcome: "monitoring", summary: "s", recommendation: "r",
    confidence: "high", confidenceLabelHe: "גבוה", confidenceScore: 1, why: "w",
  }],
  accountAnalyses: [],
  summary: { hasData: true, currentAccumulation: 0, retirementAge: 67, totalMonthlyContribution: 0 } as PensionSummaryDTO,
  projection: null,
});

describe("pensionRecommendationDisplay", () => {
  it("uses three card path when engine active", () => {
    expect(shouldShowPensionUnifiedRecommendations(threeCardData())).toBe(true);
    expect(shouldShowPensionLegacyRecommendations(threeCardData())).toBe(false);
    expect(shouldShowPensionStructuredInsightsPanel(threeCardData())).toBe(false);
  });
});
