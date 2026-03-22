import { apiJson, type ApiErrorPayload } from "./client";

export type SalaryType = "global" | "hourly";

export type OnboardingData = {
  salaryType: SalaryType | null;
  expectedMonthlyGross: number | null;
  hourlyRate: number | null;
  expectedMonthlyHours: number | null;
  jobPercentage: number | null;
  isPrimaryJob: boolean | null;
  hasMultipleEmployers: boolean | null;
  employmentStartDate: string | null; // YYYY-MM-DD
  hasPension: boolean | null;
  hasStudyFund: boolean | null;
};

export type OnboardingResponse = {
  success: boolean;
  message?: string;
  errors?: Array<{ field?: string; message?: string }>;
  data?: {
    completed: boolean;
    completedAt: string | null;
    data: Partial<OnboardingData>;
  };
};

const extractErrors = (payload: ApiErrorPayload | null) =>
  (payload && Array.isArray(payload.errors) ? payload.errors : undefined) as
    | OnboardingResponse["errors"]
    | undefined;

export async function getOnboarding(): Promise<OnboardingResponse> {
  const result = await apiJson<OnboardingResponse>("/api/onboarding", {
    auth: true,
    fallbackErrorMessage: "לא הצלחנו לטעון את נתוני ה-onboarding.",
  });
  if (!result.ok) {
    const payload = result.error.payload as ApiErrorPayload | null;
    return {
      success: false,
      message: result.error.message,
      errors: extractErrors(payload),
    };
  }
  return result.data ?? { success: false, message: "תגובה לא תקינה." };
}

export async function updateOnboarding(data: Partial<OnboardingData>): Promise<OnboardingResponse> {
  const result = await apiJson<OnboardingResponse>("/api/onboarding", {
    method: "PUT",
    auth: true,
    body: { data },
    fallbackErrorMessage: "לא הצלחנו לשמור את נתוני ה-onboarding.",
  });
  if (!result.ok) {
    const payload = result.error.payload as ApiErrorPayload | null;
    return {
      success: false,
      message: result.error.message,
      errors: extractErrors(payload),
    };
  }
  return result.data ?? { success: false, message: "תגובה לא תקינה." };
}

export async function completeOnboarding(data?: Partial<OnboardingData>): Promise<OnboardingResponse> {
  const result = await apiJson<OnboardingResponse>("/api/onboarding/complete", {
    method: "POST",
    auth: true,
    body: data ? { data } : {},
    fallbackErrorMessage: "לא הצלחנו להשלים את ה-onboarding.",
  });
  if (!result.ok) {
    const payload = result.error.payload as ApiErrorPayload | null;
    return {
      success: false,
      message: result.error.message,
      errors: extractErrors(payload),
    };
  }
  return result.data ?? { success: false, message: "תגובה לא תקינה." };
}

