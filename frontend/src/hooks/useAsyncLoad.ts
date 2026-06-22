import { useCallback, useEffect, useState } from "react";

type AsyncLoadState<T> = {
  data: T | null;
  loading: boolean;
  error: string | null;
  reload: () => void;
};

export function useAsyncLoad<T>(loadFn: () => Promise<T>): AsyncLoadState<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(() => {
    setLoading(true);
    setError(null);
    void loadFn()
      .then(result => {
        setData(result);
        setLoading(false);
      })
      .catch(err => {
        setError(err instanceof Error ? err.message : "שגיאה בטעינת הנתונים");
        setLoading(false);
      });
  }, [loadFn]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { data, loading, error, reload };
}
