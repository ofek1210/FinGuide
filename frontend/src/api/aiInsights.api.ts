import { apiJson } from "./client";
import type { ApiResult } from "./client";

export interface AIInsight {
  id: string;
  severity: "error" | "warning" | "info";
  category: "payslip" | "insurance" | "pension";
  title: string;
  description?: string;
  recommendation?: string;
  financialImpact?: number | null;
  financialImpactLabel?: string | null;
}

export interface TaxCreditsSummary {
  expectedPoints: number | null;
  actualPoints: number | null;
  gap: number | null;
  monthlyValue: number | null;
  annualValue: number | null;
  estimatedAnnualRefund: number | null;
  breakdown: Array<{
    id: string;
    label: string;
    points: number;
    action?: string | null;
  }>;
}

export interface PayslipInsightsData {
  insights: AIInsight[];
  narrative: string;
  moneyFlow?: MoneyFlowData | null;
  taxCredits?: TaxCreditsSummary | null;
  meta: {
    payslipCount: number;
    latestGross?: number;
    latestNet?: number;
    latestPeriod?: string;
    avgGross?: number;
    avgNet?: number;
    avgTax?: number;
    profileAge?: number;
    taxCreditPointsExpected?: number;
    taxCreditPointsActual?: number;
    recoverableSavingsAnnual?: number;
  };
}

export interface MoneyFlowData {
  payslipCount: number;
  avgGross: number;
  avgNet: number;
  totalGross?: number;
  totalWithheld: number;
  items: Array<{
    label: string;
    totalAmount?: number;
    avgAmount: number;
    pctOfGross: number;
    pctOfGap: number;
  }>;
}

export interface InsuranceInsightsData {
  insights: AIInsight[];
  narrative: string;
  meta: {
    policyCount: number;
    activePolicies: number;
    totalMonthlyPremium: number;
    totalAnnualPremium: number;
    healthScore?: number | null;
    duplicateCount?: number;
    annualSavings?: number;
  };
}

export interface PensionInsightsData {
  insights: AIInsight[];
  narrative: string;
  meta: {
    fundCount: number;
    activeFundCount: number;
    totalBalance: number;
    projectedBalance?: number;
    yearsToRetirement?: number;
    recommendedRiskLevel?: "low" | "medium" | "high";
    healthScore?: number | null;
    totalPotentialSavings?: number;
    avgRankPercentile?: number | null;
  };
}

export interface SummaryEmailResult {
  sentTo: string;
  payslipInsights: number;
  insuranceInsights: number;
  pensionInsights: number;
}

type Wrap<T> = { success: boolean; data: T };

export const getPayslipAIInsights = (): Promise<ApiResult<Wrap<PayslipInsightsData>>> =>
  apiJson<Wrap<PayslipInsightsData>>("/api/documents/ai-insights");

export const getInsuranceProfileInsights = (): Promise<ApiResult<Wrap<InsuranceInsightsData>>> =>
  apiJson<Wrap<InsuranceInsightsData>>("/api/insurance/profile-insights");

export const getPensionRiskAdvice = (): Promise<ApiResult<Wrap<PensionInsightsData>>> =>
  apiJson<Wrap<PensionInsightsData>>("/api/pension/risk-advice");

export const sendSummaryEmail = (consent: true): Promise<ApiResult<Wrap<{ message: string } & SummaryEmailResult>>> =>
  apiJson<Wrap<{ message: string } & SummaryEmailResult>>("/api/summary-email/send", {
    method: "POST",
    body: { consent },
  });

export const getWhatsAppShareUrl = (): Promise<ApiResult<Wrap<{ url: string }>>> =>
  apiJson<Wrap<{ url: string }>>("/api/summary-email/whatsapp-url");
