import { useCallback, useEffect, useState } from "react";
import { listRecommendations, type RecommendationItem } from "../api/recommendations.api";

export function useRecommendations() {
  const [items, setItems] = useState<RecommendationItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    const res = await listRecommendations();
    if (!res.success) {
      setError(res.message ?? "שגיאה");
      setIsLoading(false);
      return;
    }
    setItems(res.data ?? []);
    setError(null);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { items, isLoading, error, refresh };
}
