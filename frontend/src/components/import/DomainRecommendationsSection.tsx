import GlassCard from "../ui/GlassCard";
import Badge from "../ui/Badge";
import SectionHeader from "../ui/SectionHeader";
import { getUrgencyLabel, urgencyToBadgeVariant } from "../../utils/recommendationDisplay";

export type DomainRecommendation = {
  title: string;
  reason: string;
  urgency?: "high" | "medium" | "low" | string;
  financialImpact?: string | null;
};

type DomainRecommendationsSectionProps = {
  recommendations: DomainRecommendation[];
  title?: string;
  subtitle?: string;
  limit?: number;
};

export function DomainRecommendationsSection({
  recommendations,
  title = "✦ המלצות הסוכן",
  subtitle = "פעולות מומלצות לשיפור המצב הפיננסי",
  limit = 6,
}: DomainRecommendationsSectionProps) {
  if (recommendations.length === 0) return null;

  return (
    <section style={{ marginBottom: 36 }}>
      <SectionHeader title={title} subtitle={subtitle} />
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {recommendations.slice(0, limit).map((rec, i) => (
          <GlassCard key={i} padding="md" style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
            <Badge variant={urgencyToBadgeVariant(rec.urgency)}>
              {getUrgencyLabel(rec.urgency)}
            </Badge>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: 14, color: "#1F1F1F", marginBottom: 3 }}>{rec.title}</div>
              <div style={{ fontSize: 13, color: "#7C6FA0", lineHeight: 1.55 }}>{rec.reason}</div>
              {rec.financialImpact && (
                <div style={{ fontSize: 12.5, color: "#059669", fontWeight: 700, marginTop: 5 }}>{rec.financialImpact}</div>
              )}
            </div>
          </GlassCard>
        ))}
      </div>
    </section>
  );
}
