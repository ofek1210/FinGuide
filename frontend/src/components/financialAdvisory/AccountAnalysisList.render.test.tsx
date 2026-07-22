import { describe, expect, it } from "@jest/globals";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AccountAnalysisList from "./AccountAnalysisList";
import type { AccountAnalysis, RecommendationCard } from "../../api/financialAdvisory.types";

function card(slot: RecommendationCard["slot"], title: string): RecommendationCard {
  return {
    id: `${slot}-1`,
    slot,
    icon: slot === "management_fees" ? "fees" : slot === "track_suitability" ? "track" : "market",
    title,
    status: "high",
    statusLabelHe: title,
    cardOutcome: "actionable",
    summary: "סיכום",
    recommendation: "המלצה",
    confidence: "high",
    confidenceLabelHe: "גבוה",
    confidenceScore: 0.9,
    why: "למה",
    metrics: {},
  };
}

function account(id: string, label: string): AccountAnalysis {
  const cards = [
    card("management_fees", "דמי ניהול"),
    card("track_suitability", "התאמת מסלול"),
    card("market_comparison", "השוואת שוק"),
  ];
  return {
    accountId: id,
    accountLabel: label,
    fundName: label,
    productType: "GEMEL",
    currentBalance: 120000,
    cards,
  };
}

describe("AccountAnalysisList render", () => {
  it("lists each account once", () => {
    render(
      <AccountAnalysisList
        accounts={[account("a1", "קרן א"), account("a2", "קרן ב")]}
        accent="butter"
      />,
    );
    expect(screen.getByText(/ניתוח לפי חשבון \(2\)/)).toBeTruthy();
    expect(screen.getByText("קרן א")).toBeTruthy();
    expect(screen.getByText("קרן ב")).toBeTruthy();
  });

  it("expands account details on click", async () => {
    const user = userEvent.setup();
    render(<AccountAnalysisList accounts={[account("a1", "קרן א")]} />);
    const toggle = screen.getByRole("button", { name: /קרן א/i });
    expect(screen.queryByText("פירוט דמי ניהול")).toBeNull();
    await user.click(toggle);
    expect(screen.getByText("פירוט דמי ניהול")).toBeTruthy();
  });

  it("returns null when no accounts", () => {
    const { container } = render(<AccountAnalysisList accounts={[]} />);
    expect(container.firstChild).toBeNull();
  });
});
