import { describe, expect, it } from "@jest/globals";
import {
  buildRankingScopeSentence,
  extractComparisonGroupSuffix,
  labelComparisonGroup,
} from "./marketComparisonLabels";

describe("marketComparisonLabels", () => {
  it("translates known group suffixes", () => {
    expect(labelComparisonGroup("hishtalmut_equity")).toBe("מניות");
    expect(labelComparisonGroup("pension_age_50_60")).toBe("מסלול לבני 50–60");
    expect(labelComparisonGroup("gemel_sp500")).toBe("עוקב S&P 500");
  });

  it("extracts multi-part suffixes", () => {
    expect(extractComparisonGroupSuffix("investment_gemel_age_over_60")).toBe("age_over_60");
  });

  it("builds scoped ranking sentence without global wording", () => {
    const sentence = buildRankingScopeSentence("hishtalmut", "hishtalmut_equity", "high");
    expect(sentence).toContain("מניות");
    expect(sentence).toContain("קרנות השתלמות");
    expect(sentence).toContain("סיכון גבוה");
    expect(sentence).not.toContain("הקופות המובילות בשוק");
  });
});
