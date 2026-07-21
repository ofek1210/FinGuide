/**
 * InsurancePage — guided Har HaBituach import flow
 */
import { useCallback, useEffect, useState } from "react";
import {
  Shield, AlertCircle, CheckCircle, Trash2, Loader2,
  FileText, Lock, TrendingUp, ShieldCheck, AlertTriangle, BarChart3,
  Sparkles, RefreshCw, TrendingDown, Lightbulb,
  type LucideIcon,
} from "lucide-react";
import PrivateTopbar from "../components/PrivateTopbar";
import AppFooter from "../components/AppFooter";
import InsuranceRibbonWave from "../components/insurance/InsuranceRibbonWave";
import InsuranceImportGuide from "../components/insurance/InsuranceImportGuide";
import InsuranceUpload from "../components/insurance/InsuranceUpload";
import InsuranceOnboardingWizard from "../components/insurance/InsuranceOnboardingWizard";
import AgentOnboardingModal from "../components/onboarding/AgentOnboardingModal";
import { useAgentOnboarding } from "../hooks/useAgentOnboarding";
import AIInsightsLoadingState from "../components/ai/AIInsightsLoadingState";
import {
  getInsuranceAnalysis,
  getInsuranceImportHistory,
  uploadInsuranceExcel,
  deleteInsurancePolicy,
  type InsuranceAnalysisResponse,
  type InsuranceAnalysisDTO,
  type InsuranceDuplicate,
  type InsurancePolicyDTO,
  type InsuranceRecommendationDTO,
  type InsuranceHealthCheck,
  type InsuranceImportHistoryItem,
  type InsuranceMarketAdvice,
} from "../api/insuranceAI.api";
import { getInsuranceOnboardingSession } from "../api/insuranceOnboarding.api";
import { formatCurrencyOrDash } from "../utils/formatters";
import { POLICY_TYPE_LABELS, UPLOAD_PROGRESS_STEPS } from "../utils/insuranceDisplay";
import { INSURANCE_SITE_URL } from "../config/govReportImportConfig";
import { useGovReportDomainPage } from "../hooks/useGovReportDomainPage";
import { computeImportHistoryDelta } from "../utils/domainImportHistory";

const HAR_HABITUACH_URL = INSURANCE_SITE_URL;
const MAX_FILE_BYTES = 5 * 1024 * 1024;
const fmt = formatCurrencyOrDash;

export default function InsurancePage() {
  const agentOnboarding = useAgentOnboarding("insurance");

  function insuranceShell(children: React.ReactNode) {
    return (
      <div data-agent="insurance" style={{ minHeight: "100vh", background: "var(--surface-page)", backgroundImage: "radial-gradient(rgba(218,111,68,.06) 1px,transparent 1px)", backgroundSize: "22px 22px", color: "var(--text-body)", fontFamily: "var(--font-body)", direction: "rtl" }}>
        <AgentOnboardingModal
          open={agentOnboarding.showModal}
          agentLabel="ביטוח"
          estimatedMinutes={agentOnboarding.state?.estimatedMinutes}
          questions={agentOnboarding.state?.missingQuestions || []}
          onClose={agentOnboarding.dismiss}
          onSubmit={agentOnboarding.submit}
        />
        <PrivateTopbar />
        {children}
        <AppFooter variant="private" />
      </div>
    );
  }
  const [data, setData] = useState<InsuranceAnalysisResponse["data"] | null>(null);
  const [loading, setLoading] = useState(true);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [importHistory, setImportHistory] = useState<InsuranceImportHistoryItem[]>([]);
  const [lastImported, setLastImported] = useState<number | null>(null);

  const loadImportHistory = useCallback(async () => {
    const res = await getInsuranceImportHistory();
    if (res.ok && res.data?.success && res.data.data) {
      setImportHistory(res.data.data);
    }
  }, []);

  const load = useCallback(async (): Promise<number> => {
    setLoading(true);
    setAnalysisError(null);
    const res = await getInsuranceAnalysis();
    let policyCount = 0;
    if (res.ok && res.data?.success && res.data.data) {
      setData(res.data.data);
      policyCount = res.data.data.policies?.length ?? 0;
    } else if (!res.ok) {
      setAnalysisError(res.error?.message ?? "שגיאה בטעינת נתוני הביטוח");
    } else {
      setAnalysisError("שגיאה בטעינת נתוני הביטוח");
    }
    setLoading(false);
    return policyCount;
  }, []);

  const flow = useGovReportDomainPage({
    progressStepCount: UPLOAD_PROGRESS_STEPS.length,
    allowedExts: ["xlsx", "xls"],
    maxFileBytes: MAX_FILE_BYTES,
    extErrorMessage: "ניתן להעלות קבצי Excel בלבד (.xlsx / .xls)",
    sizeErrorMessage: "הקובץ גדול מדי. מקסימום 5MB.",
    uploadFile: uploadInsuranceExcel,
    extractSavingsDelta: res => res.data?.savingsDelta ?? null,
    onUploadSuccess: res => setLastImported(res.data?.imported ?? null),
    uploadSuccessMessage: res => {
      const imported = res.data?.imported ?? 0;
      return imported > 0
        ? `יובאו ${imported} פוליסות בהצלחה — הסוכן מנתח...`
        : "הדוח נקלט בהצלחה — לא נמצאו בו פוליסות פעילות, הסוכן ממשיך לניתוח לפי השאלון.";
    },
    reloadAfterUpload: async () => { await load(); },
    reloadImportHistory: loadImportHistory,
    // keep the redesigned success state visible; the user advances via the
    // "צפה בתובנות הסוכן" button rather than an automatic timeout.
    autoAdvanceOnSuccess: false,
  });

  const {
    step, setStep, uploading, uploadMsg, uploadProgressStep,
    isDragging, setIsDragging, setVisitedSite,
    lastSavingsDelta, handleUpload,
  } = flow;

  useEffect(() => {
    void load();
    void loadImportHistory();
  }, [load, loadImportHistory]);

  // On first load: skip to results when insurance onboarding is complete,
  // even if Har HaBituach contained 0 active policies.
  useEffect(() => {
    if (step !== "landing" || loading) return;
    if (!data) return;

    const policyCount = data?.policies?.length ?? 0;
    if (policyCount === 0) return;

    void getInsuranceOnboardingSession().then(res => {
      if (res.ok && res.data?.success && res.data.data?.completed) {
        setStep("results");
      }
    });
  }, [data, step, loading, setStep]);

  const handleDelete = async (id: string) => {
    if (!window.confirm("למחוק פוליסה זו?")) return;
    setDeletingId(id);
    await deleteInsurancePolicy(id);
    setDeletingId(null);
    const policyCount = await load();
    if (policyCount === 0) {
      setStep("landing");
    }
  };

  const continueAfterUpload = async () => {
    const res = await getInsuranceOnboardingSession();
    if (res.ok && res.data?.success && res.data.data?.completed) {
      await load();
      setStep("results");
      return;
    }
    setStep("onboarding");
  };

  const showResults = () => {
    setStep("results");
    void load();
  };

  const analysis = data?.analysis;
  const healthCheck = data?.healthCheck;
  const policies = data?.policies ?? [];
  const recs = data?.recommendations ?? [];
  const totalPremium = policies.reduce((s, p) => s + (p.monthlyPremium ?? 0), 0);

  // Opening / empty state — the redesigned insurance agent landing.
  if (step === "landing") {
    return <InsuranceLandingScreen loading={loading} onImport={() => setStep("guide")} />;
  }

  // Import guide — interactive stepper with a pouring progress spine (design-system).
  if (step === "guide") {
    return insuranceShell(
      <InsuranceImportGuide
        onBack={() => setStep("landing")}
        onContinue={() => setStep("upload")}
        onVisitSite={() => {
          window.open(HAR_HABITUACH_URL, "_blank", "noopener,noreferrer");
          setVisitedSite(true);
        }}
      />,
    );
  }

  // Upload — step 2/2 redesign: real dropzone wired to uploadInsuranceExcel.
  if (step === "upload") {
    return insuranceShell(
      <InsuranceUpload
        onBack={() => setStep("guide")}
        onContinue={() => { void continueAfterUpload(); }}
        onUpload={handleUpload}
        uploading={uploading}
        uploadMsg={uploadMsg}
        uploadProgressStep={uploadProgressStep}
        progressSteps={UPLOAD_PROGRESS_STEPS}
        isDragging={isDragging}
        setIsDragging={setIsDragging}
        importedCount={lastImported}
      />,
    );
  }

  if (step === "onboarding") {
    return insuranceShell(
      <InsuranceOnboardingWizard
        onBack={() => setStep("upload")}
        onComplete={showResults}
      />,
    );
  }

  // Results — insurance analysis (design-system, peach accent).
  return insuranceShell(
    <ResultsStep
      loading={loading}
      analysisError={analysisError}
      onRetry={() => void load()}
      analysis={analysis}
      healthCheck={healthCheck}
      marketAdvice={data?.marketAdvice}
      importHistory={importHistory}
      lastSavingsDelta={lastSavingsDelta}
      policies={policies}
      recs={recs}
      totalPremium={totalPremium}
      deletingId={deletingId}
      onDelete={handleDelete}
      onReimport={() => setStep("guide")}
    />,
  );
}

