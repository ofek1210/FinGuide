import type { AIInsight } from "../../api/aiInsights.api";

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
}

export function InsightCard({ insight }: Props) {
  const s = SEVERITY_STYLES[insight.severity];

  return (
    <div
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
          marginTop: 6,
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
            marginBottom: 4,
          }}
        >
          <span style={{ fontWeight: 600, fontSize: 14, color: "#1a202c" }}>
            {insight.title}
          </span>
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

        {insight.description && (
          <p
            style={{
              fontSize: 13,
              color: "#4a5568",
              margin: "0 0 6px",
              lineHeight: 1.5,
            }}
          >
            {insight.description}
          </p>
        )}

        {insight.recommendation && (
          <p
            style={{
              fontSize: 13,
              color: "#2d3748",
              margin: "0 0 6px",
              fontWeight: 500,
              lineHeight: 1.5,
            }}
          >
            ▸ {insight.recommendation}
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
      </div>
    </div>
  );
}
