import { describe, expect, it } from "@jest/globals";
import {
  formatBenchmarkLines,
  formatEstimatedImpactLines,
  hasDisplayValue,
  insightCategoryLabel,
  sortStructuredInsights,
} from "./pensionStructuredInsightDisplay";
import type { PensionStructuredInsightDTO } from "../api/pension.api";

describe("pensionStructuredInsightDisplay", () => {
  it("hasDisplayValue filters null and empty", () => {
    expect(hasDisplayValue(null)).toBe(false);
    expect(hasDisplayValue("")).toBe(false);
    expect(hasDisplayValue([])).toBe(false);
    expect(hasDisplayValue("text")).toBe(true);
    expect(hasDisplayValue(0)).toBe(true);
  });

  it("insightCategoryLabel maps known categories", () => {
    expect(insightCategoryLabel("fund_ranking")).toBe("דירוג מול קבוצה");
    expect(insightCategoryLabel("unknown_cat")).toBe("unknown_cat");
  });

  it("formatBenchmarkLines skips null fields", () => {
    const lines = formatBenchmarkLines({
      group: "pension:medium",
      percentile: 35,
      median: 6.2,
      average: null,
    });
    expect(lines).toEqual([
      "קבוצת השוואה: pension:medium",
      "אחוזון: 35",
      "חציון: 6.2",
    ]);
  });

  it("formatEstimatedImpactLines formats currency values", () => {
    const lines = formatEstimatedImpactLines({ annual: 1925, retirement: 89421, currency: "ILS" });
    expect(lines.length).toBe(2);
    expect(lines[0]).toContain("1,925");
    expect(lines[1]).toContain("89,421");
  });

  it("sortStructuredInsights orders by severity", () => {
    const insights: PensionStructuredInsightDTO[] = [
      { id: "1", category: "a", severity: "info", title: "i", finding: "f" },
      { id: "2", category: "b", severity: "high", title: "h", finding: "f" },
      { id: "3", category: "c", severity: "medium", title: "m", finding: "f" },
    ];
    const sorted = sortStructuredInsights(insights);
    expect(sorted.map(i => i.severity)).toEqual(["high", "medium", "info"]);
  });
});
