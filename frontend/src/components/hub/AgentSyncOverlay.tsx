import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { BrainCircuit } from "lucide-react";
import { AGENTS, type AgentId } from "../../theme/agents";

/* ============================================================
   Agent Sync Overlay — full-screen 3D "sync" sequence shown
   while the master agent runs a full analysis.

   Pure CSS 3D: a glowing master core in the center, the four
   domain agents orbiting it on a tilted ring (perspective +
   preserve-3d), data pulses flying between them. On `stage:
   "exit"` the satellites converge into the core, the core
   bursts, and the whole overlay fades — revealing the results
   already rendered in the Hub behind it.
   ============================================================ */

export type SyncStage = "enter" | "exit";

type AgentSyncOverlayProps = {
  stage: SyncStage;
};

/** Fixed palette for the dark overlay (matches the agents' tones). */
const SAT_COLORS: Record<AgentId, { main: string; soft: string }> = {
  payslips: { main: "#B49BF0", soft: "rgba(155,127,232,.25)" },
  insurance: { main: "#F4A87E", soft: "rgba(218,111,68,.25)" },
  pension: { main: "#48C98B", soft: "rgba(47,156,98,.25)" },
  gemel: { main: "#E5C35C", soft: "rgba(185,139,22,.25)" },
};

/** Orbit angle spacing — 360° divided across the agent satellites. */
const SAT_STEP_DEG = 360 / AGENTS.length;

const STEPS = [
  "מעיר את הסוכנים...",
  "סוכן התלושים אוסף נתוני שכר...",
  "סוכן הביטוחים סורק פוליסות...",
  "סוכן הפנסיה מחשב תחזיות...",
  "סוכן הגמל משווה מול גמל-נט...",
  "הסוכן הראשי מצליב ממצאים...",
  "מסנכרן תוצאות...",
];

