import { useState } from "react";

import { AlertTriangle, ChevronDown, ChevronUp, Loader2 } from "lucide-react";

import { formatCurrencyOrDash } from "../../utils/formatters";

import type { PensionFormattedRecommendationDTO, PensionStructuredInsightDTO } from "../../api/pension.api";



type Props = {

  recommendations?: PensionFormattedRecommendationDTO[] | null;

  positiveFindings?: PensionStructuredInsightDTO[] | null;

  additionalInsights?: PensionStructuredInsightDTO[] | null;

  summary?: string | null;

  loading?: boolean;

  error?: string | null;

  onRetry?: () => void;

  disclaimer?: string | null;

};



function impactLabel(rec: PensionFormattedRecommendationDTO): string | null {

  const fi = rec.financialImpact;

  if (!fi?.amount) return null;

  if (fi.period === "retirement") return `השפעה משוערת עד פרישה: ${formatCurrencyOrDash(fi.amount)}`;

  return `השפעה שנתית משוערת: ${formatCurrencyOrDash(fi.amount)}`;

}



function formatEvidenceLines(evidence: Record<string, unknown> | null | undefined): string[] {

  if (!evidence) return [];

  const lines: string[] = [];
  const bench = evidence.benchmark as { comparisonGroupLabel?: string } | undefined;
  const label = (typeof evidence.comparisonGroupLabel === "string" && evidence.comparisonGroupLabel.trim())
    ? evidence.comparisonGroupLabel
    : bench?.comparisonGroupLabel;
  if (typeof label === "string" && label.trim()) lines.push(`קבוצת השוואה: ${label}`);

  if (typeof evidence.estimatedAnnualCost === "number") {

    lines.push(`עלות שנתית משוערת: ${formatCurrencyOrDash(evidence.estimatedAnnualCost)}`);

  }

  if (typeof evidence.estimatedRetirementImpact === "number") {

    lines.push(`השפעה עד פרישה: ${formatCurrencyOrDash(evidence.estimatedRetirementImpact)}`);

  }

  if (typeof evidence.assetManagementFee === "number") {

    lines.push(`דמי ניהול מצבירה: ${evidence.assetManagementFee}%`);

  }

  if (typeof evidence.depositManagementFee === "number") {

    lines.push(`דמי ניהול מהפקדה: ${evidence.depositManagementFee}%`);

  }

  return lines;

}



function PositiveCard({ insight }: { insight: PensionStructuredInsightDTO }) {

  return (

    <div style={{ padding: "12px 14px", borderRadius: "var(--r-md)", background: "var(--mint-soft)", border: "1px solid rgba(47,156,98,.15)" }}>

      <div style={{ fontWeight: 800, fontSize: 14, color: "var(--mint-ink)", marginBottom: 4 }}>{insight.title}</div>

      <div style={{ fontSize: 13, color: "var(--text-muted)", lineHeight: 1.55 }}>{insight.finding}</div>

    </div>

  );

}



function RecommendationCard({ rec }: { rec: PensionFormattedRecommendationDTO }) {

  const [open, setOpen] = useState(false);

  const impact = impactLabel(rec);

  const evidenceLines = formatEvidenceLines(rec.evidence as Record<string, unknown> | null | undefined);

  const hasEvidence = evidenceLines.length > 0;



  return (

    <article style={{ background: "var(--card)", border: "1px solid var(--border-hair)", borderRadius: "var(--r-md)", boxShadow: "var(--shadow-soft)", overflow: "hidden" }}>

      <div style={{ height: 4, background: "var(--butter-ink)" }} />

      <div style={{ padding: "16px 18px" }}>

        <h3 style={{ margin: "0 0 8px", fontSize: 16, fontWeight: 900, color: "var(--text-strong)", lineHeight: 1.35 }}>{rec.title}</h3>

        <p style={{ margin: "0 0 8px", fontSize: 14, color: "var(--text-muted)", lineHeight: 1.6 }}>{rec.explanation}</p>

        {rec.whyItMatters && (

          <p style={{ margin: "0 0 8px", fontSize: 13.5, color: "var(--text-muted)", lineHeight: 1.55 }}>{rec.whyItMatters}</p>

        )}

        {rec.nextStep && (

          <p style={{ margin: "0 0 8px", fontSize: 13.5, fontWeight: 700, color: "var(--ink)" }}>{rec.nextStep}</p>

        )}

        {impact && (

          <div style={{ fontSize: 14, fontWeight: 800, color: "var(--mint-ink)", marginTop: 6 }}>{impact}</div>

        )}

        {hasEvidence && (

          <button

            type="button"

            onClick={() => setOpen(v => !v)}

            style={{ marginTop: 12, display: "inline-flex", alignItems: "center", gap: 6, border: "none", background: "none", cursor: "pointer", fontFamily: "var(--font-body)", fontWeight: 800, fontSize: 12.5, color: "var(--mint-ink)" }}

          >

            {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}

            איך הגענו לזה?

          </button>

        )}

        {open && hasEvidence && (

          <div style={{ marginTop: 10, padding: "10px 12px", borderRadius: "var(--r-sm)", background: "var(--surface-sunken)", fontSize: 12.5, color: "var(--text-muted)", lineHeight: 1.55 }}>

            {evidenceLines.map(line => <div key={line}>{line}</div>)}

          </div>

        )}

      </div>

    </article>

  );

}



