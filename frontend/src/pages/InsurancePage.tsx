/**
 * InsurancePage — guided Har HaBituach import flow
 */
import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Shield, AlertCircle, Trash2, Loader2,
  FileText, Lock, ShieldCheck, AlertTriangle, BarChart3,
  RefreshCw,
  type LucideIcon,
} from "lucide-react";
import PrivateTopbar from "../components/PrivateTopbar";
import AppFooter from "../components/AppFooter";
import InsuranceRibbonWave from "../components/insurance/InsuranceRibbonWave";
import InsuranceImportGuide from "../components/insurance/InsuranceImportGuide";
import InsuranceUpload from "../components/insurance/InsuranceUpload";
import InsuranceOnboardingWizard from "../components/insurance/InsuranceOnboardingWizard";
import AIInsightsLoadingState from "../components/ai/AIInsightsLoadingState";
import {
  getInsuranceAnalysis,
  uploadInsuranceExcel,
  deleteInsurancePolicy,
  type InsuranceAnalysisResponse,
  type InsuranceAnalysisDTO,
  type InsuranceDuplicate,
  type InsurancePolicyDTO,
  type InsuranceRecommendationDTO,
  type InsuranceHealthCheck,
  type InsuranceMarketAdvice,
  type InsuranceDecision,
} from "../api/insuranceAI.api";
import { getInsuranceOnboardingSession } from "../api/insuranceOnboarding.api";
import { formatCurrencyOrDash } from "../utils/formatters";
import { POLICY_TYPE_LABELS, UPLOAD_PROGRESS_STEPS } from "../utils/insuranceDisplay";
import { INSURANCE_SITE_URL } from "../config/govReportImportConfig";
import { useGovReportDomainPage } from "../hooks/useGovReportDomainPage";
import { useRegisterPageContext } from "../assistant/AiChatProvider";

const HAR_HABITUACH_URL = INSURANCE_SITE_URL;
const MAX_FILE_BYTES = 5 * 1024 * 1024;
const fmt = formatCurrencyOrDash;

