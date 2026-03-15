import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import PrivateTopbar from "../components/PrivateTopbar";
import Loader from "../components/ui/Loader";
import {
  getDocument,
  type DocumentItem,
  type PayslipSummaryFromBackend,
} from "../api/documents.api";

function getSummary(doc: DocumentItem | null): PayslipSummaryFromBackend | null {
  return doc?.analysisData?.summary ?? null;
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined || value === "") {
    return "לא זוהה";
  }
  return String(value);
}

export default function DocumentDetailsPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [document, setDocument] = useState<DocumentItem | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  const loadDocument = useCallback(async () => {
    if (!id) return;
    setIsLoading(true);
    setError("");

    const response = await getDocument(id);

    if (response.success && response.data) {
      setDocument(response.data);
      setError("");
    } else {
      setDocument(null);
      setError(response.message || "לא הצלחנו לטעון את פרטי המסמך.");
    }

    setIsLoading(false);
  }, [id]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadDocument();
  }, [loadDocument]);

  const summary = getSummary(document);
  // eslint-disable-next-line no-console
  console.log("[frontend] DocumentDetailsPage summary", { id, summary });

  return (
    <div className="feature-page dashboard-page" dir="rtl">
      <div className="dashboard-shell">
        <PrivateTopbar />

        <section className="dashboard-card">
          <h1 className="feature-page-title">פרטי תלוש</h1>
          <p className="feature-page-subtitle">
            פירוט הערכים שזוהו מהתלוש שהועלה.
          </p>
        </section>

        {isLoading ? (
          <section className="dashboard-card">
            <div className="findings-placeholder">
              <Loader />
              טוענים פרטי מסמך...
            </div>
          </section>
        ) : error ? (
          <section className="dashboard-card">
            <div className="feature-page-inline-error">{error}</div>
          </section>
        ) : !document ? (
          <section className="dashboard-card">
            <p>לא נמצאו פרטי מסמך.</p>
          </section>
        ) : (
          <>
            <section className="dashboard-card">
              <h2 className="feature-section-title">פרטים בסיסיים</h2>
              <div className="insights-grid">
                <div className="insight-row">
                  <span className="insight-label">שם עובד</span>
                  <span className="insight-value">
                    {formatValue(summary?.employeeName)}
                  </span>
                </div>
                <div className="insight-row">
                  <span className="insight-label">תאריך / חודש</span>
                  <span className="insight-value">
                    {formatValue(summary?.date)}
                  </span>
                </div>
                <div className="insight-row">
                  <span className="insight-label">אחוז משרה</span>
                  <span className="insight-value">
                    {formatValue(summary?.jobPercentage)}
                  </span>
                </div>
                <div className="insight-row">
                  <span className="insight-label">ימי עבודה</span>
                  <span className="insight-value">
                    {formatValue(summary?.workingDays)}
                  </span>
                </div>
                <div className="insight-row">
                  <span className="insight-label">שעות עבודה</span>
                  <span className="insight-value">
                    {formatValue(summary?.workingHours)}
                  </span>
                </div>
              </div>
            </section>

            <section className="dashboard-card">
              <h2 className="feature-section-title">שכר</h2>
              <div className="insights-grid">
                <div className="insight-row">
                  <span className="insight-label">שכר ברוטו</span>
                  <span className="insight-value">
                    {formatValue(summary?.grossSalary)}
                  </span>
                </div>
                <div className="insight-row">
                  <span className="insight-label">שכר נטו</span>
                  <span className="insight-value">
                    {formatValue(summary?.netSalary)}
                  </span>
                </div>
              </div>
            </section>

            <section className="dashboard-card">
              <h2 className="feature-section-title">זכויות ויתרות</h2>
              <div className="insights-grid">
                <div className="insight-row">
                  <span className="insight-label">ימי חופשה</span>
                  <span className="insight-value">
                    {formatValue(summary?.vacationDays)}
                  </span>
                </div>
                <div className="insight-row">
                  <span className="insight-label">ימי מחלה</span>
                  <span className="insight-value">
                    {formatValue(summary?.sickDays)}
                  </span>
                </div>
              </div>
            </section>

            <section className="dashboard-card">
              <h2 className="feature-section-title">פנסיה וקרנות</h2>
              <div className="insights-grid">
                <div className="insight-row">
                  <span className="insight-label">פנסיה - עובד</span>
                  <span className="insight-value">
                    {formatValue(summary?.pensionEmployee)}
                  </span>
                </div>
                <div className="insight-row">
                  <span className="insight-label">פנסיה - מעסיק</span>
                  <span className="insight-value">
                    {formatValue(summary?.pensionEmployer)}
                  </span>
                </div>
                <div className="insight-row">
                  <span className="insight-label">קרן השתלמות / גמל - עובד</span>
                  <span className="insight-value">
                    {formatValue(summary?.trainingFundEmployee)}
                  </span>
                </div>
                <div className="insight-row">
                  <span className="insight-label">קרן השתלמות / גמל - מעסיק</span>
                  <span className="insight-value">
                    {formatValue(summary?.trainingFundEmployer)}
                  </span>
                </div>
              </div>
            </section>

            <section className="dashboard-card">
              <h2 className="feature-section-title">ניכויים</h2>
              <div className="insights-grid">
                <div className="insight-row">
                  <span className="insight-label">מס הכנסה</span>
                  <span className="insight-value">
                    {formatValue(summary?.tax)}
                  </span>
                </div>
                <div className="insight-row">
                  <span className="insight-label">ביטוח לאומי</span>
                  <span className="insight-value">
                    {formatValue(summary?.nationalInsurance)}
                  </span>
                </div>
                <div className="insight-row">
                  <span className="insight-label">מס בריאות / ביטוח בריאות</span>
                  <span className="insight-value">
                    {formatValue(summary?.healthInsurance)}
                  </span>
                </div>
              </div>
            </section>

            <section className="dashboard-card feature-page-actions">
              <button
                className="dashboard-hero-action"
                type="button"
                onClick={() => navigate("/documents/history")}
              >
                חזרה להיסטוריית תלושים
              </button>
              <button
                className="dashboard-hero-action"
                type="button"
                onClick={() => navigate("/dashboard")}
              >
                חזרה ללוח הבקרה
              </button>
            </section>
          </>
        )}
      </div>
    </div>
  );
}

