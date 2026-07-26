import { CheckCircle2, CircleAlert, CircleDashed, Zap } from "lucide-react";
import type { AgentResult } from "../../api/fullAnalysis.api";
import type { AgentDef } from "../../theme/agents";
import type { AgentReadinessPhase } from "../../utils/agentReadiness";
import { agentStats, agentVerdict } from "./agentDisplay";
import { Sparkline } from "./hubViz";
import { AGENT_TONE } from "./hubVizCore";

/* ============================================================
   AgentSummaryCard — one canonical showcase card per agent, in
   the "scanning agent" design language: white card, number badge
   01-04 + "סוכן AI" tag, a live status dot / focused-run action,
   an icon tile with a sparkline, title/sub, and a mono metric.
   The whole card opens the domain page; the top-right pill runs a
   focused analysis (or reflects run status). A scanning sheen
   sweeps across on hover.
   ============================================================ */

type AgentSummaryCardProps = {
  agent: AgentDef;
  index: number;
  metric: string;
  readinessDetail?: string;
  readinessPhase?: AgentReadinessPhase;
  spark: number[];
  loading: boolean;
  agentResult?: AgentResult;
  running: boolean;
  disabled: boolean;
  onOpen: () => void;
  onAnalyze: () => void;
};

/* raw accent hex per agent — for the hover border + sheen (SVG/gradient) */
const AGENT_HEX: Record<AgentDef["id"], string> = {
  payslips: "#9B7FE8",
  insurance: "#DA6F44",
  pension: "#2F9C62",
  gemel: "#E7C560",
};

/* readiness lifecycle → static status pill (when no focused run is offered) */
function readinessStatus(phase: AgentReadinessPhase | undefined): { label: string; c: string; glow: string } {
  if (phase === "analysis_ready" || phase === "document_ready_onboarding_complete") {
    return { label: "פעיל", c: "var(--mint-ink)", glow: "rgba(47,156,98,.2)" };
  }
  if (phase === "document_ready_onboarding_incomplete") {
    return { label: "נדרש אונבורדינג", c: "var(--butter-ink)", glow: "rgba(185,139,22,.18)" };
  }
  if (phase === "document_processing") {
    return { label: "מעבד מסמך", c: "var(--butter-ink)", glow: "rgba(185,139,22,.18)" };
  }
  return { label: "ממתין למסמך", c: "var(--peach-ink)", glow: "rgba(218,111,68,.18)" };
}

