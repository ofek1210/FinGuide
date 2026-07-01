import { useCallback, useEffect, useState } from "react";
import {
  Sparkles, AlertTriangle, TrendingUp, BarChart3, Scale, Shield,
  FileText, ArrowLeft, Loader2, X, Check, type LucideIcon,
} from "lucide-react";
import PrivateTopbar from "../components/PrivateTopbar";
import AppFooter from "../components/AppFooter";
import { formatCurrencyOrDash } from "../utils/formatters";
import { renderMarkdown } from "../utils/renderMarkdown";
import {
  getCopilotAnalysis, updateCopilotProfile, generateMonthlyReport, upsertGoal, getFinancialProblems,
  type CopilotAnalysis, type RiskTolerance, type FinancialProblem, type AIFixPlan,
} from "../api/copilot.api";

/* מרכז תכנון פיננסי — Financial Planning Center.
   Design: ui_kits/app/FinancialPlanning.jsx. Wired to the /api/copilot/* backend
   (the same data the old /copilot page used): live health score, cash-flow from
   payslips, budget 50/30/20, investment recs + projections, risk-profile save,
   AI problems + fix plans, and monthly-report generation. */

const fmt = formatCurrencyOrDash;
const card: React.CSSProperties = { background: "var(--card)", border: "1px solid var(--border-hair)", borderRadius: "var(--radius)", boxShadow: "var(--shadow-soft)" };

type ProfileKey = "שמרני" | "מאוזן" | "אנרגטי";
const RISK_TO_API: Record<ProfileKey, RiskTolerance> = { שמרני: "low", מאוזן: "medium", אנרגטי: "high" };
const API_TO_RISK: Record<RiskTolerance, ProfileKey> = { low: "שמרני", medium: "מאוזן", high: "אנרגטי" };

const PROFILES: Record<ProfileKey, { ret: string; alloc: [string, number, string][] }> = {
  שמרני: { ret: "3%–6%", alloc: [["מניות", 20, "var(--lav-600)"], ["נדל״ן", 10, "var(--mint-ink)"], ["אג״ח קונצרני", 25, "var(--peach-ink)"], ["אג״ח ממשלתי", 30, "var(--butter-ink)"], ["מזומן", 15, "var(--text-faint)"]] },
  מאוזן: { ret: "5%–10%", alloc: [["מניות", 35, "var(--lav-600)"], ["נדל״ן", 20, "var(--mint-ink)"], ["אג״ח קונצרני", 20, "var(--peach-ink)"], ["אג״ח ממשלתי", 15, "var(--butter-ink)"], ["מזומן", 10, "var(--text-faint)"]] },
  אנרגטי: { ret: "8%–14%", alloc: [["מניות", 55, "var(--lav-600)"], ["נדל״ן", 15, "var(--mint-ink)"], ["אג״ח קונצרני", 15, "var(--peach-ink)"], ["אג״ח ממשלתי", 10, "var(--butter-ink)"], ["מזומן", 5, "var(--text-faint)"]] },
};

function Btn({ children, variant = "primary", size = "md", fullWidth, iconLeft, onClick, disabled }: { children: React.ReactNode; variant?: "primary" | "secondary"; size?: "sm" | "md"; fullWidth?: boolean; iconLeft?: React.ReactNode; onClick?: () => void; disabled?: boolean }) {
  const pad = size === "sm" ? "9px 16px" : "12px 22px";
  const fs = size === "sm" ? 13.5 : 15;
  const primary = variant === "primary";
  return (
    <button type="button" onClick={onClick} disabled={disabled}
      style={{ width: fullWidth ? "100%" : undefined, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, padding: pad, borderRadius: "var(--r-pill)", border: primary ? "none" : "1px solid var(--border-soft)", cursor: disabled ? "default" : "pointer", opacity: disabled ? 0.6 : 1, fontFamily: "inherit", fontWeight: 800, fontSize: fs, color: primary ? "#fff" : "var(--ink)", background: primary ? "var(--ink)" : "var(--card)", boxShadow: primary ? "var(--shadow-ink)" : "var(--shadow-soft)", transition: "transform .2s var(--ease)" }}
      onMouseEnter={e => { if (!disabled) e.currentTarget.style.transform = "translateY(-2px)"; }}
      onMouseLeave={e => { e.currentTarget.style.transform = "none"; }}>
      {iconLeft}{children}
    </button>
  );
}

function Badge({ children, tone }: { children: React.ReactNode; tone: "lavender" | "mint" | "peach" | "butter" }) {
  const map: Record<string, [string, string, string]> = {
    lavender: ["var(--lav-100)", "var(--lav-600)", "var(--lav-200)"],
    mint: ["var(--mint-soft)", "var(--mint-ink)", "var(--mint)"],
    peach: ["var(--peach-soft)", "var(--peach-ink)", "var(--peach)"],
    butter: ["var(--butter-soft)", "var(--butter-ink)", "var(--butter)"],
  };
  const [bg, fg, ring] = map[tone];
  return <span style={{ fontSize: 11.5, fontWeight: 800, color: fg, background: bg, border: `1px solid ${ring}`, borderRadius: "var(--r-pill)", padding: "4px 11px" }}>{children}</span>;
}

function FPRing({ value, size, sw, color, track = "var(--hair)" }: { value: number; size: number; sw: number; color: string; track?: string }) {
  const r = (size - sw) / 2;
  const circ = 2 * Math.PI * r;
  const dash = (Math.min(value, 100) / 100) * circ;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: "rotate(-90deg)", display: "block" }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track} strokeWidth={sw} />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={sw} strokeDasharray={`${dash} ${circ}`} strokeLinecap="round" style={{ transition: "stroke-dasharray 1.3s cubic-bezier(.22,.61,.36,1)" }} />
    </svg>
  );
}

