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
  impactAmount?: number;
};

export type PensionInsightSeverity = "info" | "low" | "medium" | "high";

export type PensionInsightBenchmarkDTO = {
  group?: string | null;
  comparisonGroupLabel?: string | null;
  average?: number | null;
  median?: number | null;
  percentile?: number | null;
  return1YPercentile?: number | null;
  feePercentile?: number | null;
  riskPercentile?: number | null;
  foreignMedian?: number | null;
};

export type PensionInsightEstimatedImpactDTO = {
  annual?: number | null;
  retirement?: number | null;
  currency?: "ILS" | string;
};

export type PensionStructuredInsightDTO = {
  id: string;
  category: string;
  severity: PensionInsightSeverity;
  title: string;
  finding: string;
  personalDataUsed?: string[];
  marketDataUsed?: string[];
  benchmark?: PensionInsightBenchmarkDTO;
  estimatedImpact?: PensionInsightEstimatedImpactDTO;
  recommendedAction?: string;
  confidence?: number;
  assumptions?: string[];
  limitations?: string[];
  requiresLicensedAdvisor?: boolean;
  disclaimer?: string;
  fundId?: string;
};

export type PensionInsightMetaDTO = {
  fundCount?: number;
  analyzersRun?: string[];
  marketMatches?: Array<{
    fundId?: string;
    matchConfidence?: number;
    dataComplete?: boolean;
    peerGroupSize?: number;
  }>;
  dataCompleteness?: {
    hasOnboardingProfile?: boolean;
    hasAge?: boolean;
    hasRiskTolerance?: boolean;
    hasMaritalStatus?: boolean;
    marketMatchRate?: number;
  };
  generatedAt?: string;
  disclaimer?: string;
  durationMs?: number;
  marketDataError?: string;
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

export type {
  AccountAnalysis,
  AdvisoryDataQuality,
  AdvisoryLlmMeta,
  AdvisoryMarketData,
  AdvisoryMissingDataItem,
  CardOutcome,
  ConfidenceLevel,
  PrimaryRecommendation,
  RecommendationCard as RecommendationCardDTO,
  RecommendationCardType,
  RecommendationEngine,
  ThreeCardAdvisoryData,
  ThreeCardMeta,
} from "./financialAdvisory.types";

export type RecommendationConfidenceLevel = import("./financialAdvisory.types").ConfidenceLevel;

export type PensionFormattedRecommendationDTO = import("./financialAdvisory.types").PrimaryRecommendation;

export type PensionAnalysisData = {
  summary: PensionSummaryDTO;
  projection: PensionProjectionDTO | null;
  profile?: Record<string, unknown> | null;
  productType?: "PENSION" | string;
} & Partial<import("./financialAdvisory.types").ThreeCardAdvisoryData>;

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
  accountNumber?: string | null;
  currentBalance: number;
  monthlyEmployeeDeposit: number;
  monthlyEmployerDeposit: number;
  managementFeeAccumulation: number;
  managementFeeDeposit: number;
  investmentTrack?: string | null;
  ytdReturn?: number | null;
  activityStatus?: "ACTIVE" | "INACTIVE" | "UNKNOWN" | null;
  status?: "active" | "closed";
  isActive?: boolean;
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
  finqRank?: number | null;
  yield12Months?: number | null;
  yield3Years: number | null;
  yield5Years?: number | null;
  yieldYtd?: number | null;
  equityExposurePct?: number | null;
  logoPath?: string;
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

export type PensionFreePreviewFund = {
  previewKey: string;
  fundName: string;
  provider: string | null;
  productType?: string;
  accountNumber: string | null;
  activityStatus: "ACTIVE" | "INACTIVE" | "UNKNOWN";
  fundType: string;
  status: string;
  isActive: boolean;
  requiresManualBalance?: boolean;
};

export type ManualFundEntry = {
  previewKey?: string;
  fundName: string;
  provider?: string | null;
  accountNumber?: string | null;
  activityStatus?: "ACTIVE" | "INACTIVE" | "UNKNOWN";
  fundType: string;
  currentBalance: number | "";
  investmentTrack?: string;
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
    agentReadiness?: {
      pensionReady: boolean;
      gemelReady: boolean;
      pensionInsuranceReady: boolean;
      pensionFundCount: number;
      gemelFundCount: number;
      pensionCoverageCount: number;
    };
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

export const uploadPensionFreePreview = async (file: File) => {
  const result = await apiFormUpload<{
    success: boolean;
    message?: string;
    data?: {
      sourceKind: string;
      funds: PensionFreePreviewFund[];
      narrative?: string;
      summary?: { parseWarnings?: string[] };
    };
  }>("/api/pension/upload-free-preview", file);
  if (!result.ok) {
    return { success: false, message: result.error.message };
  }
  return result.data;
};

export const uploadPensionClearinghouse = async (file: File) => {
  const result = await apiFormUpload<UploadPensionFileResponse & { message?: string }>(
    "/api/pension/upload-clearinghouse",
    file,
  );
  if (!result.ok) {
    return { success: false, message: result.error.message };
  }
  return result.data;
};

export const completeManualPensionFunds = async (funds: ManualFundEntry[]) => {
  const result = await apiJson<{
    success: boolean;
    message?: string;
    data?: { imported: number; funds: PensionFundDTO[] };
  }>("/api/pension/complete-manual-funds", {
    method: "POST",
    auth: true,
    body: JSON.stringify({ funds }),
  });
  if (!result.ok) {
    return { success: false as const, message: result.error.message };
  }
  return result.data;
};

export const getPensionLeadingFunds = (risk: PensionRiskLevel, refresh = false) => {
  const qs = new URLSearchParams({ risk });
  if (refresh) qs.set("refresh", "true");
  return apiJson<PensionLeadingFundsResponse>(`/api/pension/leading-funds/finq?${qs.toString()}`, { auth: true });
};

export const getPensionMarketFund = (id: string, risk?: PensionRiskLevel) => {
  const qs = risk ? `?risk=${risk}` : "";
  return apiJson<PensionMarketFundResponse>(`/api/pension/fund/${encodeURIComponent(id)}${qs}`, { auth: true });
};
