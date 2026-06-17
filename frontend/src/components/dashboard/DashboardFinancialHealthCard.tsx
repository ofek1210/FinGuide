import { useNavigate } from "react-router-dom";
import { Gauge } from "lucide-react";
import Loader from "../ui/Loader";
import { useFinancialHealthScore } from "../../hooks/useFinancialHealthScore";
import { APP_ROUTES } from "../../types/navigation";

export default function DashboardFinancialHealthCard() {
  const navigate = useNavigate();
  const { data, isLoading, error } = useFinancialHealthScore();

  const progress = data?.score ?? 0;
  const circumference = 2 * Math.PI * 42;
  const offset = circumference - (progress / 100) * circumference;

  return (
    <section className="dashboard-card financial-health-widget">
      <header className="dashboard-card-header-row">
        <div>
          <Gauge size={18} aria-hidden="true" />
          <h3>ציון פיננסי</h3>
        </div>
        <button
          type="button"
          className="dashboard-link-btn"
          onClick={() => navigate(APP_ROUTES.financialHealth)}
        >
          צפה בפירוט
        </button>
      </header>

      {isLoading ? (
        <div className="financial-health-widget-loading">
          <Loader />
          <span>מחשבים ציון...</span>
        </div>
      ) : null}

      {error ? <p className="dashboard-inline-error">{error}</p> : null}

      {data ? (
        <>
          <div className="financial-health-widget-main">
            <div className="financial-health-ring" aria-hidden="true">
              <svg viewBox="0 0 100 100" className="financial-health-ring-svg">
                <circle cx="50" cy="50" r="42" className="financial-health-ring-bg" />
                <circle
                  cx="50"
                  cy="50"
                  r="42"
                  className={`financial-health-ring-progress level-${data.level}`}
                  strokeDasharray={circumference}
                  strokeDashoffset={offset}
                />
              </svg>
              <div className="financial-health-ring-label">
                <strong>{data.score}</strong>
                <span>/100</span>
              </div>
            </div>
            <div className="financial-health-widget-copy">
              <p className={`financial-health-level level-${data.level}`}>{data.label}</p>
              <p className="dashboard-muted">שנת {data.year}</p>
            </div>
          </div>

          {data.topActions.length > 0 ? (
            <ul className="financial-health-widget-actions">
              {data.topActions.slice(0, 2).map((action) => (
                <li key={action.title}>
                  <strong>{action.title}</strong>
                  <span>{action.description}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="dashboard-muted">אין פעולות דחופות — המשך לעקוב אחרי המסמכים.</p>
          )}
        </>
      ) : null}
    </section>
  );
}
