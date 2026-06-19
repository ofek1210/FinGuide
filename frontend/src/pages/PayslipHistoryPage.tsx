import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
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
  const [searchParams] = useSearchParams();
  const highlightedPeriods = useMemo(() => {
    const raw = searchParams.get("highlight");
    if (!raw) {
      return undefined;
    }
    return new Set(
      raw
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean),
    );
  }, [searchParams]);
  const highlightedYear = useMemo(() => {
    const first = highlightedPeriods ? Array.from(highlightedPeriods)[0] : "";
    const parsed = Number(first?.split("-")[0]);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
  }, [highlightedPeriods]);
  const [selectedYear, setSelectedYear] = useState<number | undefined>(highlightedYear);
  const { data, isLoading, error, reload } = usePayslipHistory(selectedYear);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  useEffect(() => {
    if (highlightedYear && selectedYear == null) {
      setSelectedYear(highlightedYear);
    }
  }, [highlightedYear, selectedYear]);

  useEffect(() => {
    if (!highlightedPeriods || !data?.items?.length) {
      return;
    }
    const hasMatches = data.items.some(
      (item) => item.periodMonth && highlightedPeriods.has(item.periodMonth),
    );
    if (!hasMatches) {
      return;
    }
    const first = window.document.querySelector(".payslip-row-highlight");
    if (first && "scrollIntoView" in first) {
      first.scrollIntoView({ block: "center", behavior: "smooth" });
    }
  }, [data?.items, highlightedPeriods]);

  const handleBackToDashboard = useCallback(() => {
    navigate(APP_ROUTES.documents);
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

  const { stats, items, years, taxAdjustment, dataQualityWarnings } = data;
  const highlightedMatches = highlightedPeriods
    ? items.filter((item) => item.periodMonth && highlightedPeriods.has(item.periodMonth))
    : [];
  const highlightedRange = highlightedPeriods
    ? Array.from(highlightedPeriods).sort()
    : [];
  const yearOptions = years.map((y) => y.year).sort((a, b) => b - a);
  const monthFormatter = new Intl.DateTimeFormat("he-IL", { month: "long" });
  const missingMonthNames = stats.missingMonths
    .map((month) => monthFormatter.format(new Date(2026, month - 1, 1)))
    .join(", ");
  const taxDirection =
    (taxAdjustment?.estimatedRefundOrDue || 0) >= 0 ? "החזר צפוי" : "סכום צפוי לתשלום";

  return (
    <PayslipHistoryLayout onBackToDashboard={handleBackToDashboard}>
      <section className="payslip-hero">
        <div>
          <h1>היסטוריית תלושים</h1>
          <p>צפייה והשוואה בין תלושי שכר קודמים</p>
        </div>
        <div className="payslip-year-selector">
          <label htmlFor="payslip-year-select">שנה להצגה</label>
          <select
            id="payslip-year-select"
            value={selectedYear ?? data.selectedYear ?? ""}
            onChange={(e) => {
              const value = Number(e.target.value);
              setSelectedYear(Number.isFinite(value) ? value : undefined);
            }}
          >
            {yearOptions.map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>
        </div>
      </section>

      {downloadError ? (
        <div className="payslip-inline-error" role="alert">
          {downloadError}
        </div>
      ) : null}

      {highlightedPeriods && highlightedPeriods.size > 0 ? (
        <div className="payslip-warning-banner is-soft" role="status">
          מעבר מממצאים: חודשים מסומנים{" "}
          {highlightedRange.length > 0
            ? highlightedRange.length === 1
              ? highlightedRange[0]
              : `${highlightedRange[0]}–${highlightedRange[highlightedRange.length - 1]}`
            : "—"}
          .
        </div>
      ) : null}

      {highlightedPeriods && highlightedPeriods.size > 0 && highlightedMatches.length === 0 ? (
        <div className="payslip-warning-banner" role="alert">
          החודשים שסומנו לא מופיעים בתלושים של השנה הנבחרת או חסרים תלושים לחודשים אלה.
        </div>
      ) : null}

      {stats.missingMonths.length > 0 ? (
        <div className="payslip-warning-banner" role="alert">
          כדי לקבל תובנות אופטימליות לשנת {stats.year}, מומלץ להעלות גם את החודשים החסרים:{" "}
          {missingMonthNames}.
        </div>
      ) : null}

      {dataQualityWarnings.length > 0 ? (
        <div className="payslip-warning-banner is-soft">{dataQualityWarnings[0]}</div>
      ) : null}

      <PayslipStats
        selectedYear={stats.year}
        averageNet={formatCurrencyILS(stats.averageNet)}
        averageGross={formatCurrencyILS(stats.averageGross)}
        totalPayslips={formatNumber(stats.totalPayslips)}
        coveragePercent={stats.coveragePercent}
      />

      {taxAdjustment ? (
        <section className="payslip-tax-card">
          <h3>תיאום מס שנתי ({taxAdjustment.year}) — הערכה</h3>
          <p>
            {taxDirection} (משוער):{" "}
            <strong>~{formatCurrencyILS(Math.abs(taxAdjustment.estimatedRefundOrDue))}</strong>
          </p>
          <p>
            מס צפוי שנתי: {formatCurrencyILS(taxAdjustment.expectedAnnualTax)} | מס ששולם בפועל:{" "}
            {formatCurrencyILS(taxAdjustment.actualTaxWithheld)}
          </p>
          <small>
            הערכה מבוססת על {stats.totalPayslips} תלוש/ים ({Math.round((taxAdjustment.confidence || 0) * 100)}% ביטחון).
            לחישוב מדויק יש להעלות את כל תלושי השנה.
          </small>
        </section>
      ) : null}

      <PayslipList
        items={items}
        onDownload={handleDownload}
        onSelect={handleSelectPayslip}
        formatCurrency={(v) => (v != null ? formatCurrencyILS(v) : "לא זוהה")}
        formatDate={formatShortDate}
        downloadingId={downloadingId}
        highlightedPeriods={highlightedPeriods}
      />

      <PayslipFooterAction onUploadNew={handleUploadNew} />
    </PayslipHistoryLayout>
  );
}
