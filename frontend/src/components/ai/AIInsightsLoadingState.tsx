import { useEffect, useRef, useState } from "react";
import { Check, ShieldCheck } from "lucide-react";

/**
 * AIInsightsLoadingState — premium "AI is analyzing" state with a REAL,
 * non-resetting progress model:
 *  • the percentage trickles upward smoothly (percent by percent), pacing itself
 *    against `expectedMs` (the average time to a server answer) and easing toward
 *    a soft cap (~96%) so it never stalls and never resets;
 *  • when the real answer arrives (`ready` flips true) it climbs the rest of the
 *    way to 100% and calls `onComplete`.
 * The module band, status chips and phase microcopy all derive from the live
 * percentage, so they advance in lockstep with it. Accent follows the current
 * agent via `var(--agent*)`.
 */

type AgentType = "payslip" | "insurance" | "pension";

interface Preset { phases: string[]; modules: string[]; chips: string[]; badge: string; srLabel: string }

const PRESETS: Record<AgentType, Preset> = {
  insurance: {
    phases: ["קורא את כיסויי הביטוח", "מצליב תנאי פוליסה", "מזהה פערים בכיסוי", "מעריך רמת סיכון", "מכין תובנות AI"],
    modules: ["חיים", "בריאות", "רכב", "דירה"],
    chips: ["כיסוי", "פרמיה", "סיכון", "פערים"],
    badge: "ה‑AI מצליב נתונים",
    srLabel: "מנתח את נתוני הביטוח שלך",
  },
  payslip: {
    phases: ["קורא את התלושים", "מחשב ברוטו ונטו", "מנתח ניכויים והפרשות", "בודק זכויות והחזרים", "מכין תובנות AI"],
    modules: ["ברוטו", "ניכויים", "פנסיה", "מס"],
    chips: ["שכר", "ניכויים", "פנסיה", "מס"],
    badge: "ה‑AI מנתח את התלושים",
    srLabel: "מנתח את תלושי השכר שלך",
  },
  pension: {
    phases: ["קורא את נתוני הפנסיה", "מחשב צבירה צפויה", "בודק דמי ניהול", "מעריך רמת סיכון", "מכין תובנות AI"],
    modules: ["צבירה", "דמי ניהול", "מסלול", "תשואה"],
    chips: ["צבירה", "דמי ניהול", "סיכון", "תשואה"],
    badge: "ה‑AI מנתח את הפנסיה",
    srLabel: "מנתח את נתוני הפנסיה שלך",
  },
};

const SHIMMER_MS = 1600;
const SCAN_MS = 2100;
const TICK_MS = 90;     // how often the percentage steps up
const SOFT_CAP = 96;    // trickle ceiling until the real answer arrives
const tnum: React.CSSProperties = { fontVariantNumeric: "tabular-nums" };

