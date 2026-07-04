import { apiJson, apiFormUpload } from "./client";

export type PensionSummaryDTO = {
  hasData: boolean;
  dataSource?: "har_hakesef" | "quarterly_report" | "manual" | "payslip" | null;
  grossSalary: number | null;
  pensionEmployee: number | null;
  pensionEmployer: number | null;
  totalMonthlyContribution: number;
  expectedMinEmployee: number | null;
  expectedMinEmployer: number | null;
  hasMissingPension: boolean;
  currentAge: number | null;
  retirementAge: number;
  currentAccumulation: number;
  currentMgmtFee?: number | null;
  currentFundName?: string | null;
  fundCount?: number;
  hasStudyFund?: boolean | null;
  parseWarnings?: string[];
};

export type PensionScenario = {
  label: string;
  accumulation: number;
  monthlyPension: number;
};

export type PensionProjectionDTO = {
  available: boolean;
  reason?: string;
  monthsToRetirement?: number;
  projectedAccumulation?: number;
  monthlyPensionEstimate?: number;
  replacementRatio?: number | null;
  scenarios?: { base: PensionScenario; optimistic: PensionScenario };
  contributionRules?: { belowMinimum: boolean; rate: number; minimumRate: number };
  mgmtFeeSavings?: { savingsByRetirement: number; additionalMonthlyPension: number } | null;
};

export type PensionRecommendationDTO = {
  type: string;
  title: string;
  reason: string;
  urgency: "high" | "medium" | "low";
  financialImpact: string | null;
  confidenceScore: number;
};

export type PensionBenchmarkFundDTO = {
  fundId?: string;
  fundName: string;
  provider?: string | null;
  fundType?: string;
  matchedTrack: { id: string; name: string; provider: string; rank: number } | null;
  matchConfidence: number;
  marketRankPercentile: number | null;
  rankLabel: "above_average" | "average" | "below_average" | "unknown";
  feeVsMarket: "excellent" | "fair" | "above_market" | "high" | "unknown";
  marketAvgFee?: number;
  userFee?: number | null;
  riskLevel?: string;
  recommendedRiskLevel?: string | null;
  riskMismatch?: boolean;
  potentialSavingsToRetirement: number;
};

export type PensionBenchmarkDTO = {
  funds: PensionBenchmarkFundDTO[];
  summary: {
    totalPotentialSavings: number;
    avgRankPercentile: number | null;
    fundsAboveMarketFee: number;
    riskMismatchCount: number;
    belowAverageCount: number;
    issuesCount: number;
    recommendedRiskLevel: string | null;
  };
};

export type PensionHealthCategoryDTO = {
  id: string;
  label: string;
  score: number;
  maxScore: number;
  status: "good" | "warning" | "poor";
  detail: string;
};

export type PensionHealthCheckDTO = {
  score: number;
  level: { level: string; label: string };
  categories: PensionHealthCategoryDTO[];
  disclaimer: string;
};

export type PensionAnalysisData = {
  summary: PensionSummaryDTO;
  projection: PensionProjectionDTO | null;
  benchmark?: PensionBenchmarkDTO;
  healthCheck?: PensionHealthCheckDTO;
  recommendations: PensionRecommendationDTO[];
};

export type PensionAnalysisResponse = {
  success: boolean;
  data?: PensionAnalysisData;
};

export type SimulationResponse = {
  success: boolean;
  data?: {
    simulation: {
      retirementAge: number;
      additionalMonthlyContribution: number;
      targetMgmtFee: number;
      projectedAccumulation: number;
      monthlyPensionEstimate: number;
    };
    baseline: {
      retirementAge: number;
      projectedAccumulation: number;
      monthlyPensionEstimate: number;
    };
    delta: {
      accumulationDiff: number;
      monthlyPensionDiff: number;
    };
  };
};

export type PensionFundDTO = {
  id: string;
  fundName: string;
  fundType: string;
  provider: string | null;
  currentBalance: number;
  monthlyEmployeeDeposit: number;
  monthlyEmployerDeposit: number;
  managementFeeAccumulation: number;
  managementFeeDeposit: number;
  investmentTrack?: string | null;
  source?: string;
};

export type PensionImportSnapshotDTO = {
  id: string;
  source: string;
  sourceFile: string | null;
  importedAt: string;
  fundCount: number;
  totalPotentialSavings: number;
  healthScore: number | null;
  avgRankPercentile: number | null;
  fundsAboveMarketFee: number;
};

