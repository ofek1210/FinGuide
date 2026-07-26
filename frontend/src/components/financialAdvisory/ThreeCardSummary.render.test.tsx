import { describe, expect, it, jest } from "@jest/globals";
import { render, screen } from "@testing-library/react";
import ThreeCardSummary from "./ThreeCardSummary";
import type { RecommendationCard, ThreeCardAdvisoryData } from "../../api/financialAdvisory.types";

function feeCard(): RecommendationCard {
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
    metrics: { estimatedAnnualSaving: 350 },
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
    metrics: { userRank: 13, rankedRecordsInGroup: 47 },
    alternatives: [{ rank: 1, fundId: "1", fundName: "מסלול א", reasons: ["השוואה"] }],
    ...overrides,
  };
}

function threeCardData(overrides: Partial<ThreeCardAdvisoryData> = {}): ThreeCardAdvisoryData {
  const cards = [feeCard(), trackCard(), marketCard()];
  return {
    recommendationEngine: "three_card_v5",
    recommendationCards: cards,
    accountAnalyses: [
      { accountId: "a1", accountLabel: "קרן א", fundName: "קרן א", productType: "GEMEL", cards },
    ],
    ...overrides,
  };
}

describe("ThreeCardSummary render", () => {
  it("shows loading state", () => {
    render(<ThreeCardSummary data={null} loading />);
    expect(screen.getByText(/מריצים ניתוח שלוש-כרטיסים/)).toBeTruthy();
  });

  it("shows API error with retry", () => {
    const onRetry = jest.fn();
    render(<ThreeCardSummary data={null} error="שגיאת שרת" onRetry={onRetry} />);
    expect(screen.getByText("שגיאה בטעינת הניתוח")).toBeTruthy();
    expect(screen.getByText("שגיאת שרת")).toBeTruthy();
    screen.getByText("נסו שוב").click();
    expect(onRetry).toHaveBeenCalled();
  });

  it("renders exactly three portfolio cards and account analyses", () => {
    render(<ThreeCardSummary data={threeCardData()} hasAccounts accent="butter" />);
    expect(screen.getByText("שלוש המלצות מרכזיות")).toBeTruthy();
    expect(screen.getAllByText("דמי ניהול").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("התאמת מסלול").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("השוואת שוק").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/ניתוח לפי חשבון \(1\)/)).toBeTruthy();
    expect(screen.getAllByRole("article").length).toBeGreaterThanOrEqual(3);
  });

  it("shows missing-profile suitability state", () => {
    render(<ThreeCardSummary data={threeCardData()} hasAccounts />);
    expect(screen.getAllByText(/שמרני — נדרש מידע/).length).toBeGreaterThanOrEqual(1);
  });

  it("shows insufficient-market-data when rank is absent", () => {
    const cards = [
      feeCard(),
      trackCard(),
      marketCard({
        cardOutcome: "insufficient_data",
        status: "unmatched",
        metrics: {},
        alternatives: [],
      }),
    ];
    render(
      <ThreeCardSummary
        data={threeCardData({ recommendationCards: cards, accountAnalyses: [{ accountId: "a1", accountLabel: "קרן א", fundName: "קרן א", productType: "GEMEL", cards }] })}
        hasAccounts
      />,
    );
    expect(screen.getAllByText("השוואת שוק").length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByText(/דירוג 13 מתוך 47/)).toBeNull();
  });
});
