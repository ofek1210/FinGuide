import { apiJson } from "./client";

export type DashboardScores = {
  overall: number | null;
  payslip: number | null;
  insurance: number | null;
  pension: number | null;
};

export type DashboardSummaryData = {
  scores: DashboardScores;
  documents: {
    total: number;
    completed: number;
    failed: number;
    pending: number;
  };
  profile: {
    hasProfile: boolean;
    hasInsuranceData: boolean;
    hasPensionData: boolean;
    importedPolicies: number;
  };
  warnings: string[];
  topRecommendations: {
    id: string;
    title: string;
    importance?: string;
    category?: string;
  }[];
};

export type DashboardSummaryResponse = {
  success: boolean;
  data: DashboardSummaryData;
};

export const getDashboardSummary = () =>
  apiJson<DashboardSummaryResponse>("/api/dashboard/summary", { auth: true });