/* ════════════════════════════════════════════════════════════════
   LANDING — insurance agent opening / empty state (design-system)
════════════════════════════════════════════════════════════════ */
const RING = { x: 190, y: 132 };
const POLICY_NODES = [
  { label: "ביטוח חיים", x: 58, y: 52, color: "#7C5FD6", bend: -1 },
  { label: "בריאות", x: 322, y: 46, color: "#2F9C62", bend: 1 },
  { label: "רכב", x: 46, y: 214, color: "#B98B16", bend: 1 },
  { label: "דירה", x: 334, y: 210, color: "#DA6F44", bend: -1 },
];
function nodePath(n: { x: number; y: number; bend: number }) {
  const mx = (n.x + RING.x) / 2, my = (n.y + RING.y) / 2;
  const dx = RING.x - n.x, dy = RING.y - n.y, len = Math.hypot(dx, dy) || 1;
  const k = 0.22 * len * n.bend;
  const cpx = mx + (-dy / len) * k, cpy = my + (dx / len) * k;
  return `M${n.x} ${n.y} Q${cpx} ${cpy} ${RING.x} ${RING.y}`;
}

const SAVINGS_SPARK = [5, 6, 6, 8, 9, 11, 10, 14];
function MiniSpark({ arr, w = 56, h = 22 }: { arr: number[]; w?: number; h?: number }) {
  const max = Math.max(...arr), min = Math.min(...arr), span = max - min || 1;
  const pts = arr.map((v, i) => [(i / (arr.length - 1)) * w, h - ((v - min) / span) * (h - 3) - 1.5]);
  const d = pts.map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(" ");
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ display: "block", flex: "none" }}>
      <path d={`${d} L${w} ${h} L0 ${h} Z`} fill="var(--mint-soft)" opacity={0.7} />
      <path d={d} fill="none" stroke="var(--mint-ink)" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={pts[pts.length - 1][0]} cy={pts[pts.length - 1][1]} r={2.4} fill="var(--mint-ink)" />
    </svg>
  );
}

const tnum: React.CSSProperties = { fontVariantNumeric: "tabular-nums" };

