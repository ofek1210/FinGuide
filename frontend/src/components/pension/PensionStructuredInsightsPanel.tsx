import { AlertTriangle, Loader2, Sparkles } from "lucide-react";
import type { PensionInsightMetaDTO, PensionStructuredInsightDTO } from "../../api/pension.api";
import PensionStructuredInsightCard from "./PensionStructuredInsightCard";
import { sortStructuredInsights } from "../../utils/pensionStructuredInsightDisplay";

type Props = {
  insights?: PensionStructuredInsightDTO[] | null;
  meta?: PensionInsightMetaDTO | null;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  hasLegacyRecommendations?: boolean;
};

export default function PensionStructuredInsightsPanel({
  insights,
  meta,
  loading = false,
  error = null,
  onRetry,
  hasLegacyRecommendations = false,
}: Props) {
  const sorted = sortStructuredInsights(insights ?? []);

  if (loading) {
    return (
      <section style={{ marginBottom: 18 }} aria-busy="true" aria-label="טוען תובנות">
        <h2 style={sectionTitleStyle}>תובנות מובנות</h2>
        <div style={panelBoxStyle}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, color: "var(--mint-ink)", fontWeight: 700, fontSize: 14 }}>
            <Loader2 size={18} style={{ animation: "spin .8s linear infinite" }} />
            מנתח נתונים מול השוק והפרופיל שלך...
          </div>
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section style={{ marginBottom: 18 }} aria-label="שגיאה בטעינת תובנות">
        <h2 style={sectionTitleStyle}>תובנות מובנות</h2>
        <div style={{ ...panelBoxStyle, borderColor: "rgba(214,69,69,.25)", background: "rgba(214,69,69,.04)" }}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
            <AlertTriangle size={20} color="#C23B3B" style={{ flex: "none", marginTop: 2 }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 800, fontSize: 15, color: "var(--text-strong)", marginBottom: 4 }}>לא הצלחנו לטעון תובנות</div>
              <div style={{ fontSize: 13.5, color: "var(--text-muted)", lineHeight: 1.5 }}>{error}</div>
              {onRetry && (
                <button type="button" onClick={onRetry} style={retryBtnStyle}>נסה שוב</button>
              )}
            </div>
          </div>
        </div>
      </section>
    );
  }

  if (!sorted.length) {
    return (
      <section style={{ marginBottom: 18 }} aria-label="אין תובנות מובנות">
        <h2 style={sectionTitleStyle}>תובנות מובנות</h2>
        <div style={panelBoxStyle}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
            <Sparkles size={20} color="var(--mint-ink)" style={{ flex: "none", marginTop: 2 }} />
            <div>
              <div style={{ fontWeight: 800, fontSize: 15, color: "var(--text-strong)", marginBottom: 4 }}>אין עדיין תובנות מובנות</div>
              <div style={{ fontSize: 13.5, color: "var(--text-muted)", lineHeight: 1.55 }}>
                {hasLegacyRecommendations
                  ? "המערכת מציגה המלצות קלאסיות למטה. העלה דוח מסלקה מעודכן לקבלת תובנות מפורטות."
                  : "העלה דוח פנסיוני או הוסף קרנות כדי לקבל ניתוח מול השוק והפרופיל שלך."}
              </div>
            </div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section style={{ marginBottom: 18 }} aria-label="תובנות מובנות">
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, flexWrap: "wrap", margin: "0 2px 14px" }}>
        <h2 style={{ ...sectionTitleStyle, margin: 0 }}>תובנות מובנות ({sorted.length})</h2>
        {meta?.dataCompleteness?.marketMatchRate != null && (
          <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text-faint)" }}>
            התאמה לשוק: {Math.round(meta.dataCompleteness.marketMatchRate * 100)}%
          </span>
        )}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {sorted.map(insight => (
          <PensionStructuredInsightCard key={insight.id} insight={insight} />
        ))}
      </div>
      {meta?.disclaimer && (
        <p style={{ margin: "12px 2px 0", fontSize: 11.5, color: "var(--text-faint)", lineHeight: 1.5 }}>
          {meta.disclaimer}
        </p>
      )}
    </section>
  );
}

const sectionTitleStyle: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 800,
  color: "var(--text-faint)",
  letterSpacing: ".06em",
  margin: "0 2px 14px",
};

const panelBoxStyle: React.CSSProperties = {
  background: "var(--card)",
  border: "1px solid var(--border-hair)",
  borderRadius: "var(--radius)",
  padding: "18px 20px",
  boxShadow: "var(--shadow-soft)",
};

const retryBtnStyle: React.CSSProperties = {
  marginTop: 12,
  padding: "8px 14px",
  borderRadius: "var(--r-pill)",
  border: "none",
  cursor: "pointer",
  fontFamily: "var(--font-body)",
  fontWeight: 800,
  fontSize: 13,
  color: "#fff",
  background: "var(--mint-ink)",
};
