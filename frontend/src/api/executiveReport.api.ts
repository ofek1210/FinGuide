import { apiBlob, apiJson } from "./client";

export type AgentDataStatus = "available" | "missing" | "error";
export type AgentRecommendationStatus = "hasRecommendations" | "noRecommendations" | "unavailable";

export type PreservedRecommendation = {
  agentId: string;
  recommendationId: string | null;
  title: string;
  description: string;
  reason: string | null;
  expectedBenefit: string | null;
  source: string | null;
  confidence: number | null;
};

export type AgentReportSection = {
  agentId: string;
  title: string;
  dataStatus: AgentDataStatus;
  recommendationStatus: AgentRecommendationStatus;
  statusMessage: string | null;
  missingDetail: { whatIsMissing: string; whatEnables: string } | null;
  dataSummary: { label: string; value: string }[];
  findings: { title: string; explanation: string; severity?: string | null }[];
  recommendations: PreservedRecommendation[];
  plainLanguageExplanation: string | null;
  nextActions: string[];
  sourceData: string | null;
};

export type AgentFirstReport = {
  title: string;
  intro: string;
  agentSections: AgentReportSection[];
  combinedSummary: {
    notes: string[];
    managementFees?: {
      products: unknown[];
      totalEstimatedAnnualExcess: number | null;
    };
  };
  whatToDo: { title: string; action: string; agentId: string }[];
  missingData: {
    agentId: string;
    title: string;
    message: string;
    whatIsMissing: string | null;
    whatEnables: string | null;
  }[];
};

export type ExecutiveReportSection = {
  title: string;
  executiveSummary: string;
  agentReport: AgentFirstReport;
  preservedRecommendations: PreservedRecommendation[];
  conflicts: { title: string; explanation: string; tradeOff: string; recommendation: string }[];
};

export type ExecutiveReport = {
  meta: {
    userId: string;
    generatedAt: string;
    reportVersion: string;
    agentCount: number;
    stats?: Record<string, number>;
  };
  sections: ExecutiveReportSection;
  disclaimer: string;
};

type ExecutiveReportResponse = {
  success: boolean;
  data?: {
    runId: string;
    report: ExecutiveReport;
    meta?: Record<string, unknown>;
  };
};

export const generateExecutiveReport = async (options?: { skipLLM?: boolean }) => {
  const qs = options?.skipLLM ? "?skipLLM=true" : "";
  const result = await apiJson<ExecutiveReportResponse>(`/api/executive/report${qs}`, {
    method: "POST",
    auth: true,
    body: {},
    fallbackErrorMessage: "לא הצלחנו ליצור את הדוח הפיננסי.",
  });

  if (!result.ok) {
    return { success: false, message: result.error.message } as const;
  }

  const payload = result.data;
  if (!payload?.data?.report) {
    return { success: false, message: "תגובה לא תקינה מהשרת." } as const;
  }

  return { success: true, ...payload.data } as const;
};

type LatestExecutiveReportResponse = {
  success: boolean;
  data?: {
    runId: string;
    report: ExecutiveReport;
    savedAt: string;
  } | null;
};

export const getLatestExecutiveReport = async () => {
  const result = await apiJson<LatestExecutiveReportResponse>("/api/executive/report/latest", {
    auth: true,
    fallbackErrorMessage: "לא הצלחנו לטעון את הדוח האחרון.",
  });

  if (!result.ok) {
    return { success: false, message: result.error.message } as const;
  }
  const latest = result.data?.data;
  if (!latest?.report) {
    return { success: true, found: false } as const;
  }
  return { success: true, found: true, ...latest } as const;
};

export const downloadExecutiveReportPdf = async (options?: { runId: string }) => {
  if (!options?.runId) {
    return { success: false, message: "חסר מזהה דוח. יש ליצור דוח לפני ההורדה." } as const;
  }
  const qs = `?runId=${encodeURIComponent(options.runId)}`;
  const result = await apiBlob(`/api/executive/report/pdf${qs}`, {
    auth: true,
    fallbackErrorMessage: "לא הצלחנו להוריד את הדוח.",
  });

  if (!result.ok) {
    return { success: false, message: result.error.message } as const;
  }

  const disposition = result.response.headers.get("Content-Disposition") || "";
  const match = disposition.match(/filename="([^"]+)"/);
  const filename = match?.[1] || `FinGuide-Personal-Report-${new Date().toISOString().slice(0, 10)}.pdf`;

  return { success: true, blob: result.blob, filename } as const;
};
