import { apiJson, type ApiErrorPayload } from "./client";
import type { OnboardingProfile, OnboardingPatch } from "./onboarding.api";

export type UserProfileResponseData = OnboardingProfile & {
  completedSteps: string[];
  completedAt: string | null;
  updatedAt: string | null;
};

export type UserProfileResponse = {
  success: boolean;
  message?: string;
  errors?: Array<{ field?: string; message?: string }>;
  data?: UserProfileResponseData;
};

const extractErrors = (payload: ApiErrorPayload | null) =>
  (payload && Array.isArray(payload.errors) ? payload.errors : undefined) as
    | UserProfileResponse["errors"]
    | undefined;

export async function getUserProfile(): Promise<UserProfileResponse> {
  const result = await apiJson<UserProfileResponse>("/api/profile", {
    auth: true,
    fallbackErrorMessage: "לא הצלחנו לטעון את הפרופיל.",
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

export async function updateUserProfile(patch: OnboardingPatch): Promise<UserProfileResponse> {
  const result = await apiJson<UserProfileResponse>("/api/profile", {
    method: "PATCH",
    auth: true,
    body: { data: patch },
    fallbackErrorMessage: "לא הצלחנו לעדכן את הפרופיל.",
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