export default function PensionCentralRecommendationsPanel({

  recommendations,

  positiveFindings,

  additionalInsights,

  summary,

  loading = false,

  error = null,

  onRetry,

  disclaimer,

}: Props) {

  const recs = recommendations ?? [];

  const positive = positiveFindings ?? [];

  const additional = additionalInsights ?? [];



  if (loading && !recs.length) {

    return (

      <section style={{ marginBottom: 18 }} aria-busy="true" aria-label="טוען המלצות">

        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "16px 18px", background: "var(--card)", borderRadius: "var(--r-md)", border: "1px solid var(--border-hair)" }}>

          <Loader2 size={18} style={{ animation: "spin .8s linear infinite", color: "var(--mint-ink)" }} />

          <span style={{ fontWeight: 700, fontSize: 14, color: "var(--text-muted)" }}>מכין המלצות מותאמות...</span>

        </div>

      </section>

    );

  }



  if (error) {

    return (

      <section style={{ marginBottom: 18 }} aria-label="שגיאה בטעינת המלצות">

        <div style={{ padding: "16px 18px", background: "rgba(214,69,69,.04)", border: "1px solid rgba(214,69,69,.25)", borderRadius: "var(--r-md)" }}>

          <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>

            <AlertTriangle size={20} color="#C23B3B" style={{ flex: "none", marginTop: 2 }} />

            <div style={{ flex: 1 }}>

              <div style={{ fontWeight: 800, fontSize: 15, color: "var(--text-strong)", marginBottom: 4 }}>לא הצלחנו לטעון המלצות</div>

              <div style={{ fontSize: 13.5, color: "var(--text-muted)", lineHeight: 1.5 }}>{error}</div>

              {onRetry && (

                <button type="button" onClick={onRetry} style={{ marginTop: 10, padding: "8px 14px", borderRadius: 999, border: "1px solid var(--border-soft)", background: "var(--card)", cursor: "pointer", fontWeight: 800, fontSize: 13 }}>

                  נסה שוב

                </button>

              )}

            </div>

          </div>

        </div>

      </section>

    );

  }



  if (!recs.length && !positive.length && !additional.length) return null;



  return (

    <section style={{ marginBottom: 18 }} aria-label="המלצות מרכזיות">

      <div style={{ margin: "0 2px 14px" }}>

        <h2 style={{ fontSize: 13, fontWeight: 800, color: "var(--text-faint)", letterSpacing: ".06em", margin: 0 }}>המלצות מרכזיות</h2>

        {summary && (

          <p style={{ margin: "6px 0 0", fontSize: 14, color: "var(--text-muted)", lineHeight: 1.5 }}>{summary}</p>

        )}

      </div>



      {recs.length > 0 && (

        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: positive.length || additional.length ? 16 : 0 }}>

          {recs.map(rec => (

            <RecommendationCard key={rec.insightId} rec={rec} />

          ))}

        </div>

      )}



      {positive.length > 0 && (

        <div style={{ marginBottom: additional.length ? 16 : 0 }}>

          <h3 style={{ fontSize: 12, fontWeight: 800, color: "var(--mint-ink)", letterSpacing: ".04em", margin: "0 0 10px" }}>נקודות חיוביות</h3>

          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>

            {positive.map(ins => <PositiveCard key={ins.id} insight={ins} />)}

          </div>

        </div>

      )}



      {additional.length > 0 && (

        <details style={{ marginTop: 8 }}>

          <summary style={{ cursor: "pointer", fontSize: 12.5, fontWeight: 800, color: "var(--text-faint)" }}>

            מידע נוסף ({additional.length})

          </summary>

          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 10 }}>

            {additional.map(ins => (

              <div key={ins.id} style={{ padding: "10px 12px", borderRadius: "var(--r-sm)", background: "var(--surface-sunken)", fontSize: 13, color: "var(--text-muted)", lineHeight: 1.55 }}>

                <strong style={{ color: "var(--text-strong)" }}>{ins.title}</strong>

                <div>{ins.finding}</div>

              </div>

            ))}

          </div>

        </details>

      )}



      {disclaimer && (

        <p style={{ margin: "14px 2px 0", fontSize: 11.5, color: "var(--text-faint)", lineHeight: 1.5 }}>{disclaimer}</p>

      )}

    </section>

  );

}

