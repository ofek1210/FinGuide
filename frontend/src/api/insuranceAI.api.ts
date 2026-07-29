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
  typeLabelHe?: string;
  policies: { provider?: string; policyNumber?: string; monthlyPremium?: number }[];
  policyCount?: number;
  status?: string;
  confidence?: string;
  estimatedMonthlyWaste: number | null;
  premiumUnderReviewMonthly?: number | null;
  verifiedSavingMonthly?: number | null;
  reasonHe?: string;
};

export type InsuranceAnalysisDTO = {
  duplicates: InsuranceDuplicate[];
  duplicateCount: number;
  totalMonthlyWaste: number;
  premiumUnderReviewMonthly?: number | null;
  verifiedSavingMonthly?: number;
  vehicleVerificationNeeded?: boolean;
  missingCoverage: string[];
  missingUrgency: string;
  flags: { code: string; urgency: string; label: string }[];
  needAssessments?: {
    type: string;
    needed: boolean | null;
    status: string;
    titleHe: string;
    messageHe: string;
    whyItMatters?: string;
  }[];
  savings: {
    totalSavings: number;
    annualSavings: number;
    verified?: boolean;
    premiumUnderReviewMonthly?: number | null;
  };
  hasCriticalGap: boolean;
};

export type InsuranceRecommendationDTO = {
  type: string;
  title: string;
  reason: string;
  urgency: "high" | "medium" | "low";
  financialImpact: string | null;
  confidenceScore: number;
  confidenceLabelHe?: string;
  nextActionHe?: string;
};

export type InsuranceDecisionStatus = "healthy" | "needs_review" | "action_required";

export type InsuranceExecutiveAction = {
  id: string;
  priority: "high" | "medium" | "low";
  priorityLabelHe: string;
  titleHe: string;
  reasonHe: string;
  expectedBenefitHe: string;
  evidence?: Record<string, unknown>;
};

export type InsuranceDecision = {
  status: InsuranceDecisionStatus;
  statusLabelHe: string;
  statusTone: "green" | "yellow" | "red";
  statusSummaryHe: string;
  healthScore: number;
  healthLabelHe: string;
  healthExplanation: string[];
  coverageCompleteness: {
    policyId: string;
    coverageType: string;
    coverageTypeLabelHe: string;
    provider: string | null;
    completenessScore: number;
    coverageConfidence: "high" | "medium" | "low";
    coverageConfidenceLabelHe: string;
    checks: { id: string; labelHe: string; status: "ok" | "missing" | "unknown" }[];
    missingInformation: string[];
    manualReviewRecommended: boolean;
  }[];
  companyQuality: {
    averageServiceIndex: number | null;
    averageServiceTier: string | null;
    insurers: {
      policyId: string;
      type: string;
      provider: string | null;
      serviceScore: number | null;
      claimPaymentRate: number | null;
      satisfactionScore: number | null;
      serviceTier: string;
      complaintIndicators: number | string | null;
      complaintIndicatorsLabelHe: string;
    }[];
  };
  profileInsights: {
    type: string;
    status: string;
    needed: boolean | null;
    titleHe: string;
    messageHe: string;
    whyItMatters?: string | null;
  }[];
  executiveActions: InsuranceExecutiveAction[];
  quickAnswers: {
    portfolioHealth: { status: string; labelHe: string; score: number; scoreLabelHe: string };
    hasDuplicates: { value: boolean; labelHe: string; tone: string };
    missingImportant: { value: boolean; labelHe: string; tone: string };
    possiblyUnnecessary: { value: boolean; labelHe: string; tone: string };
    companyQuality: { value: boolean; labelHe: string; tone: string };
  };
  portfolioOverview?: {
    policyCount: number;
    activeCount: number;
    inactiveCount: number;
    companies: string[];
    policyTypes: { type: string; labelHe: string }[];
  } | null;
  methodologyHe?: string;
};

export type InsuranceHealthCheck = {
  score: number | null;
  scoreDisabled?: boolean;
  headlineHe?: string;
  messageHe?: string;
  level: { label: string; code?: string; level?: string };
  categories: { id: string; label: string; status: string; score: number; detail?: string }[];
};

export type InsuranceAnalysisSummary = {
  hasData: boolean;
  policyCount: number;
  totalMonthlyPremium: number;
};

export type InsurancePricingSource = {
  sourceName: string;
  sourceDate: string;
  sourceUrl: string | null;
  dataCollectionMethod: string;
};

export type InsurancePricingComparison = {
  userMonthlyPremium: number | null;
  fairRange: { min: number; average: number; max: number; currency: string; sampleCount?: number };
  assessment: string;
  monthlyDeltaVsAvg: number | null;
  annualDeltaVsAvg: number | null;
  disclaimer?: string;
  disclaimerEn?: string;
};

export type InsuranceMarketAdvice = {
  hasData: boolean;
  overallVerdict?: string;
  overallVerdictLabelHe?: string;
  comparisonMatrix?: {
    policyId: string;
    type: string;
    provider: string | null;
    userCost?: number | null;
    marketAvg?: number | null;
    premiumVsMarket?: string | null;
    serviceScore?: number | null;
    claimPaymentRate?: number | null;
    satisfactionScore?: number | null;
    serviceTier?: string | null;
    complaintIndicators?: number | string | null;
    duplicate?: boolean;
    verdict?: string;
    comparisonNoteHe?: string | null;
  }[];
  coverageSummaries?: {
    policyId: string;
    coverageType: string;
    coverageTypeLabelHe: string;
    provider: string | null;
    status?: string;
    completenessScore?: number;
    coverageConfidence?: "high" | "medium" | "low";
    coverageConfidenceLabelHe?: string;
    checks?: { id: string; labelHe: string; status: "ok" | "missing" | "unknown" }[];
    missingInformation: string[];
    manualReviewRecommended: boolean;
  }[];
  portfolioOverview?: {
    policyCount: number;
    activeCount: number;
    inactiveCount: number;
    companies: string[];
    policyTypes: { type: string; labelHe: string }[];
  };
  companyQuality?: {
    averageServiceIndex: number | null;
    averageServiceTier: string | null;
    source?: string;
    insurers?: InsuranceDecision["companyQuality"]["insurers"];
  };
  pricingSource?: InsurancePricingSource | null;
  disclaimer?: string;
  disclaimerEn?: string;
  dataSource?: string;
};

export type InsuranceClearinghouseCoverageDTO = {
  fundId: string;
  fundName: string;
  provider: string | null;
  coverageType: string;
  monthlyPremium: number | null;
  coverageAmount: number | null;
  source: "clearinghouse";
};

export type InsuranceDataSourceStatus = "missing" | "ready" | "empty";

export type InsuranceDataSourcesDTO = {
  clearinghouse: {
    status: InsuranceDataSourceStatus;
    labelHe: string;
    coverageCount: number;
    coverages: InsuranceClearinghouseCoverageDTO[];
  };
  harHabituach: {
    status: InsuranceDataSourceStatus;
    labelHe: string;
    policyCount: number;
  };
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
    decision?: InsuranceDecision;
    summary?: InsuranceAnalysisSummary;
    hasImportedPolicies: boolean;
    marketAdvice?: InsuranceMarketAdvice;
    dataSources?: InsuranceDataSourcesDTO;
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