export default function AIInsightsLoadingState({
  agent = "insurance",
  expectedMs = 9000,
  ready = false,
  onComplete,
}: {
  agent?: AgentType;
  /** average time (ms) to a server answer — paces the trickle */
  expectedMs?: number;
  /** the real answer arrived — finish the bar to 100% */
  ready?: boolean;
  onComplete?: () => void;
}) {
  const { phases, modules, chips, badge, srLabel } = PRESETS[agent];
  const [progress, setProgress] = useState(4);

  const readyRef = useRef(ready);
  const onCompleteRef = useRef(onComplete);
  useEffect(() => { readyRef.current = ready; }, [ready]);
  useEffect(() => { onCompleteRef.current = onComplete; }, [onComplete]);

  useEffect(() => {
    if (!document.getElementById("ai-load-anim")) {
      const st = document.createElement("style");
      st.id = "ai-load-anim";
      st.textContent =
        "@keyframes aiShimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}" +
        "@keyframes aiScanRTL{0%{transform:translateX(120%)}100%{transform:translateX(-120%)}}" +
        "@keyframes aiBadgePulse{0%,100%{opacity:.4;transform:scale(.8)}50%{opacity:1;transform:scale(1)}}" +
        "@keyframes aiRowIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}" +
        "@media (prefers-reduced-motion:reduce){.ai-shimmer,.ai-scan,.ai-badge-dot{animation:none!important}.ai-shimmer{background:var(--surface-sunken)!important}}";
      document.head.appendChild(st);
    }
    const start = Date.now();
    const tau = Math.max(expectedMs, 1000) * 0.5; // easing time-constant
    const iv = setInterval(() => {
      setProgress((prev) => {
        if (readyRef.current) {
          // answer is in — finish smoothly to 100, then hand off
          const next = Math.min(100, prev + 7);
          if (next >= 100) {
            clearInterval(iv);
            setTimeout(() => onCompleteRef.current?.(), 320);
          }
          return next;
        }
        if (prev >= SOFT_CAP) return prev; // hold near the cap, never reset
        // asymptotic approach: fast early, easing as it nears the cap
        const t = Date.now() - start;
        const target = SOFT_CAP * (1 - Math.exp(-t / tau));
        return Math.min(SOFT_CAP, Math.max(prev, Math.round(target)));
      });
    }, TICK_MS);
    return () => clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expectedMs]);

  // module band / chips / microcopy derive from the live percentage
  const phaseFloat = (progress / 100) * phases.length;
  const phase = Math.min(phases.length - 1, Math.floor(phaseFloat));

  const shimmer = (w: number | string, h: number, r = 6, extra: React.CSSProperties = {}): React.CSSProperties => ({
    width: w, height: h, borderRadius: r, flex: "none",
    background: "linear-gradient(90deg,var(--surface-sunken) 25%,#FFFFFF 50%,var(--surface-sunken) 75%)",
    backgroundSize: "200% 100%",
    animation: `aiShimmer ${SHIMMER_MS}ms linear infinite`,
    ...extra,
  });

  return (
    <div role="status" aria-live="polite" aria-busy={!ready} style={{ display: "flex", flexDirection: "column", gap: 14, padding: "4px 2px 2px" }}>
      <span style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)", whiteSpace: "nowrap" }}>
        {srLabel} — {phases[phase]} ({progress}%)
      </span>

      {/* working badge */}
      <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "5px 11px 5px 9px", borderRadius: 999, background: "var(--agent-soft)", border: "1px solid var(--agent-ring)", fontSize: 11.5, fontWeight: 800, color: "var(--agent)" }}>
          <span className="ai-badge-dot" style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--agent)", animation: "aiBadgePulse 1.1s ease-in-out infinite" }} />
          {badge}
        </span>
        <span aria-hidden="true" style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)" }}>{phases[phase]}…</span>
        <span style={{ marginInlineStart: "auto", ...tnum, fontSize: 12.5, fontWeight: 900, color: "var(--ink)" }}>{progress}%</span>
      </div>

      {/* scanning module band */}
      <div style={{ position: "relative", overflow: "hidden", borderRadius: "var(--r-sm)", border: "1px solid var(--border-hair)", background: "var(--card)", padding: 10 }}>
        <div className="ai-scan" aria-hidden="true" style={{ position: "absolute", top: 0, bottom: 0, width: "38%", background: "linear-gradient(90deg,transparent,var(--agent-soft),transparent)", filter: "blur(6px)", animation: `aiScanRTL ${SCAN_MS}ms ease-in-out infinite`, pointerEvents: "none" }} />
        <div style={{ position: "relative", display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 7 }}>
          {modules.map((m, i) => {
            const done = i < phase || progress >= 100;
            const active = i === phase && progress < 100;
            return (
              <div key={m} style={{
                display: "flex", flexDirection: "column", alignItems: "center", gap: 6, padding: "9px 4px", borderRadius: 7,
                background: done ? "var(--mint-soft)" : active ? "var(--agent-soft)" : "var(--surface-sunken)",
                border: "1px solid " + (done ? "var(--mint)" : active ? "var(--agent-ring)" : "var(--border-hair)"),
                transition: "background .35s var(--ease), border-color .35s var(--ease)",
              }}>
                <span style={{ width: 22, height: 22, borderRadius: 6, display: "grid", placeItems: "center", color: done ? "var(--mint-ink)" : active ? "var(--agent)" : "var(--text-faint)" }}>
                  {done ? <Check size={15} strokeWidth={3} /> : <ShieldCheck size={15} />}
                </span>
                <span style={{ fontSize: 10.5, fontWeight: 700, color: done ? "var(--mint-ink)" : active ? "var(--agent)" : "var(--text-faint)" }}>{m}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* status chips */}
      <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
        {chips.map((c, i) => {
          const on = i <= phase || progress >= 100;
          return (
            <span key={c} style={{
              display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 10px", borderRadius: 999, fontSize: 11, fontWeight: 800,
              background: on ? "var(--agent-soft)" : "var(--surface-sunken)",
              color: on ? "var(--agent)" : "var(--text-faint)",
              border: "1px solid " + (on ? "var(--agent-ring)" : "var(--border-hair)"),
              transition: "all .35s var(--ease)",
            }}>
              <span style={{ width: 5, height: 5, borderRadius: "50%", background: on ? "var(--agent)" : "var(--text-faint)", transition: "background .35s var(--ease)" }} />{c}
            </span>
          );
        })}
      </div>

      {/* confidence meter */}
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
          <span style={{ fontSize: 11.5, fontWeight: 700, color: "var(--text-muted)" }}>ביטחון הניתוח</span>
          <span style={{ ...tnum, fontSize: 12, fontWeight: 900, color: "var(--agent)" }}>{progress}%</span>
        </div>
        <div style={{ height: 7, borderRadius: 999, background: "var(--surface-sunken)", overflow: "hidden" }}>
          <div style={{ height: "100%", width: progress + "%", borderRadius: 999, background: "linear-gradient(90deg,var(--agent),var(--agent-strong))", transition: `width ${TICK_MS}ms linear` }} />
        </div>
      </div>

      {/* shimmer insight rows */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {[0, 1, 2].map((i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 11, padding: "10px 12px", borderRadius: "var(--r-sm)", background: "var(--surface-sunken)", border: "1px solid var(--border-hair)", animation: `aiRowIn .4s var(--ease) ${i * 0.08}s both` }}>
            <div className="ai-shimmer" style={shimmer(32, 32, 9)} />
            <div style={{ display: "flex", flexDirection: "column", gap: 6, flex: 1, minWidth: 0 }}>
              <div className="ai-shimmer" style={shimmer(i === 0 ? "58%" : i === 1 ? "44%" : "50%", 9, 5)} />
              <div className="ai-shimmer" style={shimmer(i === 0 ? "34%" : "28%", 7, 4, { opacity: 0.7 })} />
            </div>
            <div className="ai-shimmer" style={shimmer(46, 16, 5)} />
          </div>
        ))}
      </div>
    </div>
  );
}
