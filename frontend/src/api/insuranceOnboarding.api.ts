import { apiJson } from "./client";
import type { InsuranceRecommendationDTO, InsuranceHealthCheck } from "./insuranceAI.api";

export type InsuranceOnboardingQuestion = {
  id: string;
  agent: "general" | "life" | "health";
  category: string;
  text: string;
  why: string;
  type: "boolean" | "number" | "select" | "multiselect" | "text" | "info";
  options?: { value: string; label: string }[];
  skipAllowed?: boolean;
};

export type InsuranceReportProfile = {
  policyCount: number;
  companies: string[];
  byType: Record<string, number>;
  totalMonthlyPremium: number;
  hasApartment: boolean;
  hasCar: boolean;
  hasLife: boolean;
  hasHealth: boolean;
  policies: Array<{
    type: string;
    provider: string | null;
    monthlyPremium: number | null;
    status: string;
  }>;
};

export type InsuranceOnboardingSession = {
  ready: boolean;
  message?: string;
  reportProfile: InsuranceReportProfile;
  agentLabels?: Record<string, string>;
  questions: InsuranceOnboardingQuestion[];
  progress: { answered: number; total: number; percent: number };
  completed: boolean;
  currentQuestion: InsuranceOnboardingQuestion | null;
};

export type InsuranceOnboardingAnalysis = {
  summary: {
    existingPolicies: number;
    missingPolicies: string[];
    duplicatePolicies: unknown[];
    outdatedFlags: unknown[];
  };
  financial: {
    totalMonthlyPremium: number;
    premiumAssessment: "low" | "normal" | "high" | "unknown";
    potentialMonthlySavings: number;
    unnecessaryCoverages: unknown[];
  };
  risk: {
    underinsured: { area: string; severity: string }[];
    overinsured: unknown[];
    hasCriticalGap: boolean;
  };
  recommendations: InsuranceRecommendationDTO[];
  healthCheck?: InsuranceHealthCheck | null;
};

export const getInsuranceOnboardingSession = () =>
  apiJson<{ success: boolean; data: InsuranceOnboardingSession }>("/api/insurance/onboarding/session", { auth: true });

export const submitInsuranceOnboardingAnswer = (body: {
  questionId: string;
  value?: unknown;
  skipped?: boolean;
}) =>
  apiJson<{ success: boolean; data: InsuranceOnboardingSession }>("/api/insurance/onboarding/answer", {
    method: "POST",
    auth: true,
    body: JSON.stringify(body),
  });

export const completeInsuranceOnboarding = () =>
  apiJson<{ success: boolean; data: { session: InsuranceOnboardingSession; analysis: InsuranceOnboardingAnalysis } }>(
    "/api/insurance/onboarding/complete",
    { method: "POST", auth: true },
  );
