import type { FullAnalysisResponse } from "../../api/fullAnalysis.api";
import type { AgentId } from "../../theme/agents";

/* ============================================================
   Master-agent state merge — the one nontrivial piece of the
   Hub's analysis state, extracted pure so it can be unit-tested.

   A full run replaces everything, including the LLM-generated
   unified summary. A focused (single-agent) run refreshes only
   its own lane + the global score; the cross-referenced
   synthesis stays from the last full run — and never appears
   before one happened.
   ============================================================ */

export type BackendAgentKey = "payslip" | "insurance" | "pension" | "gemel";

/** Frontend agent id → backend agents{} key. */
export const AGENT_KEY: Record<AgentId, BackendAgentKey> = {
  payslips: "payslip",
  insurance: "insurance",
  pension: "pension",
  gemel: "gemel",
};

/** Backend domain key → frontend agent id. */
export const DOMAIN_TO_AGENT: Record<string, AgentId> = {
  payslip: "payslips",
  insurance: "insurance",
  pension: "pension",
  gemel: "gemel",
};

/** Merge an analysis response into the previous state. */
export function mergeAnalysisResult(
  prev: FullAnalysisResponse | null,
  data: FullAnalysisResponse,
  focus?: BackendAgentKey,
): FullAnalysisResponse {
  // Full run — take everything, including the LLM-generated unified summary.
  if (!focus) return data;
  // Focused run with no prior full run — show the agent's data but strip any
  // summary, so the unified summary never appears without a full analysis.
  if (!prev) return { ...data, summary: undefined };
  // Focused run after a full run — refresh only this agent's lane + the global
  // score; keep the last full-run summary untouched.
  return {
    ...prev,
    globalScore: data.globalScore ?? prev.globalScore,
    meta: data.meta ?? prev.meta,
    agents: prev.agents || data.agents
      ? ({ ...(prev.agents ?? {}), ...(data.agents?.[focus] ? { [focus]: data.agents[focus] } : {}) } as FullAnalysisResponse["agents"])
      : undefined,
  };
}
