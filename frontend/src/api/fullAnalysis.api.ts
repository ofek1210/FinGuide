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

export type FullAnalysisActionItem = {
  priority: "high" | "medium" | "low";
  domain: string;
  title: string;
  description?: string;
  actionUrl?: string;
  source?: string;
  financialImpact?: string | null;
};

export type FullAnalysisGlobalScore = {
  year: number;
  score: number;
  level: string;
  label: string;
  categories?: Array<{
    id: string;
    label: string;
    score: number;
    maxScore: number;
    status: string;
  }>;
};

export type FullAnalysisResponse = {
  success: boolean;
  runId?: string;
  summary?: string;
  summarySource?: "claude" | "rule" | "fallback" | "demo";
  recommendations?: FullAnalysisRecommendation[];
  canvas?: {
    focus: string;
    summaryHe: string;
    agentsToRun?: string[];
  };
  govData?: {
    ready: boolean;
    pension?: { trackCount?: number; source?: string };
    insurance?: { providerCount?: number; source?: string };
  };
  globalScore?: FullAnalysisGlobalScore | null;
  actionItems?: FullAnalysisActionItem[];
  agents?: {
    payslip: AgentResult;
    insurance: AgentResult;
    pension: AgentResult;
    gemel: AgentResult;
    profile: AgentResult;
  };
  meta?: {
    durationMs: number;
    agentCount: number;
    successCount: number;
    focus?: string;
    isDemo?: boolean;
  };
};

export const runFullAnalysis = (params?: {
  focus?: "all" | "payslip" | "insurance" | "pension" | "gemel";
  skipLLM?: boolean;
  refreshGovData?: boolean;
  demo?: boolean;
}) =>
  apiJson<FullAnalysisResponse>("/api/ai/full-analysis", {
    method: "POST",
    auth: true,
    body: params || {},
  });