function InsuranceLandingScreen({ loading, onImport }: { loading: boolean; onImport: () => void }) {
  const [cardLoading, setCardLoading] = useState(true);
  const [cardReady, setCardReady] = useState(false);
  // demo card has no real fetch — simulate an answer arriving after a moment
  useEffect(() => {
    if (!cardLoading) return;
    setCardReady(false);
    const t = setTimeout(() => setCardReady(true), 4200);
    return () => clearTimeout(t);
  }, [cardLoading]);
  useEffect(() => {
    if (document.getElementById("ins-anim")) return;
    const st = document.createElement("style");
    st.id = "ins-anim";
    st.textContent =
      "@keyframes insFlow{from{stroke-dashoffset:124}to{stroke-dashoffset:0}}" +
      "@keyframes insRise{from{opacity:0;transform:translateY(18px)}to{opacity:1;transform:none}}" +
      "@keyframes insRingScale{from{opacity:0;transform:scale(.92)}to{opacity:1;transform:none}}" +
      "@keyframes insDraw{from{stroke-dashoffset:289}to{stroke-dashoffset:78}}" +
      "@keyframes insNodeIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}" +
      "@media (prefers-reduced-motion:reduce){.ins-flow{animation:none!important}.ins-arc{stroke-dashoffset:78!important;animation:none!important}}";
    document.head.appendChild(st);
  }, []);

  const findings: { icon: LucideIcon; label: string; sub: string; value: string; unit?: string; pill: string; tone: "pos" | "warn" | "peach"; spark?: number[] }[] = [
    { icon: TrendingUp, label: "חיסכון שנתי", sub: "מול דמי הניהול היום", value: "₪3,200", pill: "▲ 18%", tone: "pos", spark: SAVINGS_SPARK },
    { icon: ShieldCheck, label: "כפילויות בכיסוי", sub: "פוליסות חופפות", value: "2", unit: "פוליסות", pill: "לבדיקה", tone: "warn" },
    { icon: AlertTriangle, label: "פער בכיסוי", sub: "ללא כיסוי פעיל", value: "ביטוח חיים", pill: "פעולה נדרשת", tone: "peach" },
  ];
  const findTone: Record<string, [string, string]> = {
    pos: ["var(--mint-soft)", "var(--mint-ink)"],
    warn: ["var(--lav-100)", "var(--lav-600)"],
    peach: ["var(--peach-soft)", "var(--peach-ink)"],
  };

  const checks: { icon: LucideIcon; title: string; body: string }[] = [
    { icon: TrendingUp, title: "חיסכון בפרמיות", body: "איפה אתה משלם יותר מהממוצע בשוק — בלי לפגוע בכיסוי." },
    { icon: AlertTriangle, title: "פערים בכיסוי", body: "ביטוחים חיוניים שחסרים לך, לפני שזה עולה לך ביוקר." },
    { icon: ShieldCheck, title: "כפילויות", body: "פוליסות חופפות שגורמות לך לשלם פעמיים על אותו דבר." },
    { icon: BarChart3, title: "השוואה לשוק", body: "מיקום הפוליסות שלך מול אלפי משתמשים אחרים." },
  ];

  return (
    <div data-agent="insurance" style={{ minHeight: "100vh", background: "var(--surface-page)", color: "var(--text-body)", fontFamily: "var(--font-body)", direction: "rtl", position: "relative" }}>
      <InsuranceRibbonWave />
      <div style={{ position: "relative", zIndex: 1 }}>
        <PrivateTopbar />

        {loading ? (
          <div style={{ minHeight: "60vh", display: "grid", placeItems: "center", color: "var(--peach-ink)", fontSize: 14 }}>
            <div style={{ textAlign: "center" }}>
              <Loader2 size={28} style={{ animation: "spin 0.8s linear infinite", marginBottom: 12 }} />
              <div>טוען נתוני ביטוח...</div>
            </div>
          </div>
        ) : (
          <main style={{ maxWidth: 1080, margin: "0 auto", padding: "44px 24px 84px" }}>
            {/* HERO — asymmetric */}
            <div style={{ display: "grid", gridTemplateColumns: "1.05fr 1fr", gap: 56, alignItems: "center" }}>
              {/* copy + CTA */}
              <div style={{ animation: "insRise .6s var(--ease) both" }}>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "6px 13px 6px 10px", borderRadius: 999, background: "var(--peach-soft)", border: "1px solid rgba(218,111,68,.22)", fontSize: 13, fontWeight: 800, color: "var(--peach-ink)", letterSpacing: "-.01em" }}>
                  <span style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--peach-ink)" }} />סוכן הביטוח
                </span>
                <h1 style={{ fontSize: "clamp(34px,4.4vw,54px)", fontWeight: 900, letterSpacing: "-.04em", lineHeight: 1.02, margin: "20px 0 18px", color: "var(--text-strong)" }}>
                  כל הביטוחים שלך,<br />מנותחים במקום אחד.
                </h1>
                <p style={{ fontSize: 18, color: "var(--text-muted)", lineHeight: 1.6, fontWeight: 500, margin: "0 0 30px", maxWidth: 440 }}>
                  ייבוא חד‑פעמי מ<b style={{ color: "var(--ink)", fontWeight: 800 }}>הר הביטוח</b> והסוכן מזהה כפילויות, פערים בכיסוי ואיפה אתה משלם יותר מדי — עם המלצה ברורה לכל פוליסה.
                </p>
                <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                  <button
                    onClick={onImport}
                    style={{ display: "inline-flex", alignItems: "center", gap: 9, padding: "15px 28px", borderRadius: "var(--r-btn)", border: "1px solid transparent", cursor: "pointer", fontFamily: "inherit", fontWeight: 800, fontSize: 16, color: "#fff", background: "var(--ink)", boxShadow: "var(--shadow-ink)", transition: "transform .25s var(--ease), box-shadow .25s var(--ease)" }}
                    onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = "0 24px 48px -16px rgba(23,18,33,.8)"; }}
                    onMouseLeave={e => { e.currentTarget.style.transform = "none"; e.currentTarget.style.boxShadow = "var(--shadow-ink)"; }}
                  >
                    <FileText size={18} strokeWidth={2} /> ייבוא מהר הביטוח
                  </button>
                  <button
                    style={{ padding: "15px 24px", borderRadius: "var(--r-btn)", border: "1px solid var(--glass-border)", background: "var(--glass-bg)", backdropFilter: "blur(var(--blur-glass)) saturate(160%)", WebkitBackdropFilter: "blur(var(--blur-glass)) saturate(160%)", cursor: "pointer", fontFamily: "inherit", fontWeight: 700, fontSize: 15, color: "var(--text-body)", boxShadow: "var(--shadow-soft)", transition: "transform .25s var(--ease), border-color .25s var(--ease)" }}
                    onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.borderColor = "var(--lav-300)"; }}
                    onMouseLeave={e => { e.currentTarget.style.transform = "none"; e.currentTarget.style.borderColor = "var(--glass-border)"; }}
                  >איך זה עובד?</button>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 9, marginTop: 22, fontSize: 13, color: "var(--text-faint)", fontWeight: 600 }}>
                  <Lock size={15} color="var(--mint-ink)" />
                  מבוסס על נתוני הר הביטוח — אתר רשמי של משרד האוצר · ~2 דקות
                </div>
              </div>

              {/* coverage analysis preview */}
              <div style={{ position: "relative", background: "var(--card)", border: "1px solid var(--border-hair)", borderRadius: "var(--radius)", boxShadow: "var(--shadow-card)", padding: "20px 20px 18px", animation: "insRingScale .6s var(--ease) .1s both", backgroundImage: "radial-gradient(rgba(123,95,214,.05) 1px,transparent 1px)", backgroundSize: "18px 18px" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                  <span style={{ fontSize: 13.5, fontWeight: 800, color: "var(--ink)" }}>ניתוח הכיסוי שלך</span>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11, fontWeight: 800, color: "var(--text-faint)", letterSpacing: ".04em" }}>
                    <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--peach-ink)" }} />דוגמה
                  </span>
                </div>
                {cardLoading ? (
                  <AIInsightsLoadingState agent="insurance" expectedMs={4200} ready={cardReady} onComplete={() => setCardLoading(false)} />
                ) : (
                <div style={{ animation: "insRise .5s var(--ease) both" }}>
                <svg viewBox="0 0 380 300" style={{ width: "100%", display: "block", overflow: "visible" }}>
                  {POLICY_NODES.map((n, i) => (
                    <g key={n.label}>
                      <path d={nodePath(n)} fill="none" stroke={n.color} strokeOpacity=".2" strokeWidth="1.4" strokeLinecap="round" strokeDasharray="1.5 7" />
                      <path className="ins-flow" d={nodePath(n)} fill="none" stroke={n.color} strokeWidth="2.4" strokeLinecap="round" pathLength={100} strokeDasharray="14 100" style={{ animation: `insFlow ${4.4 + i * 0.5}s linear infinite`, animationDelay: `${i * 0.6}s` }} />
                    </g>
                  ))}
                  {POLICY_NODES.map((n, i) => (
                    <g key={n.label + "n"} style={{ animation: `insNodeIn .5s var(--ease) ${0.25 + i * 0.08}s both` }}>
                      <circle cx={n.x} cy={n.y} r="5" fill={n.color} />
                      <circle cx={n.x} cy={n.y} r="9" fill="none" stroke={n.color} strokeOpacity=".28" strokeWidth="1.5" />
                    </g>
                  ))}
                  <circle cx={RING.x} cy={RING.y} r="46" fill="var(--card)" stroke="var(--hair)" strokeWidth="9" />
                  <circle className="ins-arc" cx={RING.x} cy={RING.y} r="46" fill="none" stroke="var(--peach-ink)" strokeWidth="9" strokeLinecap="round" pathLength={289} strokeDasharray="289" strokeDashoffset="78" transform={`rotate(-90 ${RING.x} ${RING.y})`} style={{ animation: "insDraw 1.1s var(--ease) .3s both" }} />
                  <text x={RING.x} y={RING.y - 3} textAnchor="middle" fontSize="34" fontWeight="900" fill="var(--ink)" style={{ letterSpacing: "-.04em" }}>82</text>
                  <text x={RING.x} y={RING.y + 18} textAnchor="middle" fontSize="12" fontWeight="700" fill="var(--text-muted)">ציון כיסוי</text>
                  {POLICY_NODES.map((n) => (
                    <text key={n.label + "t"} x={n.x} y={n.y > RING.y ? n.y + 22 : n.y - 14} textAnchor="middle" fontSize="12.5" fontWeight="700" fill="var(--ink-soft)">{n.label}</text>
                  ))}
                </svg>

                <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 6 }}>
                  {findings.map((f) => {
                    const [bg, fg] = findTone[f.tone];
                    const Icon = f.icon;
                    return (
                      <div key={f.label} style={{ display: "flex", alignItems: "center", gap: 11, padding: "10px 12px", borderRadius: "var(--r-sm)", background: "var(--surface-sunken)", border: "1px solid var(--border-hair)" }}>
                        <span style={{ width: 32, height: 32, borderRadius: 9, flex: "none", background: bg, color: fg, display: "grid", placeItems: "center" }}><Icon size={16} /></span>
                        <div style={{ display: "flex", flexDirection: "column", gap: 1, minWidth: 0 }}>
                          <span style={{ fontSize: 12.5, fontWeight: 800, color: "var(--ink)", letterSpacing: "-.01em" }}>{f.label}</span>
                          <span style={{ fontSize: 10.5, fontWeight: 600, color: "var(--text-faint)" }}>{f.sub}</span>
                        </div>
                        {f.spark ? <span style={{ marginInlineStart: "auto" }}><MiniSpark arr={f.spark} /></span> : null}
                        <div style={{ marginInlineStart: f.spark ? 0 : "auto", display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4, flex: "none" }}>
                          <span style={{ ...tnum, fontSize: 15, fontWeight: 900, lineHeight: 1, color: f.tone === "pos" ? "var(--mint-ink)" : "var(--ink)" }}>
                            {f.value}{f.unit ? <span style={{ fontSize: 10.5, fontWeight: 700, color: "var(--text-faint)", marginInlineStart: 3 }}>{f.unit}</span> : null}
                          </span>
                          <span style={{ fontSize: 10, fontWeight: 800, color: fg, background: bg, padding: "2px 7px", borderRadius: 999, ...tnum }}>{f.pill}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
                </div>
                )}
              </div>
            </div>

            {/* WHAT THE AGENT CHECKS */}
            <div style={{ marginTop: 64 }}>
              <h2 style={{ fontSize: 13, fontWeight: 800, color: "var(--text-faint)", letterSpacing: ".06em", margin: "0 0 20px" }}>מה הסוכן בודק עבורך</h2>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14 }}>
                {checks.map((f) => {
                  const Icon = f.icon;
                  return (
                    <div key={f.title} style={{ background: "var(--card)", border: "1px solid var(--border-hair)", borderRadius: "var(--radius)", padding: 20, transition: "border-color .25s var(--ease), transform .25s var(--ease)" }}
                      onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-3px)"; e.currentTarget.style.borderColor = "rgba(218,111,68,.4)"; }}
                      onMouseLeave={(e) => { e.currentTarget.style.transform = "none"; e.currentTarget.style.borderColor = "var(--border-hair)"; }}>
                      <span style={{ width: 38, height: 38, borderRadius: 10, background: "var(--lav-50)", color: "var(--peach-ink)", display: "grid", placeItems: "center", marginBottom: 14 }}><Icon size={20} strokeWidth={1.85} /></span>
                      <h3 style={{ margin: "0 0 6px", fontSize: 15.5, fontWeight: 800, letterSpacing: "-.01em", color: "var(--text-strong)" }}>{f.title}</h3>
                      <p style={{ margin: 0, fontSize: 13, color: "var(--text-muted)", lineHeight: 1.55 }}>{f.body}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          </main>
        )}

        <AppFooter variant="private" />
      </div>
    </div>
  );
}

