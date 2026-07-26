import { describe, expect, it } from "@jest/globals";
import { render, screen } from "@testing-library/react";
import RecommendationCard from "./RecommendationCard";
import type { RecommendationCard as RecommendationCardType } from "../../api/financialAdvisory.types";

function baseCard(overrides: Partial<RecommendationCardType> = {}): RecommendationCardType {
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
      estimatedAnnualSaving: 420,
      calculationInputs: { userBalanceFeePct: 0.75, userDepositFeePct: 0.4 },
    },
    ...overrides,
  };
}

describe("RecommendationCard render", () => {
  it("renders fee savings without legacy duplicate totals", () => {
    render(<RecommendationCard card={baseCard()} accent="butter" />);
    expect(screen.getByRole("heading", { name: "דמי ניהול" })).toBeTruthy();
    expect(screen.getByText(/פער שנתי משוער מול השוואה/)).toBeTruthy();
    expect(screen.getByText(/420/)).toBeTruthy();
  });

  it("renders market rank when present", () => {
    render(
      <RecommendationCard
        card={baseCard({
          id: "market-1",
          slot: "market_comparison",
          icon: "market",
          title: "השוואת שוק",
          statusLabelHe: "מעל חציון",
          metrics: { userRank: 5, rankedRecordsInGroup: 20 },
        })}
      />,
    );
    expect(screen.getByText(/דירוג 5 מתוך 20/)).toBeTruthy();
  });

  it("omits rank line for insufficient market data", () => {
    render(
      <RecommendationCard
        card={baseCard({
          id: "market-2",
          slot: "market_comparison",
          icon: "market",
          title: "השוואת שוק",
          cardOutcome: "insufficient_data",
          statusLabelHe: "אין נתוני שוק",
          metrics: {},
        })}
      />,
    );
    expect(screen.queryByText(/דירוג \d+ מתוך/)).toBeNull();
  });
});
