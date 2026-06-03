import { useCallback, useEffect, useState } from "react";
import {
  getFinancialHealthScore,
  type FinancialHealthScore,
} from "../api/financialHealth.api";

export const useFinancialHealthScore = (year?: number) => {
  const currentYear = year ?? new Date().getFullYear();
  const [data, setData] = useState<FinancialHealthScore | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  const reload = useCallback(async () => {
    setIsLoading(true);
    setError("");
    const response = await getFinancialHealthScore(currentYear);
    if (response.success && response.data) {
      setData(response.data);
    } else {
      setData(null);
      setError(response.message || "לא הצלחנו לטעון את הציון הפיננסי.");
    }
    setIsLoading(false);
  }, [currentYear]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { data, isLoading, error, reload, year: currentYear };
};
