import { apiJson, apiFormUpload } from "./client";

export type InsurancePolicyDTO = {
  id: string;
  type: string;
  provider: string | null;
  policyNumber: string | null;
  monthlyPremium: number | null;
  coverageAmount: number | null;
  startDate: string | null;
  endDate: string | null;
  status: string;
};

export type InsuranceProfileDTO = {
  hasLifeInsurance: boolean | null;
  hasHealthInsurance: boolean | null;
  hasDisabilityInsurance: boolean | null;
  hasApartmentInsurance: boolean | null;
  hasCarInsurance: boolean | null;
};

export type InsuranceDuplicate = {
  type: string;
  policies: { provider?: string }[];
  estimatedMonthlyWaste: number;
};

export type InsuranceAnalysisDTO = {
  duplicates: InsuranceDuplicate[];
  duplicateCount: number;
  totalMonthlyWaste: number;
  missingCoverage: string[];
  missingUrgency: string;
  flags: { code: string; urgency: string; label: string }[];
  savings: { totalSavings: number; annualSavings: number };
  hasCriticalGap: boolean;
};

export type InsuranceRecommendationDTO = {
  type: string;
  title: string;
  reason: string;
  urgency: "high" | "medium" | "low";
  financialImpact: string | null;
  confidenceScore: number;
};

export type InsuranceHealthCheck = {
  score: number;
  level: { label: string; code?: string };
  categories: { id: string; label: string; status: string; score: number; detail?: string }[];
};

export type InsuranceAnalysisSummary = {
  hasData: boolean;
  policyCount: number;
  totalMonthlyPremium: number;
};

export type InsuranceAnalysisResponse = {
  success: boolean;
  data?: {
    profile: InsuranceProfileDTO | null;
    personal: { age: number | null; maritalStatus: string | null; childrenCount: number | null };
    assets: { ownsApartment: boolean | null; ownsCar: boolean | null; hasMortgage: boolean | null };
    policies: InsurancePolicyDTO[];
    analysis: InsuranceAnalysisDTO;
    recommendations: InsuranceRecommendationDTO[];
    healthCheck?: InsuranceHealthCheck;
    summary?: InsuranceAnalysisSummary;
    hasImportedPolicies: boolean;
  };
};

export type InsuranceImportHistoryItem = {
  id: string;
  sourceFile: string;
  importedAt: string;
  policyCount: number;
  duplicateCount: number;
  totalMonthlyWaste: number;
  healthScore: number | null;
  annualSavings: number;
};

export type UploadExcelResponse = {
  success: boolean;
  message?: string;
  data?: {
    imported: number;
    savingsDelta?: number;
    healthScore?: number | null;
    healthCheck?: InsuranceHealthCheck;
    analysis?: InsuranceAnalysisDTO;
    recommendations?: InsuranceRecommendationDTO[];
    policies: Pick<InsurancePolicyDTO, "id" | "type" | "provider" | "monthlyPremium" | "status">[];
  };
};

export const getInsuranceImportHistory = () =>
  apiJson<{ success: boolean; data: InsuranceImportHistoryItem[] }>("/api/insurance/import-history", { auth: true });

export const getInsuranceAnalysis = () =>
  apiJson<InsuranceAnalysisResponse>("/api/insurance/analysis", { auth: true });

export const uploadInsuranceExcel = async (file: File): Promise<UploadExcelResponse> => {
  const result = await apiFormUpload<UploadExcelResponse>("/api/insurance/upload-excel", file);
  if (!result.ok) {
    return { success: false, message: result.error.message };
  }
  return result.data;
};

export const deleteInsurancePolicy = (id: string) =>
  apiJson<{ success: boolean }>(`/api/insurance/policies/${id}`, {
    method: "DELETE",
    auth: true,
  });
