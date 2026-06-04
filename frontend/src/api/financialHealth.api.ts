import { apiJson } from "./client";

export type HealthCategoryStatus = "good" | "warning" | "poor";

export type HealthScoreCategory = {
  key: string;
  name: string;
  score: number;
  maxScore: number;
  status: HealthCategoryStatus;
  messages: string[];
};

export type HealthTopAction = {
  title: string;
  description: string;
  actionUrl: string;
};

export type FinancialHealthScore = {
  year: number;
  score: number;
  level: "poor" | "fair" | "good" | "excellent";
  label: string;
  categories: HealthScoreCategory[];
  topActions: HealthTopAction[];
  disclaimer: string;
};

type FinancialHealthResponse = {
  success: boolean;
  message?: string;
  data?: FinancialHealthScore;
};

export const getFinancialHealthScore = async (year: number) => {
  const result = await apiJson<FinancialHealthResponse>(
    `/api/financial-health/score?year=${year}`,
    {
      auth: true,
      fallbackErrorMessage: "לא הצלחנו לטעון את הציון הפיננסי.",
    },
  );

  if (!result.ok) {
    return { success: false, message: result.error.message } as FinancialHealthResponse;
  }

  return result.data || ({ success: false, message: "תגובה לא תקינה." } as FinancialHealthResponse);
};
