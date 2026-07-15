import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AGENTS, type AgentId } from "../../theme/agents";

/* ============================================================
   Agent Focus Overlay — full-screen "solo mission" sequence
   shown while ONE domain agent runs a focused analysis
   (a task handed to it from the chat or its lane).

   Where AgentSyncOverlay shows all three agents converging,
   this shows a single agent alone at work: a radar sweep in
   its own colour, data particles streaming inward as it
   "collects" its domain data, and the other two agents dimmed
   and idle below — emphasising that only this one is on the job.
   ============================================================ */

export type FocusStage = "enter" | "exit";

type AgentFocusOverlayProps = {
  agentId: AgentId;
  stage: FocusStage;
};

const COLORS: Record<AgentId, { main: string; glow: string; soft: string }> = {
  payslips: { main: "#B49BF0", glow: "rgba(155,127,232,.55)", soft: "rgba(155,127,232,.15)" },
  insurance: { main: "#F4A87E", glow: "rgba(218,111,68,.55)", soft: "rgba(218,111,68,.15)" },
  pension: { main: "#48C98B", glow: "rgba(47,156,98,.55)", soft: "rgba(47,156,98,.15)" },
  gemel: { main: "#E5C35C", glow: "rgba(185,139,22,.55)", soft: "rgba(185,139,22,.15)" },
};

/** Domain-specific "collecting…" data noun per agent. */
const DATA_NOUN: Record<AgentId, string> = {
  payslips: "תלושי השכר",
  insurance: "הפוליסות",
  pension: "הקרנות ודמי הניהול",
  gemel: "קופות הגמל וההשתלמות",
};