function ResultsStep({
  loading, analysisError, onRetry,
  analysis, healthCheck, marketAdvice, importHistory, lastSavingsDelta,
  policies, recs, totalPremium, deletingId, onDelete, onReimport,
}: {
  loading: boolean;
  analysisError: string | null;
  onRetry: () => void;
  analysis: InsuranceAnalysisDTO | null | undefined;
  healthCheck: InsuranceHealthCheck | undefined;
  marketAdvice?: InsuranceMarketAdvice;
  importHistory: InsuranceImportHistoryItem[];
  lastSavingsDelta: number | null;
  policies: InsurancePolicyDTO[];
  recs: InsuranceRecommendationDTO[];
  totalPremium: number;
  deletingId: string | null;
  onDelete: (id: string) => void;
  onReimport: () => void;
}) {
  const historyDelta = computeImportHistoryDelta(importHistory, "annualSavings", lastSavingsDelta);

  useEffect(() => {
    if (document.getElementById("res-anim")) return;
    const st = document.createElement("style");
    st.id = "res-anim";
    st.textContent =
      "@keyframes resShine{to{background-position:220% center}}" +
      "@keyframes resFloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-7px)}}";
    document.head.appendChild(st);
  }, []);

  const wrap = (children: React.ReactNode) => <main style={{ maxWidth: 900, margin: "0 auto", padding: "40px 24px 84px" }}>{children}</main>;

  if (loading) {
    return wrap(
      <div style={{ textAlign: "center", padding: "70px 0", color: "var(--peach-ink)" }}>
        <Loader2 size={28} style={{ animation: "spin .8s linear infinite" }} />
        <div style={{ marginTop: 12, fontSize: 14, color: "var(--text-muted)" }}>מנתח את הפוליסות…</div>
      </div>,
    );
  }
  if (analysisError) {
    return wrap(
      <div style={{ textAlign: "center", padding: "40px 24px", background: "var(--card)", border: "1px solid rgba(214,69,69,.22)", borderRadius: "var(--radius)", boxShadow: "var(--shadow-soft)" }}>
        <AlertCircle size={28} color="var(--danger)" />
        <div style={{ fontWeight: 800, fontSize: 16, color: "var(--text-strong)", margin: "12px 0 8px" }}>שגיאה בטעינת הניתוח</div>
        <div style={{ fontSize: 14, color: "var(--text-muted)", marginBottom: 16 }}>{analysisError}</div>
        <button onClick={onRetry} style={inkBtn}>נסה שוב</button>
      </div>,
    );
  }
  const hasAnalysisOutput = Boolean(analysis || healthCheck || marketAdvice || recs.length > 0);
  if (policies.length === 0 && !hasAnalysisOutput) {
    return wrap(
      <div style={{ textAlign: "center", padding: "56px 24px", background: "var(--card)", border: "1px solid var(--border-hair)", borderRadius: "var(--radius)", boxShadow: "var(--shadow-soft)" }}>
        <span style={{ width: 58, height: 58, borderRadius: 16, background: "var(--peach-soft)", color: "var(--peach-ink)", display: "grid", placeItems: "center", margin: "0 auto 16px" }}><Shield size={28} /></span>
        <h2 style={{ margin: "0 0 8px", fontSize: 22, fontWeight: 900, color: "var(--text-strong)" }}>אין עדיין פוליסות ביטוח</h2>
        <p style={{ fontSize: 14.5, color: "var(--text-muted)", margin: "0 0 20px" }}>ייבא דוח מהר הביטוח כדי לקבל ניתוח מלא</p>
        <button onClick={onReimport} style={inkBtn}>ייבא דוח ביטוח</button>
      </div>,
    );
  }

  const annualSavings = analysis?.savings?.annualSavings ?? 0;
  const monthlyWaste = analysis?.totalMonthlyWaste ?? 0;
  const missing = analysis?.missingCoverage ?? [];
  const duplicates = analysis?.duplicates ?? [];
  const score = healthCheck?.score;
  const isReportWithoutPolicies = policies.length === 0 && hasAnalysisOutput;
  const heroMetric = isReportWithoutPolicies
    ? (score != null ? `${score}/100` : String(missing.length))
    : fmt(annualSavings);
  const heroMetricLabel = isReportWithoutPolicies
    ? (score != null ? "ציון התאמת כיסוי" : "כיסויים חסרים")
    : "פוטנציאל חיסכון שנתי";
  const heroDescription = isReportWithoutPolicies
    ? "הדוח נקלט, אבל לא נמצאו בו פוליסות פעילות. הניתוח מבוסס על תשובות השאלון ומדגיש כיסויים שכדאי לבדוק."
    : "על בסיס זיהוי כפילויות ואופטימיזציית פרמיות בפוליסות שלך.";

  const stats: { icon: LucideIcon; label: string; value: string; bg: string; fg: string }[] = [
    ...(score != null ? [{ icon: ShieldCheck, label: "ציון כיסוי", value: String(score), bg: "var(--peach-soft)", fg: "var(--peach-ink)" }] : []),
    { icon: AlertTriangle, label: "כיסויים לבדיקה", value: String(missing.length), bg: "var(--butter-soft)", fg: "var(--butter-ink)" },
    { icon: Lightbulb, label: "המלצות", value: String(recs.length), bg: "var(--mint-soft)", fg: "var(--mint-ink)" },
    { icon: FileText, label: "פוליסות פעילות בדוח", value: String(policies.length), bg: "var(--lav-100)", fg: "var(--lav-600)" },
    ...(!isReportWithoutPolicies ? [
      { icon: Shield, label: "הוצאה חודשית", value: fmt(totalPremium), bg: "var(--peach-soft)", fg: "var(--peach-ink)" },
      { icon: TrendingDown, label: "בזבוז מכפילויות", value: fmt(monthlyWaste), bg: monthlyWaste > 0 ? "rgba(214,69,69,.08)" : "var(--surface-sunken)", fg: monthlyWaste > 0 ? "var(--danger)" : "var(--text-faint)" },
      { icon: TrendingUp, label: "חיסכון שנתי", value: fmt(annualSavings), bg: "var(--mint-soft)", fg: "var(--mint-ink)" },
    ] : []),
  ].slice(0, isReportWithoutPolicies ? 4 : 6);

  const urgencyMap: Record<string, [string, string, string]> = {
    high: ["var(--peach-soft)", "var(--peach-ink)", "גבוהה"],
    medium: ["var(--butter-soft)", "var(--butter-ink)", "בינונית"],
    low: ["var(--lav-100)", "var(--lav-600)", "נמוכה"],
  };

  const RC = 2 * Math.PI * 42;
  const pricingDisclaimer = marketAdvice?.disclaimer
    ?? "המחירים הם הערכות המבוססות על מדגם נתונים מקומי ואינם הצעות מחיר רשמיות מחברות הביטוח.";
  const pricingSource = marketAdvice?.pricingSource;
  const comparisonMatrix = marketAdvice?.comparisonMatrix ?? [];

  const premStatusHe: Record<string, string> = {
    below_market: "מתחת לשוק",
    fair: "בטווח הוגן",
    above_market: "מעל הממוצע",
    high: "גבוה משמעותית",
    unknown: "לא ידוע",
  };

  return wrap(
    <>
      {/* pricing source disclaimer */}
      <div role="note" style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: "12px 16px", marginBottom: 20, borderRadius: "var(--r-md)", background: "var(--butter-soft)", border: "1px solid var(--butter)" }}>
        <AlertCircle size={17} color="var(--butter-ink)" style={{ flex: "none", marginTop: 2 }} />
        <div style={{ fontSize: 13, lineHeight: 1.55, color: "var(--butter-ink)" }}>
          <div style={{ fontWeight: 800, marginBottom: 4 }}>{pricingDisclaimer}</div>
          {pricingSource && (
            <div style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 600 }}>
              מקור: {pricingSource.sourceName} · {pricingSource.sourceDate}
              {pricingSource.dataCollectionMethod ? ` · ${pricingSource.dataCollectionMethod}` : ""}
            </div>
          )}
        </div>
      </div>

      {/* header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, flexWrap: "wrap", marginBottom: 22 }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
          <span style={{ width: 46, height: 46, borderRadius: 13, flex: "none", background: "var(--peach-soft)", color: "var(--peach-ink)", display: "grid", placeItems: "center" }}><Shield size={22} /></span>
          <div>
            <h1 style={{ margin: 0, fontSize: "clamp(24px,3vw,34px)", fontWeight: 900, letterSpacing: "-.03em", color: "var(--text-strong)" }}>
              {isReportWithoutPolicies ? "בדיקת כיסוי ביטוחי" : "ניתוח הביטוח שלך"}
            </h1>
            <p style={{ margin: "6px 0 0", fontSize: 15, color: "var(--text-muted)", fontWeight: 500 }}>
              {isReportWithoutPolicies
                ? "הדוח תקין, אך לא נמצאו פוליסות פעילות. הנה תמונת מצב לפי השאלון."
                : `${policies.length} פוליסות פעילות · עלות חודשית ${fmt(totalPremium)}`}
            </p>
          </div>
        </div>
        <button onClick={onReimport} style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "10px 18px", borderRadius: "var(--r-pill)", border: "1px solid var(--border-soft)", background: "var(--card)", color: "var(--ink)", cursor: "pointer", fontFamily: "inherit", fontWeight: 800, fontSize: 13.5, boxShadow: "var(--shadow-soft)" }}><RefreshCw size={15} /> ייבוא מחדש</button>
      </div>

      {/* delta banner */}
      {historyDelta != null && historyDelta !== 0 && (
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 16px", borderRadius: "var(--r-md)", background: historyDelta > 0 ? "var(--mint-soft)" : "var(--peach-soft)", border: `1px solid ${historyDelta > 0 ? "var(--mint)" : "var(--peach)"}`, marginBottom: 20 }}>
          {historyDelta > 0 ? <TrendingUp size={17} color="var(--mint-ink)" /> : <TrendingDown size={17} color="var(--peach-ink)" />}
          <span style={{ fontSize: 13.5, fontWeight: 700, color: historyDelta > 0 ? "var(--mint-ink)" : "var(--peach-ink)" }}>שינוי בחיסכון שנתי מאז הייבוא הקודם: {historyDelta > 0 ? "+" : ""}{fmt(historyDelta)}</span>
        </div>
      )}

      {/* HERO */}
      <div style={{ position: "relative", overflow: "hidden", borderRadius: "var(--radius)", padding: "32px 30px", marginBottom: 34, background: "linear-gradient(120deg,var(--peach-soft),var(--lav-100) 55%,var(--mint-soft))", border: "1px solid var(--border-soft)", boxShadow: "var(--shadow-card)" }}>
        <div style={{ position: "absolute", inset: 0, backgroundImage: "radial-gradient(rgba(255,255,255,.5) 1px,transparent 1px)", backgroundSize: "20px 20px", opacity: 0.5, pointerEvents: "none" }} />
        <span style={{ position: "absolute", insetInlineStart: 24, top: 22, color: "var(--peach-ink)", animation: "resFloat 4s ease-in-out infinite" }}><Sparkles size={20} /></span>
        <div style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 26, flexWrap: "wrap" }}>
          <div style={{ minWidth: 260 }}>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "rgba(255,255,255,.7)", border: "1px solid var(--border-soft)", borderRadius: 999, padding: "6px 14px", marginBottom: 16, fontSize: 12.5, fontWeight: 800, color: "var(--peach-ink)" }}>
              <span style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--mint-ink)", boxShadow: "0 0 0 4px rgba(47,156,98,.18)" }} />הניתוח הושלם
            </div>
            <div style={{ fontSize: 14.5, color: "var(--ink-soft)", fontWeight: 600, marginBottom: 6 }}>{heroMetricLabel}</div>
            <div style={{ fontSize: "clamp(42px,6vw,64px)", fontWeight: 900, letterSpacing: "-.045em", lineHeight: 0.95, backgroundImage: "linear-gradient(96deg,var(--peach-ink),var(--lav-600) 55%,var(--mint-ink))", backgroundSize: "220% auto", WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent", animation: "resShine 4.5s linear infinite" }}>{heroMetric}</div>
            <div style={{ fontSize: 15, color: "var(--text-muted)", fontWeight: 500, marginTop: 10, maxWidth: 420 }}>{heroDescription}</div>
          </div>
          {score != null && (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, background: "rgba(255,255,255,.62)", backdropFilter: "blur(8px)", border: "1px solid var(--border-soft)", borderRadius: "var(--radius)", padding: "20px 26px" }}>
              <div style={{ position: "relative", width: 96, height: 96 }}>
                <svg width="96" height="96" viewBox="0 0 96 96" style={{ transform: "rotate(-90deg)" }}>
                  <circle cx="48" cy="48" r="42" fill="none" stroke="var(--hair)" strokeWidth="8" />
                  <circle cx="48" cy="48" r="42" fill="none" stroke="var(--peach-ink)" strokeWidth="8" strokeLinecap="round" strokeDasharray={RC} strokeDashoffset={RC * (1 - Math.min(score, 100) / 100)} style={{ transition: "stroke-dashoffset 1s var(--ease)" }} />
                </svg>
                <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", fontSize: 28, fontWeight: 900, letterSpacing: "-.04em", color: "var(--ink)" }}>{score}</div>
              </div>
              <div style={{ fontSize: 13, fontWeight: 800, color: "var(--peach-ink)" }}>ציון כיסוי</div>
              {healthCheck?.level?.label && <div style={{ fontSize: 11.5, color: "var(--text-muted)", fontWeight: 600 }}>{healthCheck.level.label}</div>}
            </div>
          )}
        </div>
      </div>

      {isReportWithoutPolicies && (
        <div role="note" style={{ display: "flex", gap: 12, alignItems: "flex-start", padding: "16px 18px", marginBottom: 28, borderRadius: "var(--r-md)", background: "var(--surface-sunken)", border: "1px solid var(--border-hair)" }}>
          <FileText size={20} color="var(--peach-ink)" style={{ flex: "none", marginTop: 2 }} />
          <div>
            <div style={{ fontSize: 15, fontWeight: 900, color: "var(--text-strong)", marginBottom: 4 }}>לא נמצאו פוליסות פעילות בדוח</div>
            <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.6, color: "var(--text-muted)" }}>
              זה יכול לקרות אם אין לך ביטוחים פרטיים פעילים, אם הדוח הופק ללא פוליסות, או אם קיימים כיסויים דרך קופת חולים/מעסיק שלא מופיעים כדוח פוליסות פעיל.
              לכן הסוכן מציג המלצות לפי פרופיל הסיכון שמילאת בשאלון.
            </p>
          </div>
        </div>
      )}

      {/* stat grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 14, marginBottom: 34 }}>
        {stats.map(s => {
          const Icon = s.icon;
          return (
            <div key={s.label} style={{ background: "var(--card)", border: "1px solid var(--border-hair)", borderRadius: "var(--r-md)", padding: "18px 16px", boxShadow: "var(--shadow-soft)" }}>
              <span style={{ width: 36, height: 36, borderRadius: 10, background: s.bg, color: s.fg, display: "grid", placeItems: "center", marginBottom: 12 }}><Icon size={18} /></span>
              <div style={{ fontSize: 22, fontWeight: 900, letterSpacing: "-.03em", lineHeight: 1, color: "var(--ink)", fontVariantNumeric: "tabular-nums" }}>{s.value}</div>
              <div style={{ fontSize: 12.5, color: "var(--text-muted)", fontWeight: 600, marginTop: 6 }}>{s.label}</div>
            </div>
          );
        })}
      </div>

      {/* market comparison */}
      {comparisonMatrix.length > 0 && (
        <Section title="השוואת פרמיה לטווח הוגן" sub="מול מדגם מחירים מקומי — לא הצעות מחיר רשמיות">
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {comparisonMatrix.map(row => (
              <div key={row.policyId} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "14px 16px", background: "var(--card)", border: "1px solid var(--border-hair)", borderRadius: "var(--r-md)", boxShadow: "var(--shadow-soft)" }}>
                <div>
                  <div style={{ fontWeight: 800, fontSize: 14, color: "var(--ink)" }}>{row.type}</div>
                  <div style={{ fontSize: 12.5, color: "var(--text-muted)" }}>{row.provider ?? "—"}</div>
                </div>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 11, color: "var(--text-faint)", fontWeight: 700 }}>שלך</div>
                  <div style={{ fontWeight: 900, fontSize: 15 }}>{fmt(row.userCost)}</div>
                </div>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 11, color: "var(--text-faint)", fontWeight: 700 }}>ממוצע שוק</div>
                  <div style={{ fontWeight: 900, fontSize: 15 }}>{fmt(row.marketAvg)}</div>
                </div>
                <span style={{ fontSize: 11.5, fontWeight: 800, color: "var(--peach-ink)", background: "var(--peach-soft)", borderRadius: 999, padding: "4px 10px", flex: "none" }}>
                  {premStatusHe[row.premiumVsMarket] ?? row.premiumVsMarket}
                </span>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* health check */}
      {healthCheck && healthCheck.categories?.length > 0 && (
        <Section title="בדיקת בריאות ביטוח" sub={`ציון כולל ${healthCheck.score}/100${healthCheck.level?.label ? ` · ${healthCheck.level.label}` : ""}`}>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {healthCheck.categories.map(c => {
              const [bg, fg] = statusTone(c.status);
              const ok = c.status === "good" || c.status === "ok" || c.status === "excellent";
              return (
                <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 16px", background: "var(--card)", border: "1px solid var(--border-hair)", borderRadius: "var(--r-md)", boxShadow: "var(--shadow-soft)" }}>
                  <span style={{ width: 34, height: 34, borderRadius: 9, flex: "none", background: bg, color: fg, display: "grid", placeItems: "center" }}>{ok ? <CheckCircle size={17} /> : <AlertTriangle size={17} />}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 800, fontSize: 14, color: "var(--ink)" }}>{c.label}</div>
                    {c.detail && <div style={{ fontSize: 12.5, color: "var(--text-muted)", marginTop: 2 }}>{c.detail}</div>}
                  </div>
                  <div style={{ fontSize: 15, fontWeight: 900, color: fg }}>{c.score}</div>
                </div>
              );
            })}
          </div>
        </Section>
      )}

      {/* duplicates */}
      {duplicates.length > 0 && (
        <Section title="כיסויים כפולים שזוהו" sub="פוליסות שייתכן ומיותרות — שווה לבדוק">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))", gap: 14 }}>
            {duplicates.map((dup: InsuranceDuplicate, i: number) => (
              <div key={i} style={{ position: "relative", overflow: "hidden", padding: "16px 18px", background: "var(--card)", border: "1px solid rgba(214,69,69,.22)", borderRadius: "var(--r-md)", boxShadow: "var(--shadow-soft)" }}>
                <span style={{ position: "absolute", insetInlineStart: 0, top: 0, bottom: 0, width: 3, background: "var(--danger)" }} />
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <span style={{ fontWeight: 800, fontSize: 15, color: "var(--danger)" }}>{POLICY_TYPE_LABELS[dup.type] ?? dup.type}</span>
                  <span style={{ fontSize: 11, fontWeight: 800, color: "var(--danger)", background: "rgba(214,69,69,.08)", borderRadius: 999, padding: "2px 9px" }}>{dup.policies.length} כפולים</span>
                </div>
                <div style={{ fontSize: 12.5, color: "var(--text-muted)", marginBottom: 8 }}>{dup.policies.map(p => p.provider).filter(Boolean).join(" · ") || "—"}</div>
                <div style={{ fontSize: 13.5, fontWeight: 800, color: "var(--danger)" }}>בזבוז: {fmt(dup.estimatedMonthlyWaste)} / חודש</div>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* missing coverage */}
      {missing.length > 0 && (
        <Section title="כיסויים חסרים" sub="ביטוחים שכדאי לשקול בהתאם לפרופיל שלך">
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
            {missing.map((cov: string) => (
              <span key={cov} style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "10px 16px", borderRadius: "var(--r-pill)", background: "var(--butter-soft)", border: "1px solid var(--butter)" }}>
                <AlertTriangle size={15} color="var(--butter-ink)" /><span style={{ fontSize: 13.5, fontWeight: 700, color: "var(--butter-ink)" }}>{POLICY_TYPE_LABELS[cov] ?? cov}</span>
              </span>
            ))}
          </div>
        </Section>
      )}

      {/* recommendations */}
      {recs.length > 0 && (
        <Section title="המלצות הסוכן" sub="פעולות מומלצות לשיפור הכיסוי וחיסכון בפרמיות">
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {recs.map((r: InsuranceRecommendationDTO, i: number) => {
              const [ubg, ufg, ulabel] = urgencyMap[r.urgency] ?? urgencyMap.low;
              return (
                <div key={i} style={{ padding: "18px 20px", background: "var(--card)", border: "1px solid var(--border-hair)", borderRadius: "var(--r-md)", boxShadow: "var(--shadow-soft)", borderInlineStart: `3px solid ${ufg}` }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 7, flexWrap: "wrap" }}>
                    <span style={{ width: 30, height: 30, borderRadius: 8, flex: "none", background: ubg, color: ufg, display: "grid", placeItems: "center" }}><Lightbulb size={16} /></span>
                    <span style={{ fontWeight: 800, fontSize: 15.5, color: "var(--text-strong)" }}>{r.title}</span>
                    <span style={{ fontSize: 10.5, fontWeight: 800, color: ufg, background: ubg, borderRadius: 999, padding: "2px 9px" }}>עדיפות {ulabel}</span>
                  </div>
                  <p style={{ margin: "0 0 12px", paddingInlineStart: 39, fontSize: 14, color: "var(--text-body)", lineHeight: 1.6 }}>{r.reason}</p>
                  {r.financialImpact && <span style={{ display: "inline-flex", alignItems: "center", gap: 6, marginInlineStart: 39, fontSize: 12.5, fontWeight: 800, color: "var(--mint-ink)", background: "var(--mint-soft)", border: "1px solid var(--mint)", borderRadius: 999, padding: "5px 12px" }}>{r.financialImpact}</span>}
                </div>
              );
            })}
          </div>
        </Section>
      )}

      {/* policies */}
      {policies.length > 0 && (
        <Section title="הפוליסות שלך" sub={`${policies.length} פוליסות · ${fmt(totalPremium)} / חודש`}>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {policies.map((p: InsurancePolicyDTO) => (
              <div key={p.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "14px 18px", background: "var(--card)", border: "1px solid var(--border-hair)", borderRadius: "var(--r-md)", boxShadow: "var(--shadow-soft)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
                  <span style={{ width: 38, height: 38, borderRadius: 11, flex: "none", background: "var(--peach-soft)", color: "var(--peach-ink)", display: "grid", placeItems: "center" }}><Shield size={17} /></span>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 800, fontSize: 14, color: "var(--text-strong)" }}>{POLICY_TYPE_LABELS[p.type] ?? p.type}</div>
                    <div style={{ fontSize: 12.5, color: "var(--text-muted)" }}>{p.provider ?? "—"}{p.policyNumber ? ` · ${p.policyNumber}` : ""}</div>
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 16, flex: "none" }}>
                  <div style={{ textAlign: "left" }}>
                    <div style={{ fontWeight: 900, fontSize: 15.5, color: "var(--ink)" }}>{fmt(p.monthlyPremium)}</div>
                    <div style={{ fontSize: 11.5, color: "var(--text-faint)" }}>לחודש</div>
                  </div>
                  {p.status === "active" ? <CheckCircle size={16} color="var(--mint-ink)" /> : <AlertCircle size={16} color="var(--butter-ink)" />}
                  <button onClick={() => void onDelete(p.id)} disabled={deletingId === p.id} aria-label="מחק פוליסה" style={{ width: 30, height: 30, borderRadius: 8, border: "1px solid var(--border-soft)", background: "var(--card)", color: "var(--text-faint)", cursor: "pointer", display: "grid", placeItems: "center", flex: "none" }}>
                    {deletingId === p.id ? <Loader2 size={14} style={{ animation: "spin .8s linear infinite" }} /> : <Trash2 size={14} />}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}

      <p style={{ margin: "8px 0 0", textAlign: "center", fontSize: 12, color: "var(--text-faint)" }}>הניתוח מבוסס על נתוני הדוח שיובא ואינו מהווה ייעוץ ביטוחי מקצועי.</p>
    </>,
  );
}

