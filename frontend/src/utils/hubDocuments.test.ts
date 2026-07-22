import { describe, expect, it } from "@jest/globals";
import {
  buildClearinghouseReadiness,
  clearinghouseReadinessLines,
  hubDocumentUrl,
  parseHubDocumentParam,
} from "./hubDocuments";

describe("hubDocuments", () => {
  it("builds hub document URLs", () => {
    expect(hubDocumentUrl("clearinghouse")).toBe("/hub?document=clearinghouse");
    expect(parseHubDocumentParam("insurance")).toBe("insurance");
    expect(parseHubDocumentParam("unknown")).toBeNull();
  });

  it("derives clearinghouse readiness without marking empty agents ready", () => {
    const readiness = buildClearinghouseReadiness([
      { fundType: "pension_comprehensive", insuranceCoverages: [{ coverageType: "נכות" }] },
      { fundType: "study_fund", insuranceCoverages: [] },
    ]);
    expect(readiness.pensionReady).toBe(true);
    expect(readiness.gemelReady).toBe(true);
    expect(readiness.pensionInsuranceReady).toBe(true);
    expect(clearinghouseReadinessLines(readiness)).toEqual([
      "הסוכן הפנסיוני מוכן",
      "סוכן הגמל מוכן",
      "הסוכן הביטוחי קיבל כיסויים פנסיוניים",
    ]);
  });

  it("does not mark agents ready when datasets are empty", () => {
    const readiness = buildClearinghouseReadiness([]);
    expect(clearinghouseReadinessLines(readiness)).toEqual([]);
  });
});
