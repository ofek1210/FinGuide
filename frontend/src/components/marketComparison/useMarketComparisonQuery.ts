import { useCallback, useEffect, useRef, useState } from "react";
import type {
  GemelMarketProduct,
  MarketComparisonResponseDTO,
  MarketPeriod,
  MarketRiskLevel,
} from "../../api/marketComparison.api";

type FetchParams = {
  risk: MarketRiskLevel;
  period: MarketPeriod;
  product?: GemelMarketProduct;
};

type Fetcher = (params: FetchParams) => Promise<{ success: boolean; data?: MarketComparisonResponseDTO }>;

export function useMarketComparisonQuery(fetcher: Fetcher, params: FetchParams) {
  const [data, setData] = useState<MarketComparisonResponseDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);

  const load = useCallback(async () => {
    const id = ++requestId.current;
    setLoading(true);
    setError(null);
    try {
      const res = await fetcher(params);
      if (id !== requestId.current) return;
      if (!res.success || !res.data) {
        setError("fetch_failed");
        setData(null);
        return;
      }
      setData(res.data);
    } catch {
      if (id !== requestId.current) return;
      setError("fetch_failed");
      setData(null);
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }, [fetcher, params.risk, params.period, params.product]);

  useEffect(() => {
    load();
  }, [load]);

  return { data, loading, error, retry: load };
}
