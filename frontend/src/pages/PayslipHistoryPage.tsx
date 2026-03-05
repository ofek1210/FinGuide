import { useCallback } from "react";
import { useNavigate } from "react-router-dom";
import PayslipEmptyState from "../components/payslip-history/PayslipEmptyState";
import PayslipErrorState from "../components/payslip-history/PayslipErrorState";
import PayslipFooterAction from "../components/payslip-history/PayslipFooterAction";
import PayslipHistoryLayout from "../components/payslip-history/PayslipHistoryLayout";
import PayslipList from "../components/payslip-history/PayslipList";
import PayslipLoadingState from "../components/payslip-history/PayslipLoadingState";
import PayslipStats from "../components/payslip-history/PayslipStats";
import { usePayslipHistory } from "../hooks/usePayslipHistory";
import type { PayslipHistoryItem } from "../types/payslip";
import { APP_ROUTES } from "../types/navigation";
import { formatCurrencyILS, formatNumber, formatShortDate } from "../utils/formatters";

export default function PayslipHistoryPage() {
  const navigate = useNavigate();
  const { data, isLoading, error, reload } = usePayslipHistory();

  const handleBackToDashboard = useCallback(() => {
    navigate(APP_ROUTES.dashboard);
  }, [navigate]);

  const handleUploadNew = useCallback(() => {
    navigate(APP_ROUTES.documents);
  }, [navigate]);

  const handleDownload = useCallback((item: PayslipHistoryItem) => {
    if (!item.downloadUrl) return;
    window.open(item.downloadUrl, "_blank", "noopener");
  }, []);

  const handleSelectPayslip = useCallback(
    (item: PayslipHistoryItem) => {
      navigate(`${APP_ROUTES.payslipHistory}/${item.id}`);
    },
    [navigate]
  );

  if (isLoading) {
    return (
      <PayslipHistoryLayout onBackToDashboard={handleBackToDashboard}>
        <PayslipLoadingState />
      </PayslipHistoryLayout>
    );
  }

  if (error) {
    return (
      <PayslipHistoryLayout onBackToDashboard={handleBackToDashboard}>
        <PayslipErrorState message={error} onRetry={reload} />
      </PayslipHistoryLayout>
    );
  }

  if (!data || data.items.length === 0) {
    return (
      <PayslipHistoryLayout onBackToDashboard={handleBackToDashboard}>
        <PayslipEmptyState onUploadNew={handleUploadNew} />
      </PayslipHistoryLayout>
    );
  }

  const { stats, items } = data;

  return (
    <PayslipHistoryLayout onBackToDashboard={handleBackToDashboard}>
      <section className="payslip-hero">
        <div>
          <h1>היסטוריית תלושים</h1>
          <p>צפייה והשוואה בין תלושי שכר קודמים</p>
        </div>
      </section>

      <PayslipStats
        averageNet={formatCurrencyILS(stats.averageNet)}
        averageGross={formatCurrencyILS(stats.averageGross)}
        totalPayslips={formatNumber(stats.totalPayslips)}
      />

      <PayslipList
        items={items}
        onDownload={handleDownload}
        onSelect={handleSelectPayslip}
        formatCurrency={formatCurrencyILS}
        formatDate={formatShortDate}
      />

      <PayslipFooterAction onUploadNew={handleUploadNew} />
    </PayslipHistoryLayout>
  );
}
