import { apiJson } from "./client";

export type PensionSummaryDTO = {
  hasData: boolean;
  grossSalary: number | null;
  pensionEmployee: number | null;
  pensionEmployer: number | null;
  totalMonthlyContribution: number;
  currentAge: number | null;
  retirementAge: number;
  currentAccumulation: number;
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

export type PensionAnalysisResponse = {
  success: boolean;
  data?: {
    summary: PensionSummaryDTO;
    projection: PensionProjectionDTO | null;
    recommendations: PensionRecommendationDTO[];
  };
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

export const getPensionAnalysis = () =>
  apiJson<PensionAnalysisResponse>("/api/pension/analysis", { auth: true });

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
