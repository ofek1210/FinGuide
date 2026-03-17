import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { AlertTriangle, ArrowRight } from "lucide-react";
import PayslipHistoryLayout from "../components/payslip-history/PayslipHistoryLayout";
import { fetchPayslipDetail } from "../services/payslip.service";
import type { PayslipDetail } from "../types/payslip";
import { APP_ROUTES } from "../types/navigation";

type MissingField = {
  key: string;
  title: string;
};

function isMissingText(value: unknown): boolean {
  return typeof value !== "string" || value.trim().length === 0;
}

export default function PayslipMissingFieldsPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [payslip, setPayslip] = useState<PayslipDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
    void loadDetail();
  }, [loadDetail]);

  const missingFields = useMemo<MissingField[]>(() => {
    if (!payslip) return [];

    const fields: MissingField[] = [];

    if (isMissingText(payslip.periodLabel) || payslip.periodLabel === "לא זוהה") {
      fields.push({
        key: "periodLabel",
        title: "תקופת התלוש",
      });
    }

    if (isMissingText(payslip.employerName)) {
      fields.push({
        key: "employerName",
        title: "שם המעסיק",
      });
    }

    if (isMissingText(payslip.employeeName)) {
      fields.push({
        key: "employeeName",
        title: "שם העובד",
      });
    }

    if (isMissingText(payslip.employeeId)) {
      fields.push({
        key: "employeeId",
        title: "תעודת זהות",
      });
    }

    if (isMissingText(payslip.paymentDate)) {
      fields.push({
        key: "paymentDate",
        title: "תאריך תשלום",
      });
    }

    if (payslip.grossSalary == null) {
      fields.push({
        key: "grossSalary",
        title: "שכר ברוטו",
      });
    }

    if (payslip.netSalary == null) {
      fields.push({
        key: "netSalary",
        title: "שכר נטו",
      });
    }

    if (payslip.earnings.length === 0) {
      fields.push({
        key: "earnings",
        title: "טבלת הכנסות",
      });
    }

    if (payslip.deductions.length === 0) {
      fields.push({
        key: "deductions",
        title: "טבלת ניכויים",
      });
    }

    return fields;
  }, [payslip]);

  const handleBackToReport = useCallback(() => {
    if (!id) return;
    navigate(`${APP_ROUTES.payslipHistory}/${id}`);
  }, [id, navigate]);

  if (!id) {
    return (
      <PayslipHistoryLayout onBackToDashboard={() => navigate(APP_ROUTES.dashboard)}>
        <div className="payslip-detail-state payslip-detail-state-error">
          <p>מזהה תלוש חסר.</p>
          <button type="button" onClick={() => navigate(APP_ROUTES.payslipHistory)}>
            חזרה להיסטוריה
          </button>
        </div>
      </PayslipHistoryLayout>
    );
  }

  if (loading) {
    return (
      <PayslipHistoryLayout onBackToDashboard={handleBackToReport} backLabel="חזרה לדוח">
        <div className="payslip-detail-state">
          <span className="payslip-detail-state-spinner" aria-hidden="true" />
          <p>טוענים סיכום שדות חסרים...</p>
        </div>
      </PayslipHistoryLayout>
    );
  }

  if (error || !payslip) {
    return (
      <PayslipHistoryLayout onBackToDashboard={handleBackToReport} backLabel="חזרה לדוח">
        <div className="payslip-detail-state payslip-detail-state-error">
          <p>{error ?? "התלוש לא נמצא."}</p>
          <button type="button" onClick={loadDetail}>
            נסה שוב
          </button>
          <button type="button" onClick={handleBackToReport}>
            חזרה לדוח
          </button>
        </div>
      </PayslipHistoryLayout>
    );
  }

  const hasMissing = missingFields.length > 0;

  return (
    <PayslipHistoryLayout onBackToDashboard={handleBackToReport} backLabel="חזרה לדוח">
      <section className="missing-fields-hero">
        <div className="missing-fields-hero-icon" aria-hidden="true">
          <AlertTriangle />
        </div>
        <div>
          <h1 className="missing-fields-title">סיכום שדות שלא זוהו</h1>
          <p className="missing-fields-subtitle">
            {payslip.periodLabel || "תלוש משכורת"} • {hasMissing ? "נדרשת תשומת לב" : "הכל זוהה"}
          </p>
        </div>
      </section>

      <section className="missing-fields-banner" role="alert" aria-live="polite">
        <strong>למה חסרים שדות?</strong> זיהוי OCR לא תמיד מצליח לקרוא כל מסמך.
        זה יכול לקרות אם ה־PDF/התמונה לא נסרקו בצורה חדה, אם הטקסט קטן/מטושטש,
        אם יש טבלאות צפופות, או אם זה פורמט/קובץ שלא נתמך בצורה מלאה.
        במקרה כזה חלק מהסיכומים וההשוואות באפליקציה עשויים להיות פחות מדויקים.
      </section>

      {hasMissing ? (
        <section className="missing-fields-list" aria-label="רשימת שדות חסרים">
          {missingFields.map((field) => (
            <article key={field.key} className="missing-field-card">
              <h2>{field.title}</h2>
            </article>
          ))}
        </section>
      ) : (
        <section className="missing-fields-ok">
          <p>מעולה — לא מצאנו שדות חסרים בתלוש הזה.</p>
        </section>
      )}

      <div className="missing-fields-actions">
        <button
          type="button"
          className="payslip-detail-btn payslip-detail-btn-secondary"
          onClick={handleBackToReport}
        >
          <ArrowRight aria-hidden="true" />
          חזרה לדוח
        </button>
        <button
          type="button"
          className="payslip-detail-btn payslip-detail-btn-primary"
          onClick={() => navigate(APP_ROUTES.assistant)}
        >
          לשאול את הסוכן הפיננסי
        </button>
      </div>
    </PayslipHistoryLayout>
  );
}

