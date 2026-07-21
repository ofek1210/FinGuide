import { apiBlob, apiJson } from "./client";

export type ExecutivePriorityAction = {
  rank: number;
  title: string;
  explanation: string;
  whyNow: string;
  expectedBenefit: string;
  priorityScore: number;
  priorityLabel: string;
  urgency: string;
  impactStars: number;
  possibleSavings: number | null;
  sourceAgents?: string[];
  confidence?: number | null;
  conflictNote?: string | null;
};

export type ExecutiveReportSection = {
  executiveSummary: string;
  topPriorityActions: ExecutivePriorityAction[];
  financialStrengths: { title: string; explanation: string }[];
  risks: { title: string; explanation: string; severity?: string }[];
  opportunities: { title: string; explanation: string; possibleSavings?: number | null }[];
  conflicts: { title: string; explanation: string; tradeOff: string; recommendation: string }[];
  roadmap: {
    immediate: { title: string; explanation: string; rank: number }[];
    within30Days: { title: string; explanation: string; rank: number }[];
    within3Months: { title: string; explanation: string; rank: number }[];
    longTerm: { title: string; explanation: string; rank: number }[];
  };
  thingsToReviewRegularly: string[];
};

export type ExecutiveReport = {
  meta: {
    userId: string;
    generatedAt: string;
    reportVersion: string;
    agentCount: number;
    globalHealthScore: number | null;
    stats?: {
      rawRecommendationCount: number;
      mergedCount: number;
      conflictCount: number;
    };
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

/** The user's most recent saved report (kept 7 days server-side), if any. */
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
  const filename = match?.[1] || `FinGuide-Financial-Report-${new Date().toISOString().slice(0, 10)}.pdf`;

  return { success: true, blob: result.blob, filename } as const;
};
