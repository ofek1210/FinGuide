import { apiJson } from "./client";

export type DayCount = { date: string; count: number };

export type AdminStats = {
  users: {
    total: number;
    onboardingCompleted: number;
    onboardingRate: number;
    googleUsers: number;
    newByDay: DayCount[];
    activeLast7d: number;
  };
  documents: {
    total: number;
    byStatus: Record<string, number>;
    uploadsByDay: DayCount[];
    ocrSuccessRate: number | null;
  };
  ai: {
    conversations: number;
    messages: number;
    bySource: Record<string, number>;
    totalTokens: number;
    totalCalls: number;
  };
  generatedAt: string;
};

type AdminStatsResponse = {
  success: boolean;
  data?: AdminStats;
};

export const getAdminStats = () =>
  apiJson<AdminStatsResponse>("/api/admin/stats", {
    auth: true,
    fallbackErrorMessage: "שגיאה בטעינת נתוני הניהול.",
  });
