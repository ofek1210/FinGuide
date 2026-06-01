import type { RecommendationImportance } from "../../api/recommendations.api";

const labels: Record<RecommendationImportance, string> = {
  critical: "קריטי",
  high: "גבוה",
  medium: "בינוני",
  low: "נמוך",
};

type Props = { importance: RecommendationImportance };

export default function ImportanceBadge({ importance }: Props) {
  return (
    <span className={`importance-badge importance-${importance}`}>
      {labels[importance]}
    </span>
  );
}
