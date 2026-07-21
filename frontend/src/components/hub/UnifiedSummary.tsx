import { useMemo, useState } from "react";
import { Download, Sparkles, TrendingUp, Wallet } from "lucide-react";
import type { FullAnalysisResponse, FullAnalysisRecommendation } from "../../api/fullAnalysis.api";
import { downloadExecutiveReportPdf, generateExecutiveReport } from "../../api/executiveReport.api";
import { AGENTS, type AgentId, type AgentTone } from "../../theme/agents";
import { PRIORITY_STYLE } from "./agentDisplay";
import { compareByUrgency, effortFor, parseYearlyImpact, totalYearlyValue } from "./recValue";

/* ============================================================
   UnifiedSummary — orchestrator deliverable: per-agent digest,
   then one flat action list sorted urgent → least urgent.
   PDF export lives here (executive report), not in domain agents.
   ============================================================ */

const AGENT_GRADIENT = "linear-gradient(96deg,#9B7FE8 0%,#F4A87E 40%,#48C98B 72%,#E5C35C 100%)";

const BACKEND_TO_AGENT: Record<string, AgentId> = {
  payslip: "payslips",
  insurance: "insurance",
  pension: "pension",
  gemel: "gemel",
};

const GENERAL_TONE: AgentTone = {
  accent: "var(--lav-600)",
  strong: "var(--lav-700)",
  soft: "var(--lav-100)",
  ring: "var(--lav-200)",
  bg: "var(--lav-50)",
};

type Group = {
  key: string;
  label: string;
  Icon: typeof Wallet;
  tone: AgentTone;
  recs: FullAnalysisRecommendation[];
  value: number;
};

const nisRound = (n: number) => "₪" + Math.round(n).toLocaleString("en-US");

function agentLabelFor(agentId: string): string {
  const mapped = BACKEND_TO_AGENT[agentId];
  if (mapped) return AGENTS.find(a => a.id === mapped)?.label ?? agentId;
  return "כללי";
}

type UnifiedSummaryProps = {
  result: FullAnalysisResponse;
};

