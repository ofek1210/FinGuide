import { ShieldAlert } from "lucide-react";
import type { PensionStructuredInsightDTO } from "../../api/pension.api";
import AgentInsightCta from "../ai/AgentInsightCta";
import {
  formatEstimatedImpactLines,
  hasDisplayValue,
  INSIGHT_SEVERITY,
  INSIGHT_TONE,
  insightCategoryLabel,
} from "../../utils/pensionStructuredInsightDisplay";
import { insightTeaser } from "../../utils/insightDisplay";

type Props = {
  insight: PensionStructuredInsightDTO;
};

export default function PensionStructuredInsightCard({ insight }: Props) {
  const sev = INSIGHT_SEVERITY[insight.severity] ?? INSIGHT_SEVERITY.info;
  const [bg, fg] = INSIGHT_TONE[sev.tone];
  const impactLines = formatEstimatedImpactLines(insight.estimatedImpact);
  const primaryImpact = impactLines[0] ?? null;
  const findingTeaser = hasDisplayValue(insight.finding)
    ? insightTeaser(insight.finding!)
    : "";

  return (
    <article
      style={{
        background: "var(--card)",
        border: "1px solid var(--border-hair)",
        borderRadius: "var(--r-md)",
        boxShadow: "var(--shadow-soft)",
        overflow: "hidden",
      }}
    >
      <div style={{ height: 4, background: fg }} />
      <div style={{ padding: "16px 18px" }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 8 }}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
            <span style={{ fontSize: 10.5, fontWeight: 800, color: fg, background: bg, borderRadius: 999, padding: "3px 10px" }}>
              {sev.label}
            </span>
            <span style={{ fontSize: 10.5, fontWeight: 700, color: "var(--text-faint)", background: "var(--surface-sunken)", borderRadius: 999, padding: "3px 10px" }}>
              {insightCategoryLabel(insight.category)}
            </span>
          </div>
          {hasDisplayValue(insight.confidence) && (
            <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-faint)" }}>
              ביטחון {Math.round((insight.confidence ?? 0) * 100)}%
            </span>
          )}
        </div>

        <h3 style={{ margin: "0 0 8px", fontSize: 16, fontWeight: 900, color: "var(--text-strong)", lineHeight: 1.35 }}>
          {insight.title}
        </h3>

        {findingTeaser && (
          <p style={{ margin: 0, fontSize: 13.5, color: "var(--text-muted)", lineHeight: 1.5 }}>{findingTeaser}</p>
        )}

        {primaryImpact && (
          <div style={{ marginTop: 10, fontSize: 13, fontWeight: 800, color: "var(--mint-ink)" }}>
            {primaryImpact}
          </div>
        )}

        {insight.requiresLicensedAdvisor && (
          <div
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: 8,
              marginTop: 10,
              padding: "8px 10px",
              borderRadius: "var(--r-sm)",
              background: "var(--butter-soft)",
              color: "var(--butter-ink)",
              fontSize: 12,
              fontWeight: 700,
              lineHeight: 1.45,
            }}
          >
            <ShieldAlert size={15} style={{ flex: "none", marginTop: 1 }} />
            <span>נדרשת התייעצות עם בעל רישיון פנסיוני.</span>
          </div>
        )}

        <AgentInsightCta agent="pension" />
      </div>
    </article>
  );
}
