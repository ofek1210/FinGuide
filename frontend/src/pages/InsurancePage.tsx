/**
 * InsurancePage — guided Har HaBituach import flow
 */
import { useCallback, useEffect, useState } from "react";
import {
  Shield, AlertCircle, CheckCircle, Trash2, Loader2,
  FileText, Lock, TrendingUp, ShieldCheck, AlertTriangle, BarChart3,
  type LucideIcon,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import PrivateTopbar from "../components/PrivateTopbar";
import AppFooter from "../components/AppFooter";
import InsuranceRibbonWave from "../components/insurance/InsuranceRibbonWave";
import InsuranceImportGuide from "../components/insurance/InsuranceImportGuide";
import InsuranceUpload from "../components/insurance/InsuranceUpload";
import AIInsightsLoadingState from "../components/ai/AIInsightsLoadingState";
import { PrivateDomainPageLayout } from "../components/layout/PrivateDomainPageLayout";
import GlassCard from "../components/ui/GlassCard";
import StatCard from "../components/ui/StatCard";
import SectionHeader from "../components/ui/SectionHeader";
import Badge from "../components/ui/Badge";
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
} from "../api/insuranceAI.api";
import { formatCurrencyOrDash } from "../utils/formatters";
import { POLICY_TYPE_LABELS, UPLOAD_PROGRESS_STEPS } from "../utils/insuranceDisplay";
import { HealthCheckPanel, SavingsDeltaCard } from "../components/import/HealthCheckPanel";
import { INSURANCE_IMPORT_CONFIG } from "../config/govReportImportConfig";
import { DomainResultsHeader } from "../components/import/DomainResultsHeader";
import { DomainRecommendationsSection } from "../components/import/DomainRecommendationsSection";
import { DomainResultsFooter } from "../components/import/DomainResultsFooter";
import { useGovReportDomainPage } from "../hooks/useGovReportDomainPage";
import { computeImportHistoryDelta } from "../utils/domainImportHistory";

const HAR_HABITUACH_URL = INSURANCE_IMPORT_CONFIG.siteUrl;
const MAX_FILE_BYTES = 5 * 1024 * 1024;
const fmt = formatCurrencyOrDash;

