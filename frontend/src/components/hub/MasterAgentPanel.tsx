import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  BrainCircuit,
  Calculator,
  CheckCircle2,
  CircleAlert,
  CircleDashed,
  FileSpreadsheet,
  ListChecks,
  Play,
  Plus,
  Send,
  Sparkles,
  Upload,
  Zap,
} from "lucide-react";
import {
  runFullAnalysis,
  type AgentResult,
  type FullAnalysisRecommendation,
  type FullAnalysisResponse,
} from "../../api/fullAnalysis.api";
import { askAgent } from "../../api/agents.api";
import { AGENTS, type AgentId, type AgentDef } from "../../theme/agents";
import { APP_ROUTES } from "../../types/navigation";
import AgentSyncOverlay, { type SyncStage } from "./AgentSyncOverlay";
import AgentFocusOverlay, { type FocusStage } from "./AgentFocusOverlay";
import DebateArena from "./DebateArena";

/* ============================================================
   Master Agent Panel — the Hub's mission-control console.
   One master agent (the orchestrator) runs the three domain
   agents in parallel via POST /api/ai/full-analysis, then
   cross-references their outputs: action items, verdicts,
   global score and a unified Hebrew summary.

   Per-agent controls: each lane can be run on its own
   (focus=payslip|insurance|pension) and exposes a domain
   quick-action. The command chat talks to the agent router
   (POST /api/agents/ask) and can hand tasks back to the
   panel — a chat answer classified to a domain offers a
   one-click focused run of that agent.
   ============================================================ */

type BackendAgentKey = "payslip" | "insurance" | "pension";

const AGENT_KEY: Record<AgentId, BackendAgentKey> = {
  payslips: "payslip",
  insurance: "insurance",
  pension: "pension",
  expenses: "payslip",
};

const DOMAIN_TO_AGENT: Record<string, AgentId> = {
  payslip: "payslips",
  insurance: "insurance",
  pension: "pension",
};

/** Chat router classifications (services/agents/orchestrator.js) → panel focus. */
const CLASSIFICATION_TO_FOCUS: Record<string, BackendAgentKey> = {
  payslip_analysis: "payslip",
  financial_analysis: "payslip",
  insurance_benefits: "insurance",
  pension_advisor: "pension",
  financial_planning: "pension",
};

const CLASSIFICATION_LABEL: Record<string, string> = {
  payslip_analysis: "סוכן תלושים",
  financial_analysis: "סוכן ניתוח פיננסי",
  insurance_benefits: "סוכן ביטוחים",
  pension_advisor: "סוכן פנסיה",
  financial_planning: "סוכן תכנון פיננסי",
  general: "הסוכן הראשי",
};

const FOCUS_LABEL: Record<BackendAgentKey, string> = {
  payslip: "תלושים",
  insurance: "ביטוחים",
  pension: "פנסיה",
};

type Phase = "idle" | "running" | "done" | "error";

type ChatMsg = {
  role: "user" | "assistant";
  content: string;
  agentLabel?: string;
  taskFocus?: BackendAgentKey | null;
  isError?: boolean;
};

const QUICK_PROMPTS = [
  "מה מצב התלושים שלי?",
  "יש לי כפל ביטוחי?",
  "כמה אצבור לפנסיה?",
];

/** localStorage key for the persisted command-chat transcript. */
const CHAT_STORAGE_KEY = "fg_hub_agent_chat";

/** Blended accent of all three agents (lavender → peach → mint), used to frame
 *  the unified summary as "all agents together". */
const AGENT_GRADIENT = "linear-gradient(90deg,#B49BF0 0%,#F4A87E 52%,#48C98B 100%)";

/** Map a merged recommendation's agentId to a display tag. */
function recAgentTag(agentId: string): { label: string; color: string } {
  const aid = DOMAIN_TO_AGENT[agentId];
  if (aid) {
    const def = AGENTS.find(a => a.id === aid);
    if (def) return { label: def.label, color: def.tone.accent };
  }
  return { label: "פרופיל", color: "var(--lav-300)" };
}

const nis = (n: number) => "₪" + Math.round(n).toLocaleString("en-US");

function asNumber(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}
function asString(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v : null;
}

/** Pull the 2-3 headline stats each agent should surface on its lane. */
function agentStats(id: AgentId, result: AgentResult | undefined): Array<{ k: string; v: string }> {
  const d = (result?.data ?? {}) as Record<string, unknown>;
  const stats: Array<{ k: string; v: string }> = [];

  if (id === "payslips") {
    const count = asNumber(d.payslipCount);
    const gross = asNumber(d.latestGross);
    const trend = (d.trend ?? null) as { trend?: string; changePct?: number } | null;
    if (count != null) stats.push({ k: "תלושים מנותחים", v: String(count) });
    if (gross != null) stats.push({ k: "ברוטו אחרון", v: nis(gross) });
    if (trend?.trend && trend.trend !== "stable" && typeof trend.changePct === "number") {
      stats.push({ k: "מגמת שכר", v: `${trend.changePct > 0 ? "+" : ""}${trend.changePct}%` });
    }
  }

  if (id === "insurance") {
    const policies = asNumber(d.policyCount);
    const dups = asNumber(d.duplicateCount);
    const waste = asNumber(d.totalMonthlyWaste);
    if (policies != null) stats.push({ k: "פוליסות", v: String(policies) });
    if (dups != null && dups > 0) stats.push({ k: "כפילויות", v: String(dups) });
    if (waste != null && waste > 0) stats.push({ k: "בזבוז חודשי", v: nis(waste) });
  }

  if (id === "pension") {
    const monthly = asNumber(d.totalMonthlyContribution);
    const projection = (d.projection ?? null) as { monthlyPensionEstimate?: number } | null;
    const health = (d.healthCheck ?? null) as { score?: number } | null;
    if (monthly != null) stats.push({ k: "הפקדה חודשית", v: nis(monthly) });
    if (typeof projection?.monthlyPensionEstimate === "number") {
      stats.push({ k: "קצבה חזויה", v: nis(projection.monthlyPensionEstimate) });
    }
    if (typeof health?.score === "number") stats.push({ k: "ציון פנסיה", v: `${health.score}` });
  }

  return stats.slice(0, 3);
}

