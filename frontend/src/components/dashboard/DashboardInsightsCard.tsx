import { useNavigate } from "react-router-dom";
import { Sparkles } from "lucide-react";
import { useInsights } from "../../hooks/useInsights";
import { dismissInsight } from "../../api/insights.api";
import { APP_ROUTES } from "../../types/navigation";
import Loader from "../ui/Loader";

const severityClass: Record<string, string> = {
  critical: "insight-severity-critical",
  warning: "insight-severity-warning",
  info: "insight-severity-info",
};

export default function DashboardInsightsCard() {
  const navigate = useNavigate();
  const { items, isLoading, refresh } = useInsights("active");
  const top = items.slice(0, 3);

  const handleDismiss = async (id: string) => {
    await dismissInsight(id);
    void refresh();
  };

  return (
    <section className="dashboard-card">
      <header className="dashboard-card-header-row">
        <div>
          <Sparkles size={18} aria-hidden />
          <h3>תובנות AI</h3>
        </div>
        <button type="button" className="dashboard-link-btn" onClick={() => navigate(APP_ROUTES.insights)}>
          הכל
        </button>
      </header>

      {isLoading ? <Loader /> : null}
      {!isLoading && top.length === 0 ? (
        <p className="dashboard-muted">אין תובנות פעילות. העלה תלושים כדי לקבל ניתוח.</p>
      ) : null}

      <ul className="insights-list">
        {top.map(insight => (
          <li key={insight._id} className={`insights-list-item ${severityClass[insight.severity] ?? ""}`}>
            <strong>{insight.title}</strong>
            <p>{insight.description}</p>
            <button type="button" className="dashboard-link-btn" onClick={() => void handleDismiss(insight._id)}>
              סמן כנקרא
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
