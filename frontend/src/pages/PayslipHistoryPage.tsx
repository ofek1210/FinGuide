import { useCallback, useState } from "react";
import { useNavigate } from "react-router-dom";
import PayslipEmptyState from "../components/payslip-history/PayslipEmptyState";
import PayslipErrorState from "../components/payslip-history/PayslipErrorState";
import PayslipFooterAction from "../components/payslip-history/PayslipFooterAction";
import PayslipHistoryLayout from "../components/payslip-history/PayslipHistoryLayout";
import PayslipList from "../components/payslip-history/PayslipList";
import PayslipLoadingState from "../components/payslip-history/PayslipLoadingState";
import PayslipStats from "../components/payslip-history/PayslipStats";
import { downloadDocument } from "../api/documents.api";
import { usePayslipHistory } from "../hooks/usePayslipHistory";
import type { PayslipHistoryItem } from "../types/payslip";
import { APP_ROUTES } from "../types/navigation";
import { formatCurrencyILS, formatNumber, formatShortDate } from "../utils/formatters";

export default function PayslipHistoryPage() {
  const navigate = useNavigate();
  const { data, isLoading, error, reload } = usePayslipHistory();
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  const handleBackToDashboard = useCallback(() => {
    navigate(APP_ROUTES.dashboard);
  }, [navigate]);

  const handleUploadNew = useCallback(() => {
    navigate(APP_ROUTES.documents);
  }, [navigate]);

  const handleDownload = useCallback(async (item: PayslipHistoryItem) => {
    if (!item.id) return;
    setDownloadError(null);
    setDownloadingId(item.id);
    const response = await downloadDocument(item.id);
    setDownloadingId(null);
    if (!response.success || !response.blob) {
      setDownloadError(response.message ?? "שגיאה בהורדת המסמך.");
      return;
    }
    const url = window.URL.createObjectURL(response.blob);
    const link = window.document.createElement("a");
    link.href = url;
    link.download = response.filename ?? item.periodLabel ?? "document.pdf";
    window.document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
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

      {downloadError ? (
        <div className="payslip-inline-error" role="alert">
          {downloadError}
        </div>
      ) : null}

      <PayslipStats
        averageNet={formatCurrencyILS(stats.averageNet)}
        averageGross={formatCurrencyILS(stats.averageGross)}
        totalPayslips={formatNumber(stats.totalPayslips)}
      />

      <PayslipList
        items={items}
        onDownload={handleDownload}
        onSelect={handleSelectPayslip}
        formatCurrency={(v) => (v != null ? formatCurrencyILS(v) : "לא זוהה")}
        formatDate={formatShortDate}
        downloadingId={downloadingId}
      />

      <PayslipFooterAction onUploadNew={handleUploadNew} />
    </PayslipHistoryLayout>
  );
}
