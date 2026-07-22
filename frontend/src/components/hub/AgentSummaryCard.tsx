import { ArrowLeft, CheckCircle2, CircleAlert, CircleDashed, Zap } from "lucide-react";
import type { AgentResult } from "../../api/fullAnalysis.api";
import type { AgentDef } from "../../theme/agents";
import { agentStats, agentVerdict } from "./agentDisplay";
import { Sparkline } from "./hubViz";
import { AGENT_TONE, DOT } from "./hubVizCore";

/* ============================================================
   AgentSummaryCard — one canonical showcase card per agent.
   The card is BOTH the status readout and the gateway into the
   domain page; a small "נתח" chip runs a focused analysis.
   Canonical design: sunken dot-grid surface, number chip 01-04,
   white inset with icon + sparkline, title/sub, arrow tile.
   ============================================================ */

type AgentSummaryCardProps = {
  agent: AgentDef;
  index: number;
  metric: string;
  readinessDetail?: string;
  spark: number[];
  loading: boolean;
  agentResult?: AgentResult;
  running: boolean;
  disabled: boolean;
  onOpen: () => void;
  onAnalyze: () => void;
};

export default function AgentSummaryCard({
  agent: a, index, metric, readinessDetail, spark, loading, agentResult, running, disabled, onOpen, onAnalyze,
}: AgentSummaryCardProps) {
  const tone = AGENT_TONE[a.id];
  const c1 = a.tone.soft, c2 = a.tone.accent;
  const Icon = a.Icon;
  const status = agentResult?.status;
  const stats = agentStats(a.id, agentResult);
  const verdict = agentVerdict(a.id, agentResult);

  // One content line: post-run — the agent's first headline stat; pre-run — the metric.
  const contentLine = status === "success" && stats.length > 0
    ? `${stats[0].k}: ${stats[0].v}`
    : status === "no_data" || status === "no_profile"
      ? (agentResult?.message || "אין מספיק נתונים לניתוח")
      : loading ? "…" : metric;

  return (
    <button
      onClick={onOpen}
      style={{ position: "relative", textAlign: "start", background: "var(--surface-sunken)", border: "1px solid var(--border-hair)", borderRadius: "var(--radius)", padding: 20, cursor: "pointer", fontFamily: "inherit", boxShadow: "var(--shadow-soft)", transition: "transform .32s var(--ease), box-shadow .32s var(--ease)", display: "flex", flexDirection: "column", backgroundImage: DOT, backgroundSize: "16px 16px" }}
      onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-5px)"; e.currentTarget.style.boxShadow = "var(--shadow-card)"; }}
      onMouseLeave={e => { e.currentTarget.style.transform = "none"; e.currentTarget.style.boxShadow = "var(--shadow-soft)"; }}
    >
      {/* header: number chip + status / focused-run chip */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 9 }}>
          <span style={{ width: 26, height: 26, borderRadius: 8, background: c2, color: "#fff", display: "grid", placeItems: "center", fontWeight: 900, fontSize: 12, letterSpacing: "-.02em" }}>
            0{index + 1}
          </span>
          <span style={{ fontSize: 11.5, fontWeight: 800, letterSpacing: ".1em", color: c2 }}>{a.hubTitle}</span>
        </span>

        {running ? (
          <span style={{ fontSize: 11.5, fontWeight: 700, color: c2, display: "inline-flex", alignItems: "center", gap: 5 }}>
            <CircleDashed size={13} style={{ animation: "fgSpin 1s linear infinite" }} /> מנתח
          </span>
        ) : status === "success" ? (
          <span style={{ fontSize: 11.5, fontWeight: 700, color: "var(--mint-ink)", display: "inline-flex", alignItems: "center", gap: 5 }}>
            <CheckCircle2 size={13} /> הושלם
          </span>
        ) : status === "no_data" || status === "no_profile" || status === "error" ? (
          <span style={{ fontSize: 11.5, fontWeight: 700, color: "var(--peach-ink)", display: "inline-flex", alignItems: "center", gap: 5 }}>
            <CircleAlert size={13} /> {status === "error" ? "שגיאה" : "חסרים נתונים"}
          </span>
        ) : (
          <span
            role="button"
            tabIndex={disabled ? -1 : 0}
            title={`הרץ רק את סוכן ה${a.label}`}
            onClick={e => { e.stopPropagation(); if (!disabled) onAnalyze(); }}
            onKeyDown={e => { if ((e.key === "Enter" || e.key === " ") && !disabled) { e.stopPropagation(); e.preventDefault(); onAnalyze(); } }}
            style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11.5, fontWeight: 800, color: c2, background: c1, borderRadius: 999, padding: "5px 12px", opacity: disabled ? 0.5 : 1, cursor: disabled ? "not-allowed" : "pointer" }}
          >
            <Zap size={12} strokeWidth={2.4} /> נתח
          </span>
        )}
      </div>

      {/* white inset: icon + sparkline + one content line */}
      <div style={{ background: "var(--card)", border: "1px solid var(--border-hair)", borderRadius: "var(--r-md)", padding: 16, boxShadow: "var(--shadow-soft)", marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ width: 40, height: 40, borderRadius: 11, background: c1, color: c2, display: "grid", placeItems: "center" }}>
            <Icon size={21} strokeWidth={1.85} />
          </span>
          {spark.length >= 2 && <Sparkline points={spark} tone={tone} w={78} h={30} />}
        </div>
        <div style={{ marginTop: 14, fontSize: 13, fontWeight: 800, color: c2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {contentLine}
        </div>
        {verdict && (
          <div style={{ marginTop: 8, display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11.5, fontWeight: 800, color: c2, background: c1, borderRadius: 999, padding: "3px 10px" }}>
            פסק דין: {verdict}
          </div>
        )}
      </div>

      {/* footer: title/sub + arrow gateway */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginTop: "auto" }}>
        <div>
          <div style={{ fontWeight: 900, fontSize: 18, letterSpacing: "-.02em", color: "var(--text-strong)" }}>{a.label}</div>
          <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 3, fontWeight: 500 }}>{readinessDetail ?? a.sub}</div>
        </div>
        <span style={{ width: 34, height: 34, borderRadius: 10, flex: "none", background: c1, color: c2, display: "grid", placeItems: "center" }}>
          <ArrowLeft size={17} strokeWidth={2.2} />
        </span>
      </div>
    </button>
  );
}
