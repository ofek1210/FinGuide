import { apiJson } from "./client";

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

export type InsuranceAnalysisResponse = {
  success: boolean;
  data?: {
    profile: InsuranceProfileDTO | null;
    personal: { age: number | null; maritalStatus: string | null; childrenCount: number | null };
    assets: { ownsApartment: boolean | null; ownsCar: boolean | null; hasMortgage: boolean | null };
    policies: InsurancePolicyDTO[];
    analysis: InsuranceAnalysisDTO;
    recommendations: InsuranceRecommendationDTO[];
    hasImportedPolicies: boolean;
  };
};

export type UploadExcelResponse = {
  success: boolean;
  message?: string;
  data?: {
    imported: number;
    policies: Pick<InsurancePolicyDTO, "id" | "type" | "provider" | "monthlyPremium" | "status">[];
  };
};

export const getInsuranceAnalysis = () =>
  apiJson<InsuranceAnalysisResponse>("/api/insurance/analysis", { auth: true });

export const uploadInsuranceExcel = async (file: File): Promise<UploadExcelResponse> => {
  const token = localStorage.getItem("token");
  const form = new FormData();
  form.append("file", file);
  const res = await fetch("/api/insurance/upload-excel", {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: form,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { message?: string };
    return { success: false, message: err.message ?? "שגיאה בהעלאת הקובץ" };
  }
  return res.json() as Promise<UploadExcelResponse>;
};

export const deleteInsurancePolicy = (id: string) =>
  apiJson<{ success: boolean }>(`/api/insurance/policies/${id}`, {
    method: "DELETE",
    auth: true,
  });