const inkBtn: React.CSSProperties = { display: "inline-flex", alignItems: "center", gap: 8, padding: "13px 24px", borderRadius: "var(--r-md)", border: "none", cursor: "pointer", fontFamily: "var(--font-body)", fontWeight: 800, fontSize: 15, color: "#fff", background: "var(--ink)", boxShadow: "var(--shadow-ink)" };

function Section({ title, sub, children }: { title: string; sub?: string; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: 34 }}>
      <h2 style={{ margin: "0 0 4px", fontSize: "clamp(20px,2.4vw,26px)", fontWeight: 900, letterSpacing: "-.03em", color: "var(--text-strong)" }}>{title}</h2>
      {sub && <p style={{ margin: "0 0 18px", fontSize: 14, color: "var(--text-muted)", fontWeight: 500 }}>{sub}</p>}
      {children}
    </section>
  );
}

function statusTone(status: string): [string, string] {
  switch (status) {
    case "good": case "ok": case "excellent": return ["var(--mint-soft)", "var(--mint-ink)"];
    case "warning": case "fair": return ["var(--butter-soft)", "var(--butter-ink)"];
    case "poor": case "bad": case "critical": return ["var(--peach-soft)", "var(--peach-ink)"];
    default: return ["var(--surface-sunken)", "var(--text-muted)"];
  }
}
