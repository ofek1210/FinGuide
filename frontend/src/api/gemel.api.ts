import { apiJson, apiBlob } from "./client";
import type {
  AccountAnalysis,
  AdvisoryDataQuality,
  AdvisoryLlmMeta,
  AdvisoryMarketData,
  AdvisoryMissingDataItem,
  PrimaryRecommendation,
  RecommendationCard,
  ThreeCardAdvisoryData,
  ThreeCardMeta,
} from "./financialAdvisory.types";

export type {
  AccountAnalysis,
  AdvisoryDataQuality,
  AdvisoryLlmMeta,
  AdvisoryMarketData,
  AdvisoryMissingDataItem,
  PrimaryRecommendation,
  RecommendationCard,
  ThreeCardAdvisoryData,
  ThreeCardMeta,
};

export type RecommendationCardDTO = RecommendationCard;
export type FormattedRecommendationDTO = PrimaryRecommendation;

export type FinancialStructuredInsightDTO = {
  id: string;
  code: string;
  productType: "PENSION" | "GEMEL" | "HISHTALMUT";
  category: string;
  severity: "critical" | "high" | "medium" | "low" | "info";
  title: string;
  reason: string;
  suggestedAction: string;
  evidence?: Record<string, unknown>;
  financialImpact?: { amount?: number | null; currency?: string; period?: string | null };
  confidence: number;
  productId?: string | null;
  sources?: string[];
  disclaimers?: string[];
};

/* ============================================================
   Gemel API — קופות גמל וקרנות השתלמות (/api/gemel/*)
   Mirrors pension.api.ts. Holdings live in PensionFund
   (fundType: study_fund | provident_fund); market data comes
   from Gemel-Net (data.gov.il).
   ============================================================ */

export type GemelFundType = "study_fund" | "provident_fund";

export type GemelFundDTO = {
  id: string;
  fundName: string;
  fundType: GemelFundType;
  provider: string | null;
  currentBalance: number | null;
  monthlyEmployeeDeposit: number | null;
  monthlyEmployerDeposit: number | null;
  managementFeeAccumulation: number | null;
  managementFeeDeposit: number | null;
  investmentTrack: string | null;
  ytdReturn: number | null;
  activityStatus: string | null;
  status: "active" | "closed";
  isActive: boolean;
  source: string;
};

export type GemelSummaryDTO = {
  hasData: boolean;
  dataSource?: "har_hakesef" | "clearinghouse" | "manual" | "payslip" | null;
  grossSalary: number | null;
  studyFundEmployee: number | null;
  studyFundEmployer: number | null;
  studyFundEmployeeRate: number | null;
  studyFundEmployerRate: number | null;
  expectedEmployee: number | null;
  expectedEmployer: number | null;
  payslipContribution: number | null;
  declaredStudyFund: boolean | null;
  hasStudyFund: boolean;
  hasProvidentFund: boolean;
  studyFundCount: number;
  providentFundCount: number;
  fundCount: number;
  totalBalance: number;
  studyFundBalance: number;
  providentBalance: number;
  totalMonthlyContribution: number;
  fundContribution: number | null;
  currentMgmtFee: number | null;
  currentAge: number | null;
  salaryAboveCeiling: boolean;
  monthlySalaryCeiling: number;
  annualTaxFreeDeposit: number;
  depositMismatch: boolean;
  parseWarnings: string[];
  funds: GemelFundDTO[];
};

export type GemelVerdict = "LEAVE" | "NEGOTIATE" | "SWITCH" | "REVIEW";

export type GemelAlternativeDTO = {
  id: string;
  fundName: string;
  companyName: string;
  return5Years: number | null;
  sharpeRatio: number | null;
};

export type GemelMarketFundDTO = {
  productName: string;
  companyName: string | null;
  marketFundId: string | null;
  verdict: GemelVerdict;
  verdictLabelHe: string;
  returnPercentile: number | null;
  userReturn5Y: number | null;
  marketReturn5Y: number | null;
  userFee: number | null;
  marketFee: number | null;
  userDepositFee: number | null;
  marketDepositFee: number | null;
  feeVsMarket: string | null;
  sharpeRatio: number | null;
  marketBestSharpe: number | null;
  stockExposure: number | null;
  projected30YearLoss: number | null;
  annualSavingsEstimate: number | null;
  alternatives: GemelAlternativeDTO[];
  riskNote: string | null;
  specialization: string | null;
  summaryHe: string;
};

export type GemelMarketAdviceDTO = {
  hasData: boolean;
  message?: string;
  dataSource?: string;
  sourceName?: string;
  funds?: GemelMarketFundDTO[];
  overallVerdict: GemelVerdict | null;
  overallVerdictLabelHe?: string;
  summary?: { fundCount: number; verdictCounts: Partial<Record<GemelVerdict, number>> };
  disclaimer?: string;
};

export type GemelFindingDTO = {
  id: string;
  title: string;
  severity: "critical" | "warning" | "info";
  details: string;
  meta?: Record<string, unknown> | null;
};

export type GemelRecommendationDTO = {
  type: string;
  title: string;
  reason: string;
  urgency: "high" | "medium" | "low";
  financialImpact: string | null;
  confidenceScore: number;
  insightId?: string;
};

export type AdvisoryMarketDataDTO = AdvisoryMarketData;

export type GemelAnalysisData = {
  summary: GemelSummaryDTO;
  productType?: "GEMEL" | "HISHTALMUT";
  payslipFindings?: GemelFindingDTO[];
} & Partial<ThreeCardAdvisoryData>;

