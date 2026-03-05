import { apiJson, type ApiErrorPayload } from "./client";
import type { AuthUser } from "./auth.api";

/** גיבוי מקומי כשהבאק לא החזיר avatarUrl (למשל לפני העלאה). */
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

/** עדכון פרופיל (שם). הבאק עדיין לא תומך – בכשלון מחזירים status 404 והודעת משתמש מתאימה. */
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
    const message =
      result.status === 404
        ? "עדכון פרטי פרופיל (שם) לא זמין כרגע בשרת."
        : result.error.message;
    return {
      success: false,
      message,
      status: result.status,
      ...(payload?.errors && { errors: payload.errors }),
    };
  }
  return result.data ?? { success: false, message: "תגובה לא תקינה." };
}

/** העלאת תמונת פרופיל – הבאק: POST /api/auth/profile/image (שדה avatar). */
type ProfileImageResponse = {
  success: boolean;
  message?: string;
  data?: { user?: { avatarUrl?: string } };
};
export async function uploadAvatar(
  file: File,
): Promise<{ success: boolean; message?: string; url?: string }> {
  const formData = new FormData();
  formData.append("avatar", file);
  const result = await apiJson<ProfileImageResponse>("/api/auth/profile/image", {
    method: "POST",
    body: formData,
    auth: true,
    fallbackErrorMessage: "שגיאה בהעלאת התמונה.",
  });
  if (!result.ok) {
    return { success: false, message: result.error.message };
  }
  const data = result.data;
  const url = data?.data?.user?.avatarUrl ?? undefined;
  return { success: Boolean(data?.success), url, message: data?.message };
}