export default function AgentFocusOverlay({ agentId, stage }: AgentFocusOverlayProps) {
  const agent = AGENTS.find(a => a.id === agentId)!;
  const c = COLORS[agentId];
  const Icon = agent.Icon;
  const exiting = stage === "exit";

  const STEPS = [
    `מעיר את סוכן ה${agent.label}...`,
    "מתחבר למקורות הנתונים...",
    `אוסף את ${DATA_NOUN[agentId]}...`,
    "מנתח ומחשב...",
    "מסכם ממצאים...",
  ];

  const [stepIdx, setStepIdx] = useState(0);
  useEffect(() => {
    if (exiting) return;
    const iv = setInterval(() => setStepIdx(i => (i + 1) % STEPS.length), 1000);
    return () => clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exiting]);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  const particles = Array.from({ length: 12 });

  return createPortal(
    <div
      role="dialog"
      aria-label={`סוכן ה${agent.label} במשימה`}
      className={`fgfocus-overlay${exiting ? " fgfocus-exiting" : ""}`}
    >
      <style>{`
        .fgfocus-overlay {
          position: fixed; inset: 0; z-index: 9999;
          display: grid; place-items: center; direction: rtl;
          background: radial-gradient(80% 80% at 50% 42%, ${c.soft}, rgba(10,9,14,.97) 62%);
          backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px);
          animation: fgfocusFadeIn .4s ease both;
        }
        .fgfocus-overlay.fgfocus-exiting { animation: fgfocusFadeOut .5s .3s ease both; }
        @keyframes fgfocusFadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes fgfocusFadeOut { from { opacity: 1; } to { opacity: 0; } }

        .fgfocus-stage { position: relative; width: 300px; height: 300px; display: grid; place-items: center; }

        /* radar sweep in the agent's colour */
        .fgfocus-radar {
          position: absolute; inset: 34px; border-radius: 50%;
          background: conic-gradient(from 0deg, transparent 0deg, ${c.glow} 46deg, transparent 92deg);
          animation: fgfocusSpin 2.2s linear infinite;
          filter: blur(1px);
        }
        @keyframes fgfocusSpin { to { transform: rotate(360deg); } }

        /* concentric radar grid rings */
        .fgfocus-grid {
          position: absolute; inset: 34px; border-radius: 50%;
          border: 1px solid ${c.soft};
          box-shadow: inset 0 0 0 40px transparent, inset 0 0 0 1px transparent;
        }
        .fgfocus-grid::before, .fgfocus-grid::after {
          content: ""; position: absolute; border-radius: 50%; border: 1px solid ${c.soft};
        }
        .fgfocus-grid::before { inset: 34px; }
        .fgfocus-grid::after  { inset: 68px; }

        /* expanding "collecting" pings */
        .fgfocus-ping {
          position: absolute; width: 120px; height: 120px; border-radius: 50%;
          border: 2px solid ${c.main};
          animation: fgfocusPing 2.4s ease-out infinite;
        }
        @keyframes fgfocusPing {
          0% { transform: scale(.55); opacity: .65; }
          100% { transform: scale(2.1); opacity: 0; }
        }
        .fgfocus-exiting .fgfocus-ping,
        .fgfocus-exiting .fgfocus-radar,
        .fgfocus-exiting .fgfocus-particle { animation: none; opacity: 0; transition: opacity .3s; }

        /* data particles streaming inward */
        .fgfocus-particle {
          position: absolute; width: 7px; height: 7px; margin: -3.5px 0 0 -3.5px;
          left: 50%; top: 50%; border-radius: 50%;
          background: ${c.main}; box-shadow: 0 0 8px ${c.main};
          animation: fgfocusCollect 1.9s linear infinite;
        }
        @keyframes fgfocusCollect {
          0%   { transform: rotate(var(--ang)) translateX(150px) scale(.3); opacity: 0; }
          18%  { opacity: 1; }
          82%  { opacity: 1; }
          100% { transform: rotate(var(--ang)) translateX(24px) scale(1); opacity: 0; }
        }

        /* the active agent core */
        .fgfocus-core {
          position: relative; z-index: 2;
          width: 108px; height: 108px; border-radius: 30px;
          display: grid; place-items: center; color: #fff;
          background: linear-gradient(135deg, ${c.main}, ${c.glow});
          box-shadow: 0 0 44px ${c.glow}, 0 0 120px ${c.soft};
          animation: fgfocusCorePulse 1.7s ease-in-out infinite;
        }
        @keyframes fgfocusCorePulse {
          0%,100% { box-shadow: 0 0 40px ${c.glow}, 0 0 100px ${c.soft}; }
          50%     { box-shadow: 0 0 66px ${c.glow}, 0 0 150px ${c.glow}; }
        }
        .fgfocus-exiting .fgfocus-core { animation: fgfocusCoreOut .7s ease both; }
        @keyframes fgfocusCoreOut {
          0% { transform: scale(1); }
          40% { transform: scale(1.12); }
          100% { transform: scale(.5); opacity: 0; }
        }

        .fgfocus-status { margin-top: 22px; text-align: center; color: #fff; }
        .fgfocus-badge {
          display: inline-flex; align-items: center; gap: 7px;
          font-size: 12px; font-weight: 800; letter-spacing: .1em;
          color: ${c.main}; background: ${c.soft};
          border: 1px solid ${c.main}; border-radius: 999px; padding: 5px 14px;
        }
        .fgfocus-title { margin-top: 12px; font-size: 21px; font-weight: 900; letter-spacing: -.02em; }
        .fgfocus-step { margin-top: 7px; font-size: 14px; font-weight: 600; color: rgba(255,255,255,.62); min-height: 20px; animation: fgfocusStepIn .35s ease both; }
        @keyframes fgfocusStepIn { from { opacity: 0; transform: translateY(5px); } to { opacity: 1; transform: none; } }

        /* the other two agents — dimmed & idle */
        .fgfocus-others { margin-top: 30px; display: flex; gap: 26px; justify-content: center; }
        .fgfocus-other { display: flex; flex-direction: column; align-items: center; gap: 7px; opacity: .32; }
        .fgfocus-other .chip {
          width: 42px; height: 42px; border-radius: 12px; display: grid; place-items: center;
          background: rgba(255,255,255,.06); border: 1px solid rgba(255,255,255,.14); color: rgba(255,255,255,.6);
        }
        .fgfocus-other .lbl { font-size: 11px; font-weight: 700; color: rgba(255,255,255,.5); }
        .fgfocus-other .idle { font-size: 9.5px; font-weight: 700; letter-spacing: .08em; color: rgba(255,255,255,.38); }

        @media (prefers-reduced-motion: reduce) {
          .fgfocus-radar, .fgfocus-ping, .fgfocus-particle, .fgfocus-core { animation-duration: .01s !important; animation-iteration-count: 1 !important; }
        }
      `}</style>

      <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
        <div className="fgfocus-stage">
          <span className="fgfocus-radar" />
          <span className="fgfocus-grid" />
          <span className="fgfocus-ping" style={{ animationDelay: "0s" }} />
          <span className="fgfocus-ping" style={{ animationDelay: "0.8s" }} />
          <span className="fgfocus-ping" style={{ animationDelay: "1.6s" }} />

          {particles.map((_, i) => (
            <span
              key={i}
              className="fgfocus-particle"
              style={{
                ["--ang" as string]: `${i * 30}deg`,
                animationDelay: `${(i % 6) * 0.32}s`,
              }}
            />
          ))}

          <div className="fgfocus-core">
            <Icon size={46} strokeWidth={1.7} />
          </div>
        </div>

        <div className="fgfocus-status">
          <span className="fgfocus-badge">משימת סוכן יחיד</span>
          <div className="fgfocus-title">{exiting ? "המשימה הושלמה" : `סוכן ה${agent.label} במשימה`}</div>
          <div className="fgfocus-step" key={exiting ? "done" : stepIdx}>
            {exiting ? "מעדכן את הפאנל..." : STEPS[stepIdx]}
          </div>
        </div>

        {/* the other agents stay idle — only this one is working */}
        <div className="fgfocus-others">
          {AGENTS.filter(a => a.id !== agentId).map(a => {
            const OtherIcon = a.Icon;
            return (
              <div key={a.id} className="fgfocus-other">
                <span className="chip"><OtherIcon size={20} strokeWidth={1.8} /></span>
                <span className="lbl">{a.label}</span>
                <span className="idle">ממתין</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>,
    document.body,
  );
}
