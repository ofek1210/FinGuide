import { describe, expect, it } from "@jest/globals";
import { isHubOpportunityFinding } from "./agentDisplay";
import type { FindingItem } from "../../api/findings.api";

function finding(id: string): FindingItem {
  return { id, title: id, severity: "info", details: "x" };
}

describe("isHubOpportunityFinding", () => {
  it("rejects empty-account and document-hygiene meta findings", () => {
    expect(isHubOpportunityFinding(finding("no_documents"))).toBe(false);
    expect(isHubOpportunityFinding(finding("missing_basic_metadata"))).toBe(false);
    expect(isHubOpportunityFinding(finding("documents_pending"))).toBe(false);
    expect(isHubOpportunityFinding(finding("stale_documents"))).toBe(false);
  });

  it("keeps real improvement findings", () => {
    expect(isHubOpportunityFinding(finding("contribution_rate_gap_pension"))).toBe(true);
    expect(isHubOpportunityFinding(finding("pension_card_0"))).toBe(true);
  });
});
