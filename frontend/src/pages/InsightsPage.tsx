import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, Sparkles } from "lucide-react";
import PrivateTopbar from "../components/PrivateTopbar";
import AppFooter from "../components/AppFooter";
import Loader from "../components/ui/Loader";
import { useInsights } from "../hooks/useInsights";
import { dismissInsight, runInsightsAnalysis, type InsightSeverity } from "../api/insights.api";
import { APP_ROUTES } from "../types/navigation";
import AnalysisTabBar from "../components/tabs/AnalysisTabBar";

const severityLabels: Record<InsightSeverity, string> = {
  critical: "קריטי",
  warning: "אזהרה",
  info: "מידע",
};

export default function InsightsPage() {
  const navigate = useNavigate();
  const { items, isLoading, error, refresh } = useInsights("active");
  const [filter, setFilter] = useState<InsightSeverity | "all">("all");
  const [running, setRunning] = useState(false);

  const filtered = filter === "all" ? items : items.filter(i => i.severity === filter);

  const handleRun = async () => {
    setRunning(true);
    await runInsightsAnalysis();
    await refresh();
    setRunning(false);
  };

  const handleDismiss = async (id: string) => {
    await dismissInsight(id);
    await refresh();
  };

  return (
    <div className="dashboard-page" dir="rtl">
      <div className="dashboard-shell">
        <PrivateTopbar />
        <AnalysisTabBar />

        <header className="ai-page-header">
          <div className="ai-page-header-main">
            <div className="ai-page-icon-wrap">
              <Sparkles size={32} />
            </div>
            <div>
              <div className="ai-page-badge">
                <Sparkles size={12} />
                <span>ניתוח חכם</span>
              </div>
              <h1>תובנות חכמות</h1>
              <p className="ai-page-subtitle">המערכת סורקת את תלושי השכר שלך ומחפשת דברים חשובים — למשל: האם ניכו לך יותר מדי מס? האם חסרה הפרשה לפנסיה? האם יש שינוי חריג בשכר?</p>
            </div>
          </div>
          <button type="button" className="ai-run-btn" disabled={running} onClick={() => void handleRun()}>
            {running ? <><span className="ai-run-spinner" /> מריץ ניתוח AI...</> : <><Sparkles size={14} /> הרץ ניתוח AI</>}
          </button>
        </header>

        <div className="insights-filters">
          {(["all", "critical", "warning", "info"] as const).map(f => (
            <button
              key={f}
              type="button"
              className={`insights-filter-btn ${filter === f ? "is-active" : ""}`}
              onClick={() => setFilter(f)}
            >
              {f === "all" ? "הכל" : severityLabels[f]}
            </button>
          ))}
        </div>

        {isLoading ? <Loader /> : null}
        {error ? <div className="dashboard-inline-error">{error}</div> : null}

        {!isLoading && filtered.length === 0 ? (
          <section className="dashboard-card">
            <p>אין תובנות פעילות. העלה תלושים והרץ ניתוח.</p>
            <button type="button" className="auth-button" onClick={() => navigate(APP_ROUTES.documents)}>
              העלאת תלוש
            </button>
          </section>
        ) : null}

        <div className="insights-grid">
          {filtered.map(insight => (
            <article key={insight._id} className={`insight-card insight-${insight.severity}`}>
              <header>
                <AlertTriangle size={18} aria-hidden />
                <span className={`importance-badge importance-${insight.severity === "critical" ? "critical" : insight.severity === "warning" ? "high" : "medium"}`}>
                  {severityLabels[insight.severity]}
                </span>
                <h3>{insight.title}</h3>
              </header>
              <p>{insight.description}</p>
              <button type="button" className="dashboard-link-btn" onClick={() => void handleDismiss(insight._id)}>
                סמן כנקרא
              </button>
            </article>
          ))}
        </div>

        <p style={{ fontSize: 12, color: "var(--rapyd-text-muted)", textAlign: "center", margin: "24px 0 0", lineHeight: 1.6 }}>
          ⚠️ התובנות נוצרות אוטומטית על ידי AI על בסיס הנתונים שהעלית. אינן מהוות ייעוץ פיננסי מקצועי.
        </p>

        <AppFooter variant="private" />
      </div>
    </div>
  );
}
