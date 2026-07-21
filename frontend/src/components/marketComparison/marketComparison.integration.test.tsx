import { describe, expect, it } from "@jest/globals";
import { GEMEL_PRODUCT_TABS } from "./marketComparisonLabels";

describe("Gemel product tabs contract", () => {
  it("includes only public gemel products", () => {
    const ids = GEMEL_PRODUCT_TABS.map((t) => t.id);
    expect(ids).toEqual(["gemel", "hishtalmut", "investment_gemel"]);
    expect(ids).not.toContain("child_savings");
    expect(ids).not.toContain("central_severance");
    expect(ids).not.toContain("unknown");
  });

  it("maps Hebrew labels to API product values", () => {
    expect(GEMEL_PRODUCT_TABS.find((t) => t.label === "קופות גמל")?.id).toBe("gemel");
    expect(GEMEL_PRODUCT_TABS.find((t) => t.label === "קרנות השתלמות")?.id).toBe("hishtalmut");
    expect(GEMEL_PRODUCT_TABS.find((t) => t.label === "גמל להשקעה")?.id).toBe("investment_gemel");
  });
});
