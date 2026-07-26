import { apiJson } from "./client";

export type MarketRiskLevel = "low" | "medium" | "high";
export type MarketPeriod = "12" | "36" | "5y" | "combined";
export type GemelMarketProduct = "gemel" | "hishtalmut" | "investment_gemel";

export type MarketComparisonFundDTO = {
  rank: number | null;
  rankingScore: number | null;
  rankingStatus: "ranked" | "insufficient_history" | "excluded";
  rankingMethod: string;
  effectiveWeights: Partial<Record<"return12Months" | "return36MonthsAnnualized" | "return5YearsAnnualized", number>>;
  productType: string;
  riskLevel: MarketRiskLevel | "unclassified";
  comparisonGroup: string;
  fundId: string;
  fundName: string;
  managingCompany: string;
  specialization: string | null;
  subSpecialization: string | null;
  return12Months: number | null;
  return36MonthsAnnualized: number | null;
  return5YearsAnnualized: number | null;
  assetsUnderManagement: number | null;
  managementFeeBalance: number | null;
  managementFeeDeposit: number | null;
  reportPeriod: number | null;
  lastSyncedAt: string | null;
  source: string;
};

export type MarketComparisonGroupDTO = {
  comparisonGroup: string;
  eligibleRecords: number;
  rankedRecords: number;
  insufficientHistoryRecords: number;
  funds: MarketComparisonFundDTO[];
};

export type MarketComparisonDataQualityDTO = {
  source: string;
  lastUpdated: string | null;
  latestOfficialReportPeriod: number | null;
  eligibleRecords?: number;
  rankedRecords?: number;
  insufficientHistoryRecords?: number;
  missingReturn12Months?: number;
  missingReturn36MonthsAnnualized?: number;
  missingReturn5YearsAnnualized?: number;
};

export type MarketComparisonMethodologyDTO = {
  source: string | null;
  rankingMethod: string;
  rankScope: string;
  limitAppliesPerGroup: boolean;
  periodWeights: Record<string, number>;
  minimumPeriodsForCombined: number;
  missingPeriodPolicy: string;
  returnsAreHistorical: boolean;
  activePeriod: MarketPeriod;
};

export type MarketComparisonResponseDTO = {
  product: string;
  risk: MarketRiskLevel;
  period: MarketPeriod;
  comparisonGroup: string | null;
  groups: MarketComparisonGroupDTO[];
  methodology: MarketComparisonMethodologyDTO;
  dataQuality: MarketComparisonDataQualityDTO;
};

type ApiEnvelope = { success: boolean; data?: MarketComparisonResponseDTO };

export type PensionMarketComparisonParams = {
  risk: MarketRiskLevel;
  period?: MarketPeriod;
  limit?: number;
  comparisonGroup?: string;
};

export type GemelMarketComparisonParams = {
  product: GemelMarketProduct;
  risk: MarketRiskLevel;
  period?: MarketPeriod;
  limit?: number;
  comparisonGroup?: string;
};

function buildQuery(params: Record<string, string | number | undefined>) {
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value != null && value !== "") qs.set(key, String(value));
  });
  return qs.toString();
}

export const getPensionMarketComparison = async (params: PensionMarketComparisonParams) => {
  const query = buildQuery({
    risk: params.risk,
    period: params.period ?? "5y",
    limit: params.limit ?? 5,
    comparisonGroup: params.comparisonGroup,
  });
  const res = await apiJson<ApiEnvelope>(`/api/pension/leading-funds?${query}`, { auth: true });
  if (!res.ok || !res.data?.success || !res.data.data) {
    return null;
  }
  return res.data.data;
};

export const getGemelMarketComparison = async (params: GemelMarketComparisonParams) => {
  const query = buildQuery({
    product: params.product,
    risk: params.risk,
    period: params.period ?? "5y",
    limit: params.limit ?? 5,
    comparisonGroup: params.comparisonGroup,
  });
  const res = await apiJson<ApiEnvelope>(`/api/gemel/leading-funds?${query}`, { auth: true });
  if (!res.ok || !res.data?.success || !res.data.data) {
    return null;
  }
  return res.data.data;
};