export default function AgentSummaryCard({
  agent: a, index, metric, readinessDetail, readinessPhase, spark, loading,
  agentResult, running, disabled, onOpen, onAnalyze,
}: AgentSummaryCardProps) {
  const tone = AGENT_TONE[a.id];
  const c1 = a.tone.soft, c2 = a.tone.accent;
  const hex = AGENT_HEX[a.id];
  const Icon = a.Icon;
  const status = agentResult?.status;
  const stats = agentStats(a.id, agentResult);
  const verdict = agentVerdict(a.id, agentResult);

  // one mono metric line: post-run headline stat; pre-run the readiness metric
  const metricLine = status === "success" && stats.length > 0
    ? `${stats[0].k}: ${stats[0].v}`
    : status === "no_data" || status === "no_profile"
      ? (agentResult?.message || "אין מספיק נתונים")
      : loading ? "…" : metric;

  // a focused run is offered only when the agent is idle and analysable
  const canRun = !running && status == null
    && (readinessPhase === "analysis_ready" || readinessPhase === "document_ready_onboarding_complete");
  const rs = readinessStatus(readinessPhase);

  return (
    <button
      onClick={onOpen}
      style={{ position: "relative", overflow: "hidden", textAlign: "start", background: "var(--card)", border: "1px solid var(--border-hair)", borderRadius: "var(--radius)", padding: 18, cursor: "pointer", fontFamily: "inherit", boxShadow: "var(--shadow-soft)", transition: "transform .3s var(--ease), border-color .3s var(--ease), box-shadow .3s var(--ease)", display: "flex", flexDirection: "column" }}
      onMouseEnter={e => {
        e.currentTarget.style.transform = "translateY(-5px)";
        e.currentTarget.style.borderColor = hex;
        e.currentTarget.style.boxShadow = "var(--shadow-card)";
        const sc = e.currentTarget.querySelector(".hub-scan") as HTMLElement | null;
        if (sc) { sc.style.animation = "none"; void sc.offsetWidth; sc.style.animation = "hubScan 1.1s var(--ease)"; }
      }}
      onMouseLeave={e => {
        e.currentTarget.style.transform = "none";
        e.currentTarget.style.borderColor = "var(--border-hair)";
        e.currentTarget.style.boxShadow = "var(--shadow-soft)";
      }}
    >
      {/* scanning sheen on hover */}
      <span className="hub-scan" style={{ position: "absolute", top: 0, bottom: 0, width: "38%", background: `linear-gradient(100deg,transparent,${c1},transparent)`, transform: "translateX(120%)", pointerEvents: "none" }} />

      {/* header: number badge + סוכן AI · status / focused-run pill */}
      <div style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
          <span style={{ width: 25, height: 25, borderRadius: 8, background: c2, color: "#fff", display: "grid", placeItems: "center", fontWeight: 900, fontSize: 11, letterSpacing: "-.02em" }}>0{index + 1}</span>
          <span style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: ".1em", color: c2 }}>סוכן AI</span>
        </span>

        {running ? (
          <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11, fontWeight: 800, color: c2 }}>
            <CircleDashed size={12} style={{ animation: "fgSpin 1s linear infinite" }} /> מנתח
          </span>
        ) : status === "success" ? (
          <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11, fontWeight: 800, color: "var(--mint-ink)" }}>
            <CheckCircle2 size={12} /> הושלם
          </span>
        ) : status === "no_data" || status === "no_profile" || status === "error" ? (
          <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11, fontWeight: 800, color: "var(--peach-ink)" }}>
            <CircleAlert size={12} /> {status === "error" ? "שגיאה" : "חסרים נתונים"}
          </span>
        ) : canRun ? (
          <span
            role="button"
            tabIndex={disabled ? -1 : 0}
            title={`הרץ רק את סוכן ה${a.label}`}
            onClick={e => { e.stopPropagation(); if (!disabled) onAnalyze(); }}
            onKeyDown={e => { if ((e.key === "Enter" || e.key === " ") && !disabled) { e.stopPropagation(); e.preventDefault(); onAnalyze(); } }}
            style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11, fontWeight: 800, color: c2, background: c1, borderRadius: 999, padding: "5px 11px", opacity: disabled ? 0.5 : 1, cursor: disabled ? "not-allowed" : "pointer" }}
          >
            <Zap size={11} strokeWidth={2.4} /> נתח
          </span>
        ) : (
          <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11, fontWeight: 800, color: rs.c }}>
            <span style={{ width: 6.5, height: 6.5, borderRadius: "50%", background: rs.c, boxShadow: `0 0 0 3px ${rs.glow}` }} />{rs.label}
          </span>
        )}
      </div>

      {/* icon tile + sparkline */}
      <div style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 13 }}>
        <span style={{ width: 42, height: 42, borderRadius: 12, background: c1, color: c2, display: "grid", placeItems: "center" }}>
          <Icon size={21} strokeWidth={1.85} />
        </span>
        {spark.length >= 2 && <Sparkline points={spark} tone={tone} w={70} h={26} />}
      </div>

      {/* title / sub / mono metric */}
      <div style={{ position: "relative" }}>
        <div style={{ fontWeight: 900, fontSize: 15.5, letterSpacing: "-.015em", color: "var(--text-strong)" }}>{a.hubTitle}</div>
        <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{readinessDetail ?? a.sub}</div>
        <div style={{ marginTop: 10, fontFamily: "'SF Mono',ui-monospace,'Cascadia Mono',Consolas,monospace", fontSize: 11.5, fontWeight: 700, color: c2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {verdict ? `פסק דין: ${verdict}` : metricLine}
        </div>
      </div>
    </button>
  );
}