export type GemelLeadingFundDTO = {
  id: string;
  fundName: string;
  companyName: string;
  classification: string | null;
  specialization: string | null;
  subSpecialization: string | null;
  targetPopulation: string | null;
  reportPeriod: number | null;
  depositFee: number | null;
  assetFee: number | null;
  return5Years: number | null;
  standardDeviation: number | null;
  sharpeRatio: number | null;
  stockExposure: number | null;
  totalAssets: number | null;
};

export type UploadGemelFundBody = {
  fundName: string;
  fundType: GemelFundType;
  provider?: string;
  currentBalance?: number;
  monthlyEmployeeDeposit?: number;
  monthlyEmployerDeposit?: number;
  managementFeeAccumulation?: number;
  managementFeeDeposit?: number;
  investmentTrack?: string;
};

/* ── calls ─────────────────────────────────────────────────── */

export const getGemelAnalysis = () =>
  apiJson<{ success: boolean; data?: GemelAnalysisData }>("/api/gemel/analysis", {
    auth: true,
  });

export const getGemelFunds = () =>
  apiJson<{ success: boolean; data?: { funds: GemelFundDTO[] } }>("/api/gemel/funds", {
    auth: true,
  });

export const createGemelFund = (body: UploadGemelFundBody) =>
  apiJson<{ success: boolean; data?: { fund: GemelFundDTO } }>("/api/gemel/funds", {
    method: "POST",
    auth: true,
    body,
  });

export const updateGemelFund = (id: string, body: Partial<UploadGemelFundBody> & { status?: "active" | "closed"; isActive?: boolean }) =>
  apiJson<{ success: boolean; data?: { fund: GemelFundDTO } }>(`/api/gemel/funds/${id}`, {
    method: "PATCH",
    auth: true,
    body,
  });

export const deleteGemelFund = (id: string) =>
  apiJson<{ success: boolean; data?: { deleted: boolean } }>(`/api/gemel/funds/${id}`, {
    method: "DELETE",
    auth: true,
  });

export const getGemelLeadingFunds = (params?: { limit?: number; classification?: string }) => {
  const qs = new URLSearchParams();
  if (params?.limit) qs.set("limit", String(params.limit));
  if (params?.classification) qs.set("classification", params.classification);
  const suffix = qs.toString() ? `?${qs.toString()}` : "";
  return apiJson<{ success: boolean; data?: GemelLeadingFundDTO[] }>(`/api/gemel/leading-funds${suffix}`, {
    auth: true,
  });
};

export type GemelAlternativeRankedDTO = {
  rank: number;
  fundCode: string;
  fundName: string;
  companyName: string;
  trackName: string | null;
  riskLevel: string;
  suitabilityScore: number;
  feeScore: number;
  performanceScore: number;
  reasons: string[];
  tradeoffs: string[];
};

export type GemelAccountReportDTO = {
  accountId: string;
  productType: string;
  fundName: string;
  companyName: string | null;
  trackName: string | null;
  balance: number;
  accountStatus: string;
  fees: {
    balancePct: number | null;
    balanceClassification: string;
    estimatedAnnualCost: number | null;
    possibleSavings: number | null;
  };
  returns: { classification: string; percentile: number | null };
  risk: { level: string; suitability: string };
  match: { method: string; confidence: number; fundCode: string | null; warnings: string[] };
  dataQuality: string;
  whatToReview: string[];
  alternatives: GemelAlternativeRankedDTO[];
  plainLanguage: Record<string, string>;
};

export type GemelAdvisorReportDTO = {
  status: "success" | "partial" | "no_data" | "failed";
  generatedAt: string;
  humanSummary: string;
  summary: { accountCount: number; totalBalance: number; matchedAccounts: number };
  accounts: GemelAccountReportDTO[];
  recommendations: Array<{ title: string; explanation: string; severity: string; possibleSavings: number | null }>;
  dataQuality: { matchedAccounts: number; unmatchedAccounts: number; totalAccounts: number; warnings: string[] };
  disclaimer: string;
};

export const getGemelReport = (skipLLM = false) =>
  apiJson<{ success: boolean; data?: { runId: string; report: GemelAdvisorReportDTO } }>(
    `/api/gemel/report${skipLLM ? "?skipLLM=true" : ""}`,
    { auth: true },
  );

export const analyzeGemel = (skipLLM = false) =>
  apiJson<{ success: boolean; data?: { runId: string; report: GemelAdvisorReportDTO } }>(
    `/api/gemel/analyze${skipLLM ? "?skipLLM=true" : ""}`,
    { method: "POST", auth: true, body: {} },
  );

export const uploadGemelExcel = async (file: File) => {
  const form = new FormData();
  form.append("file", file);
  return apiJson<{ success: boolean; data?: { imported: number; warnings: string[] } }>("/api/gemel/upload", {
    method: "POST",
    auth: true,
    body: form,
  });
};

export const downloadGemelReportPdf = async (runId: string) => {
  const result = await apiBlob(`/api/gemel/report/pdf?runId=${encodeURIComponent(runId)}`, {
    auth: true,
    fallbackErrorMessage: "לא הצלחנו להוריד את הדוח.",
  });
  if (!result.ok) {
    return { success: false as const, message: result.error.message };
  }
  const disposition = result.response.headers.get("Content-Disposition") || "";
  const match = disposition.match(/filename="([^"]+)"/);
  const filename = match?.[1] || `FinGuide-Gemel-Report-${new Date().toISOString().slice(0, 10)}.pdf`;
  return { success: true as const, blob: result.blob, filename };
};
