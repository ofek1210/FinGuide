import { useMemo } from "react";
import { usePayslipHistory } from "./usePayslipHistory";

const PAYSLIP_PREVIEW_COUNT = 3;

export const useDashboardPayslipsPreview = () => {
  const history = usePayslipHistory();

  const items = useMemo(
    () => (history.data?.items || []).slice(0, PAYSLIP_PREVIEW_COUNT),
    [history.data],
  );

  return {
    items,
    isLoading: history.isLoading,
    error: history.error,
    reload: history.reload,
  };
};
