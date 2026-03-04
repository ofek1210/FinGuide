import { apiJson } from "./client";

export type HealthResponse = {
  success: boolean;
  message?: string;
  timestamp?: string;
};

export const getHealth = async () => {
  const result = await apiJson<HealthResponse>("/api/health", {
    fallbackErrorMessage: "השרת לא זמין כרגע.",
  });
  if (!result.ok) {
    return { success: false, message: result.error.message } as HealthResponse;
  }
  return result.data || ({ success: false, message: "תגובה לא תקינה." } as HealthResponse);
};
