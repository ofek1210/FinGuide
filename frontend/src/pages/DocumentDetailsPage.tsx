import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import PrivateTopbar from "../components/PrivateTopbar";
import Loader from "../components/ui/Loader";
import {
  getDocument,
  getDocumentDigest,
  type DocumentItem,
  type PayslipSummaryFromBackend,
  type DigestResponse,
} from "../api/documents.api";
import {
  formatCurrencyILS,
  formatPercent,
  formatNumber,
} from "../utils/formatters";

function getSummary(doc: DocumentItem | null): PayslipSummaryFromBackend | null {
  return doc?.analysisData?.summary ?? null;
}

function getParties(doc: DocumentItem | null): {
  employer_name?: string;
  employee_name?: string;
  employee_id?: string;
} | null {
  const raw = doc?.analysisData;
  if (raw == null || typeof raw !== "object") return null;
  const parties = (raw as { parties?: { employer_name?: string; employee_name?: string; employee_id?: string } }).parties;
  return parties ?? null;
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined || value === "") {
    return "—";
  }
  return String(value);
}

function formatMoney(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  const n = Number(value);
  return Number.isFinite(n) ? formatCurrencyILS(n) : "—";
}

function formatPercentValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  const n = Number(value);
  return Number.isFinite(n) ? formatPercent(n) : "—";
}

function formatNumberValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  const n = Number(value);
  return Number.isFinite(n) ? formatNumber(n) : "—";
}

