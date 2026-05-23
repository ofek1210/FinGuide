import { useCallback, useEffect, useState } from "react";
import { listInsights, type InsightItem } from "../api/insights.api";

export function useInsights(status: "active" | "dismissed" = "active") {
  const [items, setItems] = useState<InsightItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    const res = await listInsights({ status });
    if (!res.success) {
      setError(res.message ?? "שגיאה");
      setIsLoading(false);
      return;
    }
    setItems(res.data ?? []);
    setError(null);
    setIsLoading(false);
  }, [status]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { items, isLoading, error, refresh };
}
