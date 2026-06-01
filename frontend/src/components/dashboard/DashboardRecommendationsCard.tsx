import { useNavigate } from "react-router-dom";
import { Shield } from "lucide-react";
import { useRecommendations } from "../../hooks/useRecommendations";
import ImportanceBadge from "../insurance/ImportanceBadge";
import { APP_ROUTES } from "../../types/navigation";
import Loader from "../ui/Loader";

export default function DashboardRecommendationsCard() {
  const navigate = useNavigate();
  const { items, isLoading } = useRecommendations();
  const top = items
    .filter(r => r.importance === "critical" || r.importance === "high")
    .slice(0, 2);

  return (
    <section className="dashboard-card">
      <header className="dashboard-card-header-row">
        <div>
          <Shield size={18} aria-hidden />
          <h3>המלצות ביטוח</h3>
        </div>
        <button type="button" className="dashboard-link-btn" onClick={() => navigate(APP_ROUTES.insurance)}>
          הכל
        </button>
      </header>

      {isLoading ? <Loader /> : null}
      {!isLoading && top.length === 0 ? (
        <p className="dashboard-muted">אין המלצות דחופות כרגע.</p>
      ) : null}

      <ul className="recommendations-mini-list">
        {top.map(rec => (
          <li key={rec._id}>
            <ImportanceBadge importance={rec.importance} />
            <strong>{rec.title}</strong>
            <span className="dashboard-muted">
              ₪{rec.priceRange.average.toLocaleString("he-IL")}/חודש (ממוצע)
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