export default function DocumentDetailsPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [document, setDocument] = useState<DocumentItem | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [digest, setDigest] = useState<DigestResponse | null>(null);

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

  // Load AI digest separately (non-blocking)
  useEffect(() => {
    if (!id) return;
    void getDocumentDigest(id).then(res => setDigest(res));
  }, [id]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadDocument();
  }, [loadDocument]);

  const summary = getSummary(document);
  const parties = getParties(document);
  const docSource = (document?.analysisData as { source?: string } | null)?.source;
  const isForm106 = docSource === "form_106";
  const isHarHaBituach = docSource === "har_habitua";
  const form106Annual = isForm106
    ? (document?.analysisData as { annual?: Record<string, unknown> } | null)?.annual
    : null;
  const form106Period = isForm106
    ? (document?.analysisData as { period?: { year?: number } } | null)?.period
    : null;
  const hbData = isHarHaBituach
    ? (document?.analysisData as {
        exportDate?: string;
        policies?: Array<{ policyNumber?: string; companyName?: string; branchName?: string; policyType?: string; monthlyPremium?: number; coverageAmount?: number }>;
        summary?: { totalPolicies?: number; estimatedMonthlyPremium?: number; companies?: string[] };
      } | null)
    : null;

  return (
    <div className="feature-page dashboard-page" dir="rtl">
      <div className="dashboard-shell">
        <PrivateTopbar />

        <section className="dashboard-card">
          <h1 className="feature-page-title">
            {isForm106 ? "טופס 106 — תעודת שכר שנתית" : isHarHaBituach ? "הר הביטוח — פוליסות ביטוח" : "פרטי תלוש"}
          </h1>
          <p className="feature-page-subtitle">
            {isForm106
              ? "סיכום שנתי של הכנסות, ניכויים ותשלומים לפי טופס 106."
              : isHarHaBituach
              ? "רשימת הפוליסות שיובאו מפלטפורמת הר הביטוח."
              : "פירוט הערכים שזוהו מהתלוש שהועלה."}
          </p>
        </section>

        {digest?.success && digest.data ? (
          <section className="dashboard-card digest-card">
            <div className="digest-header">
              <span className="digest-ai-badge">✦ FinGuide AI</span>
              <span className="digest-date">
                {new Date(digest.data.generatedAt).toLocaleDateString("he-IL")}
              </span>
            </div>
            <p className="digest-text">{digest.data.text}</p>
          </section>
        ) : null}


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
        ) : isForm106 ? (
          <>
            <section className="dashboard-card">
              <h2 className="feature-section-title">פרטים</h2>
              <div className="insights-grid">
                <div className="insight-row">
                  <span className="insight-label">שם עובד</span>
                  <span className="insight-value">{formatValue(parties?.employee_name)}</span>
                </div>
                <div className="insight-row">
                  <span className="insight-label">ת.ז.</span>
                  <span className="insight-value">{formatValue(parties?.employee_id)}</span>
                </div>
                <div className="insight-row">
                  <span className="insight-label">מעסיק</span>
                  <span className="insight-value">{formatValue(parties?.employer_name)}</span>
                </div>
                <div className="insight-row">
                  <span className="insight-label">שנת מס</span>
                  <span className="insight-value">{formatValue(form106Period?.year)}</span>
                </div>
                <div className="insight-row">
                  <span className="insight-label">חודשי עבודה</span>
                  <span className="insight-value">{formatNumberValue(form106Annual?.work_months)}</span>
                </div>
              </div>
            </section>

            <section className="dashboard-card">
              <h2 className="feature-section-title">הכנסות (שנתי)</h2>
              <div className="insights-grid">
                <div className="insight-row">
                  <span className="insight-label">משכורת ברוטו</span>
                  <span className="insight-value">{formatMoney(form106Annual?.gross)}</span>
                </div>
                <div className="insight-row">
                  <span className="insight-label">שכר מבוטח לקופ"ג</span>
                  <span className="insight-value">{formatMoney(form106Annual?.pension_base)}</span>
                </div>
                <div className="insight-row">
                  <span className="insight-label">שכר לקרן השתלמות</span>
                  <span className="insight-value">{formatMoney(form106Annual?.study_fund_base)}</span>
                </div>
              </div>
            </section>

            <section className="dashboard-card">
              <h2 className="feature-section-title">ניכויים (שנתי)</h2>
              <div className="insights-grid">
                <div className="insight-row">
                  <span className="insight-label">מס הכנסה</span>
                  <span className="insight-value">{formatMoney(form106Annual?.income_tax)}</span>
                </div>
                <div className="insight-row">
                  <span className="insight-label">ביטוח לאומי</span>
                  <span className="insight-value">{formatMoney(form106Annual?.national_insurance)}</span>
                </div>
                <div className="insight-row">
                  <span className="insight-label">ביטוח בריאות</span>
                  <span className="insight-value">{formatMoney(form106Annual?.health_insurance)}</span>
                </div>
                <div className="insight-row">
                  <span className="insight-label">ניכוי לקופות גמל (עובד)</span>
                  <span className="insight-value">{formatMoney(form106Annual?.pension_employee_deduction)}</span>
                </div>
              </div>
            </section>

            <section className="dashboard-card">
              <h2 className="feature-section-title">הפרשות מעסיק (שנתי)</h2>
              <div className="insights-grid">
                <div className="insight-row">
                  <span className="insight-label">הפרשות לקופ"ג</span>
                  <span className="insight-value">{formatMoney(form106Annual?.pension_employer)}</span>
                </div>
                {(form106Annual?.tax_credit_points ?? null) !== null && (
                  <div className="insight-row">
                    <span className="insight-label">נקודות זיכוי</span>
                    <span className="insight-value">{formatNumberValue(form106Annual?.tax_credit_points)}</span>
                  </div>
                )}
                {(form106Annual?.tax_credit_value ?? null) !== null && (
                  <div className="insight-row">
                    <span className="insight-label">ערך נקודות זיכוי</span>
                    <span className="insight-value">{formatMoney(form106Annual?.tax_credit_value)}</span>
                  </div>
                )}
              </div>
            </section>

            <section className="dashboard-card feature-page-actions">
              <button className="dashboard-hero-action" type="button" onClick={() => navigate("/documents")}>
                חזרה למסמכים
              </button>
              <button className="dashboard-hero-action" type="button" onClick={() => navigate("/dashboard")}>
                חזרה ללוח הבקרה
              </button>
            </section>
          </>
        ) : isHarHaBituach ? (
          <>
            <section className="dashboard-card">
              <h2 className="feature-section-title">פרטי ייצוא</h2>
              <div className="insights-grid">
                <div className="insight-row">
                  <span className="insight-label">תאריך ייצוא</span>
                  <span className="insight-value">{formatValue(hbData?.exportDate)}</span>
                </div>
                <div className="insight-row">
                  <span className="insight-label">סה"כ פוליסות</span>
                  <span className="insight-value">{formatNumberValue(hbData?.summary?.totalPolicies)}</span>
                </div>
                <div className="insight-row">
                  <span className="insight-label">פרמיה חודשית משוערת</span>
                  <span className="insight-value">{formatMoney(hbData?.summary?.estimatedMonthlyPremium)}</span>
                </div>
                {hbData?.summary?.companies && hbData.summary.companies.length > 0 && (
                  <div className="insight-row">
                    <span className="insight-label">חברות ביטוח</span>
                    <span className="insight-value">{hbData.summary.companies.join(", ")}</span>
                  </div>
                )}
              </div>
            </section>

            {hbData?.policies && hbData.policies.length > 0 ? (
              <section className="dashboard-card">
                <h2 className="feature-section-title">פוליסות</h2>
                {hbData.policies.map((p, i) => (
                  <div key={i} className="insights-grid" style={{ marginBottom: "0.75rem" }}>
                    {p.companyName && <div className="insight-row"><span className="insight-label">חברה</span><span className="insight-value">{p.companyName}</span></div>}
                    {p.branchName && <div className="insight-row"><span className="insight-label">ענף</span><span className="insight-value">{p.branchName}</span></div>}
                    {p.policyNumber && <div className="insight-row"><span className="insight-label">מספר פוליסה</span><span className="insight-value">{p.policyNumber}</span></div>}
                    {p.monthlyPremium != null && <div className="insight-row"><span className="insight-label">פרמיה חודשית</span><span className="insight-value">{formatMoney(p.monthlyPremium)}</span></div>}
                  </div>
                ))}
              </section>
            ) : (
              <section className="dashboard-card">
                <p style={{ color: "var(--color-text-secondary)", fontSize: "0.95rem" }}>
                  קובץ ה-xlsx יובא בהצלחה, אך לא נמצאו פוליסות פעילות בנתונים. אם ייצאת מהר הביטוח ולא קיבלת פוליסות — ייתכן שאין לך פוליסות רשומות במאגר.
                </p>
              </section>
            )}

            <section className="dashboard-card feature-page-actions">
              <button className="dashboard-hero-action" type="button" onClick={() => navigate("/documents")}>
                חזרה למסמכים
              </button>
              <button className="dashboard-hero-action" type="button" onClick={() => navigate("/dashboard")}>
                חזרה ללוח הבקרה
              </button>
            </section>
          </>
        ) : (
          <>
            <section className="dashboard-card">
              <h2 className="feature-section-title">פרטי תלוש</h2>
              <div className="insights-grid">
                <div className="insight-row">
                  <span className="insight-label">שם עובד</span>
                  <span className="insight-value">
                    {formatValue(parties?.employee_name ?? summary?.employeeName)}
                  </span>
                </div>
                <div className="insight-row">
                  <span className="insight-label">ת.ז.</span>
                  <span className="insight-value">
                    {formatValue(parties?.employee_id)}
                  </span>
                </div>
                <div className="insight-row">
                  <span className="insight-label">מעסיק</span>
                  <span className="insight-value">
                    {formatValue(parties?.employer_name)}
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
                    {formatPercentValue(summary?.jobPercentage)}
                  </span>
                </div>
                <div className="insight-row">
                  <span className="insight-label">ימי עבודה</span>
                  <span className="insight-value">
                    {formatNumberValue(summary?.workingDays)}
                  </span>
                </div>
                <div className="insight-row">
                  <span className="insight-label">שעות עבודה</span>
                  <span className="insight-value">
                    {formatNumberValue(summary?.workingHours)}
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
                    {formatMoney(summary?.grossSalary)}
                  </span>
                </div>
                <div className="insight-row">
                  <span className="insight-label">שכר נטו</span>
                  <span className="insight-value">
                    {formatMoney(summary?.netSalary)}
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
                    {formatNumberValue(summary?.vacationDays)}
                  </span>
                </div>
                <div className="insight-row">
                  <span className="insight-label">ימי מחלה</span>
                  <span className="insight-value">
                    {formatNumberValue(summary?.sickDays)}
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
                    {formatMoney(summary?.pensionEmployee)}
                  </span>
                </div>
                <div className="insight-row">
                  <span className="insight-label">פנסיה - מעסיק</span>
                  <span className="insight-value">
                    {formatMoney(summary?.pensionEmployer)}
                  </span>
                </div>
                <div className="insight-row">
                  <span className="insight-label">קרן השתלמות / גמל - עובד</span>
                  <span className="insight-value">
                    {formatMoney(summary?.trainingFundEmployee)}
                  </span>
                </div>
                <div className="insight-row">
                  <span className="insight-label">קרן השתלמות / גמל - מעסיק</span>
                  <span className="insight-value">
                    {formatMoney(summary?.trainingFundEmployer)}
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
                    {formatMoney(summary?.tax)}
                  </span>
                </div>
                <div className="insight-row">
                  <span className="insight-label">ביטוח לאומי</span>
                  <span className="insight-value">
                    {formatMoney(summary?.nationalInsurance)}
                  </span>
                </div>
                <div className="insight-row">
                  <span className="insight-label">מס בריאות / ביטוח בריאות</span>
                  <span className="insight-value">
                    {formatMoney(summary?.healthInsurance)}
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

