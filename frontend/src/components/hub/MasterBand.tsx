import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CircleAlert, CircleDashed, FileText, Play, Upload } from "lucide-react";
import { relativeTime } from "../../utils/notificationDisplay";
import type { FullAnalysisGlobalScore, FullAnalysisResponse } from "../../api/fullAnalysis.api";
import type { AgentId } from "../../theme/agents";
import { AGENTS } from "../../theme/agents";
import { APP_ROUTES } from "../../types/navigation";
import { AGENT_KEY, type BackendAgentKey } from "./masterAgentMerge";
import { RadialGauge } from "./hubViz";
import type { AgentReadinessItem, AgentReadinessPhase } from "../../utils/agentReadiness";
import type { Phase } from "./useMasterAgent";

/* ============================================================
   MasterBand — the dark "agent command center". A live agent
   network diagram (four domain agents streaming into the main
   agent core), a health strip with a live activity terminal, one
   primary CTA that runs the full analysis, and quick reopen of the
   last saved report. Fixed SVG geometry — no live measurement.
   Every number is wired to real Hub data; the conversation motion
   is illustrative (no fabricated figures).
   ============================================================ */

export type LastReportMeta = {
  savedAt: string;
  score: number | null;
  topAction: string | null;
};

type MasterBandProps = {
  loading: boolean;
  phase: Phase;
  busy: boolean;
  focusKey: BackendAgentKey | null;
  result: FullAnalysisResponse | null;
  statusLine: string;
  potentialSavings: number;
  opportunities: number;
  completedDocs: number;
  heroRows: [string, string][];
  agentMetric: Record<AgentId, string>;
  advisorReadiness: AgentReadinessItem[];
  onRunFull: () => void;
  lastReport: LastReportMeta | null;
  savedScore: FullAnalysisGlobalScore | null;
};

const MONO = "'SF Mono',ui-monospace,'Cascadia Mono',Consolas,monospace";

/* fixed node geometry for the agent mesh (viewBox 440×330) */
const NODE: Record<string, { x: number; y: number; hex: string }> = {
  payslips: { x: 74, y: 64, hex: "#9B7FE8" },
  insurance: { x: 366, y: 72, hex: "#DA6F44" },
  pension: { x: 82, y: 262, hex: "#2F9C62" },
  gemel: { x: 356, y: 254, hex: "#E7C560" },
  core: { x: 220, y: 163, hex: "#CDB6FF" },
};

/* readiness lifecycle → mesh status token */
type MeshStatus = "ready" | "onboarding" | "waiting";
function meshStatusOf(phase: AgentReadinessPhase | undefined): MeshStatus {
  switch (phase) {
    case "analysis_ready":
    case "document_ready_onboarding_complete":
      return "ready";
    case "document_ready_onboarding_incomplete":
      return "onboarding";
    default:
      return "waiting";
  }
}
const STATUS_MAP: Record<MeshStatus, { label: string; c: string; glow: string }> = {
  ready: { label: "פעיל", c: "var(--mint-ink)", glow: "rgba(47,156,98,.2)" },
  onboarding: { label: "נדרש אונבורדינג", c: "var(--butter-ink)", glow: "rgba(185,139,22,.18)" },
  waiting: { label: "ממתין למסמך", c: "var(--peach-ink)", glow: "rgba(218,111,68,.18)" },
};

/* curved quadratic path between two mesh nodes */
function meshPath(a: { x: number; y: number }, b: { x: number; y: number }, i: number): string {
  const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
  const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy) || 1;
  const k = 0.2 * len * (i % 2 ? 1 : -1);
  return `M${a.x} ${a.y} Q${mx + (-dy / len) * k} ${my + (dx / len) * k} ${b.x} ${b.y}`;
}

/* top nodes: bubble clears the label below; bottom nodes: bubble above */
const bubbleY = (k: string) => (NODE[k].y < 165 ? "150%" : "-158%");
const CORE_BUBBLE_Y = "-172%";

