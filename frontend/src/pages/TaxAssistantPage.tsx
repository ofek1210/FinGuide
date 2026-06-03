import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, FileUp, Scale, Upload } from "lucide-react";
import PrivateTopbar from "../components/PrivateTopbar";
import AppFooter from "../components/AppFooter";
import Loader from "../components/ui/Loader";
import { APP_ROUTES } from "../types/navigation";
import {
  getTaxAssistantSummary,
  type TaxAssistantIssue,
  type TaxAssistantPayload,
  type TaxIssueSeverity,
} from "../api/taxAssistant.api";

const severityLabels: Record<TaxIssueSeverity, string> = {
  low: "נמוכה",
  medium: "בינונית",
  high: "גבוהה",
};

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("he-IL", {
    style: "currency",
    currency: "ILS",
    maximumFractionDigits: 0,
  }).format(value);

const buildYearOptions = (centerYear: number) => {
  const years: number[] = [];
  for (let y = centerYear + 1; y >= centerYear - 4; y -= 1) {
    years.push(y);
  }
  return years;
};

export default function TaxAssistantPage() {
  const navigate = useNavigate();
  const currentYear = new Date().getFullYear();
  const yearOptions = useMemo(() => buildYearOptions(currentYear), [currentYear]);

  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [data, setData] = useState<TaxAssistantPayload | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  const loadSummary = useCallback(async (year: number) => {
    setIsLoading(true);
    setError("");

    const response = await getTaxAssistantSummary(year);
    if (response.success && response.data) {
      setData(response.data);
    } else {
      setData(null);
      setError(response.message || "לא הצלחנו לטעון את ניתוח המס.");
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    void loadSummary(selectedYear);
  }, [loadSummary, selectedYear]);

  const issues = data?.issues ?? [];
  const summary = data?.summary;

  const renderIssueExplanation = (issue: TaxAssistantIssue) => {
    switch (issue.type) {
      case "missing_payslips":
        return "חוסר תלושים עלול להצביע על פערים בדיווח השנתי או בתשלומי מס.";
      case "multiple_employers":
        return "עבודה אצל יותר ממעסיק אחד בשנה אחת משפיעה על ניכויי מס ודיווחים.";
      case "employer_change":
        return "מעבר בין מעסיקים במהלך השנה דורש בדיקה שהנתונים מדווחים נכון.";
      case "unusual_income_tax":
        return "קפיצה במס הכנסה לעומת הממוצע החודשי שווה בדיקה — ייתכן בונוס, תקופה חלקית או חריגה בניכויים.";
      case "missing_pension_contributions":
        return "היעדר הפקדות פנסיה בתלוש עשוי להצביע על חוסר בניכוי או על בעיה בדיווח המעסיק.";
      case "missing_form_106":
        return "טופס 106 מסכם את השנה — מומלץ להעלות אותו לצד תלושי השכר לבדיקה מלאה.";
      default:
        return issue.message;
    }
  };

  return (
    <div className="dashboard-page tax-assistant-page" dir="rtl">
      <div className="dashboard-shell">
        <PrivateTopbar />

        <header className="feature-page-header tax-assistant-header">
          <div>
            <Scale size={28} aria-hidden="true" />
            <h1>עוזר מס</h1>
            <p>ניתוח ראשוני של תלושי השכר והמסמכים הקיימים שלך לפי שנת מס.</p>
          </div>
          <label className="tax-assistant-year-select">
            <span>שנת מס</span>
            <select
              value={selectedYear}
              onChange={(event) => setSelectedYear(Number(event.target.value))}
            >
              {yearOptions.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </label>
        </header>

        <p className="tax-assistant-disclaimer" role="note">
          {data?.disclaimer ||
            "המידע המוצג הוא הערכה בלבד ואינו מהווה ייעוץ מס מקצועי."}
        </p>

        {isLoading ? (
          <section className="dashboard-card tax-assistant-loading">
            <Loader />
            <span>מנתחים נתוני שכר...</span>
          </section>
        ) : null}

        {error ? <div className="dashboard-inline-error">{error}</div> : null}

        {!isLoading && summary ? (
          <>
            <section className="tax-assistant-summary-grid">
              <article className="dashboard-card tax-assistant-stat-card">
                <span className="tax-assistant-stat-label">תלושים בשנה</span>
                <strong>{summary.totalSalaryDocuments}</strong>
              </article>
              <article className="dashboard-card tax-assistant-stat-card">
                <span className="tax-assistant-stat-label">הכנסה ברוטו</span>
                <strong>{formatCurrency(summary.totalGrossIncome)}</strong>
              </article>
              <article className="dashboard-card tax-assistant-stat-card">
                <span className="tax-assistant-stat-label">הכנסה נטו</span>
                <strong>{formatCurrency(summary.totalNetIncome)}</strong>
              </article>
              <article className="dashboard-card tax-assistant-stat-card">
                <span className="tax-assistant-stat-label">מס הכנסה שנוכה</span>
                <strong>{formatCurrency(summary.totalIncomeTax)}</strong>
              </article>
            </section>

            {summary.employers.length > 0 ? (
              <section className="dashboard-card">
                <h2>מעסיקים בשנה</h2>
                <p className="tax-assistant-employers">{summary.employers.join(" · ")}</p>
              </section>
            ) : null}

            <section className="dashboard-card tax-assistant-actions">
              <button
                type="button"
                className="dashboard-hero-action"
                onClick={() => navigate(APP_ROUTES.documents)}
              >
                <FileUp aria-hidden="true" />
                העלה טופס 106
              </button>
              <button
                type="button"
                className="dashboard-hero-action"
                onClick={() => navigate(APP_ROUTES.documents)}
              >
                <Upload aria-hidden="true" />
                העלה תלוש חסר
              </button>
            </section>

            <section className="dashboard-card">
              <h2>ממצאים לבדיקה ({issues.length})</h2>
              {issues.length === 0 ? (
                <p className="tax-assistant-empty">
                  לא זוהו חריגות מס עבור {selectedYear} על בסיס התלושים הקיימים.
                </p>
              ) : (
                <ul className="tax-assistant-issues">
                  {issues.map((issue) => (
                    <li key={`${issue.type}-${issue.message}`} className={`tax-assistant-issue severity-${issue.severity}`}>
                      <div className="tax-assistant-issue-head">
                        <AlertTriangle aria-hidden="true" />
                        <h3>{issue.title}</h3>
                        <span className={`tax-assistant-severity severity-${issue.severity}`}>
                          חומרה: {severityLabels[issue.severity]}
                        </span>
                      </div>
                      <p className="tax-assistant-issue-message">{issue.message}</p>
                      <p className="tax-assistant-issue-explanation">{renderIssueExplanation(issue)}</p>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        ) : null}

        <AppFooter variant="private" />
      </div>
    </div>
  );
}
