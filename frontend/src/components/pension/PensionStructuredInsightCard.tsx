import { ShieldAlert } from "lucide-react";
import type { PensionStructuredInsightDTO } from "../../api/pension.api";
import {
  formatBenchmarkLines,
  formatEstimatedImpactLines,
  hasDisplayValue,
  INSIGHT_SEVERITY,
  INSIGHT_TONE,
  insightCategoryLabel,
} from "../../utils/pensionStructuredInsightDisplay";

type Props = {
  insight: PensionStructuredInsightDTO;
};

function DetailBlock({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginTop: 10 }}>
      <div style={{ fontSize: 11, fontWeight: 800, color: "var(--text-faint)", letterSpacing: ".04em", marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 13, color: "var(--text-muted)", lineHeight: 1.55 }}>{children}</div>
    </div>
  );
}

export default function PensionStructuredInsightCard({ insight }: Props) {
  const sev = INSIGHT_SEVERITY[insight.severity] ?? INSIGHT_SEVERITY.info;
  const [bg, fg] = INSIGHT_TONE[sev.tone];
  const benchmarkLines = formatBenchmarkLines(insight.benchmark);
  const impactLines = formatEstimatedImpactLines(insight.estimatedImpact);

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

        {hasDisplayValue(insight.finding) && (
          <p style={{ margin: 0, fontSize: 14, color: "var(--text-muted)", lineHeight: 1.6 }}>{insight.finding}</p>
        )}

        {benchmarkLines.length > 0 && (
          <DetailBlock label="Benchmark">
            <ul style={{ margin: 0, paddingInlineStart: 18 }}>
              {benchmarkLines.map(line => <li key={line}>{line}</li>)}
            </ul>
          </DetailBlock>
        )}

        {impactLines.length > 0 && (
          <DetailBlock label="השפעה כספית משוערת">
            <ul style={{ margin: 0, paddingInlineStart: 18 }}>
              {impactLines.map(line => (
                <li key={line} style={{ fontWeight: 800, color: "var(--mint-ink)" }}>{line}</li>
              ))}
            </ul>
          </DetailBlock>
        )}

        {hasDisplayValue(insight.recommendedAction) && (
          <DetailBlock label="פעולה מומלצת">
            {insight.recommendedAction}
          </DetailBlock>
        )}

        {hasDisplayValue(insight.assumptions) && (
          <DetailBlock label="הנחות">
            <ul style={{ margin: 0, paddingInlineStart: 18 }}>
              {insight.assumptions!.map(item => <li key={item}>{item}</li>)}
            </ul>
          </DetailBlock>
        )}

        {hasDisplayValue(insight.limitations) && (
          <DetailBlock label="מגבלות">
            <ul style={{ margin: 0, paddingInlineStart: 18 }}>
              {insight.limitations!.map(item => <li key={item}>{item}</li>)}
            </ul>
          </DetailBlock>
        )}

        {insight.requiresLicensedAdvisor && (
          <div
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: 8,
              marginTop: 12,
              padding: "10px 12px",
              borderRadius: "var(--r-sm)",
              background: "var(--butter-soft)",
              color: "var(--butter-ink)",
              fontSize: 12.5,
              fontWeight: 700,
              lineHeight: 1.5,
            }}
          >
            <ShieldAlert size={16} style={{ flex: "none", marginTop: 1 }} />
            <span>נדרשת התייעצות עם בעל רישיון פנסיוני לפני קבלת החלטה.</span>
          </div>
        )}

        {hasDisplayValue(insight.disclaimer) && (
          <p style={{ margin: "12px 0 0", fontSize: 11.5, color: "var(--text-faint)", lineHeight: 1.5 }}>
            {insight.disclaimer}
          </p>
        )}
      </div>
    </article>
  );
}
