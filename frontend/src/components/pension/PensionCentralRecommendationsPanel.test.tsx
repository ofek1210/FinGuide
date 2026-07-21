import { describe, expect, it } from "@jest/globals";
import { render, screen } from "@testing-library/react";
import PensionCentralRecommendationsPanel from "./PensionCentralRecommendationsPanel";

describe("PensionCentralRecommendationsPanel", () => {
  it("renders LLM-formatted recommendation text without overwriting", () => {
    render(
      <PensionCentralRecommendationsPanel
        recommendations={[{
          insightId: "fees-1",
          title: "כדאי לבדוק את דמי הניהול",
          explanation: "דמי הניהול בקרן שלך מעט גבוהים.",
          whyItMatters: "הפער עשוי להצטבר.",
          nextStep: "פני לגוף המנהל.",
        }]}
        disclaimer="המידע אינו ייעוץ."
      />,
    );

    expect(screen.getByText("כדאי לבדוק את דמי הניהול")).toBeTruthy();
    expect(screen.getByText("דמי הניהול בקרן שלך מעט גבוהים.")).toBeTruthy();
    expect(screen.getByText("הפער עשוי להצטבר.")).toBeTruthy();
    expect(screen.getByText("פני לגוף המנהל.")).toBeTruthy();
    expect(screen.getAllByText("המידע אינו ייעוץ.")).toHaveLength(1);
  });

  it("shows positive findings separately from central cards", () => {
    render(
      <PensionCentralRecommendationsPanel
        recommendations={[]}
        positiveFindings={[{
          id: "pos-1",
          category: "performance",
          severity: "info",
          title: "ביצועים מעל החציון",
          finding: "הקרן הציגה ביצועים טובים.",
        }]}
      />,
    );

    expect(screen.getByText("נקודות חיוביות")).toBeTruthy();
    expect(screen.getByText("ביצועים מעל החציון")).toBeTruthy();
  });
});
