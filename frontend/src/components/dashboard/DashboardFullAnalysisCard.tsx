import { useCallback, useState } from "react";
import { Sparkles, Loader2, AlertCircle, CheckCircle, ChevronDown, ChevronUp } from "lucide-react";
import { runFullAnalysis, type FullAnalysisRecommendation } from "../../api/fullAnalysis.api";

const urgencyBadge = (u: string) => {
  const map: Record<string, { bg: string; color: string; label: string }> = {
    high:   { bg: "rgba(239,68,68,0.15)",   color: "#FCA5A5", label: "דחוף" },
    medium: { bg: "rgba(234,179,8,0.15)",   color: "#FDE68A", label: "מומלץ" },
    low:    { bg: "rgba(16,185,129,0.12)",  color: "#6EE7B7", label: "לידיעה" },
  };
  return map[u] ?? map.low;
};

export default function DashboardFullAnalysisCard() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    summary?: string;
    recommendations?: FullAnalysisRecommendation[];
    meta?: { durationMs: number; successCount: number; agentCount: number };
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  const handleRun = useCallback(async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    const res = await runFullAnalysis({ skipLLM: false });
    setLoading(false);
    if (res.success) {
      setResult({
        summary: res.summary,
        recommendations: res.recommendations,
        meta: res.meta,
      });
      setExpanded(true);
    } else {
      setError("הניתוח נכשל. נסה שוב מאוחר יותר.");
    }
  }, []);

  return (
    <div className="dashboard-card" style={{ padding: "24px 28px" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{
            width: 36, height: 36, background: "rgba(129,140,248,0.15)",
            borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <Sparkles size={18} style={{ color: "#818CF8" }} />
          </span>
          <div>
            <div style={{ fontWeight: 700, color: "var(--rapyd-text)", fontSize: 15 }}>
              ניתוח AI מלא
            </div>
            <div style={{ fontSize: 12, color: "var(--rapyd-text-muted)" }}>
              פנסיה · ביטוח · תלושים — בו-זמנית
            </div>
          </div>
        </div>
        <button
          onClick={handleRun}
          disabled={loading}
          style={{
            background: loading ? "rgba(129,140,248,0.2)" : "#5B4FF5",
            color: "#fff", border: "none", borderRadius: 8,
            padding: "8px 20px", fontSize: 14, fontWeight: 700,
            cursor: loading ? "not-allowed" : "pointer",
            fontFamily: "inherit", display: "flex", alignItems: "center", gap: 6,
            transition: "background 0.2s",
          }}
        >
          {loading
            ? <><Loader2 size={15} style={{ animation: "spin 1s linear infinite" }} /> מנתח...</>
            : <><Sparkles size={15} /> הרץ ניתוח</>}
        </button>
      </div>

      {/* Error state */}
      {error && (
        <div style={{
          background: "rgba(220,38,38,0.1)", borderRadius: 8, padding: "10px 14px",
          display: "flex", alignItems: "center", gap: 8, color: "#FCA5A5", fontSize: 14,
        }}>
          <AlertCircle size={15} />
          {error}
        </div>
      )}

      {/* Results */}
      {result && (
        <div style={{ marginTop: 4 }}>
          {/* Success header */}
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            marginBottom: expanded ? 16 : 0,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#34D399" }}>
              <CheckCircle size={15} />
              <span>
                הניתוח הושלם
                {result.meta && ` · ${result.meta.successCount}/${result.meta.agentCount} סוכנים · ${(result.meta.durationMs / 1000).toFixed(1)}s`}
              </span>
            </div>
            <button
              onClick={() => setExpanded((v) => !v)}
              style={{ background: "none", border: "none", cursor: "pointer", color: "var(--rapyd-text-muted)", padding: 4 }}
            >
              {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
          </div>

          {expanded && (
            <>
              {/* Summary */}
              {result.summary && (
                <div style={{
                  background: "rgba(129,140,248,0.08)", borderRadius: 10, padding: "14px 18px",
                  marginBottom: 16, fontSize: 14, color: "var(--rapyd-text)", lineHeight: 1.6,
                  borderRight: "3px solid #818CF8",
                }}>
                  {result.summary}
                </div>
              )}

              {/* Recommendations */}
              {result.recommendations && result.recommendations.length > 0 && (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "var(--rapyd-text-muted)", marginBottom: 4 }}>
                    המלצות ({result.recommendations.length})
                  </div>
                  {result.recommendations.slice(0, 5).map((rec, i) => {
                    const badge = urgencyBadge(rec.urgency);
                    return (
                      <div key={i} style={{
                        background: "rgba(255,255,255,0.04)", borderRadius: 8, padding: "12px 16px",
                        border: "1px solid rgba(255,255,255,0.07)", display: "flex", gap: 12, alignItems: "flex-start",
                      }}>
                        <span style={{
                          background: badge.bg, color: badge.color, borderRadius: 6,
                          padding: "2px 8px", fontSize: 11, fontWeight: 700, whiteSpace: "nowrap", marginTop: 2,
                        }}>
                          {badge.label}
                        </span>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 700, color: "var(--rapyd-text)", fontSize: 14, marginBottom: 2 }}>
                            {rec.title}
                          </div>
                          <div style={{ fontSize: 13, color: "var(--rapyd-text-muted)" }}>
                            {rec.reason}
                          </div>
                          {rec.financialImpact && (
                            <div style={{ fontSize: 12, color: "#34D399", marginTop: 4, fontWeight: 600 }}>
                              💰 {rec.financialImpact}
                            </div>
                          )}
                        </div>
                        <div style={{ fontSize: 11, color: "var(--rapyd-text-muted)", whiteSpace: "nowrap" }}>
                          {rec.confidenceScore}%
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Empty state */}
      {!loading && !result && !error && (
        <p style={{ fontSize: 13, color: "var(--rapyd-text-muted)", margin: 0, lineHeight: 1.5 }}>
          לחץ "הרץ ניתוח" וה-AI יסרוק את כל נתוניך — תלושים, פנסיה וביטוח — ויספק המלצות מותאמות אישית.
        </p>
      )}
    </div>
  );
}
