import { describe, expect, it } from "@jest/globals";
import {
  buildDocumentInventory,
  computeAgentReadiness,
  needsAgentOnboarding,
  phaseLabel,
} from "./agentReadiness";
import type { SmartOnboardingStateDTO } from "../api/smartOnboarding.api";

function onboarding(partial: Partial<SmartOnboardingStateDTO>): SmartOnboardingStateDTO {
  return {
    layer: "agent",
    complete: false,
    completedAt: null,
    totalQuestions: 3,
    answeredCount: 0,
    missingQuestions: [{ id: "q1", type: "yesno", title: "שאלה" }],
    knownAnswers: {},
    estimatedMinutes: 2,
    ...partial,
  };
}

describe("agentReadiness", () => {
  it("labels onboarding-required phase", () => {
    expect(phaseLabel("document_ready_onboarding_incomplete")).toBe("נדרש אונבורדינג");
  });

  it("detects missing onboarding questions", () => {
    expect(needsAgentOnboarding(onboarding({}))).toBe(true);
    expect(needsAgentOnboarding(onboarding({ complete: true, missingQuestions: [] }))).toBe(false);
  });

  it("builds document inventory from signals", () => {
    const items = buildDocumentInventory({
      completedPayslips: 2,
      processingPayslips: 0,
      pensionFundCount: 1,
      insurancePolicyCount: 0,
      gemelFundCount: 0,
      hasPayslipGemelSignal: true,
      hasGemelAnalysis: false,
    });
    expect(items.find(i => i.id === "clearinghouse")?.status).toBe("ok");
    expect(items.find(i => i.id === "har_habituach")?.status).toBe("missing");
    expect(items.find(i => i.id === "payslips")?.status).toBe("ok");
    expect(items.find(i => i.id === "clearinghouse")?.route).toContain("document=clearinghouse");
  });

  it("prefers onboarding over analysis when document exists", () => {
    const item = computeAgentReadiness({
      agentId: "pension",
      onboarding: onboarding({}),
      hasDocument: true,
      hasAnalysis: true,
    });
    expect(item.phase).toBe("document_ready_onboarding_incomplete");
  });

  it("marks analysis ready when onboarding complete", () => {
    const item = computeAgentReadiness({
      agentId: "gemel",
      onboarding: onboarding({ complete: true, missingQuestions: [] }),
      hasDocument: true,
      hasAnalysis: true,
    });
    expect(item.phase).toBe("analysis_ready");
  });
});
