import { mergeAnalysisResult } from "./masterAgentMerge";
import type { AgentResult, FullAnalysisResponse } from "../../api/fullAnalysis.api";

const agent = (over: Partial<AgentResult> = {}): AgentResult => ({
  status: "success",
  message: null,
  data: {},
  recommendationCount: 0,
  durationMs: 100,
  explanation: null,
  ...over,
});

const fullRun = (over: Partial<FullAnalysisResponse> = {}): FullAnalysisResponse => ({
  success: true,
  summary: "סיכום מאוחד",
  summarySource: "claude",
  globalScore: { year: 2026, score: 78, level: "good", label: "מצב טוב" },
  actionItems: [{ priority: "high", domain: "pension", title: "פעולה" }],
  recommendations: [],
  agents: {
    payslip: agent(),
    insurance: agent(),
    pension: agent(),
    gemel: agent(),
    profile: agent(),
  },
  meta: { durationMs: 4000, agentCount: 5, successCount: 5 },
  ...over,
});

describe("mergeAnalysisResult", () => {
  it("full run replaces everything, including the summary", () => {
    const prev = fullRun({ summary: "ישן" });
    const next = fullRun({ summary: "חדש" });
    expect(mergeAnalysisResult(prev, next)).toBe(next);
  });

  it("focused run with no prior full run strips the summary", () => {
    const data = fullRun({ summary: "לא אמור להופיע" });
    const merged = mergeAnalysisResult(null, data, "pension");
    expect(merged.summary).toBeUndefined();
    expect(merged.agents?.pension).toBe(data.agents?.pension);
  });

  it("focused run after a full run refreshes only that lane + global score, keeps summary", () => {
    const prev = fullRun({ summary: "הסיכום המלא" });
    const freshPension = agent({ recommendationCount: 3, durationMs: 900 });
    const data = fullRun({
      summary: undefined,
      globalScore: { year: 2026, score: 82, level: "good", label: "מצב טוב" },
      agents: { ...fullRun().agents!, pension: freshPension },
      meta: { durationMs: 900, agentCount: 1, successCount: 1, focus: "pension" },
    });

    const merged = mergeAnalysisResult(prev, data, "pension");
    expect(merged.summary).toBe("הסיכום המלא");
    expect(merged.actionItems).toBe(prev.actionItems);
    expect(merged.agents?.pension).toBe(freshPension);
    expect(merged.agents?.payslip).toBe(prev.agents?.payslip);
    expect(merged.globalScore?.score).toBe(82);
    expect(merged.meta?.focus).toBe("pension");
  });

  it("focused payload without agents keeps the previous lanes", () => {
    const prev = fullRun();
    const data = fullRun({ agents: undefined });
    const merged = mergeAnalysisResult(prev, data, "gemel");
    expect(merged.agents).toEqual(prev.agents);
  });
});