export default function UnifiedSummary({ result }: UnifiedSummaryProps) {
  const [pdfBusy, setPdfBusy] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);

  const total = result.recommendations?.length ?? 0;

  const { groups, prioritized, worth } = useMemo(() => {
    const recs = result.recommendations ?? [];
    const out: Group[] = [];

    for (const a of AGENTS) {
      const mine = recs.filter(r => BACKEND_TO_AGENT[r.agentId] === a.id);
      if (mine.length) {
        out.push({
          key: a.id,
          label: a.label,
          Icon: a.Icon,
          tone: a.tone,
          recs: mine,
          value: totalYearlyValue(mine).total,
        });
      }
    }

    const general = recs.filter(r => !BACKEND_TO_AGENT[r.agentId]);
    if (general.length) {
      out.push({
        key: "general",
        label: "המלצות כלליות",
        Icon: Wallet,
        tone: GENERAL_TONE,
        recs: general,
        value: totalYearlyValue(general).total,
      });
    }

    return {
      groups: out,
      prioritized: [...recs].sort(compareByUrgency),
      worth: totalYearlyValue(recs),
    };
  }, [result.recommendations]);

  if (!total) return null;

  const score = result.globalScore ?? null;

  const handleDownloadPdf = async () => {
    setPdfBusy(true);
    setPdfError(null);
    const gen = await generateExecutiveReport({ skipLLM: true });
    if (!gen.success || !gen.runId) {
      setPdfError(gen.message || "לא הצלחנו ליצור את הדוח.");
      setPdfBusy(false);
      return;
    }
    const dl = await downloadExecutiveReportPdf({ runId: gen.runId });
    setPdfBusy(false);
    if (dl.success && dl.blob) {
      const url = URL.createObjectURL(dl.blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = dl.filename;
      a.click();
      URL.revokeObjectURL(url);
    } else {
      setPdfError(dl.message || "לא הצלחנו להוריד את ה-PDF.");
    }
  };

  return (
    <section style={{ marginBottom: 46, animation: "fgRise .6s var(--ease) both" }}>
      <div style={{ background: AGENT_GRADIENT, borderRadius: "calc(var(--radius) + 2px)", padding: 2, boxShadow: "0 24px 60px -30px rgba(124,95,214,.5)" }}>
        <div style={{ background: "var(--card)", borderRadius: "var(--radius)", padding: "30px 32px" }}>
          {/* header */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18, flexWrap: "wrap" }}>
            <span style={{ width: 34, height: 34, borderRadius: 10, flex: "none", background: AGENT_GRADIENT, display: "grid", placeItems: "center", color: "#fff" }}>
              <Sparkles size={18} strokeWidth={2.2} />
            </span>
            <div style={{ flex: 1, minWidth: 180 }}>
              <div style={{ fontSize: 11.5, fontWeight: 800, letterSpacing: ".12em", color: "var(--lav-600)" }}>הסיכום המאוחד · הסוכן הראשי</div>
              <div style={{ fontSize: 13, color: "var(--text-muted)", fontWeight: 600, marginTop: 2 }}>
                כל ההמלצות מכל הסוכנים — מסודרות לפי דחיפות
              </div>
            </div>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "var(--surface-sunken)", color: "var(--text-body)", borderRadius: 999, padding: "6px 13px", fontWeight: 800, fontSize: 13 }}>
              {total} המלצות
            </span>
            {score?.score != null && (
              <span style={{ display: "inline-flex", alignItems: "baseline", gap: 4, background: "var(--lav-100)", color: "var(--lav-700)", borderRadius: 999, padding: "6px 14px", fontWeight: 900, fontSize: 15, fontVariantNumeric: "tabular-nums" }}>
                {score.score}<span style={{ fontSize: 11, fontWeight: 700 }}>/100</span>
              </span>
            )}
            <button
              type="button"
              onClick={() => void handleDownloadPdf()}
              disabled={pdfBusy}
              style={{
                display: "inline-flex", alignItems: "center", gap: 7, padding: "8px 14px",
                borderRadius: "var(--r-md)", border: "2px solid var(--text-strong)",
                background: pdfBusy ? "var(--surface-sunken)" : "var(--butter)",
                fontWeight: 800, fontSize: 13, cursor: pdfBusy ? "wait" : "pointer", fontFamily: "inherit",
              }}
            >
              <Download size={16} />
              {pdfBusy ? "מכין PDF..." : "הורדת PDF"}
            </button>
          </div>

          {pdfError ? (
            <p style={{ margin: "0 0 14px", fontSize: 13, color: "var(--danger)", fontWeight: 600 }}>{pdfError}</p>
          ) : null}

          {worth.total > 0 && (
            <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap", background: "var(--mint-soft)", border: "1px solid var(--mint)", borderRadius: "var(--r-md)", padding: "16px 20px", marginBottom: 22 }}>
              <span style={{ width: 38, height: 38, borderRadius: 10, flex: "none", background: "var(--mint)", color: "var(--mint-ink)", display: "grid", placeItems: "center" }}>
                <TrendingUp size={20} strokeWidth={2.3} />
              </span>
              <div style={{ flex: 1, minWidth: 200 }}>
                <div style={{ fontSize: 12.5, fontWeight: 700, color: "var(--mint-ink)", opacity: .85 }}>שווי מוערך של טיפול בהכל</div>
                <div style={{ fontSize: "clamp(24px,2.6vw,32px)", fontWeight: 900, letterSpacing: "-.02em", color: "var(--mint-ink)", lineHeight: 1.1, fontVariantNumeric: "tabular-nums" }}>
                  ~{nisRound(worth.total)}<span style={{ fontSize: 15, fontWeight: 800 }}> בשנה</span>
                </div>
              </div>
            </div>
          )}

          {result.summary && (
            <p style={{ margin: "0 0 22px", fontSize: 15.5, lineHeight: 1.7, fontWeight: 500, color: "var(--text-body)", whiteSpace: "pre-line", textWrap: "pretty" }}>
              {result.summary}
            </p>
          )}

          {/* per-agent digest */}
          <div style={{ marginBottom: 26 }}>
            <h3 style={{ margin: "0 0 12px", fontSize: 15, fontWeight: 900, color: "var(--text-strong)" }}>סיכום לפי סוכן</h3>
            <ol style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 10 }}>
              {groups.map(g => (
                <li
                  key={g.key}
                  style={{
                    display: "flex", alignItems: "flex-start", gap: 12, padding: "12px 14px",
                    background: g.tone.bg, border: `1px solid ${g.tone.ring}`, borderRadius: "var(--r-md)",
                  }}
                >
                  <span style={{ width: 30, height: 30, borderRadius: 8, flex: "none", background: g.tone.soft, color: g.tone.accent, display: "grid", placeItems: "center" }}>
                    <g.Icon size={16} strokeWidth={2.2} />
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 800, color: g.tone.strong, marginBottom: 4 }}>
                      {g.label} · {g.recs.length} המלצות
                      {g.value > 0 ? <span style={{ fontWeight: 700, color: "var(--mint-ink)", marginInlineStart: 8 }}>≈{nisRound(g.value)}/שנה</span> : null}
                    </div>
                    <div style={{ fontSize: 13, lineHeight: 1.55, color: "var(--text-muted)", fontWeight: 500 }}>
                      {g.recs.map(r => r.title).join(" · ")}
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          </div>

          {/* unified action plan — flat, urgent first */}
          <div>
            <h3 style={{ margin: "0 0 14px", fontSize: 15, fontWeight: 900, color: "var(--text-strong)" }}>
              תוכנית פעולה — מהדחוף לפחות דחוף
            </h3>
            <ol style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 0, border: "1px solid var(--border-hair)", borderRadius: "var(--r-md)", overflow: "hidden" }}>
              {prioritized.map((r, i) => {
                const pr = PRIORITY_STYLE[r.urgency] ?? PRIORITY_STYLE.medium;
                const effort = effortFor(r.type);
                const yearly = parseYearlyImpact(r.financialImpact);
                const agentLabel = agentLabelFor(r.agentId);
                return (
                  <li
                    key={`${r.type}-${i}`}
                    style={{
                      display: "flex", gap: 14, padding: "16px 18px",
                      background: "var(--card)", borderTop: i === 0 ? "none" : "1px solid var(--border-hair)",
                    }}
                  >
                    <span style={{
                      width: 32, height: 32, borderRadius: "50%", flex: "none",
                      background: "var(--surface-sunken)", color: "var(--text-strong)",
                      display: "grid", placeItems: "center", fontWeight: 900, fontSize: 14,
                    }}>
                      {i + 1}
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 6 }}>
                        <span style={{ fontSize: 10.5, fontWeight: 800, background: pr.bg, color: pr.color, borderRadius: 6, padding: "2px 8px" }}>{pr.label}</span>
                        <span style={{ fontSize: 10.5, fontWeight: 700, background: "var(--surface-sunken)", color: "var(--text-muted)", borderRadius: 6, padding: "2px 8px" }}>{agentLabel}</span>
                        <span style={{ fontSize: 10.5, fontWeight: 700, background: "var(--surface-sunken)", color: "var(--text-muted)", borderRadius: 6, padding: "2px 8px" }}>{effort.label}</span>
                      </div>
                      <div style={{ fontSize: 15, fontWeight: 800, color: "var(--text-strong)", lineHeight: 1.4, marginBottom: 6 }}>{r.title}</div>
                      <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.6, color: "var(--text-muted)", fontWeight: 500 }}>{r.reason}</p>
                      {r.financialImpact && (
                        <div style={{ marginTop: 8, display: "inline-flex", alignItems: "center", gap: 6, background: "var(--mint-soft)", color: "var(--mint-ink)", borderRadius: 6, padding: "4px 10px", fontSize: 12.5, fontWeight: 800, fontVariantNumeric: "tabular-nums" }}>
                          {r.financialImpact}
                          {yearly != null && !/שנה/.test(r.financialImpact) && (
                            <span style={{ fontWeight: 700, opacity: .75 }}>· ≈{nisRound(yearly)}/שנה</span>
                          )}
                        </div>
                      )}
                    </div>
                  </li>
                );
              })}
            </ol>
          </div>
        </div>
      </div>
    </section>
  );
}