const whiteCta: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 9,
  background: "#fff",
  color: "var(--ink)",
  border: "none",
  borderRadius: "var(--r-btn)",
  padding: "13px 24px",
  fontFamily: "inherit",
  fontWeight: 800,
  fontSize: 15,
  transition: "transform .2s var(--ease)",
};

export default function MasterBand({
  loading, phase, busy, focusKey, result, statusLine,
  opportunities, completedDocs, heroRows, agentMetric, advisorReadiness,
  onRunFull, lastReport, savedScore,
}: MasterBandProps) {
  const navigate = useNavigate();

  // inject the command-band keyframes once
  useEffect(() => {
    if (document.getElementById("hub-anim")) return;
    const st = document.createElement("style");
    st.id = "hub-anim";
    st.textContent =
      "@keyframes hubPulse{0%{transform:scale(.75);opacity:.55}80%,100%{transform:scale(1.5);opacity:0}}" +
      "@keyframes hubBlink{0%,55%{opacity:1}56%,100%{opacity:0}}" +
      "@keyframes hubRise{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}" +
      "@keyframes hubLog{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}" +
      "@keyframes hubScan{0%{transform:translateX(120%)}100%{transform:translateX(-220%)}}" +
      "@keyframes hubPkt{0%{offset-distance:0%;opacity:0}10%{opacity:1}90%{opacity:1}100%{offset-distance:100%;opacity:0}}" +
      "@keyframes hubTyp{0%{opacity:0;transform:translate(-50%,var(--by)) scale(.72)}14%{opacity:1;transform:translate(-50%,var(--by)) scale(1)}82%{opacity:1}100%{opacity:0;transform:translate(-50%,var(--by)) scale(.9)}}" +
      "@keyframes hubMsg{0%{opacity:0;transform:translate(-50%,var(--by)) scale(.8)}12%{opacity:1;transform:translate(-50%,var(--by)) scale(1)}86%{opacity:1;transform:translate(-50%,var(--by)) scale(1)}100%{opacity:0;transform:translate(-50%,var(--by)) scale(.94)}}" +
      "@keyframes hubDot{0%,100%{transform:translateY(0);opacity:.5}50%{transform:translateY(-3px);opacity:1}}" +
      "@keyframes hubFlash{0%{box-shadow:0 0 0 0 var(--fl)}70%{box-shadow:0 0 0 12px transparent}100%{box-shadow:0 0 0 0 transparent}}" +
      "@keyframes hubRoute{0%{opacity:0}12%{opacity:.55}88%{opacity:.55}100%{opacity:0}}" +
      "@media (prefers-reduced-motion:reduce){.hub-pulse,.hub-pkt,.hub-typ,.hub-msg{animation:none!important}}";
    document.head.appendChild(st);
  }, []);

  const readinessOf = (id: AgentId): AgentReadinessItem | undefined =>
    advisorReadiness.find(r => r.agentId === id);

  // per-agent live status (a running focus wins over static readiness)
  const meshStatus = (id: AgentId): MeshStatus => {
    const key = AGENT_KEY[id];
    if (phase === "running" || focusKey === key) return "ready";
    return meshStatusOf(readinessOf(id)?.phase);
  };

  // ---- scripted agent-to-agent conversation (illustrative motion, no fabricated numbers) ----
  const talks: { f: AgentId | "core"; t: AgentId | "core"; m: string }[] = [
    { f: "payslips", t: "core", m: "עדכון ניתוח תלושי השכר" },
    { f: "core", t: "pension", m: "עדכון צבירה מול השכר" },
    { f: "pension", t: "gemel", m: "סנכרון דמי ניהול השתלמות" },
    { f: "insurance", t: "core", m: "בדיקת כפילות בכיסוי" },
    { f: "gemel", t: "payslips", m: "אימות הפקדות מול התלוש" },
    { f: "core", t: "insurance", m: "הפקת המלצה לצמצום עלות" },
  ];
  const [talkIdx, setTalkIdx] = useState(0);
  useEffect(() => {
    const t = window.setInterval(() => setTalkIdx(i => (i + 1) % talks.length), 4300);
    return () => window.clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const talk = talks[talkIdx];

  // ---- live activity terminal, built from the real per-agent metrics ----
  const logs = [
    { t: "OK", c: "#7BD2A0", m: `סוכן תלושים · ${agentMetric.payslips}` },
    { t: "!!", c: "#F0A47E", m: `סוכן ביטוחים · ${agentMetric.insurance}` },
    { t: "..", c: "#CDB6FF", m: `סוכן פנסיוני · ${agentMetric.pension}` },
    { t: "OK", c: "#7BD2A0", m: `סוכן גמל · ${agentMetric.gemel}` },
    {
      t: "OK", c: "#7BD2A0",
      m: opportunities > 0
        ? `הסוכן הראשי · ${opportunities} הזדמנויות פעילות · ניתוח עודכן`
        : "הסוכן הראשי · אין הזדמנויות חדשות · הכל תקין",
    },
  ];
  const [logIdx, setLogIdx] = useState(0);
  useEffect(() => {
    const t = window.setInterval(() => setLogIdx(i => (i + 1) % logs.length), 2800);
    return () => window.clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const visLogs = [logs[logIdx], logs[(logIdx + 1) % logs.length], logs[(logIdx + 2) % logs.length]];

  // ---- health: live run wins, else the score computed from the user's saved data ----
  const liveScore = result?.globalScore ?? null;
  const score = liveScore ?? savedScore;
  const healthPct = score ? Math.round((score.score / 100) * 100) : 0;
  const healthTone =
    healthPct >= 75 ? { label: "מצב טוב", c: "#7BD2A0" }
      : healthPct >= 45 ? { label: "יש מקום לשיפור", c: "#F6E4A8" }
        : { label: "דורש טיפול", c: "#F0A47E" };
  const subMeters: [string, number, string][] = score?.categories?.length
    ? score.categories.slice(0, 3).map((cat, i) => [
      cat.label,
      Math.round((cat.score / (cat.maxScore || 100)) * 100),
      ["#DA6F44", "#CDB6FF", "#7BD2A0"][i],
    ])
    : [["שלמות מסמכים", 0, "#DA6F44"], ["יציבות שכר", 0, "#CDB6FF"], ["מוכנות מס", 0, "#7BD2A0"]];

  // breakdown-row accent dots (cycled to match the design)
  const rowDot = ["#9B7FE8", "#DA6F44", "#2F9C62"];

  // empty state — nothing analysed yet
  const empty = !loading && opportunities === 0 && completedDocs === 0;

  return (
    <div style={{ position: "relative", borderRadius: "var(--radius)", overflow: "hidden", background: "radial-gradient(120% 90% at 86% 0%,#232030,#141319 58%,#0D0C11)", color: "#fff", boxShadow: "var(--shadow-xl)", marginBottom: 20, animation: "hubRise .55s var(--ease) both" }}>
      {/* tech grid */}
      <div style={{ position: "absolute", inset: 0, backgroundImage: "linear-gradient(rgba(255,255,255,.045) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.045) 1px,transparent 1px)", backgroundSize: "34px 34px", pointerEvents: "none", maskImage: "radial-gradient(90% 90% at 50% 30%,#000 40%,transparent 95%)", WebkitMaskImage: "radial-gradient(90% 90% at 50% 30%,#000 40%,transparent 95%)" }} />
      <div style={{ position: "absolute", width: 380, height: 380, borderRadius: "50%", insetInlineStart: -130, top: -150, background: "radial-gradient(circle,rgba(155,127,232,.3),transparent 70%)", pointerEvents: "none" }} />

      <div style={{ position: "relative", display: "grid", gridTemplateColumns: "1fr 1.05fr", gap: 26, padding: "32px 34px 24px", alignItems: "center" }}>
        {/* text + stats (right in RTL) */}
        <div>
          <div style={{ fontFamily: MONO, fontSize: 12, color: "rgba(255,255,255,.5)", letterSpacing: ".08em", marginBottom: 12 }}>OPPORTUNITIES.ACTIVE</div>

          {empty ? (
            <>
              <div style={{ fontSize: "clamp(24px,2.6vw,34px)", fontWeight: 900, letterSpacing: "-.03em", lineHeight: 1.15, maxWidth: 400 }}>
                העלו תלוש שכר ראשון — והסוכנים יתחילו לחפש הזדמנויות לחיסכון.
              </div>
              <button onClick={() => navigate(APP_ROUTES.documentsUpload)} style={{ ...whiteCta, marginTop: 22, cursor: "pointer" }}
                onMouseEnter={e => (e.currentTarget.style.transform = "translateY(-2px)")}
                onMouseLeave={e => (e.currentTarget.style.transform = "none")}>
                <Upload size={16} strokeWidth={2.4} /> העלאת תלוש ראשון
              </button>
            </>
          ) : (
            <>
              <div style={{ display: "flex", alignItems: "baseline", gap: 14 }}>
                <span style={{ fontSize: "clamp(58px,6.4vw,84px)", fontWeight: 900, letterSpacing: "-.05em", lineHeight: 0.9, fontVariantNumeric: "tabular-nums", background: "linear-gradient(96deg,#CDB6FF,#F8D2BE 70%,#F6E4A8)", WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent" }}>
                  {loading ? "—" : opportunities}
                </span>
                <span style={{ fontSize: 16, fontWeight: 700, color: "rgba(255,255,255,.72)" }}>הזדמנויות פעילות לשיפור</span>
              </div>

              <div style={{ marginTop: 20, display: "flex", flexDirection: "column", maxWidth: 400 }}>
                {heroRows.map(([k, v], i) => (
                  <div key={k} style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 0", borderBottom: "1px solid rgba(255,255,255,.09)" }}>
                    <span style={{ width: 8, height: 8, borderRadius: "50%", background: rowDot[i % rowDot.length], boxShadow: `0 0 8px ${rowDot[i % rowDot.length]}`, flex: "none" }} />
                    <span style={{ fontSize: 14, color: "rgba(255,255,255,.7)", fontWeight: 500 }}>{k}</span>
                    <span style={{ marginInlineStart: "auto", fontFamily: MONO, fontSize: 16, fontWeight: 800 }}>{v}</span>
                  </div>
                ))}
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 22, flexWrap: "wrap" }}>
                <button
                  onClick={onRunFull}
                  disabled={busy}
                  style={{ ...whiteCta, cursor: busy ? "not-allowed" : "pointer", opacity: busy ? 0.7 : 1 }}
                  onMouseEnter={e => { if (!busy) e.currentTarget.style.transform = "translateY(-2px)"; }}
                  onMouseLeave={e => { e.currentTarget.style.transform = "none"; }}
                >
                  {phase === "running"
                    ? <><CircleDashed size={16} style={{ animation: "fgSpin 1s linear infinite" }} /> מנתח...</>
                    : <><Play size={16} strokeWidth={2.4} /> הרץ ניתוח מלא</>}
                </button>

                {lastReport && (
                  <button
                    onClick={() => navigate(APP_ROUTES.executiveReport)}
                    title={lastReport.topAction ? `בראש הדוח: ${lastReport.topAction}` : "פתיחת הדוח האחרון"}
                    style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "11px 16px", borderRadius: "var(--r-btn)", border: "1px solid rgba(255,255,255,.18)", background: "rgba(255,255,255,.07)", fontSize: 13, fontWeight: 700, color: "rgba(255,255,255,.85)", cursor: "pointer", transition: "background .2s var(--ease), transform .2s var(--ease)", fontFamily: "inherit" }}
                    onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,.13)"; e.currentTarget.style.transform = "translateY(-2px)"; }}
                    onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,.07)"; e.currentTarget.style.transform = "none"; }}
                  >
                    <FileText size={15} strokeWidth={2.2} color="#CDB6FF" />
                    הדוח האחרון · {relativeTime(lastReport.savedAt)}
                  </button>
                )}
              </div>

              {phase === "error" && (
                <div style={{ marginTop: 16, display: "inline-flex", alignItems: "center", gap: 9, background: "rgba(218,111,68,.13)", border: "1px solid rgba(218,111,68,.3)", borderRadius: "var(--r-md)", padding: "10px 14px", fontSize: 13, fontWeight: 600, color: "#F4A87E" }}>
                  <CircleAlert size={15} /> הניתוח נכשל. ודא שהשרת זמין ונסה שוב.
                </div>
              )}
            </>
          )}
        </div>

        {/* agent conversation mesh (left in RTL) */}
        <div style={{ position: "relative", minHeight: 330 }}>
          <div style={{ position: "absolute", top: -6, insetInlineEnd: 0, fontFamily: MONO, fontSize: 10.5, letterSpacing: ".12em", color: "rgba(255,255,255,.4)" }}>AGENTS.MESH</div>
          <svg viewBox="0 0 440 330" style={{ width: "100%", display: "block", overflow: "visible" }}>
            {/* static faint routes */}
            {talks.map((tk, i) => (
              <path key={i} d={meshPath(NODE[tk.f], NODE[tk.t], i)} fill="none" stroke="rgba(255,255,255,.16)" strokeWidth="1.2" strokeDasharray="2 7" strokeLinecap="round" />
            ))}
            {/* active exchange — remounts per talk so the timeline restarts */}
            <g key={talkIdx}>
              <path d={meshPath(NODE[talk.f], NODE[talk.t], talkIdx)} fill="none" stroke={NODE[talk.f].hex} strokeWidth="1.6" strokeDasharray="2 7" strokeLinecap="round" style={{ animation: "hubRoute 4.3s linear both" }} />
              <circle className="hub-pkt" r="5" fill={NODE[talk.f].hex} style={{ offsetPath: `path("${meshPath(NODE[talk.f], NODE[talk.t], talkIdx)}")`, offsetRotate: "0deg", animation: "hubPkt 1.35s var(--ease) 1.05s both", filter: `drop-shadow(0 0 6px ${NODE[talk.f].hex})` } as React.CSSProperties} />
              <circle className="hub-pkt" r="2.5" fill={NODE[talk.f].hex} opacity=".6" style={{ offsetPath: `path("${meshPath(NODE[talk.f], NODE[talk.t], talkIdx)}")`, offsetRotate: "0deg", animation: "hubPkt 1.35s var(--ease) 1.18s both" } as React.CSSProperties} />
            </g>
          </svg>

          {/* agent avatar nodes */}
          {AGENTS.map(a => {
            const nd = NODE[a.id];
            const st = meshStatus(a.id);
            const receiving = talk.t === a.id;
            const Icon = a.Icon;
            return (
              <button key={a.id} onClick={() => navigate(a.route)} style={{ position: "absolute", left: `${(nd.x / 440) * 100}%`, top: `${(nd.y / 330) * 100}%`, transform: "translate(-50%,-50%)", background: "none", border: "none", padding: 0, cursor: "pointer", fontFamily: "inherit", textAlign: "center" }}>
                <span key={receiving ? `rx${talkIdx}` : "idle"} style={{ position: "relative", display: "grid", placeItems: "center", width: 46, height: 46, margin: "0 auto", borderRadius: "50%", background: "rgba(255,255,255,.08)", border: `1.5px solid ${nd.hex}`, color: nd.hex, backdropFilter: "blur(6px)", ["--fl" as string]: `${nd.hex}66`, animation: receiving ? "hubFlash 1.2s var(--ease) 2.35s" : "none" } as React.CSSProperties}>
                  <Icon size={20} strokeWidth={1.9} />
                  <span style={{ position: "absolute", bottom: -1, insetInlineEnd: -1, width: 11, height: 11, borderRadius: "50%", background: STATUS_MAP[st].c, border: "2px solid #141319" }} />
                </span>
                <span style={{ display: "inline-block", marginTop: 6, padding: "3px 10px", borderRadius: 999, background: "rgba(255,255,255,.08)", border: "1px solid rgba(255,255,255,.14)", fontSize: 11, fontWeight: 800, color: "#fff", whiteSpace: "nowrap" }}>{a.hubTitle.replace("סוכן ", "")}</span>
              </button>
            );
          })}

          {/* main-agent core */}
          <div style={{ position: "absolute", left: `${(NODE.core.x / 440) * 100}%`, top: `${(NODE.core.y / 330) * 100}%`, transform: "translate(-50%,-50%)", textAlign: "center", pointerEvents: "none" }}>
            <div key={talk.t === "core" ? `c${talkIdx}` : "c"} style={{ position: "relative", width: 84, height: 84, margin: "0 auto", ["--fl" as string]: "rgba(205,182,255,.45)", animation: talk.t === "core" ? "hubFlash 1.2s var(--ease) 2.35s" : "none", borderRadius: 24 } as React.CSSProperties}>
              <span className="hub-pulse" style={{ position: "absolute", inset: 0, borderRadius: 24, border: "2px solid rgba(205,182,255,.6)", animation: "hubPulse 2.6s ease-out infinite" }} />
              <span style={{ position: "relative", display: "grid", placeItems: "center", width: 84, height: 84, borderRadius: 24, background: "linear-gradient(150deg,#3B2E6E,#241D45)", border: "1px solid rgba(205,182,255,.35)", boxShadow: "0 14px 34px rgba(0,0,0,.5), inset 0 1px 0 rgba(255,255,255,.14)", color: "#CDB6FF" }}>
                <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .962 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.962 0z" /></svg>
              </span>
            </div>
            <div style={{ marginTop: 8, fontSize: 12, fontWeight: 800, color: "rgba(255,255,255,.82)" }}>הסוכן הראשי</div>
            <div style={{ fontFamily: MONO, fontSize: 10.5, color: "#7BD2A0", marginTop: 2 }}>ONLINE</div>
          </div>

          {/* conversation bubbles — typing at sender, message at receiver */}
          <div key={`b${talkIdx}`} style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
            <span className="hub-typ" style={{ position: "absolute", left: `${(NODE[talk.f].x / 440) * 100}%`, top: `${(NODE[talk.f].y / 330) * 100}%`, ["--by" as string]: talk.f === "core" ? CORE_BUBBLE_Y : bubbleY(talk.f), transform: `translate(-50%,${talk.f === "core" ? CORE_BUBBLE_Y : bubbleY(talk.f)})`, display: "inline-flex", alignItems: "center", gap: 4, padding: "7px 12px", borderRadius: 12, background: "rgba(255,255,255,.12)", border: "1px solid rgba(255,255,255,.2)", backdropFilter: "blur(8px)", animation: "hubTyp 1.15s var(--ease) both" } as React.CSSProperties}>
              {[0, 1, 2].map(d => <span key={d} style={{ width: 5, height: 5, borderRadius: "50%", background: NODE[talk.f].hex, animation: `hubDot .9s ease-in-out ${d * 0.15}s infinite` }} />)}
            </span>
            <span className="hub-msg" style={{ position: "absolute", left: `${(NODE[talk.t].x / 440) * 100}%`, top: `${(NODE[talk.t].y / 330) * 100}%`, ["--by" as string]: talk.t === "core" ? CORE_BUBBLE_Y : bubbleY(talk.t), transform: `translate(-50%,${talk.t === "core" ? CORE_BUBBLE_Y : bubbleY(talk.t)})`, display: "inline-flex", alignItems: "center", gap: 7, padding: "7px 13px", borderRadius: 12, background: "rgba(20,19,25,.92)", border: `1px solid ${NODE[talk.f].hex}55`, boxShadow: `0 8px 22px rgba(0,0,0,.4), 0 0 12px ${NODE[talk.f].hex}22`, whiteSpace: "nowrap", animation: "hubMsg 1.9s var(--ease) 2.3s both", opacity: 0 } as React.CSSProperties}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: NODE[talk.f].hex, flex: "none" }} />
              <span style={{ fontSize: 11.5, fontWeight: 700, color: "rgba(255,255,255,.92)" }}>{talk.m}</span>
            </span>
          </div>
        </div>
      </div>

      {/* health + terminal strip */}
      <div style={{ position: "relative", display: "grid", gridTemplateColumns: "auto 1fr 1.15fr", gap: 24, alignItems: "center", padding: "18px 34px 22px", borderTop: "1px solid rgba(255,255,255,.09)" }}>
        {/* gauge */}
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <RadialGauge value={score?.score ?? 0} sub="" tone="lavender" size={86} onDark />
          <div>
            <div style={{ fontSize: 13.5, fontWeight: 800 }}>בריאות פיננסית</div>
            <div style={{ fontSize: 12, fontWeight: 700, color: healthTone.c, marginTop: 2 }}>{score ? healthTone.label : "ממתין לניתוח"}</div>
          </div>
        </div>
        {/* sub meters */}
        <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
          {subMeters.map(([k, v, c]) => (
            <div key={k} style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 12, color: "rgba(255,255,255,.6)", fontWeight: 600, width: 96, flex: "none", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{k}</span>
              <div style={{ flex: 1, height: 5, borderRadius: 999, background: "rgba(255,255,255,.12)", overflow: "hidden" }}>
                <div style={{ width: `${v}%`, height: "100%", borderRadius: 999, background: c, transition: "width 1s var(--ease)" }} />
              </div>
              <span style={{ fontFamily: MONO, fontSize: 12, fontWeight: 800, color: c, width: 34, textAlign: "end" }}>{v}%</span>
            </div>
          ))}
        </div>
        {/* activity terminal */}
        <div style={{ borderRadius: "var(--r-md)", background: "rgba(0,0,0,.4)", border: "1px solid rgba(255,255,255,.1)", padding: "12px 15px", direction: "rtl" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 8 }}>
            <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#7BD2A0", boxShadow: "0 0 7px #7BD2A0" }} />
            <span style={{ fontFamily: MONO, fontSize: 10.5, letterSpacing: ".1em", color: "rgba(255,255,255,.5)" }}>AGENTS.LIVE</span>
            <span style={{ marginInlineStart: "auto", fontFamily: MONO, fontSize: 10.5, color: "rgba(255,255,255,.4)" }}>{statusLine}</span>
          </div>
          {visLogs.map((l, i) => (
            <div key={l.m} style={{ display: "flex", alignItems: "baseline", gap: 8, padding: "2.5px 0", opacity: i === 0 ? 1 : 0.45, animation: i === 0 ? "hubLog .4s var(--ease)" : "none" }}>
              <span style={{ fontFamily: MONO, fontSize: 10.5, fontWeight: 700, color: l.c, flex: "none" }}>[{l.t}]</span>
              <span style={{ fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,.78)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{l.m}</span>
              {i === 0 && <span style={{ width: 7, height: 13, background: "#CDB6FF", flex: "none", animation: "hubBlink 1.1s steps(1) infinite" }} />}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
