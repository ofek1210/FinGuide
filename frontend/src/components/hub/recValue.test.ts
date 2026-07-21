import { parseYearlyImpact, effortFor, compareByValue, compareByUrgency, totalYearlyValue } from "./recValue";
import type { FullAnalysisRecommendation } from "../../api/fullAnalysis.api";

const rec = (over: Partial<FullAnalysisRecommendation>): FullAnalysisRecommendation => ({
  type: "generic",
  title: "t",
  reason: "r",
  urgency: "medium",
  financialImpact: null,
  confidenceScore: 80,
  agentId: "pension",
  ...over,
});

describe("parseYearlyImpact", () => {
  it("annualizes monthly amounts", () => {
    expect(parseYearlyImpact("+₪1,167/חודש לקצבה")).toBe(14004);
  });

  it("passes yearly amounts through", () => {
    expect(parseYearlyImpact("~₪163/שנה")).toBe(163);
  });

  it("ignores amounts without an explicit period (one-time horizons)", () => {
    expect(parseYearlyImpact("חיסכון של ₪280,000 עד הפרישה")).toBeNull();
  });

  it("ignores percent-only and empty impacts", () => {
    expect(parseYearlyImpact("הכנסה חלופית של עד 75% מהשכר")).toBeNull();
    expect(parseYearlyImpact(null)).toBeNull();
    expect(parseYearlyImpact(undefined)).toBeNull();
  });
});

describe("effortFor", () => {
  it("grades fee/duplicate types as one phone call", () => {
    expect(effortFor("high_mgmt_fee").rank).toBe(0);
    expect(effortFor("gemel_market_negotiate").rank).toBe(0);
    expect(effortFor("duplicate_policy").rank).toBe(0);
  });

  it("grades missing coverage / tax as one inquiry", () => {
    expect(effortFor("missing_disability").rank).toBe(1);
    expect(effortFor("tax_refund").rank).toBe(1);
  });

  it("defaults to a longer process", () => {
    expect(effortFor("emergency_fund").rank).toBe(2);
    expect(effortFor("").rank).toBe(2);
  });
});

describe("compareByValue", () => {
  it("puts the highest yearly value first", () => {
    const small = rec({ financialImpact: "~₪163/שנה", type: "gemel_market_negotiate" });
    const big = rec({ financialImpact: "+₪1,167/חודש", type: "high_mgmt_fee" });
    expect([small, big].sort(compareByValue)[0]).toBe(big);
  });

  it("breaks value ties by least effort, then urgency", () => {
    const call = rec({ type: "high_mgmt_fee", urgency: "low" });
    const process = rec({ type: "emergency_fund", urgency: "high" });
    expect([process, call].sort(compareByValue)[0]).toBe(call);

    const highUrgency = rec({ type: "emergency_fund", urgency: "high" });
    const lowUrgency = rec({ type: "savings_habit", urgency: "low" });
    expect([lowUrgency, highUrgency].sort(compareByValue)[0]).toBe(highUrgency);
  });
});

describe("compareByUrgency", () => {
  it("puts high urgency before medium even when medium has higher value", () => {
    const urgent = rec({ urgency: "high", financialImpact: "~₪100/שנה" });
    const valuable = rec({ urgency: "medium", financialImpact: "+₪1,167/חודש" });
    expect([valuable, urgent].sort(compareByUrgency)[0]).toBe(urgent);
  });
});

describe("totalYearlyValue", () => {
  it("sums only parseable impacts and counts them", () => {
    const { total, counted } = totalYearlyValue([
      rec({ financialImpact: "+₪1,167/חודש" }),
      rec({ financialImpact: "~₪163/שנה" }),
      rec({ financialImpact: "עד 75% מהשכר" }),
      rec({ financialImpact: null }),
    ]);
    expect(total).toBe(14167);
    expect(counted).toBe(2);
  });
});
