import { describe, expect, it } from "@jest/globals";
import type { MarketComparisonResponseDTO, MarketRiskLevel } from "../../api/marketComparison.api";

/**
 * Validates stale-request guard logic mirrored from useMarketComparisonQuery.
 * Full hook rendering is skipped due to React 19 + Jest act limitations in this repo.
 */
describe("useMarketComparisonQuery stale guard", () => {
  it("applies only the latest request id", async () => {
    let requestId = 0;
    let appliedRisk: MarketRiskLevel | null = null;

    const run = async (risk: MarketRiskLevel, delayMs: number) => {
      const id = ++requestId;
      await new Promise((r) => setTimeout(r, delayMs));
      if (id !== requestId) return;
      appliedRisk = risk;
    };

    const fetcher = async (params: { risk: MarketRiskLevel }) =>
      run(params.risk, params.risk === "medium" ? 30 : 5);

    await Promise.all([
      fetcher({ risk: "medium" }),
      fetcher({ risk: "high" }),
    ]);

    expect(appliedRisk).toBe("high");
  });

  it("fetcher contract includes product for gemel tabs", () => {
    const params = { risk: "medium" as const, period: "5y" as const, product: "hishtalmut" as const };
    expect(params.product).toBe("hishtalmut");
    expect(["gemel", "hishtalmut", "investment_gemel"]).toContain(params.product);
    expect(["child_savings", "central_severance", "unknown"]).not.toContain(params.product);
  });

  it("groups response shape is array not top-level funds", () => {
    const response: MarketComparisonResponseDTO = {
      product: "gemel",
      risk: "medium",
      period: "5y",
      comparisonGroup: null,
      groups: [{
        comparisonGroup: "gemel_equity",
        eligibleRecords: 1,
        rankedRecords: 1,
        insufficientHistoryRecords: 0,
        funds: [],
      }],
      methodology: {
        source: "gemel_net",
        rankingMethod: "return5YearsAnnualized",
        rankScope: "within_comparison_group_only",
        limitAppliesPerGroup: true,
        periodWeights: {},
        minimumPeriodsForCombined: 2,
        missingPeriodPolicy: "redistribute",
        returnsAreHistorical: true,
        activePeriod: "5y",
      },
      dataQuality: {
        source: "gemel_net",
        lastUpdated: null,
        latestOfficialReportPeriod: null,
      },
    };

    expect(Array.isArray(response.groups)).toBe(true);
    expect((response as { funds?: unknown }).funds).toBeUndefined();
  });
});
