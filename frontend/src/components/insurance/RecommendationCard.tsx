import type { RecommendationItem } from "../../api/recommendations.api";
import ImportanceBadge from "./ImportanceBadge";
import PriceRangeBar from "./PriceRangeBar";

type Props = {
  recommendation: RecommendationItem;
  onDismiss: (id: string) => void;
  onPurchased: (id: string) => void;
};

export default function RecommendationCard({ recommendation, onDismiss, onPurchased }: Props) {
  return (
    <article className="recommendation-card">
      <header>
        <ImportanceBadge importance={recommendation.importance} />
        <h3>{recommendation.title}</h3>
      </header>

      <ul className="recommendation-reasoning">
        {recommendation.reasoning.map((line, i) => (
          <li key={i}>{line}</li>
        ))}
      </ul>

      {recommendation.priceRange.average > 0 ? (
        <PriceRangeBar range={recommendation.priceRange} />
      ) : (
        <p className="dashboard-muted">הערכת עלות: לפי שכר ומעסיק</p>
      )}

      <div className="recommendation-actions">
        <button type="button" className="auth-button" onClick={() => onPurchased(recommendation._id)}>
          יש לי כבר
        </button>
        <button type="button" className="dashboard-link-btn" onClick={() => onDismiss(recommendation._id)}>
          לא רלוונטי
        </button>
      </div>
    </article>
  );
}
