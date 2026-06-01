import { apiJson } from "./client";

export type InsightSeverity = "info" | "warning" | "critical";
export type InsightStatus = "active" | "dismissed" | "resolved";
export type InsightKind =
  | "salary_drop"
  | "salary_growth"
  | "pension_low"
  | "pension_missing"
  | "tax_anomaly"
  | "missing_payslip"
  | "unusual_deduction"
  | "study_fund_low";

export type InsightItem = {
  _id: string;
  kind: InsightKind;
  severity: InsightSeverity;
  title: string;
  description: string;
  payload?: Record<string, unknown>;
  status: InsightStatus;
  createdAt: string;
};

export type InsightsResponse = {
  success: boolean;
  count?: number;
  data?: InsightItem[];
  message?: string;
};

export async function listInsights(params?: {
  status?: InsightStatus;
  severity?: InsightSeverity;
}): Promise<InsightsResponse> {
  const qs = new URLSearchParams();
  if (params?.status) qs.set("status", params.status);
  if (params?.severity) qs.set("severity", params.severity);
  const query = qs.toString() ? `?${qs.toString()}` : "";

  const result = await apiJson<InsightsResponse>(`/api/insights${query}`, {
    auth: true,
    fallbackErrorMessage: "לא הצלחנו לטעון תובנות.",
  });
  if (!result.ok) return { success: false, message: result.error.message };
  return result.data ?? { success: false };
}

export async function runInsightsAnalysis(): Promise<InsightsResponse> {
  const result = await apiJson<InsightsResponse>("/api/insights/run", {
    method: "POST",
    auth: true,
    fallbackErrorMessage: "לא הצלחנו להריץ ניתוח.",
  });
  if (!result.ok) return { success: false, message: result.error.message };
  return result.data ?? { success: false };
}

export async function dismissInsight(id: string): Promise<InsightsResponse> {
  const result = await apiJson<InsightsResponse>(`/api/insights/${id}/dismiss`, {
    method: "POST",
    auth: true,
    fallbackErrorMessage: "לא הצלחנו לסמן כנקרא.",
  });
  if (!result.ok) return { success: false, message: result.error.message };
  return result.data ?? { success: false };
}
