import { describe, expect, it } from "@jest/globals";
import {
  fmtPct,
  fmtScore,
  formatSelectedPeriodValue,
  hasPartialCombinedWeights,
} from "./marketComparisonFormatters";
import type { MarketComparisonFundDTO } from "../../api/marketComparison.api";

const baseFund: MarketComparisonFundDTO = {
  rank: 1,
  rankingScore: 94.6,
  rankingStatus: "ranked",
  rankingMethod: "combined_percentile",
  effectiveWeights: { return12Months: 0.2, return36MonthsAnnualized: 0.35 },
  productType: "hishtalmut",
  riskLevel: "medium",
  comparisonGroup: "hishtalmut_equity",
  fundId: "1",
  fundName: "Test",
  managingCompany: "Co",
  specialization: null,
  subSpecialization: null,
  return12Months: 5.1,
  return36MonthsAnnualized: 4.2,
  return5YearsAnnualized: null,
  assetsUnderManagement: 1200,
  managementFeeBalance: 0.75,
  managementFeeDeposit: 0.5,
  reportPeriod: 202503,
  lastSyncedAt: null,
  source: "gemel_net",
};

describe("marketComparisonFormatters", () => {
  it("formats null values as unavailable", () => {
    expect(fmtPct(null)).toBe("לא זמין");
  });

  it("shows combined score as score not percentage", () => {
    expect(fmtScore(94.6)).toBe("94.6 / 100");
    expect(formatSelectedPeriodValue(baseFund, "combined")).toBe("94.6 / 100");
  });

  it("detects partial combined weights", () => {
    expect(hasPartialCombinedWeights(baseFund)).toBe(true);
  });

  it("shows insufficient history message without rank", () => {
    const fund = { ...baseFund, rank: null, rankingStatus: "insufficient_history" as const };
    expect(formatSelectedPeriodValue(fund, "5y")).toBe("אין היסטוריה מספקת לדירוג");
  });
});