/** Domain verdict (pension LEAVE/NEGOTIATE/SWITCH · insurance STAY/REVIEW/SWITCH). */
function agentVerdict(id: AgentId, result: AgentResult | undefined): string | null {
  const d = (result?.data ?? {}) as Record<string, unknown>;
  if (id === "pension") {
    const advice = (d.fundAdvice ?? null) as { overallVerdictLabelHe?: string } | null;
    return asString(advice?.overallVerdictLabelHe);
  }
  if (id === "insurance") {
    const advice = (d.marketAdvice ?? null) as { overallVerdictLabelHe?: string } | null;
    return asString(advice?.overallVerdictLabelHe);
  }
  return null;
}

/** Domain quick-action per agent (navigation into the domain flow). */
function agentQuickAction(id: AgentId): { label: string; Icon: typeof Upload; route: string } {
  if (id === "payslips") return { label: "העלה תלוש", Icon: Upload, route: APP_ROUTES.documentsUpload };
  if (id === "insurance") return { label: "ייבוא הר הביטוח", Icon: FileSpreadsheet, route: APP_ROUTES.insurance };
  if (id === "expenses") return { label: "עדכון הוצאות", Icon: Upload, route: APP_ROUTES.expenses };
  return { label: "סימולציית פרישה", Icon: Calculator, route: APP_ROUTES.pension };
}

const SOURCE_LABEL: Record<string, string> = {
  claude: "נוסח על-ידי Claude",
  rule: "סיכום מבוסס כללים",
  fallback: "סיכום מבוסס כללים",
  demo: "מצב הדגמה",
};

const PRIORITY_STYLE: Record<string, { bg: string; color: string; label: string }> = {
  high: { bg: "rgba(218,111,68,.16)", color: "#F4A87E", label: "דחוף" },
  medium: { bg: "rgba(155,127,232,.16)", color: "#B49BF0", label: "חשוב" },
  low: { bg: "rgba(72,201,139,.14)", color: "#48C98B", label: "כדאי" },
};

const laneButtonStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  background: "rgba(255,255,255,.08)",
  color: "#fff",
  border: "1px solid rgba(255,255,255,.15)",
  borderRadius: 9,
  padding: "7px 12px",
  fontFamily: "inherit",
  fontWeight: 700,
  fontSize: 12,
  cursor: "pointer",
  transition: "background .2s var(--ease)",
};

type MasterAgentPanelProps = {
  /** Notified with the full analysis result when a run completes.
   *  The Hub uses this to feed the shared financial-health card. */
  onResult?: (result: FullAnalysisResponse) => void;
};

/** Imperative handle so the Hub's health-card CTA can trigger a full run. */
export type MasterAgentPanelHandle = { runFull: () => void };

const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms));

/** Overlay timing: hold the animation a readable minimum, then play the exit. */
const SYNC_MIN_MS = 3400;
const SYNC_EXIT_MS = 1000;
const FOCUS_MIN_MS = 2600;
const FOCUS_EXIT_MS = 800;

