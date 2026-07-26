import { describe, expect, it } from "@jest/globals";
import { resolveMarketComparisonEmptyState } from "./marketComparisonEmptyStates";
import type { MarketComparisonResponseDTO } from "../../api/marketComparison.api";

const baseData: MarketComparisonResponseDTO = {
  product: "gemel",
  risk: "medium",
  period: "5y",
  comparisonGroup: null,
  groups: [],
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

describe("resolveMarketComparisonEmptyState", () => {
  it("returns no-groups message", () => {
    expect(resolveMarketComparisonEmptyState({ ...baseData, groups: [] }, null)).toBe(
      "לא נמצאו קבוצות השוואה מתאימות לסינון שנבחר.",
    );
  });

  it("returns missing-period message when eligible but empty funds", () => {
    const data = {
      ...baseData,
      groups: [{
        comparisonGroup: "gemel_equity",
        eligibleRecords: 5,
        rankedRecords: 0,
        insufficientHistoryRecords: 5,
        funds: [],
      }],
    };
    expect(resolveMarketComparisonEmptyState(data, "gemel_equity")).toBe(
      "אין מספיק נתוני תשואה לתקופה שנבחרה בקבוצת מסלולים זו.",
    );
  });

  it("returns no-ranked message when group has no eligible records", () => {
    const data = {
      ...baseData,
      groups: [{
        comparisonGroup: "gemel_general",
        eligibleRecords: 0,
        rankedRecords: 0,
        insufficientHistoryRecords: 0,
        funds: [],
      }],
    };
    expect(resolveMarketComparisonEmptyState(data, "gemel_general")).toBe(
      "לא נמצאו מסלולים שניתן לדרג לפי הנתונים הזמינים.",
    );
  });

  it("returns null when funds exist", () => {
    const data = {
      ...baseData,
      groups: [{
        comparisonGroup: "gemel_equity",
        eligibleRecords: 1,
        rankedRecords: 1,
        insufficientHistoryRecords: 0,
        funds: [{
          rank: 1,
          rankingScore: null,
          rankingStatus: "ranked" as const,
          rankingMethod: "return5YearsAnnualized",
          effectiveWeights: {},
          productType: "gemel",
          riskLevel: "medium" as const,
          comparisonGroup: "gemel_equity",
          fundId: "1",
          fundName: "X",
          managingCompany: "Y",
          specialization: null,
          subSpecialization: null,
          return12Months: 1,
          return36MonthsAnnualized: 1,
          return5YearsAnnualized: 1,
          assetsUnderManagement: 1,
          managementFeeBalance: 1,
          managementFeeDeposit: null,
          reportPeriod: null,
          lastSyncedAt: null,
          source: "gemel_net",
        }],
      }],
    };
    expect(resolveMarketComparisonEmptyState(data, "gemel_equity")).toBeNull();
  });
});
