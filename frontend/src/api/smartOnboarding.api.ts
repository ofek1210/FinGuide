import { apiJson } from "./client";

export type SmartQuestionType = "single" | "multi" | "yesno" | "number";

export type SmartQuestionOption = {
  value: string;
  label: string;
};

export type SmartQuestionDTO = {
  id: string;
  type: SmartQuestionType;
  title: string;
  sub?: string | null;
  options?: SmartQuestionOption[] | null;
  required?: boolean;
};

export type SmartKnownAnswerDTO = {
  answer: unknown;
  source: string;
  confidence: number;
};

export type SmartOnboardingStateDTO = {
  layer: string;
  complete: boolean;
  skipped?: boolean;
  completedAt: string | null;
  skippedAt?: string | null;
  totalQuestions: number;
  answeredCount: number;
  missingQuestions: SmartQuestionDTO[];
  knownAnswers: Record<string, SmartKnownAnswerDTO>;
  estimatedMinutes: number;
  shouldShowModal?: boolean;
};

export type AgentId = "payslip" | "insurance" | "pension" | "gemel";

export const getGeneralOnboardingState = () =>
  apiJson<{ success: boolean; data?: SmartOnboardingStateDTO }>("/api/smart-onboarding/general", { auth: true });

export const saveGeneralOnboardingAnswers = (answers: Record<string, unknown>) =>
  apiJson<{ success: boolean; data?: SmartOnboardingStateDTO }>("/api/smart-onboarding/general", {
    method: "PUT",
    auth: true,
    body: { answers },
  });

export const completeGeneralOnboarding = (answers: Record<string, unknown> = {}) =>
  apiJson<{ success: boolean; data?: SmartOnboardingStateDTO }>("/api/smart-onboarding/general/complete", {
    method: "POST",
    auth: true,
    body: { answers },
  });

export const getAgentOnboardingState = (agentId: AgentId) =>
  apiJson<{ success: boolean; data?: SmartOnboardingStateDTO }>(`/api/smart-onboarding/agents/${agentId}`, { auth: true });

export const saveAgentOnboardingAnswers = (agentId: AgentId, answers: Record<string, unknown>) =>
  apiJson<{ success: boolean; data?: SmartOnboardingStateDTO }>(`/api/smart-onboarding/agents/${agentId}`, {
    method: "PUT",
    auth: true,
    body: { answers },
  });

export const completeAgentOnboarding = (agentId: AgentId, answers: Record<string, unknown> = {}) =>
  apiJson<{ success: boolean; data?: SmartOnboardingStateDTO }>(`/api/smart-onboarding/agents/${agentId}/complete`, {
    method: "POST",
    auth: true,
    body: { answers },
  });

export const skipAgentOnboarding = (agentId: AgentId) =>
  apiJson<{ success: boolean; data?: SmartOnboardingStateDTO }>(`/api/smart-onboarding/agents/${agentId}/skip`, {
    method: "POST",
    auth: true,
  });

export const getAgentOnboardingContext = (agentId: AgentId) =>
  apiJson<{ success: boolean; data?: { general: Record<string, unknown>; agent: Record<string, unknown> } }>(
    `/api/smart-onboarding/agents/${agentId}/context`,
    { auth: true },
  );
