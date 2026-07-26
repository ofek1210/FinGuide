import type { AIInsight } from "../../api/aiInsights.api";
import type { InsightAgentKind } from "../../utils/insightDisplay";
import { insightTeaser } from "../../utils/insightDisplay";
import AgentInsightCta from "./AgentInsightCta";

const SEVERITY_STYLES: Record<
  AIInsight["severity"],
  { border: string; bg: string; dot: string; label: string }
> = {
  error: { border: "#e53e3e", bg: "#fff5f5", dot: "#e53e3e", label: "קריטי" },
  warning: { border: "#d69e2e", bg: "#fffbeb", dot: "#d69e2e", label: "שים לב" },
  info: { border: "#3182ce", bg: "#ebf8ff", dot: "#3182ce", label: "תובנה" },
};

interface Props {
  insight: AIInsight;
  agent?: InsightAgentKind;
}

export function InsightCard({ insight, agent = "payslip" }: Props) {
  const s = SEVERITY_STYLES[insight.severity];
  const teaser = insightTeaser(insight.description || insight.recommendation || "");

  return (
    <article
      style={{
        display: "flex",
        gap: 12,
        padding: "14px 16px",
        borderRadius: 10,
        background: s.bg,
        borderRight: `3px solid ${s.border}`,
        marginBottom: 10,
      }}
    >
      <div
        style={{
          width: 8,
          height: 8,
          borderRadius: "50%",
          background: s.dot,
          marginTop: 8,
          flexShrink: 0,
        }}
      />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: 8,
            marginBottom: teaser || insight.financialImpactLabel ? 6 : 0,
          }}
        >
          <h3 style={{ margin: 0, fontWeight: 800, fontSize: 15, color: "#1a202c", lineHeight: 1.35 }}>
            {insight.title}
          </h3>
          <span
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: s.border,
              background: `${s.border}18`,
              padding: "2px 8px",
              borderRadius: 99,
              whiteSpace: "nowrap",
              flexShrink: 0,
            }}
          >
            {s.label}
          </span>
        </div>

        {teaser && (
          <p
            style={{
              fontSize: 13,
              color: "#4a5568",
              margin: "0 0 6px",
              lineHeight: 1.45,
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
            }}
          >
            {teaser}
          </p>
        )}

        {insight.financialImpactLabel && (
          <span
            style={{
              display: "inline-block",
              fontSize: 12,
              fontWeight: 700,
              color: "#2d7d46",
              background: "#f0fdf4",
              border: "1px solid #bbf7d0",
              padding: "2px 10px",
              borderRadius: 99,
            }}
          >
            {insight.financialImpactLabel}
          </span>
        )}

        <AgentInsightCta agent={agent} />
      </div>
    </article>
  );
}