export type PensionRiskLevel = "LOW" | "MEDIUM" | "HIGH" | "INCREASED";

export type PensionLeadingFundDTO = {
  id: string;
  fundName: string;
  managingBody: string;
  yield3Years: number | null;
  managementFeeAccumulation: number | null;
  managementFeeDeposit: number | null;
  sharpeRatio: number | null;
  riskCategory?: string;
};

export type PensionLeadingFundsResponse = {
  success: boolean;
  data?: {
    riskCategory: PensionRiskLevel;
    funds: PensionLeadingFundDTO[];
    source: "finq" | "cache" | "cache_fallback";
    updatedAt?: string;
    cached?: boolean;
    warning?: string;
  };
};

export type PensionMarketFundResponse = {
  success: boolean;
  data?: {
    fund: PensionLeadingFundDTO;
    source: "finq" | "cache_fallback";
    riskCategory?: string;
    updatedAt?: string;
  };
};

export type UpdatePensionFundBody = Partial<{
  fundName: string;
  fundType: string;
  provider: string;
  currentBalance: number;
  monthlyEmployeeDeposit: number;
  monthlyEmployerDeposit: number;
  managementFeeAccumulation: number;
  managementFeeDeposit: number;
  investmentTrack: string;
}>;

export type UploadPensionBody = {
  fundName: string;
  fundType?: string;
  provider?: string;
  currentBalance?: number;
  monthlyEmployeeDeposit?: number;
  monthlyEmployerDeposit?: number;
  managementFeeAccumulation?: number;
  managementFeeDeposit?: number;
};

export type UploadPensionFileResponse = {
  success: boolean;
  message?: string;
  data?: {
    imported: number;
    merged?: number;
    created?: number;
    savingsDelta?: number;
    healthScore?: number | null;
    warnings: string[];
    funds: PensionFundDTO[];
    summary?: { totalFunds: number; totalBalance: number | null; fundTypes: string[] };
  };
};

export const getPensionAnalysis = () =>
  apiJson<PensionAnalysisResponse>("/api/pension/analysis", { auth: true });

export const getPensionImportHistory = () =>
  apiJson<{ success: boolean; data: PensionImportSnapshotDTO[] }>("/api/pension/import-history", { auth: true });

export const getPensionFunds = () =>
  apiJson<{ success: boolean; data: PensionFundDTO[] }>("/api/pension/funds", { auth: true });

export const uploadPensionFund = (body: UploadPensionBody) =>
  apiJson<{ success: boolean; message: string; data: PensionFundDTO }>("/api/pension/upload", {
    method: "POST",
    auth: true,
    body: JSON.stringify(body),
  });

export const deletePensionFund = (id: string) =>
  apiJson<{ success: boolean; message: string }>(`/api/pension/funds/${id}`, {
    method: "DELETE",
    auth: true,
  });

export const updatePensionFund = (id: string, body: UpdatePensionFundBody) =>
  apiJson<{ success: boolean; message: string; data: PensionFundDTO }>(`/api/pension/funds/${id}`, {
    method: "PATCH",
    auth: true,
    body: JSON.stringify(body),
  });

export const simulatePensionScenario = (params: {
  retirementAge?: number;
  additionalMonthlyContribution?: number;
  targetMgmtFee?: number;
}) =>
  apiJson<SimulationResponse>("/api/pension/simulate", {
    method: "POST",
    auth: true,
    body: JSON.stringify(params),
  });

export const uploadPensionFile = async (
  file: File,
  importSource: "har_hakesef" | "quarterly_report" = "har_hakesef",
): Promise<UploadPensionFileResponse & { message?: string }> => {
  const qs = importSource === "quarterly_report" ? "?importSource=quarterly_report" : "";
  const result = await apiFormUpload<UploadPensionFileResponse>(`/api/pension/upload-file${qs}`, file);
  if (!result.ok) {
    return { success: false, message: result.error.message };
  }
  return result.data;
};

export const getPensionLeadingFunds = (risk: PensionRiskLevel, refresh = false) => {
  const qs = new URLSearchParams({ risk });
  if (refresh) qs.set("refresh", "true");
  return apiJson<PensionLeadingFundsResponse>(`/api/pension/leading-funds?${qs.toString()}`, { auth: true });
};

export const getPensionMarketFund = (id: string, risk?: PensionRiskLevel) => {
  const qs = risk ? `?risk=${risk}` : "";
  return apiJson<PensionMarketFundResponse>(`/api/pension/fund/${encodeURIComponent(id)}${qs}`, { auth: true });
};
