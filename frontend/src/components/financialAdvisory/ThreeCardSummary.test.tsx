import { describe, expect, it } from "@jest/globals";
import { isThreeCardAdvisory, type RecommendationCard, type ThreeCardAdvisoryData } from "../../api/financialAdvisory.types";
import {
  feeMetricsOf,
  formatCurrency,
  formatRankLine,
  hasDisplayValue,
  marketMetricsOf,
  sortCards,
  suitabilityMetricsOf,
  sumAnnualSavings,
} from "../../utils/financialAdvisoryDisplay";

function feeCard(overrides: Partial<RecommendationCard> = {}): RecommendationCard {
  return {
    id: "fee-1",
    slot: "management_fees",
    icon: "fees",
    title: "דמי ניהול",
    status: "high",
    statusLabelHe: "דמי צבירה גבוהים",
    cardOutcome: "actionable",
    summary: "דמי צבירה גבוהים.",
    recommendation: "כדאי לנהל משא ומתן.",
    confidence: "high",
    confidenceLabelHe: "גבוה",
    confidenceScore: 0.9,
    why: "פירוט דמי ניהול.",
    metrics: {
      depositFeeStatus: "excellent",
      balanceFeeStatus: "high",
      estimatedAnnualSaving: 350,
      calculationInputs: { userBalanceFeePct: 0.75, userDepositFeePct: 0.4 },
    },
    ...overrides,
  };
}

function trackCard(): RecommendationCard {
  return {
    id: "track-1",
    slot: "track_suitability",
    icon: "track",
    title: "התאמת מסלול",
    status: "provisional_conservative",
    statusLabelHe: "שמרני — נדרש מידע",
    cardOutcome: "information_required",
    summary: "חסרים נתונים.",
    recommendation: "השלימו פרופיל.",
    confidence: "insufficient_data",
    confidenceLabelHe: "נמוך",
    confidenceScore: 0.5,
    why: "חסר אופק.",
    metrics: { suitabilityBlockers: ["missing_product_horizon"] },
  };
}

function marketCard(overrides: Partial<RecommendationCard> = {}): RecommendationCard {
  return {
    id: "market-1",
    slot: "market_comparison",
    icon: "market",
    title: "השוואת שוק",
    status: "above_peer_median",
    statusLabelHe: "מעל חציון",
    cardOutcome: "monitoring",
    summary: "מעל חציון.",
    recommendation: "מעקב.",
    confidence: "high",
    confidenceLabelHe: "גבוה",
    confidenceScore: 0.87,
    why: "מתודולוגיית פרויקט.",
    metrics: { userRank: 13, rankedRecordsInGroup: 47, comparisonGroupLabel: "כללי" },
    alternatives: [{ rank: 1, fundId: "1", fundName: "מסלול א", reasons: ["השוואה"] }],
    ...overrides,
  };
}

function baseData(cards: RecommendationCard[]): ThreeCardAdvisoryData {
  return {
    recommendationEngine: "three_card_v5",
    recommendationCards: cards,
    accountAnalyses: [
      { accountId: "a1", accountLabel: "קרן א", fundName: "קרן א", productType: "PENSION", cards },
      { accountId: "a2", accountLabel: "קרן ב", fundName: "קרן ב", productType: "PENSION", cards },
    ],
  };
}

describe("three_card_v5 contract helpers", () => {
  it("detects three card engine with exactly three cards", () => {
    const data = baseData([feeCard(), trackCard(), marketCard()]);
    expect(isThreeCardAdvisory(data)).toBe(true);
    expect(sortCards(data.recommendationCards).map(c => c.slot)).toEqual([
      "management_fees",
      "track_suitability",
      "market_comparison",
    ]);
  });

  it("sums actionable fee card annual savings", () => {
    const data = baseData([feeCard(), trackCard(), marketCard()]);
    expect(sumAnnualSavings(data)).toBe(350);
  });

  it("formats rank X out of Y", () => {
    const line = formatRankLine(marketMetricsOf(marketCard()));
    expect(line).toBe("דירוג 13 מתוך 47 בקבוצת ההשוואה הרלוונטית");
  });

  it("hides zero currency values", () => {
    expect(formatCurrency(0)).toBeNull();
    expect(formatCurrency(350)).toContain("350");
  });

  it("supports information-required suitability blockers", () => {
    const card = trackCard();
    expect(card.cardOutcome).toBe("information_required");
    expect(suitabilityMetricsOf(card).suitabilityBlockers).toContain("missing_product_horizon");
  });

  it("supports insufficient market data without rank", () => {
    const card = marketCard({
      cardOutcome: "insufficient_data",
      status: "unmatched",
      metrics: {},
      alternatives: [],
    });
    expect(formatRankLine(marketMetricsOf(card))).toBeNull();
    expect(card.alternatives).toHaveLength(0);
  });

  it("includes alternatives only when backend supplies them", () => {
    expect(marketCard().alternatives?.length).toBe(1);
    expect(marketCard({ alternatives: [] }).alternatives).toHaveLength(0);
  });

  it("supports multiple account analyses", () => {
    expect(baseData([feeCard(), trackCard(), marketCard()]).accountAnalyses).toHaveLength(2);
  });

  it("does not treat missing values as displayable", () => {
    expect(hasDisplayValue(undefined)).toBe(false);
    expect(hasDisplayValue(null)).toBe(false);
    expect(hasDisplayValue(0)).toBe(true);
    expect(formatCurrency(0)).toBeNull();
    expect(hasDisplayValue("undefined")).toBe(false);
  });

  it("exposes separate fee metrics from backend", () => {
    const m = feeMetricsOf(feeCard());
    expect(m.depositFeeStatus).toBe("excellent");
    expect(m.balanceFeeStatus).toBe("high");
    expect(m.calculationInputs?.userDepositFeePct).toBe(0.4);
  });
});
