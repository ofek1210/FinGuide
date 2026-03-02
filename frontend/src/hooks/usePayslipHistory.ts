import { useCallback, useEffect, useState } from "react";
import { fetchPayslipHistory } from "../services/payslip.service";
import type { PayslipHistoryResponse } from "../types/payslip";

type PayslipHistoryState = {
  data: PayslipHistoryResponse | null;
  isLoading: boolean;
  error: string | null;
};

const DEFAULT_STATE: PayslipHistoryState = {
  data: null,
  isLoading: true,
  error: null,
};

export const usePayslipHistory = () => {
  const [state, setState] = useState<PayslipHistoryState>(DEFAULT_STATE);

  const loadHistory = useCallback(async () => {
    setState((prev) => ({ ...prev, isLoading: true, error: null }));
    try {
      const response = await fetchPayslipHistory();
      setState({ data: response, isLoading: false, error: null });
    } catch {
      setState({
        data: null,
        isLoading: false,
        error: "לא הצלחנו לטעון את היסטוריית התלושים.",
      });
    }
  }, []);

  useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

  return {
    ...state,
    reload: loadHistory,
  };
};
