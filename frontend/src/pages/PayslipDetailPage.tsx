import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  Download,
  FileText,
  Building2,
  User,
  Calendar,
  Hash,
  Briefcase,
  Sun,
  Heart,
} from "lucide-react";
import PayslipHistoryLayout from "../components/payslip-history/PayslipHistoryLayout";
import { downloadDocument } from "../api/documents.api";
import { fetchPayslipDetail } from "../services/payslip.service";
import type { PayslipDetail } from "../types/payslip";
import { APP_ROUTES } from "../types/navigation";
import {
  formatCurrencyILS,
  formatLongDate,
  formatPercent,
  formatNumber,
} from "../utils/formatters";

export default function PayslipDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [payslip, setPayslip] = useState<PayslipDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);

  const loadDetail = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const data = await fetchPayslipDetail(id);
      setPayslip(data ?? null);
    } catch {
      setError("לא הצלחנו לטעון את פרטי התלוש.");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadDetail();
  }, [loadDetail]);

  const handleBackToHistory = useCallback(() => {
    navigate(APP_ROUTES.payslipHistory);
  }, [navigate]);

  const handleDownload = useCallback(async () => {
    if (!payslip?.id) return;
    setIsDownloading(true);
    const response = await downloadDocument(payslip.id);
    setIsDownloading(false);
    if (!response.success || !response.blob) return;
    const url = window.URL.createObjectURL(response.blob);
    const link = window.document.createElement("a");
    link.href = url;
    link.download = response.filename ?? payslip.periodLabel ?? "document.pdf";
    window.document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  }, [payslip?.id, payslip?.periodLabel]);

  if (!id) {
    return (
      <PayslipHistoryLayout onBackToDashboard={() => navigate(APP_ROUTES.dashboard)}>
        <div className="payslip-detail-state payslip-detail-state-error">
          <p>מזהה תלוש חסר.</p>
          <button type="button" onClick={handleBackToHistory}>
            חזרה להיסטוריה
          </button>
        </div>
      </PayslipHistoryLayout>
    );
  }

  if (loading) {
    return (
      <PayslipHistoryLayout
        onBackToDashboard={handleBackToHistory}
        backLabel="חזרה להיסטוריה"
      >
        <div className="payslip-detail-state">
          <span className="payslip-detail-state-spinner" aria-hidden="true" />
          <p>טוענים פרטי תלוש...</p>
        </div>
      </PayslipHistoryLayout>
    );
  }

  if (error || !payslip) {
    return (
      <PayslipHistoryLayout
        onBackToDashboard={handleBackToHistory}
        backLabel="חזרה להיסטוריה"
      >
        <div className="payslip-detail-state payslip-detail-state-error">
          <p>{error ?? "התלוש לא נמצא."}</p>
          <button type="button" onClick={loadDetail}>
            נסה שוב
          </button>
          <button type="button" onClick={handleBackToHistory}>
            חזרה להיסטוריה
          </button>
        </div>
      </PayslipHistoryLayout>
    );
  }

  const earningsTotal = payslip.earnings.reduce((sum, i) => sum + i.amount, 0);
  const deductionsTotal = payslip.deductions.reduce((sum, i) => sum + i.amount, 0);
  const hasEarnings = payslip.earnings.length > 0;
  const hasDeductions = payslip.deductions.length > 0;

  return (
    <PayslipHistoryLayout
      onBackToDashboard={handleBackToHistory}
      backLabel="חזרה להיסטוריה"
    >
      <section className="payslip-detail-hero">
        <div className="payslip-detail-hero-icon" aria-hidden="true">
          <FileText />
        </div>
        <div>
          <h1 className="payslip-detail-title">תלוש משכורת</h1>
          <p className="payslip-detail-period">{payslip.periodLabel || "לא זוהה"}</p>
        </div>
      </section>

      <section className="payslip-detail-card payslip-detail-info">
        <h2 className="payslip-detail-card-title">פרטי התלוש</h2>
        <ul className="payslip-detail-info-list">
          <li>
            <Building2 aria-hidden="true" />
            <span className="payslip-detail-info-label">מעסיק</span>
            <span className="payslip-detail-info-value">{payslip.employerName ?? "—"}</span>
          </li>
          <li>
            <User aria-hidden="true" />
            <span className="payslip-detail-info-label">שם העובד</span>
            <span className="payslip-detail-info-value">{payslip.employeeName ?? "—"}</span>
          </li>
          <li>
            <Hash aria-hidden="true" />
            <span className="payslip-detail-info-label">ת.ז.</span>
            <span className="payslip-detail-info-value">{payslip.employeeId ?? "—"}</span>
          </li>
          <li>
            <Calendar aria-hidden="true" />
            <span className="payslip-detail-info-label">תאריך / תקופה</span>
            <span className="payslip-detail-info-value">
              {payslip.paymentDate
                ? formatLongDate(payslip.paymentDate)
                : payslip.periodLabel || "—"}
            </span>
          </li>
        </ul>
      </section>

      {(payslip.jobPercent != null ||
        payslip.workingDays != null ||
        payslip.workingHours != null ||
        payslip.vacationDays != null ||
        payslip.sickDays != null) && (
        <section className="payslip-detail-card payslip-detail-info">
          <h2 className="payslip-detail-card-title">עבודה ויתרות</h2>
          <ul className="payslip-detail-info-list">
            {payslip.jobPercent != null && (
              <li>
                <Briefcase aria-hidden="true" />
                <span className="payslip-detail-info-label">אחוז משרה</span>
                <span className="payslip-detail-info-value">
                  {formatPercent(payslip.jobPercent)}
                </span>
              </li>
            )}
            {payslip.workingDays != null && (
              <li>
                <Briefcase aria-hidden="true" />
                <span className="payslip-detail-info-label">ימי עבודה</span>
                <span className="payslip-detail-info-value">
                  {formatNumber(payslip.workingDays)}
                </span>
              </li>
            )}
            {payslip.workingHours != null && (
              <li>
                <Briefcase aria-hidden="true" />
                <span className="payslip-detail-info-label">שעות עבודה</span>
                <span className="payslip-detail-info-value">
                  {formatNumber(payslip.workingHours)}
                </span>
              </li>
            )}
            {payslip.vacationDays != null && (
              <li>
                <Sun aria-hidden="true" />
                <span className="payslip-detail-info-label">ימי חופשה</span>
                <span className="payslip-detail-info-value">
                  {formatNumber(payslip.vacationDays)}
                </span>
              </li>
            )}
            {payslip.sickDays != null && (
              <li>
                <Heart aria-hidden="true" />
                <span className="payslip-detail-info-label">ימי מחלה</span>
                <span className="payslip-detail-info-value">
                  {formatNumber(payslip.sickDays)}
                </span>
              </li>
            )}
          </ul>
        </section>
      )}

      <div className="payslip-detail-tables">
        {hasEarnings && (
          <section className="payslip-detail-card">
            <h2 className="payslip-detail-card-title">הכנסות</h2>
            <table className="payslip-detail-table">
              <tbody>
                {payslip.earnings.map((row) => (
                  <tr key={row.label}>
                    <td className="payslip-detail-table-label">{row.label}</td>
                    <td className="payslip-detail-table-amount">
                      {formatCurrencyILS(row.amount)}
                    </td>
                  </tr>
                ))}
                <tr className="payslip-detail-table-total">
                  <td>סה״כ ברוטו</td>
                  <td>{formatCurrencyILS(earningsTotal)}</td>
                </tr>
              </tbody>
            </table>
          </section>
        )}

        {hasDeductions && (
          <section className="payslip-detail-card">
            <h2 className="payslip-detail-card-title">ניכויים</h2>
            <table className="payslip-detail-table">
              <tbody>
                {payslip.deductions.map((row) => (
                  <tr key={row.label}>
                    <td className="payslip-detail-table-label">{row.label}</td>
                    <td className="payslip-detail-table-amount payslip-detail-table-deduction">
                      {formatCurrencyILS(-row.amount)}
                    </td>
                  </tr>
                ))}
                <tr className="payslip-detail-table-total">
                  <td>סה״כ ניכויים</td>
                  <td className="payslip-detail-table-deduction">
                    {formatCurrencyILS(-deductionsTotal)}
                  </td>
                </tr>
              </tbody>
            </table>
          </section>
        )}
      </div>

      <section className="payslip-detail-net-card">
        <div className="payslip-detail-net-label">שכר נטו לתשלום</div>
        <div className="payslip-detail-net-value">
          {payslip.netSalary != null ? formatCurrencyILS(payslip.netSalary) : "לא זוהה"}
        </div>
      </section>

      <div className="payslip-detail-actions">
        <button
          type="button"
          className="payslip-detail-btn payslip-detail-btn-secondary"
          onClick={handleBackToHistory}
        >
          חזרה להיסטוריה
        </button>
        <button
          type="button"
          className="payslip-detail-btn payslip-detail-btn-primary"
          onClick={handleDownload}
          disabled={!payslip.id || isDownloading}
          aria-label={payslip.id ? "הורדת קובץ PDF" : "הורדה לא זמינה"}
        >
          <Download aria-hidden="true" />
          {isDownloading ? "מוריד..." : "הורד PDF"}
        </button>
      </div>
    </PayslipHistoryLayout>
  );
}
