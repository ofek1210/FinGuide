import { apiJson, type ApiErrorPayload } from "./client";
import type { AuthUser } from "./auth.api";

/** מקומי בלבד – הבאק עדיין לא תומך ב-Avatar. TODO: כשהבאק יספק PATCH /api/auth/me ו־endpoint ל־Avatar, להסיר. */
export const AVATAR_STORAGE_KEY = "finguide_avatar_url";

export function getAvatarDisplayUrl(user: AuthUser | null): string | null {
  if (user?.avatarUrl) return user.avatarUrl;
  const local = typeof window !== "undefined" ? localStorage.getItem(AVATAR_STORAGE_KEY) : null;
  return local || null;
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

/** העלאת Avatar. נדרש מהבאק: POST /api/users/me/avatar (multipart) או דומה. */
export async function uploadAvatar(file: File): Promise<{ success: boolean; message?: string; url?: string }> {
  const formData = new FormData();
  formData.append("avatar", file);
  const result = await apiJson<{ success: boolean; url?: string; message?: string }>(
    "/api/users/me/avatar",
    {
      method: "POST",
      body: formData,
      auth: true,
      fallbackErrorMessage: "שגיאה בהעלאת התמונה.",
    },
  );
  if (!result.ok) {
    return { success: false, message: result.error.message };
  }
  const data = result.data;
  return { success: Boolean(data?.success), url: data?.url, message: data?.message };
}