export default function InsurancePage() {
  const navigate = useNavigate();

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

  const load = useCallback(async () => {
    setLoading(true);
    setAnalysisError(null);
    const res = await getInsuranceAnalysis();
    if (res.ok && res.data?.success && res.data.data) {
      setData(res.data.data);
    } else if (!res.ok) {
      setAnalysisError(res.error?.message ?? "שגיאה בטעינת נתוני הביטוח");
    } else {
      setAnalysisError("שגיאה בטעינת נתוני הביטוח");
    }
    setLoading(false);
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
    uploadSuccessMessage: res => `יובאו ${res.data?.imported ?? 0} פוליסות בהצלחה — הסוכן מנתח...`,
    reloadAfterUpload: load,
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

  // On first load, if the user already has policies, jump straight to results.
  // Gated to the landing step so it never skips the upload success screen mid-flow.
  useEffect(() => {
    if (step === "landing" && (data?.policies ?? []).length > 0) {
      setStep("results");
    }
  }, [data, step, setStep]);

  const handleDelete = async (id: string) => {
    if (!window.confirm("למחוק פוליסה זו?")) return;
    setDeletingId(id);
    await deleteInsurancePolicy(id);
    setDeletingId(null);
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
    return (
      <div data-agent="insurance" style={{ minHeight: "100vh", background: "var(--surface-page)", backgroundImage: "radial-gradient(rgba(218,111,68,.06) 1px,transparent 1px)", backgroundSize: "22px 22px", color: "var(--text-body)", fontFamily: "var(--font-body)", direction: "rtl" }}>
        <PrivateTopbar />
        <InsuranceImportGuide
          onBack={() => setStep("landing")}
          onContinue={() => setStep("upload")}
          onVisitSite={() => {
            window.open(HAR_HABITUACH_URL, "_blank", "noopener,noreferrer");
            setVisitedSite(true);
          }}
        />
        <AppFooter variant="private" />
      </div>
    );
  }

  // Upload — step 2/2 redesign: real dropzone wired to uploadInsuranceExcel.
  if (step === "upload") {
    return (
      <div data-agent="insurance" style={{ minHeight: "100vh", background: "var(--surface-page)", color: "var(--text-body)", fontFamily: "var(--font-body)", direction: "rtl" }}>
        <PrivateTopbar />
        <InsuranceUpload
          onBack={() => setStep("guide")}
          onContinue={() => setStep("results")}
          onUpload={handleUpload}
          uploading={uploading}
          uploadMsg={uploadMsg}
          uploadProgressStep={uploadProgressStep}
          progressSteps={UPLOAD_PROGRESS_STEPS}
          isDragging={isDragging}
          setIsDragging={setIsDragging}
          importedCount={lastImported}
        />
        <AppFooter variant="private" />
      </div>
    );
  }

  return (
    <PrivateDomainPageLayout>

        {step === "results" && (
          <ResultsStep
            loading={loading}
            analysisError={analysisError}
            onRetry={() => void load()}
            analysis={analysis}
            healthCheck={healthCheck}
            importHistory={importHistory}
            lastSavingsDelta={lastSavingsDelta}
            policies={policies}
            recs={recs}
            totalPremium={totalPremium}
            deletingId={deletingId}
            onDelete={handleDelete}
            onReimport={() => setStep("guide")}
            navigate={navigate}
          />
        )}

    </PrivateDomainPageLayout>
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
  analysis, healthCheck, importHistory, lastSavingsDelta,
  policies, recs, totalPremium, deletingId, onDelete, onReimport, navigate,
}: {
  loading: boolean;
  analysisError: string | null;
  onRetry: () => void;
  analysis: InsuranceAnalysisDTO | null | undefined;
  healthCheck: InsuranceHealthCheck | undefined;
  importHistory: InsuranceImportHistoryItem[];
  lastSavingsDelta: number | null;
  policies: InsurancePolicyDTO[];
  recs: InsuranceRecommendationDTO[];
  totalPremium: number;
  deletingId: string | null;
  onDelete: (id: string) => void;
  onReimport: () => void;
  navigate: ReturnType<typeof useNavigate>;
}) {
  const historyDelta = computeImportHistoryDelta(importHistory, "annualSavings", lastSavingsDelta);

  if (loading) {
    return (
      <div style={{ textAlign: "center", padding: "60px 0" }}>
        <Loader2 size={28} color="var(--peach-ink)" style={{ animation: "spin 0.8s linear infinite" }} />
        <div style={{ marginTop: 12, fontSize: 14, color: "var(--text-muted)", fontFamily: "var(--font-body)" }}>מנתח את הפוליסות...</div>
      </div>
    );
  }

  if (analysisError) {
    return (
      <GlassCard padding="lg" style={{ textAlign: "center", borderRight: "4px solid var(--danger)" }}>
        <AlertCircle size={28} color="var(--danger)" style={{ marginBottom: 12 }} />
        <div style={{ fontWeight: 700, fontSize: 16, color: "var(--text-strong)", marginBottom: 8, fontFamily: "var(--font-body)" }}>שגיאה בטעינת הניתוח</div>
        <div style={{ fontSize: 14, color: "var(--text-muted)", marginBottom: 16, fontFamily: "var(--font-body)" }}>{analysisError}</div>
        <button type="button" onClick={onRetry} style={{ padding: "10px 20px", borderRadius: "var(--r-btn)", background: "var(--peach-ink)", color: "#fff", border: "none", cursor: "pointer", fontFamily: "var(--font-body)", fontWeight: 700 }}>
          נסה שוב
        </button>
      </GlassCard>
    );
  }

  if (policies.length === 0) {
    return (
      <GlassCard padding="lg" style={{ textAlign: "center" }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>🛡️</div>
        <h2 style={{ fontFamily: "var(--font-body)", fontSize: 22, fontWeight: 700, color: "var(--text-strong)", margin: "0 0 10px" }}>
          אין עדיין פוליסות ביטוח
        </h2>
        <p style={{ fontSize: 14.5, color: "var(--text-muted)", margin: "0 0 20px", fontFamily: "var(--font-body)" }}>
          ייבא דוח מהר הביטוח כדי לקבל ניתוח מלא
        </p>
        <button
          type="button"
          onClick={onReimport}
          style={{ padding: "12px 24px", borderRadius: "var(--r-card)", background: "var(--peach-ink)", color: "#fff", border: "none", cursor: "pointer", fontFamily: "var(--font-body)", fontWeight: 700, fontSize: 14 }}
        >
          ייבא דוח ביטוח
        </button>
      </GlassCard>
    );
  }

  return (
    <div style={{ maxWidth: "var(--maxw-app)", margin: "0 auto", padding: "36px var(--gutter) 80px" }}>
      <DomainResultsHeader
        emoji="🛡️"
        title="ניתוח הביטוח שלך"
        subtitle={`${policies.length} פוליסות פעילות · עלות חודשית ${fmt(totalPremium)}`}
        accentColor="var(--peach-ink)"
        onReimport={onReimport}
      />

      {analysis && (
        <section style={{ marginBottom: 36 }}>
          {historyDelta != null && historyDelta !== 0 && (
            <SavingsDeltaCard delta={historyDelta} label="שינוי בחיסכון שנתי" formatValue={n => fmt(n)} />
          )}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 14 }}>
            <StatCard icon="💸" label="הוצאה חודשית" value={fmt(totalPremium)} sub="כל הפוליסות" accent="var(--peach-ink)" />
            <StatCard icon="♻️" label="בזבוז מכפילויות" value={fmt(analysis.totalMonthlyWaste)} sub="לחודש" accent="var(--danger)" trend={analysis.totalMonthlyWaste > 0 ? "down" : "flat"} />
            <StatCard icon="💰" label="חיסכון שנתי" value={fmt(analysis.savings.annualSavings)} accent="var(--success)" trend="up" />
            <StatCard icon="📋" label="פוליסות פעילות" value={policies.length.toString()} accent="var(--accent)" />
            {analysis.missingCoverage.length > 0 && (
              <StatCard icon="⚠️" label="כיסויים חסרים" value={analysis.missingCoverage.length.toString()} accent="var(--warning)" />
            )}
          </div>
        </section>
      )}

      {healthCheck && (
        <HealthCheckPanel title="בדיקת בריאות ביטוח" healthCheck={healthCheck} accentColor="var(--peach-ink)" />
      )}

      {analysis && analysis.duplicates.length > 0 && (
        <section style={{ marginBottom: 32 }}>
          <SectionHeader title="⚠️ כיסויים כפולים שזוהו" subtitle="פוליסות אשר ייתכן ומיותרות — שווה לבדוק" />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 14 }}>
            {analysis.duplicates.map((dup: InsuranceDuplicate, i: number) => (
              <GlassCard key={i} padding="md" style={{ borderRight: "4px solid var(--danger)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                  <div style={{ fontWeight: 800, fontSize: 15, color: "var(--danger)", fontFamily: "var(--font-body)" }}>{POLICY_TYPE_LABELS[dup.type] ?? dup.type}</div>
                  <Badge variant="high">{dup.policies.length} כפולים</Badge>
                </div>
                <div style={{ fontSize: 12.5, color: "var(--text-muted)", marginBottom: 6, fontFamily: "var(--font-body)" }}>
                  {dup.policies.map((p: { provider?: string }) => p.provider).filter(Boolean).join(" · ")}
                </div>
                <div style={{ fontSize: 14, fontWeight: 700, color: "var(--danger)", fontFamily: "var(--font-body)" }}>
                  בזבוז: {fmt(dup.estimatedMonthlyWaste)} / חודש
                </div>
              </GlassCard>
            ))}
          </div>
        </section>
      )}

      {analysis && analysis.missingCoverage.length > 0 && (
        <section style={{ marginBottom: 32 }}>
          <SectionHeader title="כיסויים חסרים" subtitle="ביטוחים שכדאי לשקול בהתאם לפרופיל שלך" />
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
            {analysis.missingCoverage.map((cov: string) => (
              <div key={cov} style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 16px", borderRadius: "var(--r-card)", background: "var(--butter-soft)", border: "1px solid var(--border-soft)" }}>
                <AlertCircle size={15} color="var(--butter-ink)" />
                <span style={{ fontSize: 13.5, fontWeight: 600, color: "var(--butter-ink)", fontFamily: "var(--font-body)" }}>{POLICY_TYPE_LABELS[cov] ?? cov}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      <DomainRecommendationsSection
        recommendations={recs}
        title="✦ המלצות הסוכן"
        subtitle="פעולות מומלצות לשיפור הכיסוי וחיסכון בפרמיות"
      />

      <section style={{ marginBottom: 40 }}>
        <SectionHeader title="הפוליסות שלך" subtitle={`${policies.length} פוליסות · ${fmt(totalPremium)} / חודש`} />
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {policies.map((p: InsurancePolicyDTO) => (
            <GlassCard key={p.id} padding="sm" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderRadius: "var(--r-card)", boxShadow: "var(--shadow-soft)", background: "var(--surface-card)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ width: 38, height: 38, borderRadius: 11, background: "var(--peach-soft)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Shield size={17} color="var(--peach-ink)" />
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14, color: "var(--text-strong)", fontFamily: "var(--font-body)" }}>{POLICY_TYPE_LABELS[p.type] ?? p.type}</div>
                  <div style={{ fontSize: 12.5, color: "var(--text-muted)", fontFamily: "var(--font-body)" }}>
                    {p.provider ?? "—"}{p.policyNumber ? ` · ${p.policyNumber}` : ""}
                  </div>
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                <div style={{ textAlign: "left" }}>
                  <div style={{ fontWeight: 800, fontSize: 15.5, color: "var(--text-strong)", fontFamily: "var(--font-body)" }}>{fmt(p.monthlyPremium)}</div>
                  <div style={{ fontSize: 11.5, color: "var(--text-muted)", fontFamily: "var(--font-body)" }}>לחודש</div>
                </div>
                {p.status === "active"
                  ? <CheckCircle size={16} color="var(--success)" />
                  : <AlertCircle size={16} color="var(--warning)" />
                }
                <button
                  type="button"
                  onClick={() => void onDelete(p.id)}
                  disabled={deletingId === p.id}
                  style={{ background: "none", border: "none", cursor: "pointer", color: "var(--danger)", padding: 4, display: "flex" }}
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </GlassCard>
          ))}
        </div>
      </section>

      <DomainResultsFooter
        agent="insurance"
        insightsTrigger={policies.length}
        insightsTitle="תובנות AI מותאמות לפרופיל שלך"
        insightsSubtitle="ניתוח הפוליסות שלך ביחס לגיל, מצב משפחתי, נכסים ועוד"
        copilot={{
          title: "שאל את סוכן הביטוח",
          description: '"האם אני צריך ביטוח חיים?", "כמה אני משלם יותר מהממוצע?", "מה הסיכון הכי גדול שלי?"',
          buttonLabel: "פתח שיחה עם הסוכן",
          gradientFrom: "var(--peach-ink)",
          gradientTo: "var(--peach)",
        }}
        disclaimer="⚠️ הניתוח מבוסס על נתוני הדוח שיובא. אינו מהווה ייעוץ ביטוחי מקצועי."
        onNavigate={route => navigate(route)}
      />
    </div>
  );
}
