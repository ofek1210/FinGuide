import { apiJson, type ApiErrorPayload } from "./client";
import type { AuthUser } from "./auth.api";

export function getAvatarDisplayUrl(user: AuthUser | null): string | null {
  return user?.avatarUrl || null;
}

export type UpdateProfilePayload = { name?: string; email?: string };

export type UpdateProfileResponse = {
  success: boolean;
  message?: string;
  data?: { user: AuthUser };
};

/** עדכון פרופיל. נדרש מהבאק: PATCH /api/auth/me עם body { name?, email? }. */
export async function updateProfile(
  body: UpdateProfilePayload,
): Promise<UpdateProfileResponse & { status?: number; errors?: unknown[] }> {
  const result = await apiJson<UpdateProfileResponse>("/api/auth/me", {
    method: "PATCH",
    body,
    auth: true,
    fallbackErrorMessage: "שגיאה בעדכון הפרופיל.",
  });
  if (!result.ok) {
    const payload = result.error.payload as ApiErrorPayload | null;
    return {
      success: false,
      message: result.error.message,
      status: result.status,
      ...(payload?.errors && { errors: payload.errors }),
    };
  }
  return result.data ?? { success: false, message: "תגובה לא תקינה." };
}

export type UploadAvatarResponse = {
  success: boolean;
  message?: string;
  data?: { user: AuthUser };
};

export async function uploadAvatar(
  file: File,
): Promise<UploadAvatarResponse & { status?: number; errors?: unknown[] }> {
  const formData = new FormData();
  formData.append("avatar", file);

  const result = await apiJson<UploadAvatarResponse>(
    "/api/auth/profile/image",
    {
      method: "POST",
      body: formData,
      auth: true,
      fallbackErrorMessage: "שגיאה בהעלאת התמונה.",
    },
  );
  if (!result.ok) {
    const payload = result.error.payload as ApiErrorPayload | null;
    return {
      success: false,
      message: result.error.message,
      status: result.status,
      ...(payload?.errors && { errors: payload.errors }),
    };
  }
  return result.data ?? { success: false, message: "תגובה לא תקינה." };
}
