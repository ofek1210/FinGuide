import { apiJson, type ApiErrorPayload } from "./client";
import type { AuthUser } from "./auth.api";

/** גיבוי מקומי לתמונת פרופיל (לפני שהבאק החזיר avatarUrl) – לא בשימוש כשהבאק תומך. */
export const AVATAR_STORAGE_KEY = "finguide_avatar_url";

const getApiBaseUrl = (): string => {
  const base = typeof import.meta !== "undefined" && import.meta.env?.VITE_API_URL;
  if (typeof base === "string" && base.trim()) return base.replace(/\/$/, "");
  return "";
};

/** מחזיר URL מלא לתצוגת תמונת פרופיל (path מהבאק או data URL מקומי). */
export function resolveAvatarUrl(pathOrDataUrl: string | null): string | null {
  if (!pathOrDataUrl) return null;
  if (pathOrDataUrl.startsWith("data:")) return pathOrDataUrl;
  const base = getApiBaseUrl();
  return base ? `${base}${pathOrDataUrl.startsWith("/") ? pathOrDataUrl : `/${pathOrDataUrl}`}` : pathOrDataUrl;
}

export function getAvatarDisplayUrl(user: AuthUser | null): string | null {
  if (user?.avatarUrl) return resolveAvatarUrl(user.avatarUrl);
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

export type UploadAvatarResponse = {
  success: boolean;
  message?: string;
  data?: { user: AuthUser };
};

/** העלאת תמונת פרופיל – POST /api/auth/profile/image (multipart, שדה avatar). */
export async function uploadAvatar(file: File): Promise<{
  success: boolean;
  message?: string;
  avatarUrl?: string | null;
}> {
  const formData = new FormData();
  formData.append("avatar", file);
  const result = await apiJson<UploadAvatarResponse>("/api/auth/profile/image", {
    method: "POST",
    body: formData,
    auth: true,
    fallbackErrorMessage: "שגיאה בהעלאת התמונה.",
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
  const data = result.data;
  const avatarUrl = data?.data?.user?.avatarUrl ?? null;
  return { success: Boolean(data?.success), avatarUrl, message: data?.message };
}
