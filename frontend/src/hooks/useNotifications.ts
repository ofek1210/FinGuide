import { useCallback, useEffect, useRef, useState } from "react";
import { listNotifications, type NotificationItem } from "../api/notifications.api";

const POLL_INTERVAL_MS = 30_000;

export function useNotifications() {
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  const refresh = useCallback(async () => {
    const res = await listNotifications();
    if (!mountedRef.current) return;
    if (!res.success) {
      setError(res.message ?? "שגיאה בטעינת התראות");
      setIsLoading(false);
      return;
    }
    setItems(res.data ?? []);
    setUnreadCount(res.unreadCount ?? 0);
    setError(null);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    void refresh();
    const id = window.setInterval(() => void refresh(), POLL_INTERVAL_MS);
    return () => {
      mountedRef.current = false;
      window.clearInterval(id);
    };
  }, [refresh]);

  return { items, unreadCount, isLoading, error, refresh };
}