function FPDonut({ size = 150, sw = 22, segments }: { size?: number; sw?: number; segments: { label: string; pct: number; color: string }[] }) {
  const r = (size - sw) / 2;
  const circ = 2 * Math.PI * r;
  let acc = 0;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: "rotate(-90deg)", display: "block" }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--hair)" strokeWidth={sw} />
      {segments.filter(s => s.pct > 0).map((s, i) => {
        const len = (s.pct / 100) * circ;
        const el = <circle key={i} cx={size / 2} cy={size / 2} r={r} fill="none" stroke={s.color} strokeWidth={sw} strokeDasharray={`${len} ${circ}`} strokeDashoffset={-acc} strokeLinecap="butt" style={{ transition: "stroke-dasharray 1.1s var(--ease)" }} />;
        acc += len;
        return el;
      })}
    </svg>
  );
}

type Toast = { type: "success" | "error"; text: string } | null;

export default function FinancialPlanningPage() {
  const [analysis, setAnalysis] = useState<CopilotAnalysis | null>(null);
  const [problems, setProblems] = useState<FinancialProblem[]>([]);
  const [fixPlans, setFixPlans] = useState<AIFixPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [openP, setOpenP] = useState<number | null>(null);
  const [profile, setProfile] = useState<ProfileKey>("מאוזן");
  const [budgetOpen, setBudgetOpen] = useState(false);
  const [expenses, setExpenses] = useState("");
  const [debts, setDebts] = useState("");
  const [goalOpen, setGoalOpen] = useState(false);
  const [goalLabel, setGoalLabel] = useState("");
  const [goalTarget, setGoalTarget] = useState("");

  const [savingProfile, setSavingProfile] = useState(false);
  const [savingBudget, setSavingBudget] = useState(false);
  const [savingGoal, setSavingGoal] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [report, setReport] = useState<{ html: string; source: string } | null>(null);
  const [toast, setToast] = useState<Toast>(null);

  const load = useCallback(async () => {
    setError(null);
    const [a, p] = await Promise.all([getCopilotAnalysis(), getFinancialProblems()]);
    if (a.ok && a.data.success && a.data.data) {
      const d = a.data.data;
      setAnalysis(d);
      if (d.profile.riskTolerance) setProfile(API_TO_RISK[d.profile.riskTolerance]);
      if (d.profile.monthlyExpenses != null) setExpenses(String(d.profile.monthlyExpenses));
      if (d.profile.monthlyDebts != null) setDebts(String(d.profile.monthlyDebts));
    } else {
      setError("לא הצלחנו לטעון את נתוני התכנון הפיננסי.");
    }
    if (p.ok && p.data.success && p.data.data) {
      setProblems(p.data.data.problems ?? []);
      setFixPlans(p.data.data.aiFixPlans ?? []);
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    void load().finally(() => setLoading(false));
  }, [load]);

  useEffect(() => {
    if (document.getElementById("fp-anim")) return;
    const st = document.createElement("style");
    st.id = "fp-anim";
    st.textContent =
      "@keyframes fpIn{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}" +
      "@keyframes fpBar{from{height:0}}@keyframes fpSeg{from{width:0}}@keyframes fpToast{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none}}" +
      "@media (prefers-reduced-motion:reduce){[class^=fp-an]{animation:none!important}}";
    document.head.appendChild(st);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3600);
    return () => clearTimeout(t);
  }, [toast]);

  // ── actions ────────────────────────────────────────────────────────────────
  const saveProfile = async () => {
    setSavingProfile(true);
    const res = await updateCopilotProfile({ riskTolerance: RISK_TO_API[profile] });
    setSavingProfile(false);
    if (res.ok && res.data.success) { setToast({ type: "success", text: `פרופיל הסיכון "${profile}" נשמר בהצלחה` }); void load(); }
    else setToast({ type: "error", text: "שמירת פרופיל הסיכון נכשלה. נסה שוב." });
  };

  const saveBudget = async () => {
    const exp = expenses.trim() === "" ? undefined : Number(expenses);
    const dbt = debts.trim() === "" ? undefined : Number(debts);
    if (exp == null && dbt == null) { setToast({ type: "error", text: "הזן לפחות סכום אחד." }); return; }
    if ((exp != null && Number.isNaN(exp)) || (dbt != null && Number.isNaN(dbt))) { setToast({ type: "error", text: "יש להזין מספרים בלבד." }); return; }
    setSavingBudget(true);
    const res = await updateCopilotProfile({ ...(exp != null ? { monthlyExpenses: exp } : {}), ...(dbt != null ? { monthlyDebts: dbt } : {}) });
    setSavingBudget(false);
    if (res.ok && res.data.success) { setToast({ type: "success", text: "התקציב עודכן ונשמר בפרופיל" }); setBudgetOpen(false); void load(); }
    else setToast({ type: "error", text: "עדכון התקציב נכשל. נסה שוב." });
  };

  const addGoal = async () => {
    if (!goalLabel.trim()) { setToast({ type: "error", text: "הזן שם ליעד." }); return; }
    setSavingGoal(true);
    const res = await upsertGoal({ label: goalLabel.trim(), type: "other", ...(goalTarget.trim() && !Number.isNaN(Number(goalTarget)) ? { targetAmount: Number(goalTarget) } : {}) });
    setSavingGoal(false);
    if (res.ok && res.data.success) { setToast({ type: "success", text: "היעד נוסף ונשמר בפרופיל" }); setGoalLabel(""); setGoalTarget(""); setGoalOpen(false); void load(); }
    else setToast({ type: "error", text: "הוספת היעד נכשלה. נסה שוב." });
  };

  const makeReport = async () => {
    setGenerating(true);
    const res = await generateMonthlyReport();
    setGenerating(false);
    if (res.ok && res.data.success && res.data.data) { setReport({ html: renderMarkdown(res.data.data.report), source: res.data.data.source }); setToast({ type: "success", text: "הדוח החודשי נוצר בהצלחה" }); }
    else setToast({ type: "error", text: "יצירת הדוח נכשלה. נסה שוב." });
  };

  // ── derived ────────────────────────────────────────────────────────────────
  const score = analysis?.healthScore?.score ?? 0;
  const scoreLabel = analysis?.healthScore?.label;
  const gross = analysis?.payslip?.grossSalary ?? null;
  const net = analysis?.payslip?.netSalary ?? null;
  const ba = analysis?.budgetAnalysis;
  const cashFlow = ba?.monthlyFreeFlow ?? net;
  const inv = analysis?.investmentRecs;
  const goals = analysis?.goals ?? [];
  const alloc = PROFILES[profile].alloc;
  const monthlyInvest = inv?.recommendedMonthlyInvestment ?? null;

  const projections = (inv?.projections ?? []).slice().sort((a, b) => b.years - a.years);
  const maxProj = projections.reduce((m, p) => Math.max(m, p.projected), 0) || 1;

  const budgetSeg = ba?.available && ba.breakdown
    ? [
        { label: "הוצאות קבועות", pct: ba.breakdown.fixed.pct, color: "var(--lav-600)" },
        { label: "הוצאות משתנות", pct: ba.breakdown.discretionary.pct, color: "var(--peach-ink)" },
        { label: "חיסכון", pct: ba.breakdown.savings.pct, color: "var(--mint-ink)" },
      ]
    : [
        { label: "חיסכון", pct: 100, color: "var(--mint-ink)" },
        { label: "הוצאות קבועות", pct: 0, color: "var(--lav-600)" },
        { label: "הוצאות משתנות", pct: 0, color: "var(--peach-ink)" },
      ];

  const sectionHead = (title: string, badge: string, badgeTone: "lavender" | "mint", Icon: LucideIcon) => (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ width: 32, height: 32, borderRadius: 9, background: "var(--lav-100)", color: "var(--lav-600)", display: "grid", placeItems: "center", flex: "none" }}><Icon size={18} /></span>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 900, letterSpacing: "-.02em", color: "var(--text-strong)" }}>{title}</h2>
      </div>
      <Badge tone={badgeTone}>{badge}</Badge>
    </div>
  );

  const sevTone: Record<FinancialProblem["severity"], [string, string, string]> = {
    critical: ["var(--peach-soft)", "var(--peach-ink)", "rgba(218,111,68,.28)"],
    warning: ["var(--butter-soft)", "var(--butter-ink)", "var(--butter)"],
    info: ["var(--lav-100)", "var(--lav-600)", "var(--border-soft)"],
  };

  const RISK: { key: ProfileKey; Icon: LucideIcon; sub: string }[] = [
    { key: "שמרני", Icon: Shield, sub: "הגנה על הקרן, סיכון נמוך" },
    { key: "מאוזן", Icon: Scale, sub: "איזון בין צמיחה ליציבות" },
    { key: "אנרגטי", Icon: TrendingUp, sub: "מיקוד בצמיחה לטווח ארוך" },
  ];

  const shell = (children: React.ReactNode) => (
    <div style={{ minHeight: "100vh", background: "var(--surface-page)", color: "var(--text-body)", fontFamily: "var(--font-body)", direction: "rtl" }}>
      <PrivateTopbar />
      {children}
      <AppFooter variant="private" />
      {toast && (
        <div className="fp-an" style={{ position: "fixed", insetInlineStart: "50%", transform: "translateX(-50%)", bottom: 26, zIndex: 1200, display: "flex", alignItems: "center", gap: 10, padding: "13px 20px", borderRadius: "var(--r-pill)", background: toast.type === "success" ? "var(--mint-ink)" : "var(--danger)", color: "#fff", boxShadow: "var(--shadow-xl)", fontWeight: 800, fontSize: 14, animation: "fpToast .3s var(--ease) both" }}>
          {toast.type === "success" ? <Check size={17} strokeWidth={2.8} /> : <AlertTriangle size={17} />}
          {toast.text}
        </div>
      )}
    </div>
  );

  if (loading) {
    return shell(
      <main style={{ minHeight: "55vh", display: "grid", placeItems: "center" }}>
        <div style={{ textAlign: "center", color: "var(--lav-600)" }}>
          <Loader2 size={28} style={{ animation: "spin .8s linear infinite", marginBottom: 12 }} />
          <div style={{ fontSize: 14, color: "var(--text-muted)" }}>טוען את התמונה הפיננסית שלך…</div>
        </div>
      </main>,
    );
  }

  if (error) {
    return shell(
      <main style={{ maxWidth: 600, margin: "0 auto", padding: "60px 24px", textAlign: "center" }}>
        <div style={{ color: "var(--danger)", fontWeight: 700, marginBottom: 14 }}>{error}</div>
        <Btn onClick={() => { setLoading(true); void load().finally(() => setLoading(false)); }}>נסה שוב</Btn>
      </main>,
    );
  }

  return shell(
    <main style={{ maxWidth: 1180, margin: "0 auto", padding: "40px 24px 84px" }}>
      {/* header */}
      <div className="fp-an" style={{ display: "flex", alignItems: "center", gap: 22, flexWrap: "wrap", marginBottom: 18, animation: "fpIn .55s var(--ease) both" }}>
        <div style={{ position: "relative", width: 92, height: 92, flex: "none" }}>
          <FPRing value={score} size={92} sw={8} color="var(--peach-ink)" />
          <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", textAlign: "center" }}>
            <div>
              <div style={{ fontSize: 28, fontWeight: 900, letterSpacing: "-.04em", lineHeight: 1, color: "var(--ink)" }}>{score}</div>
              <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-faint)", marginTop: 2 }}>ציון פיננסי</div>
            </div>
          </div>
        </div>
        <div style={{ flex: 1, minWidth: 260 }}>
          <h1 style={{ margin: 0, fontSize: "clamp(26px,3.2vw,38px)", fontWeight: 900, letterSpacing: "-.035em", lineHeight: 1.05, color: "var(--text-strong)" }}>מרכז תכנון פיננסי</h1>
          <p style={{ margin: "8px 0 0", fontSize: 15.5, color: "var(--text-muted)", lineHeight: 1.55, maxWidth: 540, fontWeight: 500 }}>
            כאן הכל לראות את התמונה הפיננסית המלאה שלך — תקציב, חיסכון, השקעות ויעדים. ככל שתזין יותר נתונים, התובנות יהפכו מדויקות יותר.
          </p>
        </div>
      </div>

      {/* score banner */}
      <div className="fp-an" style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "14px 18px", borderRadius: "var(--radius)", background: "var(--grad-prism)", border: "1px solid var(--border-soft)", marginBottom: 24, animation: "fpIn .55s .05s var(--ease) both" }}>
        <span style={{ color: "var(--lav-600)", flex: "none", marginTop: 1 }}><Sparkles size={17} /></span>
        <p style={{ margin: 0, fontSize: 13.5, color: "var(--ink-soft)", lineHeight: 1.55, fontWeight: 500 }}>
          <b style={{ fontWeight: 800 }}>ציון {score}/100{scoreLabel ? ` · ${scoreLabel}` : ""}</b> — הציון מורכב מניצול זכויות מס, יעילות פנסיה, כיסוי ביטוחי ותכנון תקציב. ככל שתשלים נתונים, הציון יעלה וההמלצות יתחדדו.
        </p>
      </div>

      {/* cash-flow stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 14, marginBottom: 24 }}>
        {([
          { l: "תזרים חודשי", v: fmt(cashFlow), sub: "אחרי הוצאות", c: "var(--mint-ink)", trend: true },
          { l: "נטו", v: fmt(net), sub: "להפקדה בפועל", c: "var(--ink)", trend: false },
          { l: "ברוטו", v: fmt(gross), sub: "סך הכנסות", c: "var(--ink)", trend: false },
        ] as const).map((s, i) => (
          <div key={s.l} className="fp-an" style={{ ...card, padding: "18px 20px", animation: `fpIn .5s ${0.1 + i * 0.05}s var(--ease) both` }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 9 }}>
              <span style={{ fontSize: 12.5, color: "var(--text-muted)", fontWeight: 700 }}>{s.l}</span>
              <span style={{ color: s.trend ? "var(--mint-ink)" : "var(--text-faint)", display: "inline-flex" }}>{s.trend ? <TrendingUp size={15} /> : <BarChart3 size={15} />}</span>
            </div>
            <div style={{ fontSize: 27, fontWeight: 900, letterSpacing: "-.03em", color: s.c, lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>{s.v}</div>
            <div style={{ fontSize: 12, color: "var(--text-faint)", fontWeight: 600, marginTop: 6 }}>{s.sub}</div>
          </div>
        ))}
      </div>

      {/* AI problems */}
      <div className="fp-an" style={{ ...card, padding: "22px 24px", marginBottom: 22, animation: "fpIn .5s .2s var(--ease) both" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ width: 32, height: 32, borderRadius: 9, background: "var(--peach-soft)", color: "var(--peach-ink)", display: "grid", placeItems: "center" }}><AlertTriangle size={18} /></span>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 900, letterSpacing: "-.02em", color: "var(--text-strong)" }}>בעיות פיננסיות ותוכנית תיקון</h2>
          </div>
          <span style={{ fontSize: 11, fontWeight: 900, color: "var(--lav-600)", background: "var(--lav-100)", border: "1px solid var(--border-soft)", borderRadius: 999, padding: "4px 11px" }}>AI</span>
        </div>
        {problems.length === 0 ? (
          <div style={{ display: "flex", alignItems: "center", gap: 9, fontSize: 13.5, color: "var(--mint-ink)", fontWeight: 700, padding: "10px 2px" }}>
            <Check size={16} strokeWidth={2.6} /> לא זוהו בעיות פיננסיות פעילות — כל הכבוד!
          </div>
        ) : (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 13, color: "var(--text-muted)", fontWeight: 600, margin: "0 2px 14px" }}>
              <span style={{ color: "var(--lav-600)", display: "inline-flex" }}><Sparkles size={13} /></span>
              זוהו <b style={{ color: "var(--ink)" }}>{problems.length} בעיות</b> — לחץ על כל אחת לתוכנית תיקון
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
              {problems.map((p, i) => {
                const [bg, fg, bd] = sevTone[p.severity];
                const open = openP === i;
                const plan = fixPlans.find(f => f.problemId === p.id);
                return (
                  <div key={p.id} style={{ border: `1px solid ${bd}`, borderRadius: "var(--r-md)", background: bg, overflow: "hidden" }}>
                    <button onClick={() => setOpenP(open ? null : i)} style={{ width: "100%", display: "flex", alignItems: "center", gap: 13, padding: "13px 15px", background: "none", border: "none", cursor: "pointer", textAlign: "start", fontFamily: "inherit" }}>
                      <span style={{ width: 30, height: 30, borderRadius: 8, flex: "none", background: "var(--card)", color: fg, display: "grid", placeItems: "center" }}>{p.severity === "info" ? <Sparkles size={16} /> : <AlertTriangle size={16} />}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 14.5, fontWeight: 800, color: "var(--ink)" }}>{p.title}</div>
                        <div style={{ fontSize: 12.5, color: "var(--text-muted)", marginTop: 2, lineHeight: 1.45 }}>{p.description}</div>
                      </div>
                      <span style={{ color: fg, flex: "none", transform: open ? "rotate(90deg)" : "none", transition: "transform .25s var(--ease)" }}><ArrowLeft size={16} /></span>
                    </button>
                    {open && (
                      <div style={{ padding: "0 56px 15px 15px", animation: "fpIn .3s var(--ease) both" }}>
                        <div style={{ background: "var(--card)", border: "1px solid var(--border-hair)", borderRadius: "var(--r-sm)", padding: "13px 15px" }}>
                          {p.impact && <div style={{ fontSize: 12.5, color: "var(--peach-ink)", fontWeight: 700, marginBottom: 10 }}>השפעה: {p.impact}</div>}
                          {plan ? (
                            <>
                              <div style={{ fontSize: 12, fontWeight: 800, color: "var(--text-faint)", letterSpacing: ".05em", marginBottom: 9 }}>תוכנית תיקון</div>
                              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 12 }}>
                                {plan.steps.map((step, j) => (
                                  <div key={j} style={{ display: "flex", alignItems: "center", gap: 9, fontSize: 13.5, color: "var(--text-body)", fontWeight: 500 }}>
                                    <span style={{ width: 19, height: 19, borderRadius: "50%", flex: "none", background: bg, color: fg, display: "grid", placeItems: "center", fontSize: 10.5, fontWeight: 900 }}>{j + 1}</span>
                                    {step}
                                  </div>
                                ))}
                              </div>
                              <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 16px", fontSize: 12, color: "var(--text-muted)", fontWeight: 600 }}>
                                {plan.timeframe && <span>⏱ {plan.timeframe}</span>}
                                {plan.expectedResult && <span style={{ color: "var(--mint-ink)" }}>✓ {plan.expectedResult}</span>}
                              </div>
                            </>
                          ) : (
                            <div style={{ fontSize: 13, color: "var(--text-muted)" }}>תוכנית התיקון תיווצר ע״י ה‑AI בקרוב.</div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* investments + budget */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 22 }}>
        {/* LEFT — investments & forecast */}
        <div className="fp-an" style={{ ...card, padding: "22px 24px", animation: "fpIn .5s .25s var(--ease) both" }}>
          {sectionHead("השקעות ותחזיות", "תחזית", "lavender", BarChart3)}
          <div style={{ display: "flex", gap: 10, padding: "12px 14px", borderRadius: "var(--r-sm)", background: "var(--lav-50)", border: "1px solid var(--border-soft)", marginBottom: 16 }}>
            <span style={{ color: "var(--lav-600)", flex: "none", marginTop: 1 }}><Sparkles size={15} /></span>
            <p style={{ margin: 0, fontSize: 12.5, color: "var(--ink-soft)", lineHeight: 1.5, fontWeight: 500 }}>על בסיס פרופיל הסיכון וההפקדה החודשית, המערכת ממליצה על <b style={{ fontWeight: 800 }}>מסלול השקעות {profile}</b> ומחשבת כיצד הכסף יצמח לאורך שנים בריבית דריבית.</p>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 16 }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-faint)", marginBottom: 5 }}>פרופיל</div>
              <div style={{ display: "flex", background: "var(--surface-sunken)", border: "1px solid var(--border-hair)", borderRadius: 999, padding: 3 }}>
                {(Object.keys(PROFILES) as ProfileKey[]).map(k => (
                  <button key={k} onClick={() => setProfile(k)} title={k} style={{ flex: 1, padding: "6px 2px", borderRadius: 999, border: "none", cursor: "pointer", fontFamily: "inherit", fontSize: 11, fontWeight: 800, background: profile === k ? "var(--card)" : "transparent", color: profile === k ? "var(--lav-600)" : "var(--text-muted)", boxShadow: profile === k ? "var(--shadow-soft)" : "none", transition: "all .18s" }}>{k}</button>
                ))}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-faint)", marginBottom: 5 }}>תשואה צפויה</div>
              <div style={{ padding: "8px 12px", borderRadius: "var(--r-sm)", background: "var(--mint-soft)", border: "1px solid var(--mint)", fontSize: 14.5, fontWeight: 900, color: "var(--mint-ink)", textAlign: "center" }}>{inv?.expectedAnnualReturn ?? PROFILES[profile].ret}</div>
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-faint)", marginBottom: 5 }}>הפקדה חודשית</div>
              <div style={{ padding: "8px 12px", borderRadius: "var(--r-sm)", background: "var(--surface-sunken)", border: "1px solid var(--border-hair)", fontSize: 14.5, fontWeight: 900, color: "var(--ink)", textAlign: "center" }}>{monthlyInvest != null ? fmt(monthlyInvest) : "—"}</div>
            </div>
          </div>
          <div style={{ display: "flex", height: 14, borderRadius: 999, overflow: "hidden", marginBottom: 9 }}>
            {alloc.map(([label, pct, color], i) => (
              <div key={label} className="fp-anseg" title={`${label} ${pct}%`} style={{ width: `${pct}%`, background: color, animation: `fpSeg .8s ${0.1 + i * 0.06}s var(--ease) both` }} />
            ))}
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "5px 14px", marginBottom: 20 }}>
            {alloc.map(([label, pct, color]) => (
              <span key={label} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11.5, fontWeight: 600, color: "var(--text-muted)" }}>
                <span style={{ width: 8, height: 8, borderRadius: 3, background: color }} />{label} {pct}%
              </span>
            ))}
          </div>
          {(inv?.suggestions ?? []).length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 20 }}>
              {inv!.suggestions.map((r, i) => (
                <div key={i} style={{ display: "flex", gap: 12, padding: "12px 14px", borderRadius: "var(--r-md)", background: "var(--surface-sunken)", border: "1px solid var(--border-hair)", borderInlineStart: "3px solid var(--lav-600)" }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 800, color: "var(--ink)", marginBottom: 3 }}>{r.title}</div>
                    <div style={{ fontSize: 12.5, color: "var(--text-muted)", lineHeight: 1.5 }}>{r.description}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
          {projections.length > 0 && (
            <>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
                <h3 style={{ margin: 0, fontSize: 14, fontWeight: 900, color: "var(--text-strong)" }}>תחזית צבירה</h3>
                {monthlyInvest != null && <span style={{ fontSize: 11.5, color: "var(--text-faint)", fontWeight: 600 }}>בהפקדת {fmt(monthlyInvest)}/חודש בתשואה ממוצעת</span>}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: `repeat(${projections.length},1fr)`, gap: 14, alignItems: "end", height: 150 }}>
                {projections.map((pr, i) => (
                  <div key={pr.years} style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end", height: "100%" }}>
                    <div style={{ fontSize: 14, fontWeight: 900, letterSpacing: "-.02em", color: i === 0 ? "var(--lav-600)" : "var(--ink-soft)", marginBottom: 7 }}>{fmt(pr.projected)}</div>
                    <div className="fp-anbar" style={{ width: "100%", maxWidth: 78, height: `${Math.max(6, (pr.projected / maxProj) * 100)}%`, minHeight: 24, borderRadius: "6px 6px 0 0", background: i === 0 ? "var(--grad-brand)" : "var(--lav-200)", animation: `fpBar .9s ${0.2 + i * 0.1}s var(--ease) both` }} />
                    <div style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 700, marginTop: 9 }}>{pr.years} שנים</div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* RIGHT — budget analysis */}
        <div className="fp-an" style={{ ...card, padding: "22px 24px", animation: "fpIn .5s .3s var(--ease) both" }}>
          {sectionHead("ניתוח תקציב", "תקציב", "mint", TrendingUp)}
          <div style={{ display: "flex", gap: 10, padding: "12px 14px", borderRadius: "var(--r-sm)", background: "var(--lav-50)", border: "1px solid var(--border-soft)", marginBottom: 18 }}>
            <span style={{ color: "var(--lav-600)", flex: "none", marginTop: 1 }}><Sparkles size={15} /></span>
            <p style={{ margin: 0, fontSize: 12.5, color: "var(--ink-soft)", lineHeight: 1.5, fontWeight: 500 }}>ניתוח התקציב מחושב אוטומטית מההכנסות וההוצאות. <b style={{ fontWeight: 800 }}>כלל 50/30/20</b> הוא בנצ׳מרק מקובל לחלוקה בריאה של ההכנסה.</p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 20, marginBottom: 18 }}>
            <div style={{ position: "relative", width: 150, height: 150, flex: "none" }}>
              <FPDonut size={150} sw={22} segments={budgetSeg} />
              <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", textAlign: "center" }}>
                <div>
                  <div style={{ fontSize: 19, fontWeight: 900, letterSpacing: "-.03em", color: "var(--ink)", lineHeight: 1 }}>{fmt(net)}</div>
                  <div style={{ fontSize: 11, color: "var(--text-faint)", fontWeight: 700, marginTop: 3 }}>חודשי</div>
                </div>
              </div>
            </div>
            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 11 }}>
              {budgetSeg.map(s => (
                <div key={s.label} style={{ display: "flex", alignItems: "center", gap: 9 }}>
                  <span style={{ width: 10, height: 10, borderRadius: 3, background: s.color, flex: "none" }} />
                  <span style={{ flex: 1, fontSize: 13, color: "var(--text-body)", fontWeight: 600 }}>{s.label}</span>
                  <span style={{ fontSize: 14, fontWeight: 900, color: s.pct > 0 ? "var(--ink)" : "var(--text-faint)" }}>{Math.round(s.pct)}%</span>
                </div>
              ))}
            </div>
          </div>
          <div style={{ padding: "14px 16px", borderRadius: "var(--r-md)", background: "var(--butter-soft)", border: "1px solid var(--butter)", marginBottom: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 13, fontWeight: 900, color: "var(--butter-ink)", marginBottom: 11 }}><Scale size={15} /> כלל 50/30/20</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10 }}>
              {[["צרכים", ba?.ideal?.needs, "50%"], ["רצונות", ba?.ideal?.wants, "30%"], ["חיסכון", ba?.ideal?.savings, "20%"]].map(([l, v, p]) => (
                <div key={l as string} style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 16, fontWeight: 900, letterSpacing: "-.02em", color: "var(--ink)" }}>{fmt(v as number | undefined)}</div>
                  <div style={{ fontSize: 11.5, color: "var(--text-muted)", fontWeight: 700, marginTop: 2 }}>{l} · {p}</div>
                </div>
              ))}
            </div>
          </div>
          {ba?.available && (ba.monthlyFreeFlow ?? 0) > 0 && (
            <div style={{ display: "flex", gap: 11, padding: "13px 15px", borderRadius: "var(--r-md)", background: "var(--mint-soft)", border: "1px solid var(--mint)", marginBottom: 16 }}>
              <span style={{ color: "var(--mint-ink)", flex: "none", marginTop: 1 }}><TrendingUp size={16} /></span>
              <div>
                <div style={{ fontSize: 13.5, fontWeight: 800, color: "var(--ink)", marginBottom: 2 }}>יש לך עודף להשקעה — {fmt(ba.monthlyFreeFlow)}/חודש</div>
                <div style={{ fontSize: 12.5, color: "var(--text-muted)", lineHeight: 1.5 }}>{ba.savingsRate ? `שיעור החיסכון שלך ${ba.savingsRate}. ` : ""}שקול להפנות את העודף לצמיחה לטווח ארוך.</div>
              </div>
            </div>
          )}
          <div style={{ border: "1px solid var(--border-hair)", borderRadius: "var(--r-md)", overflow: "hidden" }}>
            <button onClick={() => setBudgetOpen(o => !o)} style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 15px", background: "var(--surface-sunken)", border: "none", cursor: "pointer", fontFamily: "inherit", fontSize: 13.5, fontWeight: 800, color: "var(--ink)" }}>
              עדכון הוצאות חודשיות
              <span style={{ color: "var(--text-muted)", transform: budgetOpen ? "rotate(90deg)" : "none", transition: "transform .25s var(--ease)" }}><ArrowLeft size={15} /></span>
            </button>
            {budgetOpen && (
              <div style={{ padding: "14px 15px", display: "flex", flexDirection: "column", gap: 12, animation: "fpIn .3s var(--ease) both" }}>
                {([["הוצאות חודשיות", "מזון, דיור, חשבונות, פנאי…", expenses, setExpenses], ["החזרי חובות / הלוואות", "משכנתא, הלוואות, אשראי…", debts, setDebts]] as const).map(([l, ph, val, setter]) => (
                  <div key={l}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)", marginBottom: 5 }}>{l}</div>
                    <div style={{ display: "flex", alignItems: "center", border: "1px solid var(--border-soft)", borderRadius: "var(--r-sm)", background: "var(--card)", padding: "0 12px" }}>
                      <span style={{ color: "var(--text-faint)", fontWeight: 800, fontSize: 14 }}>₪</span>
                      <input value={val} onChange={e => setter(e.target.value.replace(/[^\d.]/g, ""))} inputMode="numeric" placeholder={ph} style={{ flex: 1, border: "none", outline: "none", padding: "10px 8px", fontFamily: "inherit", fontSize: 14, color: "var(--ink)", background: "transparent" }} />
                    </div>
                  </div>
                ))}
                <Btn variant="primary" size="sm" onClick={saveBudget} disabled={savingBudget} iconLeft={savingBudget ? <Loader2 size={14} style={{ animation: "spin .8s linear infinite" }} /> : undefined}>{savingBudget ? "שומר…" : "עדכן תקציב"}</Btn>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* setup cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 16 }}>
        {/* monthly report */}
        <div className="fp-an" style={{ ...card, padding: "22px 24px", display: "flex", flexDirection: "column", animation: "fpIn .5s .35s var(--ease) both" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 18 }}>
            <span style={{ color: "var(--lav-600)" }}><FileText size={18} /></span>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 900, color: "var(--text-strong)" }}>דוח חודשי AI</h3>
          </div>
          <div style={{ display: "grid", placeItems: "center", padding: "8px 0 18px" }}>
            <span style={{ width: 52, height: 52, borderRadius: 14, background: "var(--lav-50)", color: "var(--lav-600)", display: "grid", placeItems: "center" }}><FileText size={26} /></span>
          </div>
          <p style={{ margin: "0 0 18px", fontSize: 13, color: "var(--text-muted)", lineHeight: 1.6, textAlign: "center", flex: 1 }}>סיכום חודשי מותאם אישית: ניתוח שכר ופנסיה, מצב מול היעדים והמלצות למימוש זכויות וחיסכון — הכל בעברית פשוטה.</p>
          <Btn variant="primary" size="sm" fullWidth onClick={makeReport} disabled={generating} iconLeft={generating ? <Loader2 size={14} style={{ animation: "spin .8s linear infinite" }} /> : undefined}>{generating ? "יוצר דוח…" : "צור דוח חודשי"}</Btn>
        </div>

        {/* goals */}
        <div className="fp-an" style={{ ...card, padding: "22px 24px", display: "flex", flexDirection: "column", animation: "fpIn .5s .4s var(--ease) both" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 18 }}>
            <span style={{ color: "var(--mint-ink)" }}><TrendingUp size={18} /></span>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 900, color: "var(--text-strong)" }}>יעדים פיננסיים</h3>
          </div>
          {goals.length > 0 ? (
            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 10, marginBottom: 14 }}>
              {goals.map(g => (
                <div key={g.id} style={{ padding: "11px 13px", borderRadius: "var(--r-md)", background: "var(--surface-sunken)", border: "1px solid var(--border-hair)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 7 }}>
                    <span style={{ fontSize: 13.5, fontWeight: 800, color: "var(--ink)" }}>{g.label}</span>
                    <span style={{ fontSize: 12, fontWeight: 800, color: "var(--mint-ink)" }}>{Math.round(g.progressPct)}%</span>
                  </div>
                  <div style={{ height: 7, borderRadius: 999, background: "var(--hair)", overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${Math.min(100, g.progressPct)}%`, background: "var(--mint-ink)", borderRadius: 999 }} />
                  </div>
                  {g.targetAmount != null && <div style={{ fontSize: 11.5, color: "var(--text-muted)", fontWeight: 600, marginTop: 6 }}>{fmt(g.currentAmount)} מתוך {fmt(g.targetAmount)}</div>}
                </div>
              ))}
            </div>
          ) : (
            <div style={{ flex: 1, display: "grid", placeItems: "center", textAlign: "center", padding: "16px 0" }}>
              <div>
                <span style={{ width: 52, height: 52, borderRadius: 14, background: "var(--surface-sunken)", color: "var(--text-faint)", display: "grid", placeItems: "center", margin: "0 auto 14px" }}><Sparkles size={24} /></span>
                <div style={{ fontSize: 14, fontWeight: 800, color: "var(--text-muted)" }}>אין יעדים עדיין</div>
                <div style={{ fontSize: 12.5, color: "var(--text-faint)", marginTop: 4 }}>הוסף יעד ראשון כדי לעקוב אחר ההתקדמות</div>
              </div>
            </div>
          )}
          {goalOpen && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 10, animation: "fpIn .3s var(--ease) both" }}>
              <input value={goalLabel} onChange={e => setGoalLabel(e.target.value)} placeholder="שם היעד (לדוגמה: קרן חירום)" style={{ border: "1px solid var(--border-soft)", borderRadius: "var(--r-sm)", padding: "10px 12px", fontFamily: "inherit", fontSize: 13.5, color: "var(--ink)", background: "var(--card)", outline: "none" }} />
              <div style={{ display: "flex", alignItems: "center", border: "1px solid var(--border-soft)", borderRadius: "var(--r-sm)", background: "var(--card)", padding: "0 12px" }}>
                <span style={{ color: "var(--text-faint)", fontWeight: 800, fontSize: 14 }}>₪</span>
                <input value={goalTarget} onChange={e => setGoalTarget(e.target.value.replace(/[^\d.]/g, ""))} inputMode="numeric" placeholder="סכום יעד (אופציונלי)" style={{ flex: 1, border: "none", outline: "none", padding: "10px 8px", fontFamily: "inherit", fontSize: 13.5, color: "var(--ink)", background: "transparent" }} />
              </div>
            </div>
          )}
          {goalOpen ? (
            <Btn variant="primary" size="sm" fullWidth onClick={addGoal} disabled={savingGoal} iconLeft={savingGoal ? <Loader2 size={14} style={{ animation: "spin .8s linear infinite" }} /> : undefined}>{savingGoal ? "שומר…" : "שמור יעד"}</Btn>
          ) : (
            <Btn variant="secondary" size="sm" fullWidth onClick={() => setGoalOpen(true)} iconLeft={<span style={{ fontWeight: 900 }}>+</span>}>הוסף יעד</Btn>
          )}
        </div>

        {/* risk profile */}
        <div className="fp-an" style={{ ...card, padding: "22px 24px", display: "flex", flexDirection: "column", animation: "fpIn .5s .45s var(--ease) both" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 14 }}>
            <span style={{ color: "var(--peach-ink)" }}><Shield size={18} /></span>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 900, color: "var(--text-strong)" }}>פרופיל סיכון</h3>
          </div>
          <p style={{ margin: "0 0 14px", fontSize: 12.5, color: "var(--text-muted)", lineHeight: 1.55 }}>הפרופיל קובע איך המערכת ממליצה להשקיע. בחר את רמת הסיכון המתאימה לך.</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 14 }}>
            {RISK.map(r => {
              const on = profile === r.key;
              const Icon = r.Icon;
              return (
                <button key={r.key} onClick={() => setProfile(r.key)} style={{ display: "flex", alignItems: "center", gap: 11, padding: "11px 13px", borderRadius: "var(--r-md)", cursor: "pointer", fontFamily: "inherit", textAlign: "start", border: `1.5px solid ${on ? "var(--lav-400)" : "var(--border-hair)"}`, background: on ? "var(--lav-50)" : "var(--card)", transition: "all .18s var(--ease)" }}>
                  <span style={{ width: 34, height: 34, borderRadius: 9, flex: "none", background: on ? "var(--lav-100)" : "var(--surface-sunken)", color: on ? "var(--lav-600)" : "var(--text-muted)", display: "grid", placeItems: "center" }}><Icon size={17} /></span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 800, color: "var(--ink)" }}>{r.key}</div>
                    <div style={{ fontSize: 11.5, color: "var(--text-muted)", marginTop: 1 }}>{r.sub}</div>
                  </div>
                  <span style={{ width: 17, height: 17, borderRadius: "50%", flex: "none", border: `2px solid ${on ? "var(--lav-600)" : "var(--border-soft)"}`, display: "grid", placeItems: "center" }}>
                    {on && <span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--lav-600)" }} />}
                  </span>
                </button>
              );
            })}
          </div>
          <div style={{ display: "flex", gap: 9, padding: "11px 13px", borderRadius: "var(--r-sm)", background: "var(--butter-soft)", border: "1px solid var(--butter)", marginBottom: 14 }}>
            <span style={{ color: "var(--butter-ink)", flex: "none", marginTop: 1 }}><Sparkles size={14} /></span>
            <div style={{ fontSize: 12, color: "var(--ink-soft)", lineHeight: 1.5, fontWeight: 500 }}>פרופיל <b style={{ fontWeight: 800 }}>{profile}</b> — תשואה צפויה {inv?.expectedAnnualReturn ?? PROFILES[profile].ret} בשנה.</div>
          </div>
          <Btn variant="primary" size="sm" fullWidth onClick={saveProfile} disabled={savingProfile} iconLeft={savingProfile ? <Loader2 size={14} style={{ animation: "spin .8s linear infinite" }} /> : undefined}>{savingProfile ? "שומר…" : "שמור פרופיל"}</Btn>
        </div>
      </div>

      {/* monthly report modal */}
      {report && (
        <div onClick={() => setReport(null)} style={{ position: "fixed", inset: 0, zIndex: 1100, background: "rgba(18,17,24,.55)", backdropFilter: "blur(4px)", WebkitBackdropFilter: "blur(4px)", display: "grid", placeItems: "center", padding: 24 }}>
          <div onClick={e => e.stopPropagation()} style={{ width: "min(720px,100%)", maxHeight: "86vh", display: "flex", flexDirection: "column", background: "var(--surface-card)", borderRadius: "var(--r-card)", boxShadow: "var(--shadow-xl)", overflow: "hidden", direction: "rtl" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "16px 20px", borderBottom: "1px solid var(--border-hair)" }}>
              <span style={{ width: 38, height: 38, borderRadius: 11, flex: "none", background: "var(--lav-100)", color: "var(--lav-600)", display: "grid", placeItems: "center" }}><FileText size={19} /></span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 16, fontWeight: 900, color: "var(--text-strong)" }}>הדוח החודשי שלך</div>
                <div style={{ fontSize: 12, color: "var(--text-muted)" }}>נוצר ע״י {report.source === "claude" ? "AI" : "המערכת"}</div>
              </div>
              <button onClick={() => setReport(null)} aria-label="סגור" style={{ width: 34, height: 34, borderRadius: 9, border: "1px solid var(--border-hair)", background: "var(--card)", color: "var(--text-muted)", cursor: "pointer", display: "grid", placeItems: "center" }}><X size={17} /></button>
            </div>
            <div style={{ padding: "20px 24px", overflow: "auto", fontSize: 14, lineHeight: 1.7, color: "var(--text-body)" }} dangerouslySetInnerHTML={{ __html: report.html }} />
          </div>
        </div>
      )}
    </main>,
  );
}