export default function InsurancePage() {
  const [searchParams] = useSearchParams();

  function insuranceShell(children: React.ReactNode) {
    return (
      <div data-agent="insurance" style={{ minHeight: "100vh", background: "var(--surface-page)", backgroundImage: "radial-gradient(rgba(218,111,68,.06) 1px,transparent 1px)", backgroundSize: "22px 22px", color: "var(--text-body)", fontFamily: "var(--font-body)", direction: "rtl" }}>
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
  const [lastImported, setLastImported] = useState<number | null>(null);

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
    onUploadSuccess: res => setLastImported(res.data?.imported ?? null),
    uploadSuccessMessage: res => {
      const imported = res.data?.imported ?? 0;
      return imported > 0
        ? `יובאו ${imported} פוליסות בהצלחה — הסוכן מנתח...`
        : "הדוח נקלט בהצלחה — לא נמצאו בו פוליסות פעילות, הסוכן ממשיך לניתוח לפי השאלון.";
    },
    reloadAfterUpload: async () => { await load(); },
    // keep the redesigned success state visible; the user advances via the
    // "צפה בתובנות הסוכן" button rather than an automatic timeout.
    autoAdvanceOnSuccess: false,
  });

  const {
    step, setStep, uploading, uploadMsg, uploadProgressStep,
    isDragging, setIsDragging, setVisitedSite,
    handleUpload,
  } = flow;

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (searchParams.get("flow") === "import" && step === "landing") {
      setStep("guide");
    }
  }, [searchParams, step, setStep]);

  // When policies exist, route into onboarding or results — not the empty landing upload prompt.
  useEffect(() => {
    if (loading || !data) return;

    const policyCount = data.policies?.length ?? 0;
    if (policyCount === 0) return;
    if (step !== "landing" && step !== "onboarding") return;

    void getInsuranceOnboardingSession().then(res => {
      const completed = res.ok && res.data?.success && res.data.data?.completed;
      setStep(completed ? "results" : "onboarding");
    });
  }, [data, loading, step, setStep]);

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
  const decision = data?.decision;
  const policies = data?.policies ?? [];
  const recs = data?.recommendations ?? [];
  const totalPremium = policies.reduce((s, p) => s + (p.monthlyPremium ?? 0), 0);


  const insuranceLabel =
    healthCheck?.score != null
      ? `ביטוח · ציון ${Math.round(healthCheck.score)}`
      : step === "results"
        ? "ביטוח · ניתוח"
        : "ביטוח";
  const insuranceDetail = [
    `שלב במסך: ${step}`,
    healthCheck?.score != null
      ? `ציון בריאות ביטוח: ${Math.round(healthCheck.score)}/100`
      : null,
    policies.length ? `פוליסות: ${policies.length}` : null,
    totalPremium > 0
      ? `פרמיה חודשית: ₪${Math.round(totalPremium).toLocaleString("he-IL")}`
      : null,
    analysis && "duplicateCount" in analysis && Number(analysis.duplicateCount) > 0
      ? `כפילויות: ${analysis.duplicateCount}`
      : null,
    recs[0]?.title ? `המלצה מובילה: ${recs[0].title}` : null,
  ]
    .filter(Boolean)
    .join("\n");
  useRegisterPageContext(insuranceLabel, insuranceDetail || null);

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
      decision={decision}
      marketAdvice={data?.marketAdvice}
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

  const findings: { icon: LucideIcon; label: string; sub: string; value: string; unit?: string; pill: string; tone: "pos" | "warn" | "peach" }[] = [
    { icon: ShieldCheck, label: "מדד שירות", sub: "איכות חברות הביטוח", value: "82", unit: "/100", pill: "אובייקטיבי", tone: "pos" },
    { icon: AlertTriangle, label: "כפילויות בכיסוי", sub: "פוליסות חופפות", value: "2", unit: "פוליסות", pill: "לבדיקה", tone: "warn" },
    { icon: AlertTriangle, label: "פער בכיסוי", sub: "לפי פרופיל המשפחה", value: "ביטוח חיים", pill: "פעולה נדרשת", tone: "peach" },
  ];
  const findTone: Record<string, [string, string]> = {
    pos: ["var(--mint-soft)", "var(--mint-ink)"],
    warn: ["var(--lav-100)", "var(--lav-600)"],
    peach: ["var(--peach-soft)", "var(--peach-ink)"],
  };

  const checks: { icon: LucideIcon; title: string; body: string }[] = [
    { icon: ShieldCheck, title: "בריאות התיק", body: "סקירת פוליסות, חברות וסטטוס פעיל/לא פעיל — בלי השוואת מחירים." },
    { icon: AlertTriangle, title: "פערים בכיסוי", body: "ביטוחים שחסרים לפי הפרופיל שלך (משפחה, דירה, רכב) — עם הסבר למה זה חשוב." },
    { icon: ShieldCheck, title: "כפילויות", body: "פוליסות חופפות שכדאי לבדוק מול סוכן מורשה." },
    { icon: BarChart3, title: "איכות שירות", body: "מדד שירות ממשלתי, תשלום תביעות ושביעות לקוחות — נתונים אובייקטיביים." },
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
                    type="button"
                    onClick={onImport}
                    style={{ display: "inline-flex", alignItems: "center", gap: 9, padding: "15px 28px", borderRadius: "var(--r-btn)", border: "1px solid transparent", cursor: "pointer", fontFamily: "inherit", fontWeight: 800, fontSize: 16, color: "#fff", background: "var(--ink)", boxShadow: "var(--shadow-ink)", transition: "transform .25s var(--ease), box-shadow .25s var(--ease)" }}
                    onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = "0 24px 48px -16px rgba(23,18,33,.8)"; }}
                    onMouseLeave={e => { e.currentTarget.style.transform = "none"; e.currentTarget.style.boxShadow = "var(--shadow-ink)"; }}
                  >
                    <FileText size={18} strokeWidth={2} /> ייבוא מהר הביטוח
                  </button>
                  <button
                    type="button"
                    onClick={() => document.getElementById("insurance-how-it-works")?.scrollIntoView({ behavior: "smooth", block: "start" })}
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
                        <div style={{ marginInlineStart: "auto", display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4, flex: "none" }}>
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
            <div id="insurance-how-it-works" style={{ marginTop: 64, scrollMarginTop: 96 }}>
              <h2 style={{ fontSize: 13, fontWeight: 800, color: "var(--text-faint)", letterSpacing: ".06em", margin: "0 0 20px" }}>מה הסוכן בודק עבורך</h2>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 14 }}>
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
  analysis, healthCheck, decision, marketAdvice,
  policies, recs, totalPremium, deletingId, onDelete, onReimport,
}: {
  loading: boolean;
  analysisError: string | null;
  onRetry: () => void;
  analysis: InsuranceAnalysisDTO | null | undefined;
  healthCheck: InsuranceHealthCheck | undefined;
  decision?: InsuranceDecision;
  marketAdvice?: InsuranceMarketAdvice;
  policies: InsurancePolicyDTO[];
  recs: InsuranceRecommendationDTO[];
  totalPremium: number;
  deletingId: string | null;
  onDelete: (id: string) => void;
  onReimport: () => void;
}) {
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

  const hasAnalysisOutput = Boolean(analysis || healthCheck || decision || marketAdvice || recs.length > 0);
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

  const score = decision?.healthScore ?? (healthCheck?.scoreDisabled ? null : healthCheck?.score ?? null);
  const statusToneMap = {
    green: { bg: "var(--mint-soft)", fg: "var(--mint-ink)", border: "var(--mint)" },
    yellow: { bg: "var(--butter-soft)", fg: "var(--butter-ink)", border: "var(--butter)" },
    red: { bg: "var(--peach-soft)", fg: "var(--peach-ink)", border: "var(--peach)" },
  } as const;
  const statusKey = (decision?.statusTone || "yellow") as keyof typeof statusToneMap;
  const statusColors = statusToneMap[statusKey] || statusToneMap.yellow;
  const overview = decision?.portfolioOverview || marketAdvice?.portfolioOverview;
  const quick = decision?.quickAnswers;
  const actions = decision?.executiveActions?.length
    ? decision.executiveActions
    : recs.slice(0, 5).map((r, i) => ({
      id: `rec_${i}`,
      priority: r.urgency,
      priorityLabelHe: r.urgency === "high" ? "גבוהה" : r.urgency === "medium" ? "בינונית" : "נמוכה",
      titleHe: r.title,
      reasonHe: r.reason,
      expectedBenefitHe: r.nextActionHe || r.financialImpact || "שיפור בהירות הכיסוי",
    }));
  const completeness = decision?.coverageCompleteness?.length
    ? decision.coverageCompleteness
    : (marketAdvice?.coverageSummaries || []);
  const insurers = decision?.companyQuality?.insurers?.length
    ? decision.companyQuality.insurers
    : (marketAdvice?.comparisonMatrix || []).map(row => ({
      policyId: row.policyId,
      type: row.type,
      provider: row.provider,
      serviceScore: row.serviceScore ?? null,
      claimPaymentRate: row.claimPaymentRate ?? null,
      satisfactionScore: row.satisfactionScore ?? null,
      serviceTier: row.serviceTier || "unknown",
      complaintIndicators: row.complaintIndicators ?? null,
      complaintIndicatorsLabelHe: "לא זמין במקור",
    }));
  const profileInsights = decision?.profileInsights || analysis?.needAssessments || [];
  const duplicates = analysis?.duplicates ?? [];
  const RC = 2 * Math.PI * 42;

  const toneBadge = (tone: string) => {
    if (tone === "green") return statusToneMap.green;
    if (tone === "red") return statusToneMap.red;
    return statusToneMap.yellow;
  };

  const priorityTone = (p: string) => {
    if (p === "high") return statusToneMap.red;
    if (p === "medium") return statusToneMap.yellow;
    return { bg: "var(--lav-100)", fg: "var(--lav-600)", border: "var(--lav-200)" };
  };

  return wrap(
    <>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, flexWrap: "wrap", marginBottom: 22 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: "clamp(24px,3vw,34px)", fontWeight: 900, letterSpacing: "-.03em", color: "var(--text-strong)" }}>
            בדיקת בריאות תיק הביטוח
          </h1>
          <p style={{ margin: "6px 0 0", fontSize: 15, color: "var(--text-muted)" }}>
            {(overview?.activeCount ?? policies.length)} פוליסות
            {overview?.companies?.length ? ` · ${overview.companies.length} חברות` : ""}
            {totalPremium > 0 ? ` · ${fmt(totalPremium)} / חודש` : ""}
          </p>
        </div>
        <button onClick={onReimport} style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "10px 18px", borderRadius: "var(--r-pill)", border: "1px solid var(--border-soft)", background: "var(--card)", color: "var(--ink)", cursor: "pointer", fontFamily: "inherit", fontWeight: 800, fontSize: 13.5, boxShadow: "var(--shadow-soft)" }}>
          <RefreshCw size={15} /> ייבוא מחדש
        </button>
      </div>

      <div style={{ borderRadius: "var(--radius)", padding: "28px 26px", marginBottom: 28, background: "linear-gradient(120deg,var(--peach-soft),var(--lav-100) 55%,var(--mint-soft))", border: "1px solid var(--border-soft)", boxShadow: "var(--shadow-card)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 20, flexWrap: "wrap" }}>
          <div style={{ minWidth: 240 }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 8, background: statusColors.bg, color: statusColors.fg, border: `1px solid ${statusColors.border}`, borderRadius: 999, padding: "6px 14px", fontSize: 13, fontWeight: 800, marginBottom: 12 }}>
              {decision?.statusLabelHe || healthCheck?.level?.label || "בדיקה"}
            </span>
            <div style={{ fontSize: 14, color: "var(--ink-soft)", fontWeight: 600, marginBottom: 4 }}>ציון בריאות התיק</div>
            <div style={{ fontSize: "clamp(42px,6vw,60px)", fontWeight: 900, letterSpacing: "-.04em", lineHeight: 0.95, color: "var(--ink)" }}>
              {score != null ? `${score}` : "—"}
              {score != null ? <span style={{ fontSize: 22, color: "var(--text-muted)", fontWeight: 700 }}>/100</span> : null}
            </div>
            <div style={{ marginTop: 8, fontSize: 15, fontWeight: 800, color: "var(--text-strong)" }}>
              {decision?.healthLabelHe || ""}
            </div>
            <p style={{ margin: "8px 0 0", fontSize: 14, color: "var(--text-muted)", maxWidth: 420, lineHeight: 1.55 }}>
              {decision?.statusSummaryHe || healthCheck?.messageHe || "סקירה דטרמיניסטית לפי פוליסות, פרופיל ומדד שירות."}
            </p>
            {(decision?.healthExplanation || []).slice(0, 3).map((line) => (
              <div key={line} style={{ marginTop: 6, fontSize: 13, color: "var(--text-body)", fontWeight: 600 }}>• {line}</div>
            ))}
          </div>
          {score != null && (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, background: "rgba(255,255,255,.7)", border: "1px solid var(--border-soft)", borderRadius: "var(--radius)", padding: "18px 22px" }}>
              <div style={{ position: "relative", width: 96, height: 96 }}>
                <svg width="96" height="96" viewBox="0 0 96 96" style={{ transform: "rotate(-90deg)" }}>
                  <circle cx="48" cy="48" r="42" fill="none" stroke="var(--hair)" strokeWidth="8" />
                  <circle cx="48" cy="48" r="42" fill="none" stroke="var(--peach-ink)" strokeWidth="8" strokeLinecap="round" strokeDasharray={RC} strokeDashoffset={RC * (1 - Math.min(score, 100) / 100)} />
                </svg>
                <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", fontSize: 26, fontWeight: 900 }}>{score}</div>
              </div>
            </div>
          )}
        </div>
      </div>

      {quick && (
        <Section title="תשובות מהירות" sub="מה חשוב לדעת עכשיו">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 12 }}>
            {([
              { k: "בריאות התיק", label: `${quick.portfolioHealth.score}/100 · ${quick.portfolioHealth.scoreLabelHe}`, tone: decision?.statusTone || "yellow", ok: decision?.status === "healthy" },
              { k: "כפילויות", label: quick.hasDuplicates.labelHe, tone: quick.hasDuplicates.tone, ok: !quick.hasDuplicates.value },
              { k: "כיסוי חסר", label: quick.missingImportant.labelHe, tone: quick.missingImportant.tone, ok: !quick.missingImportant.value },
              { k: "כיסוי מיותר?", label: quick.possiblyUnnecessary.labelHe, tone: quick.possiblyUnnecessary.tone, ok: !quick.possiblyUnnecessary.value },
              { k: "איכות חברה", label: quick.companyQuality.labelHe, tone: quick.companyQuality.tone, ok: quick.companyQuality.value },
            ]).map((card) => {
              const tone = toneBadge(card.tone);
              return (
                <div key={card.k} style={{ background: "var(--card)", border: "1px solid var(--border-hair)", borderRadius: "var(--r-md)", padding: "14px 16px", boxShadow: "var(--shadow-soft)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginBottom: 8 }}>
                    <span style={{ fontSize: 12.5, fontWeight: 800, color: "var(--text-muted)" }}>{card.k}</span>
                    <span style={{ fontSize: 11, fontWeight: 800, color: tone.fg, background: tone.bg, borderRadius: 999, padding: "3px 9px" }}>
                      {card.ok ? "תקין" : "לבדיקה"}
                    </span>
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text-strong)", lineHeight: 1.45 }}>{card.label}</div>
                </div>
              );
            })}
          </div>
        </Section>
      )}

      {actions.length > 0 && (
        <Section title="תוכנית פעולה" sub="עד 5 פעולות מעשיות — ללא השוואת מחירים">
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {actions.map((a) => {
              const pt = priorityTone(a.priority);
              return (
                <div key={a.id} style={{ background: "var(--card)", border: "1px solid var(--border-hair)", borderRadius: "var(--r-md)", padding: "16px 18px", boxShadow: "var(--shadow-soft)", borderInlineStart: `3px solid ${pt.fg}` }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 6 }}>
                    <span style={{ fontWeight: 900, fontSize: 15, color: "var(--text-strong)" }}>{a.titleHe}</span>
                    <span style={{ fontSize: 11, fontWeight: 800, color: pt.fg, background: pt.bg, borderRadius: 999, padding: "3px 9px" }}>עדיפות {a.priorityLabelHe}</span>
                  </div>
                  <div style={{ fontSize: 13.5, color: "var(--text-body)", lineHeight: 1.55, marginBottom: 6 }}>{a.reasonHe}</div>
                  <div style={{ fontSize: 12.5, fontWeight: 700, color: "var(--mint-ink)" }}>תועלת: {a.expectedBenefitHe}</div>
                </div>
              );
            })}
          </div>
        </Section>
      )}

      {profileInsights.length > 0 && (
        <Section title="התאמה לפרופיל" sub="מה נחוץ ומה לא — לפי האונבורדינג">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))", gap: 10 }}>
            {profileInsights.slice(0, 8).map((p) => {
              const tone = p.status === "not_recommended" || p.status === "possibly_unnecessary"
                ? statusToneMap.yellow
                : p.status === "recommended" || p.status === "unverified"
                  ? statusToneMap.red
                  : statusToneMap.green;
              return (
                <div key={`${p.type}-${p.status}-${p.titleHe}`} style={{ background: "var(--card)", border: "1px solid var(--border-hair)", borderRadius: "var(--r-md)", padding: "14px 16px" }}>
                  <span style={{ fontSize: 11, fontWeight: 800, color: tone.fg, background: tone.bg, borderRadius: 999, padding: "3px 9px" }}>{p.titleHe}</span>
                  <p style={{ margin: "10px 0 0", fontSize: 13.5, color: "var(--text-body)", lineHeight: 1.5 }}>{p.messageHe}</p>
                </div>
              );
            })}
          </div>
        </Section>
      )}

      {duplicates.length > 0 && (
        <Section title="כפילויות וחפיפות" sub="כיסויים שכדאי לאמת">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 10 }}>
            {duplicates.map((dup: InsuranceDuplicate, i: number) => (
              <div key={i} style={{ padding: "14px 16px", background: "var(--card)", border: "1px solid var(--butter)", borderRadius: "var(--r-md)" }}>
                <div style={{ fontWeight: 800, color: "var(--butter-ink)" }}>{dup.typeLabelHe ?? POLICY_TYPE_LABELS[dup.type] ?? dup.type}</div>
                <div style={{ fontSize: 12.5, color: "var(--text-muted)", marginTop: 4 }}>{dup.reasonHe ?? `${dup.policyCount ?? dup.policies.length} פוליסות`}</div>
              </div>
            ))}
          </div>
        </Section>
      )}

      {insurers.length > 0 && (
        <Section title="איכות חברות הביטוח" sub="מדד שירות · תשלום תביעות · שביעות לקוחות">
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {insurers.map((row) => (
              <div key={row.policyId} style={{ display: "grid", gridTemplateColumns: "1.4fr repeat(3, minmax(70px,1fr)) auto", gap: 10, alignItems: "center", padding: "12px 14px", background: "var(--card)", border: "1px solid var(--border-hair)", borderRadius: "var(--r-md)" }}>
                <div>
                  <div style={{ fontWeight: 800, fontSize: 14 }}>{row.type}</div>
                  <div style={{ fontSize: 12.5, color: "var(--text-muted)" }}>{row.provider ?? "—"}</div>
                </div>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 10.5, color: "var(--text-faint)", fontWeight: 700 }}>מדד שירות</div>
                  <div style={{ fontWeight: 900 }}>{row.serviceScore ?? "—"}</div>
                </div>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 10.5, color: "var(--text-faint)", fontWeight: 700 }}>תביעות</div>
                  <div style={{ fontWeight: 900 }}>{row.claimPaymentRate != null ? `${row.claimPaymentRate}%` : "—"}</div>
                </div>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 10.5, color: "var(--text-faint)", fontWeight: 700 }}>שביעות</div>
                  <div style={{ fontWeight: 900 }}>{row.satisfactionScore ?? "—"}</div>
                </div>
                <span style={{ fontSize: 11, fontWeight: 800, color: "var(--text-muted)", background: "var(--surface-sunken)", borderRadius: 999, padding: "4px 8px" }}>
                  תלונות: {row.complaintIndicatorsLabelHe || "לא זמין"}
                </span>
              </div>
            ))}
          </div>
        </Section>
      )}

      {completeness.length > 0 && (
        <Section title="שלמות מידע בכיסויים" sub="רמת ביטחון לפי הנתונים שזוהו בדוח">
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {completeness.map((c) => (
              <div key={c.policyId} style={{ padding: "12px 14px", background: "var(--card)", border: "1px solid var(--border-hair)", borderRadius: "var(--r-md)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                  <div style={{ fontWeight: 800 }}>{c.coverageTypeLabelHe}{c.provider ? ` · ${c.provider}` : ""}</div>
                  <span style={{ fontSize: 11.5, fontWeight: 800, color: "var(--text-muted)" }}>
                    ביטחון: {"coverageConfidenceLabelHe" in c && c.coverageConfidenceLabelHe
                      ? c.coverageConfidenceLabelHe
                      : (c.manualReviewRecommended ? "נמוכה" : "בינונית")}
                    {"completenessScore" in c && c.completenessScore != null ? ` · ${c.completenessScore}%` : ""}
                  </span>
                </div>
                {"checks" in c && Array.isArray(c.checks) ? (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
                    {c.checks.slice(0, 6).map((ch) => (
                      <span key={ch.id} style={{ fontSize: 11.5, fontWeight: 700, padding: "3px 8px", borderRadius: 999, background: ch.status === "ok" ? "var(--mint-soft)" : "var(--butter-soft)", color: ch.status === "ok" ? "var(--mint-ink)" : "var(--butter-ink)" }}>
                        {ch.status === "ok" ? "✓" : "⚠"} {ch.labelHe}
                      </span>
                    ))}
                  </div>
                ) : (
                  <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 6 }}>
                    {(c.missingInformation || []).length ? `חסר: ${c.missingInformation.join(", ")}` : "מידע בסיסי זוהה"}
                  </div>
                )}
              </div>
            ))}
          </div>
        </Section>
      )}

      {policies.length > 0 && (
        <Section title="הפוליסות שלך" sub={`${policies.length} פוליסות`}>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {policies.map((p) => (
              <div key={p.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "12px 16px", background: "var(--card)", border: "1px solid var(--border-hair)", borderRadius: "var(--r-md)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
                  <span style={{ width: 36, height: 36, borderRadius: 10, flex: "none", background: "var(--peach-soft)", color: "var(--peach-ink)", display: "grid", placeItems: "center" }}><Shield size={16} /></span>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: 14 }}>{POLICY_TYPE_LABELS[p.type] ?? p.type}</div>
                    <div style={{ fontSize: 12.5, color: "var(--text-muted)" }}>{p.provider ?? "—"} · {p.status}</div>
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontWeight: 800, fontVariantNumeric: "tabular-nums" }}>{fmt(p.monthlyPremium ?? 0)}</span>
                  <button
                    type="button"
                    disabled={deletingId === p.id}
                    onClick={() => onDelete(p.id)}
                    style={{ border: "none", background: "transparent", color: "var(--text-faint)", cursor: "pointer", padding: 4 }}
                    aria-label="מחק פוליסה"
                  >
                    {deletingId === p.id ? <Loader2 size={16} style={{ animation: "spin .8s linear infinite" }} /> : <Trash2 size={16} />}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}

      <p style={{ margin: "8px 0 0", textAlign: "center", fontSize: 12, color: "var(--text-faint)" }}>
        {decision?.methodologyHe || "הניתוח דטרמיניסטי על בסיס הדוח והפרופיל — אינו ייעוץ ביטוחי."}
      </p>
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
