import {
  AGENT_INSIGHT_CTA,
  insightTeaser,
  summarizeInsightText,
} from "./insightDisplay";

describe("insightDisplay", () => {
  it("summarizeInsightText truncates long strings", () => {
    const long = "א".repeat(150);
    expect(summarizeInsightText(long, 40).endsWith("…")).toBe(true);
    expect(summarizeInsightText("קצר", 40)).toBe("קצר");
  });

  it("insightTeaser keeps the first sentence", () => {
    expect(insightTeaser("משהו חשוב. עוד טקסט ארוך.")).toBe("משהו חשוב.");
  });

  it("AGENT_INSIGHT_CTA has Hebrew labels per agent", () => {
    expect(AGENT_INSIGHT_CTA.payslip.label).toContain("סוכן התלושים");
    expect(AGENT_INSIGHT_CTA.pension.label).toContain("סוכן הפנסיוני");
    expect(AGENT_INSIGHT_CTA.gemel.label).toContain("סוכן הגמל");
  });
});
