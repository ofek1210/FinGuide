import { useCallback, useEffect, useRef, useState } from "react";
import { Gavel, MessageSquareQuote, Scale, Swords } from "lucide-react";
import {
  streamAgentDebate,
  type DebatePosition,
  type DebateRebuttal,
  type DebateVerdict,
} from "../../api/debate.api";
import { AGENTS, type AgentId } from "../../theme/agents";

type Phase = "idle" | "running" | "done" | "error";

const AGENT_KEY: Record<AgentId, string> = {
  payslips: "payslip",
  insurance: "insurance",
  pension: "pension",
  gemel: "gemel",
};

const STANCE_LABEL = {
  challenge: "מתנגד",
  support: "תומך",
  neutral: "מעיר",
} as const;

const STANCE_COLOR = {
  challenge: "#F4A87E",
  support: "#48C98B",
  neutral: "rgba(255,255,255,.55)",
} as const;

function agentTone(agentId: string) {
  const entry = AGENTS.find(a => AGENT_KEY[a.id] === agentId);
  return entry?.tone ?? { soft: "rgba(255,255,255,.08)", accent: "#fff" };
}

function agentLabel(agentId: string) {
  const entry = AGENTS.find(a => AGENT_KEY[a.id] === agentId);
  return entry?.label ?? agentId;
}

type Props = {
  disabled?: boolean;
};

