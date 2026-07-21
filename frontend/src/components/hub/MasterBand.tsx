import { useNavigate } from "react-router-dom";
import { CircleAlert, CircleDashed, FileText, Play, Upload } from "lucide-react";
import { relativeTime } from "../../utils/notificationDisplay";
import type { FullAnalysisGlobalScore, FullAnalysisResponse } from "../../api/fullAnalysis.api";
import { AGENTS } from "../../theme/agents";
import { APP_ROUTES } from "../../types/navigation";
import { AGENT_KEY, type BackendAgentKey } from "./masterAgentMerge";
import { FOCUS_LABEL, nis } from "./agentDisplay";
import { RadialGauge } from "./hubViz";
import { useCountUp, useInView } from "./hubVizCore";
import type { Phase } from "./useMasterAgent";

/* ============================================================
   MasterBand — the dark prism band that IS the master agent:
   the unified financial picture, one primary CTA that runs the
   full analysis, four tiny per-agent status dots, and the
   floating financial-health card fed by result.globalScore.
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
  onRunFull: () => void;
  lastReport: LastReportMeta | null;
  savedScore: FullAnalysisGlobalScore | null;
};

const whiteCta: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 9,
  background: "#fff",
  color: "var(--ink)",
  border: "none",
  borderRadius: "var(--r-btn)",
  padding: "14px 24px",
  fontFamily: "inherit",
  fontWeight: 800,
  fontSize: 15,
  transition: "transform .2s var(--ease)",
};

export default function MasterBand({
  loading, phase, busy, focusKey, result, statusLine,
  potentialSavings, opportunities, completedDocs, heroRows, onRunFull, lastReport, savedScore,
}: MasterBandProps) {
  const navigate = useNavigate();
  const [heroRef, heroSeen] = useInView<HTMLDivElement>();

  const total = useCountUp(potentialSavings, heroSeen && !loading);
  const bigOpportunities = useCountUp(opportunities, heroSeen && !loading);
  const heroMode: "money" | "counts" | "empty" =
    loading || potentialSavings > 0 ? "money" : opportunities > 0 ? "counts" : "empty";

  // Live run wins; otherwise the score computed from the user's saved data —
  // so the health card reflects the last analysis from the moment Hub loads.
  const liveScore = result?.globalScore ?? null;
  const score = liveScore ?? savedScore;

  const healthRows: [string, number | null][] = score?.categories?.length
    ? score.categories.slice(0, 3).map(cat => [
      cat.label,
      Math.round((cat.score / (cat.maxScore || 100)) * 100),
    ])
    : [
      ["תלושי שכר", null],
      ["יעילות פנסיה", null],
      ["כיסוי ביטוחי", null],
    ];

  const scrollToCards = () => {
    document.getElementById("agent-cards")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div ref={heroRef} style={{ position: "relative", borderRadius: "var(--radius)", overflow: "hidden", background: "radial-gradient(120% 90% at 88% 4%,#26242F,#16151B 60%,#0E0D12)", color: "#fff", boxShadow: "var(--shadow-xl)", marginBottom: 46 }}>
      <div style={{ position: "absolute", inset: 0, backgroundImage: "radial-gradient(rgba(255,255,255,.055) 1px,transparent 1px)", backgroundSize: "22px 22px", pointerEvents: "none" }} />
      <div style={{ position: "absolute", width: 360, height: 360, borderRadius: "50%", insetInlineStart: -120, top: -140, background: "radial-gradient(circle,rgba(155,127,232,.32),transparent 70%)", pointerEvents: "none" }} />

      <div style={{ position: "relative", display: "grid", gridTemplateColumns: "1.25fr .85fr", gap: 30, padding: 34, alignItems: "center" }}>
        {/* ── text side ── */}
        {heroMode === "empty" && completedDocs === 0 ? (
          <div>
            <div style={{ fontSize: 13.5, color: "rgba(255,255,255,.6)", fontWeight: 600, marginBottom: 12 }}>עוד אין לנו מספיק נתונים</div>
            <div style={{ fontSize: "clamp(26px,3vw,38px)", fontWeight: 900, letterSpacing: "-.03em", lineHeight: 1.15, maxWidth: 420 }}>
              העלו תלוש שכר ראשון — והסוכנים יתחילו לחפש עבורך הזדמנויות לחיסכון.
            </div>
            <button onClick={() => navigate(APP_ROUTES.documentsUpload)} style={{ ...whiteCta, marginTop: 24, cursor: "pointer" }}
              onMouseEnter={e => e.currentTarget.style.transform = "translateY(-2px)"}
              onMouseLeave={e => e.currentTarget.style.transform = "none"}>
              <Upload size={17} strokeWidth={2.4} /> העלאת תלוש ראשון
            </button>
          </div>
        ) : (
          <div>
            <div style={{ fontSize: 13.5, color: "rgba(255,255,255,.6)", fontWeight: 600, marginBottom: 12 }}>
              {heroMode === "money" ? "פוטנציאל החיסכון שזיהינו עד הפרישה" : heroMode === "counts" ? "הזדמנויות פעילות לשיפור" : "הסוכן הראשי מוכן לניתוח"}
            </div>
            <div style={{ fontSize: "clamp(44px,5vw,64px)", fontWeight: 900, letterSpacing: "-.04em", lineHeight: .95, fontVariantNumeric: "tabular-nums", background: "linear-gradient(96deg,#CDB6FF,#F8D2BE 70%,#F6E4A8)", WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent" }}>
              {heroMode === "money" ? nis(total) : heroMode === "counts" ? bigOpportunities : "✓"}
            </div>

            {/* the cross-referenced count rows (the full unified summary gets its
                own emphasized block right below the band) */}
            <div style={{ marginTop: 22, display: "flex", flexDirection: "column", gap: 1, maxWidth: 380 }}>
              {heroRows.map(([k, v]) => (
                <div key={k} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 0", borderBottom: "1px solid rgba(255,255,255,.09)" }}>
                  <span style={{ fontSize: 14, color: "rgba(255,255,255,.7)", fontWeight: 500 }}>{k}</span>
                  <span style={{ fontSize: 15, fontWeight: 800, fontVariantNumeric: "tabular-nums" }}>{v}</span>
                </div>
              ))}
            </div>

            {/* primary CTA — actually runs the full analysis; next to it,
                the last saved report opens instantly (no re-run) */}
            <div style={{ marginTop: 24, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
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
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 9,
                    background: "rgba(255,255,255,.07)",
                    color: "#fff",
                    border: "1px solid rgba(255,255,255,.18)",
                    borderRadius: "var(--r-btn)",
                    padding: "13px 18px",
                    fontFamily: "inherit",
                    fontWeight: 700,
                    fontSize: 13.5,
                    cursor: "pointer",
                    transition: "background .2s var(--ease), transform .2s var(--ease)",
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,.13)"; e.currentTarget.style.transform = "translateY(-2px)"; }}
                  onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,.07)"; e.currentTarget.style.transform = "none"; }}
                >
                  <FileText size={15} strokeWidth={2.2} color="#CDB6FF" />
                  <span>הדוח האחרון</span>
                  <span style={{ fontWeight: 600, color: "rgba(255,255,255,.55)", fontSize: 12.5 }}>
                    {relativeTime(lastReport.savedAt)}
                    {lastReport.score != null ? ` · ציון ${lastReport.score}` : ""}
                  </span>
                </button>
              )}
            </div>

            {/* four tiny per-agent status dots */}
            <div style={{ marginTop: 18, display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
              <span style={{ fontSize: 11.5, color: "rgba(255,255,255,.45)", fontWeight: 700 }}>{statusLine}</span>
              <span style={{ display: "inline-flex", gap: 12 }}>
                {AGENTS.map(a => {
                  const key = AGENT_KEY[a.id];
                  const status = result?.agents?.[key]?.status;
                  const active = phase === "running" || focusKey === key;
                  const dotColor = active
                    ? "#B49BF0"
                    : status === "success" ? "#48C98B"
                      : status === "no_data" || status === "no_profile" || status === "error" ? "#F4A87E"
                        : "rgba(255,255,255,.25)";
                  return (
                    <button
                      key={a.id}
                      onClick={scrollToCards}
                      title={FOCUS_LABEL[key]}
                      style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "none", border: "none", padding: 0, cursor: "pointer", fontFamily: "inherit" }}
                    >
                      <span style={{ width: 8, height: 8, borderRadius: "50%", background: dotColor, boxShadow: status === "success" ? "0 0 0 3px rgba(72,201,139,.15)" : undefined, animation: active ? "fgPulse 1s ease-in-out infinite" : undefined }} />
                      <span style={{ fontSize: 11.5, fontWeight: 700, color: "rgba(255,255,255,.55)" }}>{FOCUS_LABEL[key]}</span>
                    </button>
                  );
                })}
              </span>
            </div>

            {/* error strip */}
            {phase === "error" && (
              <div style={{ marginTop: 16, display: "inline-flex", alignItems: "center", gap: 9, background: "rgba(218,111,68,.13)", border: "1px solid rgba(218,111,68,.3)", borderRadius: "var(--r-md)", padding: "10px 14px", fontSize: 13, fontWeight: 600, color: "#F4A87E" }}>
                <CircleAlert size={15} />
                הניתוח נכשל. ודא שהשרת זמין ונסה שוב.
              </div>
            )}
          </div>
        )}

        {/* ── floating health card — fed directly by result.globalScore ── */}
        <div style={{ background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.12)", borderRadius: "var(--r-md)", backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)", padding: 24, display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
          <div style={{ alignSelf: "stretch", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: 13.5, fontWeight: 800 }}>בריאות פיננסית</span>
            <span style={{ fontSize: 11, fontWeight: 800, color: "#fff", background: score ? "rgba(72,201,139,.28)" : "rgba(255,255,255,.12)", borderRadius: 999, padding: "3px 10px" }}>
              {liveScore ? "מעודכן · הסוכן הראשי" : score ? "לפי הניתוח האחרון" : "ממתין לניתוח"}
            </span>
          </div>
          <RadialGauge
            value={score?.score ?? 0}
            sub={score?.label ?? "טרם חושב"}
            tone="lavender" size={148} onDark
          />
          <div style={{ alignSelf: "stretch", display: "flex", flexDirection: "column", gap: 9, marginTop: 4 }}>
            {healthRows.map(([k, v], i) => (
              <div key={k} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 13 }}>
                <span style={{ color: "rgba(255,255,255,.62)", fontWeight: 500 }}>{k}</span>
                <span style={{ fontWeight: 800, color: ["var(--mint-ink)", "var(--lav-300)", "var(--peach)"][i], fontVariantNumeric: "tabular-nums" }}>
                  {v == null ? "—" : `${v}%`}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
