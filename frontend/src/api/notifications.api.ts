import { apiJson } from "./client";

export type NotificationType =
  | "insight_created"
  | "recommendation_new"
  | "document_processed"
  | "salary_drop"
  | "missing_payslip"
  | "system";

export type NotificationItem = {
  _id: string;
  type: NotificationType;
  title: string;
  body: string;
  link: string | null;
  read: boolean;
  readAt: string | null;
  createdAt: string;
};

export type NotificationsResponse = {
  success: boolean;
  count?: number;
  unreadCount?: number;
  data?: NotificationItem[];
  message?: string;
};

export async function listNotifications(unreadOnly = false): Promise<NotificationsResponse> {
  const qs = unreadOnly ? "?unreadOnly=true&limit=20" : "?limit=20";
  const result = await apiJson<NotificationsResponse>(`/api/notifications${qs}`, {
    auth: true,
    fallbackErrorMessage: "לא הצלחנו לטעון התראות.",
  });
  if (!result.ok) return { success: false, message: result.error.message };
  return result.data ?? { success: false };
}

export async function markNotificationRead(id: string): Promise<NotificationsResponse> {
  const result = await apiJson<NotificationsResponse>(`/api/notifications/${id}/read`, {
    method: "POST",
    auth: true,
    fallbackErrorMessage: "לא הצלחנו לעדכן.",
  });
  if (!result.ok) return { success: false, message: result.error.message };
  return result.data ?? { success: false };
}

export async function markAllNotificationsRead(): Promise<{ success: boolean }> {
  const result = await apiJson<{ success: boolean }>("/api/notifications/read-all", {
    method: "POST",
    auth: true,
    fallbackErrorMessage: "לא הצלחנו לעדכן.",
  });
  if (!result.ok) return { success: false };
  return result.data ?? { success: false };
}

export async function deleteNotification(id: string): Promise<{ success: boolean }> {
  const result = await apiJson<{ success: boolean }>(`/api/notifications/${id}`, {
    method: "DELETE",
    auth: true,
    fallbackErrorMessage: "לא הצלחנו למחוק.",
  });
  if (!result.ok) return { success: false };
  return result.data ?? { success: false };
}