export default function AgentSyncOverlay({ stage }: AgentSyncOverlayProps) {
  const [stepIdx, setStepIdx] = useState(0);

  // Cycle the status line while syncing.
  useEffect(() => {
    if (stage === "exit") return;
    const iv = setInterval(() => setStepIdx(i => (i + 1) % STEPS.length), 1150);
    return () => clearInterval(iv);
  }, [stage]);

  // Lock page scroll while the overlay is up.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  const exiting = stage === "exit";

  return createPortal(
    <div
      role="dialog"
      aria-label="הסוכנים מסתנכרנים"
      className={`fgsync-overlay${exiting ? " fgsync-exiting" : ""}`}
    >
      <style>{`
        .fgsync-overlay {
          position: fixed; inset: 0; z-index: 9999;
          display: grid; place-items: center;
          direction: rtl;
          background: radial-gradient(90% 90% at 50% 40%, rgba(24,22,32,.94), rgba(8,7,12,.97));
          backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px);
          animation: fgsyncFadeIn .45s var(--ease, ease) both;
        }
        .fgsync-overlay.fgsync-exiting { animation: fgsyncFadeOut .55s .45s ease both; }
        @keyframes fgsyncFadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes fgsyncFadeOut { from { opacity: 1; } to { opacity: 0; } }

        .fgsync-grain {
          position: absolute; inset: 0; pointer-events: none;
          background-image: radial-gradient(rgba(255,255,255,.06) 1px, transparent 1px);
          background-size: 26px 26px;
          mask-image: radial-gradient(70% 70% at 50% 45%, #000, transparent);
          -webkit-mask-image: radial-gradient(70% 70% at 50% 45%, #000, transparent);
        }

        /* ── 3D scene ── */
        .fgsync-scene { perspective: 1100px; width: 380px; height: 380px; position: relative; }
        .fgsync-stage {
          position: absolute; inset: 0;
          transform-style: preserve-3d;
          animation: fgsyncTilt 9s ease-in-out infinite alternate;
        }
        @keyframes fgsyncTilt {
          from { transform: rotateX(12deg) rotateY(-7deg); }
          to   { transform: rotateX(20deg) rotateY(7deg); }
        }

        /* master core */
        .fgsync-core {
          position: absolute; top: 50%; left: 50%;
          width: 104px; height: 104px; margin: -52px 0 0 -52px;
          border-radius: 30px;
          background: linear-gradient(135deg, #9B7FE8, #6F8BE8);
          display: grid; place-items: center; color: #fff;
          box-shadow: 0 0 46px rgba(124,95,214,.65), 0 0 130px rgba(124,95,214,.3);
          animation: fgsyncCorePulse 1.8s ease-in-out infinite;
        }
        @keyframes fgsyncCorePulse {
          0%, 100% { box-shadow: 0 0 40px rgba(124,95,214,.55), 0 0 110px rgba(124,95,214,.25); }
          50%      { box-shadow: 0 0 66px rgba(124,95,214,.85), 0 0 170px rgba(124,95,214,.45); }
        }
        .fgsync-exiting .fgsync-core { animation: fgsyncCoreBurst .8s var(--ease, ease) both; }
        @keyframes fgsyncCoreBurst {
          0%   { transform: scale(1); filter: brightness(1); }
          45%  { transform: scale(1.5); filter: brightness(2.1); box-shadow: 0 0 130px rgba(180,155,240,1), 0 0 300px rgba(155,127,232,.7); }
          100% { transform: scale(.2); opacity: 0; filter: brightness(3); }
        }
        .fgsync-core-ring {
          position: absolute; inset: -16px; border-radius: 40px;
          border: 1.5px solid rgba(180,155,240,.4);
          animation: fgsyncRingSpin 6s linear infinite;
        }
        @keyframes fgsyncRingSpin { to { transform: rotate(360deg); } }

        /* orbit ring (tilted, dashed) */
        .fgsync-orbit {
          position: absolute; top: 50%; left: 50%;
          width: 320px; height: 320px; margin: -160px 0 0 -160px;
          border-radius: 50%;
          border: 1.5px dashed rgba(255,255,255,.16);
          transform: rotateX(72deg);
          animation: fgsyncOrbitSpin 14s linear infinite;
        }
        @keyframes fgsyncOrbitSpin { to { transform: rotateX(72deg) rotate(360deg); } }

        /* satellites — orbit with counter-rotation so they always face the viewer */
        .fgsync-sat {
          position: absolute; top: 50%; left: 50%;
          width: 76px; height: 76px; margin: -38px 0 0 -38px;
          transform-style: preserve-3d;
        }
        .fgsync-sat-0 { animation: fgsyncOrbit0 7s linear infinite; }
        .fgsync-sat-1 { animation: fgsyncOrbit1 7s linear infinite; }
        .fgsync-sat-2 { animation: fgsyncOrbit2 7s linear infinite; }
        .fgsync-sat-3 { animation: fgsyncOrbit3 7s linear infinite; }
        @keyframes fgsyncOrbit0 { from { transform: rotateY(0deg)   translateZ(160px) rotateY(0deg); }    to { transform: rotateY(360deg) translateZ(160px) rotateY(-360deg); } }
        @keyframes fgsyncOrbit1 { from { transform: rotateY(90deg)  translateZ(160px) rotateY(-90deg); }  to { transform: rotateY(450deg) translateZ(160px) rotateY(-450deg); } }
        @keyframes fgsyncOrbit2 { from { transform: rotateY(180deg) translateZ(160px) rotateY(-180deg); } to { transform: rotateY(540deg) translateZ(160px) rotateY(-540deg); } }
        @keyframes fgsyncOrbit3 { from { transform: rotateY(270deg) translateZ(160px) rotateY(-270deg); } to { transform: rotateY(630deg) translateZ(160px) rotateY(-630deg); } }
        .fgsync-exiting .fgsync-sat-0,
        .fgsync-exiting .fgsync-sat-1,
        .fgsync-exiting .fgsync-sat-2,
        .fgsync-exiting .fgsync-sat-3 { animation: fgsyncConverge .7s var(--ease, ease) both; }
        @keyframes fgsyncConverge {
          0%   { transform: translateZ(150px) scale(1); opacity: 1; }
          100% { transform: translateZ(0) scale(.15); opacity: 0; }
        }

        .fgsync-sat-body {
          width: 100%; height: 100%; border-radius: 22px;
          display: grid; place-items: center;
          background: rgba(255,255,255,.07);
          border: 1px solid rgba(255,255,255,.2);
          backdrop-filter: blur(4px); -webkit-backdrop-filter: blur(4px);
          animation: fgsyncSatBob 2.6s ease-in-out infinite;
        }
        @keyframes fgsyncSatBob {
          0%, 100% { transform: translateY(0); }
          50%      { transform: translateY(-8px); }
        }
        .fgsync-sat-label {
          position: absolute; top: calc(100% + 8px); left: 50%; transform: translateX(-50%);
          font-size: 12px; font-weight: 800; white-space: nowrap;
          text-shadow: 0 2px 10px rgba(0,0,0,.7);
        }

        /* data pulses flying core ↔ satellites */
        .fgsync-pulse {
          position: absolute; top: 50%; left: 50%;
          width: 9px; height: 9px; margin: -4.5px 0 0 -4.5px;
          border-radius: 50%;
          filter: blur(.4px);
        }
        .fgsync-exiting .fgsync-pulse { display: none; }
        @keyframes fgsyncPulseOut {
          0%   { transform: rotate(var(--ang)) translateX(0) scale(.4); opacity: 0; }
          15%  { opacity: 1; }
          85%  { opacity: 1; }
          100% { transform: rotate(var(--ang)) translateX(148px) scale(1); opacity: 0; }
        }
        @keyframes fgsyncPulseIn {
          0%   { transform: rotate(var(--ang)) translateX(148px) scale(1); opacity: 0; }
          15%  { opacity: 1; }
          85%  { opacity: 1; }
          100% { transform: rotate(var(--ang)) translateX(0) scale(.4); opacity: 0; }
        }

        /* status text */
        .fgsync-status {
          margin-top: 28px; text-align: center; color: #fff;
          animation: fgsyncFadeIn .6s .2s var(--ease, ease) both;
        }
        .fgsync-status-title { font-size: 19px; font-weight: 900; letter-spacing: -.02em; }
        .fgsync-status-step {
          margin-top: 8px; font-size: 14px; font-weight: 600;
          color: rgba(255,255,255,.65); min-height: 21px;
          animation: fgsyncStepIn .4s var(--ease, ease) both;
        }
        @keyframes fgsyncStepIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
        .fgsync-dots { display: inline-flex; gap: 5px; margin-inline-start: 4px; vertical-align: middle; }
        .fgsync-dots i {
          width: 5px; height: 5px; border-radius: 50%; background: #B49BF0;
          animation: fgsyncBlink 1.1s ease-in-out infinite;
        }
        .fgsync-dots i:nth-child(2) { animation-delay: .18s; }
        .fgsync-dots i:nth-child(3) { animation-delay: .36s; }
        @keyframes fgsyncBlink { 0%, 100% { opacity: .25; } 50% { opacity: 1; } }

        @media (prefers-reduced-motion: reduce) {
          .fgsync-stage, .fgsync-orbit, .fgsync-core-ring,
          .fgsync-sat-0, .fgsync-sat-1, .fgsync-sat-2, .fgsync-sat-3,
          .fgsync-sat-body, .fgsync-pulse { animation-duration: 0.01s !important; animation-iteration-count: 1 !important; }
        }
      `}</style>

      <div className="fgsync-grain" />

      <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
        <div className="fgsync-scene">
          <div className="fgsync-stage">
            {/* tilted orbit ring */}
            <div className="fgsync-orbit" />

            {/* data pulses (core → out and back), one per agent direction */}
            {AGENTS.map((a, i) => {
              const c = SAT_COLORS[a.id] ?? SAT_COLORS.payslips;
              return (
                <span key={a.id + "-pulses"}>
                  <span
                    className="fgsync-pulse"
                    style={{
                      background: c.main,
                      boxShadow: `0 0 10px ${c.main}`,
                      ["--ang" as string]: `${i * SAT_STEP_DEG + 18}deg`,
                      animation: `fgsyncPulseOut 1.6s ${i * 0.35}s linear infinite`,
                    }}
                  />
                  <span
                    className="fgsync-pulse"
                    style={{
                      background: c.main,
                      boxShadow: `0 0 10px ${c.main}`,
                      ["--ang" as string]: `${i * SAT_STEP_DEG - 22}deg`,
                      animation: `fgsyncPulseIn 1.6s ${0.8 + i * 0.35}s linear infinite`,
                    }}
                  />
                </span>
              );
            })}

            {/* the agent satellites — one per domain agent */}
            {AGENTS.map((a, i) => {
              const c = SAT_COLORS[a.id] ?? SAT_COLORS.payslips;
              const Icon = a.Icon;
              return (
                <div key={a.id} className={`fgsync-sat fgsync-sat-${i}`}>
                  <div
                    className="fgsync-sat-body"
                    style={{ boxShadow: `0 0 26px ${c.soft}, inset 0 0 18px ${c.soft}`, animationDelay: `${i * 0.4}s` }}
                  >
                    <Icon size={30} strokeWidth={1.8} color={c.main} />
                    <span className="fgsync-sat-label" style={{ color: c.main }}>{a.label}</span>
                  </div>
                </div>
              );
            })}

            {/* master core on top */}
            <div className="fgsync-core">
              <div className="fgsync-core-ring" />
              <BrainCircuit size={46} strokeWidth={1.7} />
            </div>
          </div>
        </div>

        <div className="fgsync-status">
          <div className="fgsync-status-title">
            {exiting ? "הסנכרון הושלם" : "הסוכנים מסתנכרנים"}
            {!exiting && (
              <span className="fgsync-dots"><i /><i /><i /></span>
            )}
          </div>
          <div className="fgsync-status-step" key={exiting ? "done" : stepIdx}>
            {exiting ? "טוען את התוצאות ל-Hub..." : STEPS[stepIdx]}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
