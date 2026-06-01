import { apiJson } from "./client";

export type RecommendationKind =
  | "life"
  | "health"
  | "disability"
  | "apartment"
  | "car"
  | "pension_increase";

export type RecommendationImportance = "critical" | "high" | "medium" | "low";
export type RecommendationStatus = "active" | "dismissed" | "purchased";

export type PriceRange = {
  min: number;
  average: number;
  max: number;
  currency: string;
};

export type RecommendationItem = {
  _id: string;
  kind: RecommendationKind;
  importance: RecommendationImportance;
  title: string;
  reasoning: string[];
  priceRange: PriceRange;
  coverageEstimate: number | null;
  status: RecommendationStatus;
  createdAt: string;
};

export type RecommendationsResponse = {
  success: boolean;
  count?: number;
  data?: RecommendationItem[];
  message?: string;
};

export async function listRecommendations(): Promise<RecommendationsResponse> {
  const result = await apiJson<RecommendationsResponse>("/api/recommendations?status=active", {
    auth: true,
    fallbackErrorMessage: "לא הצלחנו לטעון המלצות.",
  });
  if (!result.ok) return { success: false, message: result.error.message };
  return result.data ?? { success: false };
}

export async function runRecommendations(): Promise<RecommendationsResponse> {
  const result = await apiJson<RecommendationsResponse>("/api/recommendations/run", {
    method: "POST",
    auth: true,
    fallbackErrorMessage: "לא הצלחנו לחשב המלצות.",
  });
  if (!result.ok) return { success: false, message: result.error.message };
  return result.data ?? { success: false };
}

export async function dismissRecommendation(id: string): Promise<RecommendationsResponse> {
  const result = await apiJson<RecommendationsResponse>(`/api/recommendations/${id}/dismiss`, {
    method: "POST",
    auth: true,
    fallbackErrorMessage: "לא הצלחנו לעדכן.",
  });
  if (!result.ok) return { success: false, message: result.error.message };
  return result.data ?? { success: false };
}

export async function markRecommendationPurchased(id: string): Promise<RecommendationsResponse> {
  const result = await apiJson<RecommendationsResponse>(`/api/recommendations/${id}/purchased`, {
    method: "POST",
    auth: true,
    fallbackErrorMessage: "לא הצלחנו לעדכן.",
  });
  if (!result.ok) return { success: false, message: result.error.message };
  return result.data ?? { success: false };
}