function loadChat(): ChatMsg[] {
  try {
    const raw = localStorage.getItem(CHAT_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

const MasterAgentPanel = forwardRef<MasterAgentPanelHandle, MasterAgentPanelProps>(function MasterAgentPanel({ onResult }, ref) {
  const navigate = useNavigate();
  const [phase, setPhase] = useState<Phase>("idle");
  const [focusKey, setFocusKey] = useState<BackendAgentKey | null>(null);
  const [result, setResult] = useState<FullAnalysisResponse | null>(null);
  const [syncStage, setSyncStage] = useState<SyncStage | null>(null);
  const [focusStage, setFocusStage] = useState<FocusStage | null>(null);

  // ── command chat state (persisted to localStorage) ──────────
  const [chatMessages, setChatMessages] = useState<ChatMsg[]>(loadChat);
  const [chatInput, setChatInput] = useState("");
  const [chatBusy, setChatBusy] = useState(false);
  const chatListRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatListRef.current?.scrollTo({ top: chatListRef.current.scrollHeight, behavior: "smooth" });
  }, [chatMessages, chatBusy]);

  // Persist the transcript (keep the last 50 messages).
  useEffect(() => {
    try {
      localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(chatMessages.slice(-50)));
    } catch { /* storage full / unavailable — non-fatal */ }
  }, [chatMessages]);

  const handleNewChat = useCallback(() => {
    setChatMessages([]);
    try { localStorage.removeItem(CHAT_STORAGE_KEY); } catch { /* non-fatal */ }
  }, []);

  const busy = phase === "running" || focusKey !== null;

  /** Merge an analysis response into panel state.
   *  A focused run refreshes only its own lane + the global score;
   *  the cross-referenced synthesis stays from the last full run. */
  const applyResult = useCallback((data: FullAnalysisResponse, focus?: BackendAgentKey) => {
    setResult(prev => {
      // Full run — take everything, including the LLM-generated unified summary.
      if (!focus) return data;
      // Focused run with no prior full run — show the agent's data but strip any
      // summary, so the unified summary never appears without a full analysis.
      if (!prev) return { ...data, summary: undefined };
      // Focused run after a full run — refresh only this agent's lane + the global
      // score; keep the last full-run summary untouched.
      return {
        ...prev,
        globalScore: data.globalScore ?? prev.globalScore,
        meta: data.meta ?? prev.meta,
        agents: prev.agents || data.agents
          ? ({ ...(prev.agents ?? {}), ...(data.agents?.[focus] ? { [focus]: data.agents[focus] } : {}) } as FullAnalysisResponse["agents"])
          : undefined,
      };
    });
    onResult?.(data);
  }, [onResult]);

  const handleRun = useCallback(async () => {
    setPhase("running");
    setSyncStage("enter");
    const startedAt = Date.now();

    const res = await runFullAnalysis({});

    // Hold the 3D sync scene for a minimum beat, then play the exit
    // (satellites converge into the core, core bursts, overlay fades).
    await sleep(Math.max(0, SYNC_MIN_MS - (Date.now() - startedAt)));
    setSyncStage("exit");
    await sleep(SYNC_EXIT_MS);
    setSyncStage(null);

    // Only now — back in the Hub — reveal the results.
    if (res.ok && res.data) {
      applyResult(res.data);
      setPhase("done");
    } else {
      setPhase("error");
    }
  }, [applyResult]);

  // Let the Hub's health-card CTA kick off a full run.
  useImperativeHandle(ref, () => ({ runFull: () => { void handleRun(); } }), [handleRun]);

  /** Run a single agent (focused analysis) from its lane controls or a chat task.
   *  Shows the solo-mission overlay for just this agent while it works. */
  const handleFocusRun = useCallback(async (key: BackendAgentKey) => {
    setFocusKey(key);
    setFocusStage("enter");
    const startedAt = Date.now();

    // Focused run: skipLLM so no model credit is spent — only the agent's own
    // (rule-based) data. The unified LLM summary is reserved for a full run.
    const res = await runFullAnalysis({ focus: key, skipLLM: true });

    await sleep(Math.max(0, FOCUS_MIN_MS - (Date.now() - startedAt)));
    setFocusStage("exit");
    await sleep(FOCUS_EXIT_MS);
    setFocusStage(null);

    if (res.ok && res.data) {
      applyResult(res.data, key);
      setPhase(p => (p === "idle" || p === "error" ? "done" : p));
    }
    setFocusKey(null);
  }, [applyResult]);

  /** Send a chat message to the agent router; classified answers become tasks. */
  const handleChatSend = useCallback(async (text?: string) => {
    const message = (text ?? chatInput).trim();
    if (!message || chatBusy) return;
    setChatInput("");
    setChatMessages(prev => [...prev, { role: "user", content: message }]);
    setChatBusy(true);

    const history = chatMessages.slice(-6).map(m => ({ role: m.role, content: m.content }));
    const res = await askAgent(message, history);

    if (res.ok && res.data?.data?.answer) {
      const { answer, classification } = res.data.data;
      setChatMessages(prev => [...prev, {
        role: "assistant",
        content: answer,
        agentLabel: CLASSIFICATION_LABEL[classification] ?? "הסוכן הראשי",
        taskFocus: CLASSIFICATION_TO_FOCUS[classification] ?? null,
      }]);
    } else {
      setChatMessages(prev => [...prev, {
        role: "assistant",
        content: "לא הצלחתי להגיע לסוכנים כרגע. נסה שוב בעוד רגע.",
        isError: true,
      }]);
    }
    setChatBusy(false);
  }, [chatInput, chatBusy, chatMessages]);

  const statusLine = useMemo(() => {
    if (phase === "running") return "מריץ שלושה סוכנים במקביל ומצליב תוצאות...";
    if (focusKey) return `מריץ את סוכן ה${FOCUS_LABEL[focusKey]} בלבד...`;
    if (phase === "done" && result?.meta) {
      const secs = (result.meta.durationMs / 1000).toFixed(1);
      return `הניתוח הושלם · ${result.meta.successCount}/${result.meta.agentCount} סוכנים · ${secs} שניות`;
    }
    if (phase === "error") return "הניתוח נכשל — נסה שוב בעוד רגע.";
    return "שלושה סוכנים מחכים לפקודה. הרצה אחת — תמונה מלאה.";
  }, [phase, focusKey, result]);

  const actionItems = result?.actionItems ?? [];
  const recommendations: FullAnalysisRecommendation[] = result?.recommendations ?? [];
  const summarySource = result?.summarySource ? SOURCE_LABEL[result.summarySource] : null;

  return (
    <section style={{ marginBottom: 46 }}>
      {/* full-screen 3D sync sequence while all agents run together */}
      {syncStage && <AgentSyncOverlay stage={syncStage} />}
      {/* solo-mission sequence while a single agent runs a focused task */}
      {focusStage && focusKey && <AgentFocusOverlay agentId={DOMAIN_TO_AGENT[focusKey]} stage={focusStage} />}
      <style>{`
        @keyframes fgScan { 0% { transform: translateX(120%); } 100% { transform: translateX(-120%); } }
        @keyframes fgPulse { 0%,100% { opacity: .45; } 50% { opacity: 1; } }
        @keyframes fgRise { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }
        @keyframes fgSpin { to { transform: rotate(360deg); } }
        @keyframes fgBlink { 0%,100% { opacity: .3; } 50% { opacity: 1; } }
      `}</style>

      {/* headline */}
      <div style={{ textAlign: "center", marginBottom: 26 }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 12.5, fontWeight: 800, letterSpacing: ".12em", color: "var(--lav-600)" }}>
          <Sparkles size={18} color="var(--lav-500)" />
          הסוכן הראשי
        </span>
        <h2 style={{ margin: "10px 0 0", fontSize: "clamp(26px,3vw,36px)", fontWeight: 900, letterSpacing: "-.03em", color: "var(--text-strong)" }}>
          סוכן ראשי אחד. שלושה מומחים. תמונה אחת.
        </h2>
        <p style={{ margin: "12px auto 0", maxWidth: 520, fontSize: 16, color: "var(--text-muted)", fontWeight: 500, lineHeight: 1.55 }}>
          הסוכן הראשי מפעיל את סוכני התלושים, הביטוח והפנסיה במקביל — ומצליב את כל הממצאים לדוח מאוחד.
        </p>
      </div>

      {/* console */}
      <div style={{ position: "relative", borderRadius: "var(--radius)", overflow: "hidden", background: "radial-gradient(120% 90% at 12% 0%,#26242F,#16151B 60%,#0E0D12)", color: "#fff", boxShadow: "var(--shadow-xl)" }}>
        <div style={{ position: "absolute", inset: 0, backgroundImage: "radial-gradient(rgba(255,255,255,.05) 1px,transparent 1px)", backgroundSize: "22px 22px", pointerEvents: "none" }} />
        <div style={{ position: "absolute", width: 340, height: 340, borderRadius: "50%", insetInlineEnd: -120, top: -150, background: "radial-gradient(circle,rgba(155,127,232,.28),transparent 70%)", pointerEvents: "none" }} />

        <div style={{ position: "relative", padding: "28px 30px 30px" }}>
          {/* console header — the master agent */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap", marginBottom: 24 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <span style={{ position: "relative", width: 46, height: 46, borderRadius: 14, background: "linear-gradient(135deg,#9B7FE8,#6F8BE8)", display: "grid", placeItems: "center", boxShadow: "0 6px 18px rgba(124,95,214,.4)" }}>
                <BrainCircuit size={24} strokeWidth={1.9} />
                {busy && (
                  <span style={{ position: "absolute", inset: -4, borderRadius: 17, border: "2px solid rgba(155,127,232,.5)", animation: "fgPulse 1.2s ease-in-out infinite" }} />
                )}
              </span>
              <div>
                <div style={{ fontWeight: 900, fontSize: 17, letterSpacing: "-.02em" }}>הסוכן הראשי של FinGuide</div>
                <div style={{ fontSize: 13, color: "rgba(255,255,255,.62)", fontWeight: 500, marginTop: 2, display: "flex", alignItems: "center", gap: 7 }}>
                  <span style={{ width: 7, height: 7, borderRadius: "50%", flex: "none", background: phase === "error" ? "#F4A87E" : "#48C98B", boxShadow: "0 0 0 3px rgba(72,201,139,.15)", animation: busy ? "fgPulse 1s ease-in-out infinite" : undefined }} />
                  {statusLine}
                </div>
              </div>
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button
                onClick={() => handleRun()}
                disabled={busy}
                style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "#fff", color: "var(--ink)", border: "none", borderRadius: "var(--r-btn)", padding: "12px 22px", fontFamily: "inherit", fontWeight: 800, fontSize: 14.5, cursor: busy ? "not-allowed" : "pointer", opacity: busy ? 0.7 : 1, transition: "transform .2s var(--ease)" }}
                onMouseEnter={e => { if (!busy) e.currentTarget.style.transform = "translateY(-2px)"; }}
                onMouseLeave={e => { e.currentTarget.style.transform = "none"; }}
              >
                {phase === "running"
                  ? <><CircleDashed size={16} style={{ animation: "fgSpin 1s linear infinite" }} /> מנתח...</>
                  : <><Play size={16} strokeWidth={2.4} /> הרץ ניתוח מלא</>}
              </button>
            </div>
          </div>

          {/* three agent lanes — each with its own controls */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(250px,1fr))", gap: 14 }}>
            {AGENTS.map((a: AgentDef, i: number) => {
              const key = AGENT_KEY[a.id];
              const agentResult = result?.agents?.[key];
              const laneRunning = phase === "running" || focusKey === key;
              const Icon = a.Icon;
              const stats = agentStats(a.id, agentResult);
              const verdict = agentVerdict(a.id, agentResult);
              const status = agentResult?.status;
              const quick = agentQuickAction(a.id);

              return (
                <div
                  key={a.id}
                  style={{ position: "relative", overflow: "hidden", display: "flex", flexDirection: "column", background: "rgba(255,255,255,.05)", border: "1px solid rgba(255,255,255,.11)", borderRadius: "var(--r-md)", padding: 18, color: "#fff" }}
                >
                  {laneRunning && (
                    <span style={{ position: "absolute", inset: 0, background: "linear-gradient(100deg,transparent 30%,rgba(255,255,255,.09) 50%,transparent 70%)", animation: `fgScan 1.4s ${i * 0.35}s ease-in-out infinite`, pointerEvents: "none" }} />
                  )}
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 13 }}>
                    <button
                      onClick={() => navigate(a.route)}
                      style={{ display: "inline-flex", alignItems: "center", gap: 10, background: "none", border: "none", padding: 0, cursor: "pointer", fontFamily: "inherit", color: "#fff" }}
                      title={`מעבר לעמוד ${a.label}`}
                    >
                      <span style={{ width: 36, height: 36, borderRadius: 10, background: a.tone.soft, color: a.tone.accent, display: "grid", placeItems: "center" }}>
                        <Icon size={19} strokeWidth={1.9} />
                      </span>
                      <span style={{ fontWeight: 800, fontSize: 15, letterSpacing: "-.01em" }}>{a.label}</span>
                    </button>
                    {/* status chip */}
                    {laneRunning ? (
                      <span style={{ fontSize: 11.5, fontWeight: 700, color: "rgba(255,255,255,.75)", display: "inline-flex", alignItems: "center", gap: 6 }}>
                        <CircleDashed size={13} style={{ animation: "fgSpin 1s linear infinite" }} /> מנתח
                      </span>
                    ) : status === "success" ? (
                      <span style={{ fontSize: 11.5, fontWeight: 700, color: "#48C98B", display: "inline-flex", alignItems: "center", gap: 5 }}>
                        <CheckCircle2 size={13} /> הושלם
                      </span>
                    ) : status === "no_data" || status === "no_profile" ? (
                      <span style={{ fontSize: 11.5, fontWeight: 700, color: "#F4A87E", display: "inline-flex", alignItems: "center", gap: 5 }}>
                        <CircleAlert size={13} /> חסרים נתונים
                      </span>
                    ) : status === "error" ? (
                      <span style={{ fontSize: 11.5, fontWeight: 700, color: "#F4A87E", display: "inline-flex", alignItems: "center", gap: 5 }}>
                        <CircleAlert size={13} /> שגיאה
                      </span>
                    ) : (
                      <span style={{ fontSize: 11.5, fontWeight: 700, color: "rgba(255,255,255,.45)" }}>בהמתנה</span>
                    )}
                  </div>

                  {/* lane body */}
                  <div style={{ flex: 1 }}>
                    {status === "success" && stats.length > 0 ? (
                      <div style={{ display: "flex", flexDirection: "column", gap: 7, animation: "fgRise .5s var(--ease) both" }}>
                        {stats.map(s => (
                          <div key={s.k} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 13, borderBottom: "1px solid rgba(255,255,255,.07)", paddingBottom: 7 }}>
                            <span style={{ color: "rgba(255,255,255,.6)", fontWeight: 500 }}>{s.k}</span>
                            <span style={{ fontWeight: 800, fontVariantNumeric: "tabular-nums" }}>{s.v}</span>
                          </div>
                        ))}
                        {verdict && (
                          <div style={{ marginTop: 3, display: "inline-flex", alignSelf: "flex-start", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 800, color: a.tone.accent, background: "rgba(255,255,255,.07)", borderRadius: 999, padding: "4px 11px" }}>
                            פסק דין: {verdict}
                          </div>
                        )}
                        {agentResult && agentResult.recommendationCount > 0 && (
                          <div style={{ fontSize: 12, color: "rgba(255,255,255,.55)", fontWeight: 600 }}>
                            {agentResult.recommendationCount} המלצות · {(agentResult.durationMs / 1000).toFixed(1)}s
                          </div>
                        )}
                      </div>
                    ) : status === "no_data" || status === "no_profile" ? (
                      <div style={{ fontSize: 13, color: "rgba(255,255,255,.6)", lineHeight: 1.5, animation: "fgRise .5s var(--ease) both" }}>
                        {agentResult?.message || "אין מספיק נתונים לניתוח בתחום זה."}
                      </div>
                    ) : (
                      <div style={{ fontSize: 13, color: "rgba(255,255,255,.5)", lineHeight: 1.5 }}>
                        {a.sub} · {laneRunning ? "אוסף נתונים ומחשב..." : "מוכן לפקודה"}
                      </div>
                    )}
                  </div>

                  {/* lane controls — run this agent alone + domain quick action */}
                  <div style={{ display: "flex", gap: 8, marginTop: 14, paddingTop: 12, borderTop: "1px solid rgba(255,255,255,.08)" }}>
                    <button
                      onClick={() => handleFocusRun(key)}
                      disabled={busy}
                      style={{ ...laneButtonStyle, background: a.tone.soft, color: a.tone.strong, border: "none", fontWeight: 800, opacity: busy ? 0.55 : 1, cursor: busy ? "not-allowed" : "pointer" }}
                      title={`הרץ רק את סוכן ה${FOCUS_LABEL[key]}`}
                    >
                      {focusKey === key
                        ? <CircleDashed size={13} style={{ animation: "fgSpin 1s linear infinite" }} />
                        : <Zap size={13} strokeWidth={2.4} />}
                      נתח עכשיו
                    </button>
                    <button
                      onClick={() => navigate(quick.route)}
                      style={laneButtonStyle}
                      onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,.14)"; }}
                      onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,.08)"; }}
                    >
                      <quick.Icon size={13} /> {quick.label}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          <DebateArena disabled={busy} />

          {/* synthesis — the master agent's cross-referenced output */}
          {result && (
            <div style={{ marginTop: 18, display: "grid", gridTemplateColumns: actionItems.length > 0 ? "1.05fr .95fr" : "1fr", gap: 14, animation: "fgRise .6s .15s var(--ease) both" }}>
              {/* cross-referenced action items */}
              {actionItems.length > 0 && (
                <div style={{ background: "rgba(255,255,255,.05)", border: "1px solid rgba(255,255,255,.11)", borderRadius: "var(--r-md)", padding: 20 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                    <span style={{ fontWeight: 900, fontSize: 15 }}>הצלבת הסוכן הראשי — פעולות מומלצות</span>
                    <button onClick={() => navigate(APP_ROUTES.financialHealth)} style={{ display: "inline-flex", alignItems: "center", gap: 4, background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", fontSize: 12.5, fontWeight: 700, color: "rgba(255,255,255,.65)" }}>
                      לכל הממצאים <ArrowLeft size={14} strokeWidth={2.4} />
                    </button>
                  </div>

                  {/* framed by a gentle gradient of all three agent colours.
                      (Financial-health score is shown in the Hub's shared health card.) */}
                  <div style={{ background: AGENT_GRADIENT, borderRadius: "calc(var(--r-md) + 1px)", padding: 1.5, boxShadow: "0 0 30px rgba(155,127,232,.14)", marginBottom: 14 }}>
                    <div style={{ background: "linear-gradient(180deg,rgba(38,36,47,.96),rgba(20,19,26,.98))", borderRadius: "var(--r-md)", padding: 20, display: "flex", flexDirection: "column", gap: 12 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <span style={{ flex: "none", width: 34, height: 34, borderRadius: 10, background: AGENT_GRADIENT, display: "grid", placeItems: "center", color: "#1a1820" }}>
                          <Sparkles size={17} strokeWidth={2.2} />
                        </span>
                        <div>
                          <div style={{ fontWeight: 900, fontSize: 15 }}>סיכום מאוחד</div>
                          <div style={{ fontSize: 12.5, color: "rgba(255,255,255,.6)", fontWeight: 600, marginTop: 2 }}>
                            {summarySource ?? "כל הסוכנים בדוח אחד"}
                            {result.globalScore?.score != null ? ` · ציון ${result.globalScore.score}/100` : ""}
                          </div>
                        </div>
                      </div>
                      <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.65, color: "rgba(255,255,255,.85)", fontWeight: 500, whiteSpace: "pre-line", borderInlineStart: "3px solid transparent", borderImage: `${AGENT_GRADIENT} 1`, paddingInlineStart: 14 }}>
                        {result.summary}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* two rubrics: cross-referenced action items · agent recommendations */}
              <div style={{ display: "grid", gridTemplateColumns: actionItems.length > 0 && recommendations.length > 0 ? "1fr 1fr" : "1fr", gap: 14 }}>
                {actionItems.length > 0 && (
                  <div style={{ background: "rgba(255,255,255,.05)", border: "1px solid rgba(255,255,255,.11)", borderRadius: "var(--r-md)", padding: 20 }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 8, fontWeight: 900, fontSize: 15 }}>
                        <Zap size={15} color="#F4A87E" /> פעולות דחופות
                      </span>
                      <span style={{ fontSize: 11.5, fontWeight: 700, color: "rgba(255,255,255,.5)" }}>{actionItems.length}</span>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
                      {actionItems.slice(0, 4).map((item, i) => {
                        const p = PRIORITY_STYLE[item.priority] ?? PRIORITY_STYLE.medium;
                        const agentId = DOMAIN_TO_AGENT[item.domain];
                        const domainDef = agentId ? AGENTS.find(x => x.id === agentId) : null;
                        return (
                          <button
                            key={`${item.domain}-${item.title}`}
                            onClick={() => item.actionUrl && navigate(item.actionUrl)}
                            style={{ display: "flex", alignItems: "flex-start", gap: 11, textAlign: "start", fontFamily: "inherit", cursor: item.actionUrl ? "pointer" : "default", background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.08)", borderRadius: 12, padding: "11px 14px", color: "#fff", animation: `fgRise .45s ${0.15 + i * 0.08}s var(--ease) both` }}
                          >
                            <span style={{ flex: "none", marginTop: 1, fontSize: 10.5, fontWeight: 800, borderRadius: 999, padding: "3px 9px", background: p.bg, color: p.color }}>{p.label}</span>
                            <span style={{ flex: 1, minWidth: 0 }}>
                              <span style={{ display: "block", fontWeight: 800, fontSize: 13.5 }}>{item.title}</span>
                              {item.description && <span style={{ display: "block", fontSize: 12, color: "rgba(255,255,255,.58)", marginTop: 2, lineHeight: 1.45 }}>{item.description}</span>}
                            </span>
                            {domainDef && (
                              <span style={{ flex: "none", fontSize: 10.5, fontWeight: 800, color: domainDef.tone.accent, background: "rgba(255,255,255,.07)", borderRadius: 999, padding: "3px 9px" }}>{domainDef.label}</span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* recommendations rubric — merged per-agent recommendations (result.recommendations) */}
                {recommendations.length > 0 && (
                  <div style={{ background: "rgba(255,255,255,.05)", border: "1px solid rgba(255,255,255,.11)", borderRadius: "var(--r-md)", padding: 20 }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 8, fontWeight: 900, fontSize: 15 }}>
                        <ListChecks size={15} color="#B49BF0" /> המלצות הסוכנים
                      </span>
                      <span style={{ fontSize: 11.5, fontWeight: 700, color: "rgba(255,255,255,.5)" }}>{recommendations.length}</span>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
                      {recommendations.slice(0, 5).map((rec, i) => {
                        const p = PRIORITY_STYLE[rec.urgency] ?? PRIORITY_STYLE.medium;
                        const tag = recAgentTag(rec.agentId);
                        return (
                          <div
                            key={`${rec.agentId}-${rec.type}-${i}`}
                            style={{ display: "flex", alignItems: "flex-start", gap: 11, background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.08)", borderRadius: 12, padding: "11px 14px", color: "#fff", animation: `fgRise .45s ${0.15 + i * 0.08}s var(--ease) both` }}
                          >
                            <span style={{ flex: "none", marginTop: 1, fontSize: 10.5, fontWeight: 800, borderRadius: 999, padding: "3px 9px", background: p.bg, color: p.color }}>{p.label}</span>
                            <span style={{ flex: 1, minWidth: 0 }}>
                              <span style={{ display: "block", fontWeight: 800, fontSize: 13.5 }}>{rec.title}</span>
                              {rec.financialImpact && (
                                <span style={{ display: "block", fontSize: 12, color: "#48C98B", fontWeight: 700, marginTop: 3 }}>💰 {rec.financialImpact}</span>
                              )}
                              {!rec.financialImpact && rec.reason && (
                                <span style={{ display: "block", fontSize: 12, color: "rgba(255,255,255,.58)", marginTop: 2, lineHeight: 1.45 }}>{rec.reason}</span>
                              )}
                            </span>
                            <span style={{ flex: "none", display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
                              <span style={{ fontSize: 10.5, fontWeight: 800, color: tag.color, background: "rgba(255,255,255,.07)", borderRadius: 999, padding: "3px 9px", whiteSpace: "nowrap" }}>{tag.label}</span>
                              {typeof rec.confidenceScore === "number" && (
                                <span style={{ fontSize: 10.5, fontWeight: 700, color: "rgba(255,255,255,.45)" }}>{rec.confidenceScore}%</span>
                              )}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* error strip */}
          {phase === "error" && (
            <div style={{ marginTop: 16, display: "flex", alignItems: "center", gap: 9, background: "rgba(218,111,68,.13)", border: "1px solid rgba(218,111,68,.3)", borderRadius: "var(--r-md)", padding: "12px 16px", fontSize: 13.5, fontWeight: 600, color: "#F4A87E" }}>
              <CircleAlert size={16} />
              הניתוח נכשל. ודא שהשרת זמין ונסה שוב.
            </div>
          )}

          {/* ── command chat — talk to the agents, hand out tasks ── */}
          <div id="agent-chat" style={{ marginTop: 18, background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.1)", borderRadius: "var(--r-md)", overflow: "hidden", scrollMarginTop: 90 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 18px", borderBottom: chatMessages.length > 0 || chatBusy ? "1px solid rgba(255,255,255,.08)" : "none" }}>
              <span style={{ width: 30, height: 30, borderRadius: 9, background: "rgba(155,127,232,.2)", color: "#B49BF0", display: "grid", placeItems: "center" }}>
                <BrainCircuit size={16} strokeWidth={2} />
              </span>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 800, fontSize: 14 }}>דבר עם הסוכנים</div>
                <div style={{ fontSize: 11.5, color: "rgba(255,255,255,.55)", fontWeight: 600 }}>שאל שאלה — הסוכן הראשי ינתב אותה למומחה הנכון ויציע משימה</div>
              </div>
              {/* new-chat: clears the saved transcript */}
              {chatMessages.length > 0 && (
                <button
                  onClick={handleNewChat}
                  disabled={chatBusy}
                  title="התחל צ'אט חדש — מוחק את ההיסטוריה"
                  style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "rgba(255,255,255,.06)", color: "rgba(255,255,255,.8)", border: "1px solid rgba(255,255,255,.14)", borderRadius: 999, padding: "6px 13px", fontFamily: "inherit", fontWeight: 700, fontSize: 12, cursor: chatBusy ? "not-allowed" : "pointer", opacity: chatBusy ? 0.5 : 1, whiteSpace: "nowrap" }}
                >
                  <Plus size={13} strokeWidth={2.6} /> צ'אט חדש
                </button>
              )}
            </div>

            {/* quick prompts — only when the chat is empty, to seed a conversation */}
            {chatMessages.length === 0 && !chatBusy && (
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", padding: "0 18px 12px" }}>
                {QUICK_PROMPTS.map(q => (
                  <button
                    key={q}
                    onClick={() => handleChatSend(q)}
                    style={{ background: "rgba(255,255,255,.06)", color: "rgba(255,255,255,.75)", border: "1px solid rgba(255,255,255,.13)", borderRadius: 999, padding: "5px 12px", fontFamily: "inherit", fontWeight: 700, fontSize: 11.5, cursor: "pointer" }}
                  >
                    {q}
                  </button>
                ))}
              </div>
            )}

            {/* message list */}
            {(chatMessages.length > 0 || chatBusy) && (
              <div ref={chatListRef} style={{ maxHeight: 300, overflowY: "auto", padding: "14px 18px", display: "flex", flexDirection: "column", gap: 10 }}>
                {chatMessages.map((m, i) => (
                  <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: m.role === "user" ? "flex-end" : "flex-start", animation: "fgRise .35s var(--ease) both" }}>
                    {m.role === "assistant" && m.agentLabel && (
                      <span style={{ fontSize: 10.5, fontWeight: 800, color: "#B49BF0", marginBottom: 4, display: "inline-flex", alignItems: "center", gap: 5 }}>
                        <Sparkles size={11} /> {m.agentLabel}
                      </span>
                    )}
                    <div style={{
                      maxWidth: "78%",
                      padding: "10px 14px",
                      borderRadius: m.role === "user" ? "14px 14px 4px 14px" : "14px 14px 14px 4px",
                      background: m.role === "user" ? "linear-gradient(135deg,rgba(155,127,232,.32),rgba(111,139,232,.24))" : m.isError ? "rgba(218,111,68,.14)" : "rgba(255,255,255,.07)",
                      border: m.isError ? "1px solid rgba(218,111,68,.3)" : "1px solid rgba(255,255,255,.08)",
                      fontSize: 13.5, lineHeight: 1.6, fontWeight: 500,
                      color: m.isError ? "#F4A87E" : "rgba(255,255,255,.88)",
                      whiteSpace: "pre-line",
                    }}>
                      {m.content}
                    </div>
                    {/* task hand-off: the chat assigns work to a panel agent */}
                    {m.role === "assistant" && m.taskFocus && (
                      <button
                        onClick={() => handleFocusRun(m.taskFocus as BackendAgentKey)}
                        disabled={busy}
                        style={{ marginTop: 6, display: "inline-flex", alignItems: "center", gap: 6, background: "rgba(72,201,139,.14)", color: "#48C98B", border: "1px solid rgba(72,201,139,.32)", borderRadius: 999, padding: "6px 13px", fontFamily: "inherit", fontWeight: 800, fontSize: 12, cursor: busy ? "not-allowed" : "pointer", opacity: busy ? 0.55 : 1 }}
                      >
                        <Zap size={13} strokeWidth={2.4} />
                        הטל משימה: הרץ ניתוח {FOCUS_LABEL[m.taskFocus]}
                      </button>
                    )}
                  </div>
                ))}
                {chatBusy && (
                  <div style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 12.5, fontWeight: 700, color: "rgba(255,255,255,.6)" }}>
                    <span style={{ display: "inline-flex", gap: 3 }}>
                      {[0, 1, 2].map(j => (
                        <span key={j} style={{ width: 6, height: 6, borderRadius: "50%", background: "#B49BF0", animation: `fgBlink 1.1s ${j * 0.18}s ease-in-out infinite` }} />
                      ))}
                    </span>
                    הסוכן הראשי מנתב את השאלה...
                  </div>
                )}
              </div>
            )}

            {/* input */}
            <form
              onSubmit={e => { e.preventDefault(); handleChatSend(); }}
              style={{ display: "flex", gap: 10, padding: "12px 18px", borderTop: "1px solid rgba(255,255,255,.08)" }}
            >
              <input
                id="agent-chat-input"
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                placeholder="לדוגמה: למה הנטו שלי ירד החודש?"
                disabled={chatBusy}
                style={{ flex: 1, background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.12)", borderRadius: 11, padding: "11px 15px", fontFamily: "inherit", fontSize: 13.5, fontWeight: 500, color: "#fff", outline: "none" }}
              />
              <button
                type="submit"
                disabled={chatBusy || !chatInput.trim()}
                style={{ display: "inline-flex", alignItems: "center", gap: 7, background: chatInput.trim() && !chatBusy ? "linear-gradient(135deg,#9B7FE8,#6F8BE8)" : "rgba(255,255,255,.08)", color: "#fff", border: "none", borderRadius: 11, padding: "11px 18px", fontFamily: "inherit", fontWeight: 800, fontSize: 13.5, cursor: chatBusy || !chatInput.trim() ? "not-allowed" : "pointer", transition: "background .25s var(--ease)" }}
              >
                <Send size={14} strokeWidth={2.3} /> שלח
              </button>
            </form>
          </div>
        </div>
      </div>
    </section>
  );
});

export default MasterAgentPanel;