export default function DebateArena({ disabled = false }: Props) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [phaseLabel, setPhaseLabel] = useState<string | null>(null);
  const [positions, setPositions] = useState<DebatePosition[]>([]);
  const [rebuttals, setRebuttals] = useState<DebateRebuttal[]>([]);
  const [verdict, setVerdict] = useState<DebateVerdict | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const abortRef = useRef<(() => void) | null>(null);

  // Abort any in-flight SSE stream when the component unmounts, so leaving the
  // Hub mid-debate doesn't keep the connection alive or setState after unmount.
  useEffect(() => () => abortRef.current?.(), []);

  const reset = useCallback(() => {
    abortRef.current?.();
    abortRef.current = null;
    setPhase("idle");
    setPhaseLabel(null);
    setPositions([]);
    setRebuttals([]);
    setVerdict(null);
    setErrorMsg(null);
  }, []);

  const runDebate = useCallback((demo: boolean) => {
    reset();
    setPhase("running");

    abortRef.current = streamAgentDebate(
      { demo },
      event => {
        if (event.type === "phase") {
          setPhaseLabel(event.labelHe ?? null);
        } else if (event.type === "position") {
          const { type: _t, ...pos } = event;
          setPositions(prev => [...prev, pos]);
        } else if (event.type === "rebuttal") {
          const { type: _t, ...reb } = event;
          setRebuttals(prev => [...prev, reb]);
        } else if (event.type === "verdict") {
          const { type: _t, ...v } = event;
          setVerdict(v);
        } else if (event.type === "done") {
          setPhase("done");
          setPhaseLabel(null);
        }
      },
      msg => {
        setErrorMsg(msg);
        setPhase("error");
      },
    );
  }, [reset]);

  return (
    <div
      style={{
        marginTop: 20,
        borderRadius: "var(--r-md)",
        border: "1px solid rgba(255,255,255,.12)",
        background: "rgba(0,0,0,.22)",
        padding: "20px 22px",
        color: "#fff",
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
        <div>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 12, fontWeight: 800, letterSpacing: ".1em", color: "var(--lav-300, #c4b5fd)" }}>
            <Scale size={16} />
            מועצת סוכנים
          </div>
          <h3 style={{ margin: "8px 0 0", fontSize: 20, fontWeight: 900, letterSpacing: "-.02em" }}>
            הוויכוח הגלוי — מי צודק קודם?
          </h3>
          <p style={{ margin: "8px 0 0", fontSize: 13.5, color: "rgba(255,255,255,.65)", maxWidth: 480, lineHeight: 1.5 }}>
            הסוכנים מציגים עמדות, מתווכחים על סדר העדיפויות, והשופט מסכם פסיקה ממוספרת.
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            type="button"
            disabled={disabled || phase === "running"}
            onClick={() => runDebate(true)}
            style={btnStyle(disabled || phase === "running")}
          >
            <MessageSquareQuote size={14} /> הדגמת דיון
          </button>
          <button
            type="button"
            disabled={disabled || phase === "running"}
            onClick={() => runDebate(false)}
            style={{ ...btnStyle(disabled || phase === "running"), background: "linear-gradient(135deg,#9B7FE8,#6F8BE8)", border: "none" }}
          >
            <Swords size={14} /> פתח דיון חי
          </button>
        </div>
      </div>

      {phase === "running" && phaseLabel && (
        <div style={{ fontSize: 13, color: "rgba(255,255,255,.7)", marginBottom: 14, animation: "pulse 1.2s ease-in-out infinite" }}>
          {phaseLabel}
        </div>
      )}

      {errorMsg && (
        <div style={{ color: "#F4A87E", fontSize: 13.5, marginBottom: 12 }}>{errorMsg}</div>
      )}

      {positions.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 10, marginBottom: 16 }}>
          {positions.map(p => {
            const tone = agentTone(p.agentId);
            return (
              <div key={p.agentId} style={{ background: "rgba(255,255,255,.05)", border: `1px solid ${tone.accent}33`, borderRadius: 12, padding: 14 }}>
                <div style={{ fontSize: 11.5, fontWeight: 800, color: tone.accent, marginBottom: 6 }}>{p.labelHe}</div>
                <div style={{ fontWeight: 800, fontSize: 14, lineHeight: 1.35, marginBottom: 6 }}>{p.title}</div>
                <div style={{ fontSize: 12.5, color: "rgba(255,255,255,.65)", lineHeight: 1.45 }}>{p.reason}</div>
                {p.financialImpact && (
                  <div style={{ marginTop: 8, fontSize: 12, fontWeight: 700, color: "#48C98B" }}>{p.financialImpact}</div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {rebuttals.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: ".08em", color: "rgba(255,255,255,.5)", marginBottom: 8 }}>סבב תגובות</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {rebuttals.map((r, i) => (
              <div key={i} style={{ fontSize: 13, lineHeight: 1.5, padding: "10px 12px", borderRadius: 10, background: "rgba(255,255,255,.04)", borderInlineStart: `3px solid ${STANCE_COLOR[r.stance]}` }}>
                <span style={{ fontWeight: 800, color: STANCE_COLOR[r.stance] }}>{STANCE_LABEL[r.stance]}</span>
                {" · "}
                <span style={{ fontWeight: 700 }}>{agentLabel(r.fromAgent)}</span>
                {" → "}
                {r.text}
              </div>
            ))}
          </div>
        </div>
      )}

      {verdict && (
        <div style={{ background: "rgba(155,127,232,.12)", border: "1px solid rgba(155,127,232,.35)", borderRadius: 14, padding: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10, fontWeight: 900, fontSize: 15 }}>
            <Gavel size={18} /> פסיקת השופט
          </div>
          <p style={{ margin: "0 0 12px", fontSize: 14, lineHeight: 1.55 }}>{verdict.summaryHe}</p>
          <ol style={{ margin: 0, paddingInlineStart: 20, display: "flex", flexDirection: "column", gap: 6 }}>
            {verdict.rankedPriorities.map(item => (
              <li key={item.rank} style={{ fontSize: 13.5, lineHeight: 1.45 }}>
                <strong>{item.rank}. {item.labelHe || item.agentId}</strong> — {item.title}
                {item.financialImpact ? ` (${item.financialImpact})` : ""}
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}

function btnStyle(disabled: boolean) {
  return {
    display: "inline-flex" as const,
    alignItems: "center" as const,
    gap: 6,
    background: "rgba(255,255,255,.08)",
    color: "#fff",
    border: "1px solid rgba(255,255,255,.16)",
    borderRadius: "var(--r-btn, 10px)",
    padding: "10px 14px",
    fontFamily: "inherit",
    fontWeight: 700,
    fontSize: 13,
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.55 : 1,
  };
}
