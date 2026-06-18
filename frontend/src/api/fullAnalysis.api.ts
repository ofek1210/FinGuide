import { apiJson } from "./client";

export type AgentStatus = "success" | "no_data" | "no_profile" | "error";

export type AgentResult = {
  status: AgentStatus;
  message: string | null;
  data: Record<string, unknown> | null;
  recommendationCount: number;
  durationMs: number;
  explanation: string | null;
};

export type FullAnalysisRecommendation = {
  type: string;
  title: string;
  reason: string;
  urgency: "high" | "medium" | "low";
  financialImpact: string | null;
  confidenceScore: number;
  agentId: string;
};

export type FullAnalysisResponse = {
  success: boolean;
  runId?: string;
  summary?: string;
  summarySource?: "claude" | "rule" | "fallback";
  recommendations?: FullAnalysisRecommendation[];
  agents?: {
    payslip: AgentResult;
    insurance: AgentResult;
    pension: AgentResult;
    profile: AgentResult;
  };
  meta?: {
    durationMs: number;
    agentCount: number;
    successCount: number;
  };
};

export const runFullAnalysis = (params?: {
  focus?: "all" | "payslip" | "insurance" | "pension";
  skipLLM?: boolean;
}) =>
  apiJson<FullAnalysisResponse>("/api/ai/full-analysis", {
    method: "POST",
    auth: true,
    body: JSON.stringify(params || {}),
  });
