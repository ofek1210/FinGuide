/**
 * InsurancePage — unified insurance agent (Har HaBituach import lives in Hub).
 */
import { useCallback, useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  Shield, AlertCircle, CheckCircle, Trash2, Loader2,
  FileText, TrendingUp, ShieldCheck, AlertTriangle,
  Sparkles, TrendingDown, Lightbulb,
  type LucideIcon,
} from "lucide-react";
import PrivateTopbar from "../components/PrivateTopbar";
import AppFooter from "../components/AppFooter";
import InsuranceOnboardingWizard from "../components/insurance/InsuranceOnboardingWizard";
import AgentOnboardingModal from "../components/onboarding/AgentOnboardingModal";
import AgentMissingDocumentPanel from "../components/hub/AgentMissingDocumentPanel";
import DocumentCenterCta from "../components/hub/DocumentCenterCta";
import { useAgentOnboarding } from "../hooks/useAgentOnboarding";
import {
  getInsuranceAnalysis,
  getInsuranceImportHistory,
  deleteInsurancePolicy,
  type InsuranceAnalysisResponse,
  type InsuranceAnalysisDTO,
  type InsuranceDuplicate,
  type InsurancePolicyDTO,
  type InsuranceRecommendationDTO,
  type InsuranceHealthCheck,
  type InsuranceImportHistoryItem,
  type InsuranceMarketAdvice,
  type InsuranceDataSourcesDTO,
} from "../api/insuranceAI.api";
import { getInsuranceOnboardingSession } from "../api/insuranceOnboarding.api";
import { formatCurrencyOrDash } from "../utils/formatters";
import { POLICY_TYPE_LABELS } from "../utils/insuranceDisplay";
import { computeImportHistoryDelta } from "../utils/domainImportHistory";
import { hubDocumentUrl } from "../utils/hubDocuments";
import { useRegisterPageContext } from "../assistant/AiChatProvider";

const fmt = formatCurrencyOrDash;

type FlowStep = "missing" | "onboarding" | "results";

export default function InsurancePage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const agentOnboarding = useAgentOnboarding("insurance");

  function insuranceShell(children: React.ReactNode) {
    return (
      <div data-agent="insurance" style={{ minHeight: "100vh", background: "var(--surface-page)", backgroundImage: "radial-gradient(rgba(218,111,68,.06) 1px,transparent 1px)", backgroundSize: "22px 22px", color: "var(--text-body)", fontFamily: "var(--font-body)", direction: "rtl" }}>
        <AgentOnboardingModal
          open={agentOnboarding.showModal || forceOnboardingModal}
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
  const [step, setStep] = useState<FlowStep>("missing");
  const [onboardingChecked, setOnboardingChecked] = useState(false);

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

  const resolveStep = useCallback(async (analysisData: InsuranceAnalysisResponse["data"] | undefined) => {
    const policyCount = analysisData?.policies?.length ?? 0;
    const hasClearinghouseCoverages = (analysisData?.dataSources?.clearinghouse?.coverageCount ?? 0) > 0;
    const sessionRes = await getInsuranceOnboardingSession();
    const onboardingComplete = sessionRes.ok && sessionRes.data?.success && sessionRes.data.data?.completed;

    if (policyCount > 0) {
      setStep(onboardingComplete ? "results" : "onboarding");
    } else if (onboardingComplete || hasClearinghouseCoverages) {
      setStep("results");
    } else {
      setStep("missing");
    }
    setOnboardingChecked(true);
  }, []);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      setAnalysisError(null);
      const res = await getInsuranceAnalysis();
      let analysisPayload: InsuranceAnalysisResponse["data"] | undefined;
      if (res.ok && res.data?.success && res.data.data) {
        analysisPayload = res.data.data;
        setData(analysisPayload);
      } else if (!res.ok) {
        setAnalysisError(res.error?.message ?? "שגיאה בטעינת נתוני הביטוח");
      } else {
        setAnalysisError("שגיאה בטעינת נתוני הביטוח");
      }
      setLoading(false);
      await loadImportHistory();
      await resolveStep(analysisPayload);
    })();
  }, [loadImportHistory, resolveStep]);

  useEffect(() => {
    if (searchParams.get("flow") === "import") {
      navigate(hubDocumentUrl("insurance"), { replace: true });
    }
  }, [searchParams, navigate]);

  const hasPrivateInsuranceDoc = (data?.policies?.length ?? 0) > 0;
  const forceOnboardingModal = hasPrivateInsuranceDoc && agentOnboarding.needsQuestions;

  const handleDelete = async (id: string) => {
    if (!window.confirm("למחוק פוליסה זו?")) return;
    setDeletingId(id);
    await deleteInsurancePolicy(id);
    setDeletingId(null);
    const policyCount = await load();
    if (policyCount === 0) {
      await resolveStep(data ?? undefined);
    }
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

  if (loading || !onboardingChecked) {
    return insuranceShell(
      <div style={{ minHeight: "60vh", display: "grid", placeItems: "center", color: "var(--peach-ink)", fontSize: 14 }}>
        <div style={{ textAlign: "center" }}>
          <Loader2 size={28} style={{ animation: "spin 0.8s linear infinite", marginBottom: 12 }} />
          <div>טוען נתוני ביטוח...</div>
        </div>
      </div>,
    );
  }

  if (step === "missing") {
    return insuranceShell(
      <AgentMissingDocumentPanel
        title="חסר דוח הר הביטוח"
        body="ייבוא ביטוחים פרטיים מתבצע במרכז המסמכים ב-Hub. כיסויים פנסיוניים מגיעים מדוח המסלקה — ניתן לצפות בהם לאחר ייבוא שם."
        documentId="insurance"
      />,
    );
  }

  if (step === "onboarding") {
    return insuranceShell(
      <InsuranceOnboardingWizard
        onBack={() => setStep("missing")}
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
      dataSources={data?.dataSources}
      importHistory={importHistory}
      lastSavingsDelta={null}
      policies={policies}
      recs={recs}
      totalPremium={totalPremium}
      deletingId={deletingId}
      onDelete={handleDelete}
    />,
  );
}

function ResultsStep({
  loading, analysisError, onRetry,
  analysis, healthCheck, marketAdvice, dataSources, importHistory, lastSavingsDelta,
  policies, recs, totalPremium, deletingId, onDelete,
}: {
  loading: boolean;
  analysisError: string | null;
  onRetry: () => void;
  analysis: InsuranceAnalysisDTO | null | undefined;
  healthCheck: InsuranceHealthCheck | undefined;
  marketAdvice?: InsuranceMarketAdvice;
  dataSources?: InsuranceDataSourcesDTO;
  importHistory: InsuranceImportHistoryItem[];
  lastSavingsDelta: number | null;
  policies: InsurancePolicyDTO[];
  recs: InsuranceRecommendationDTO[];
  totalPremium: number;
  deletingId: string | null;
  onDelete: (id: string) => void;
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
  if (policies.length === 0 && !hasAnalysisOutput && !dataSources?.clearinghouse?.coverageCount) {
    return wrap(
      <div style={{ textAlign: "center", padding: "56px 24px", background: "var(--card)", border: "1px solid var(--border-hair)", borderRadius: "var(--radius)", boxShadow: "var(--shadow-soft)" }}>
        <span style={{ width: 58, height: 58, borderRadius: 16, background: "var(--peach-soft)", color: "var(--peach-ink)", display: "grid", placeItems: "center", margin: "0 auto 16px" }}><Shield size={28} /></span>
        <h2 style={{ margin: "0 0 8px", fontSize: 22, fontWeight: 900, color: "var(--text-strong)" }}>אין עדיין פוליסות ביטוח</h2>
        <p style={{ fontSize: 14.5, color: "var(--text-muted)", margin: "0 0 20px" }}>ייבאו דוח הר הביטוח במרכז המסמכים כדי לקבל ניתוח מלא</p>
        <DocumentCenterCta documentId="insurance" />
      </div>,
    );
  }

  const annualSavings = analysis?.savings?.annualSavings ?? 0;
  const premiumUnderReview = analysis?.premiumUnderReviewMonthly ?? analysis?.savings?.premiumUnderReviewMonthly ?? 0;
  const missing = analysis?.missingCoverage ?? [];
  const duplicates = analysis?.duplicates ?? [];
  const scoreDisabled = healthCheck?.scoreDisabled === true;
  const score = scoreDisabled ? null : healthCheck?.score;
  const isReportWithoutPolicies = policies.length === 0 && hasAnalysisOutput;
  const heroMetric = scoreDisabled
    ? "—"
    : isReportWithoutPolicies
      ? (score != null ? `${score}/100` : String(missing.length))
      : premiumUnderReview > 0
        ? fmt(premiumUnderReview)
        : fmt(annualSavings);
  const heroMetricLabel = scoreDisabled
    ? "מצב התיק הביטוחי"
    : isReportWithoutPolicies
      ? (score != null ? "ציון התאמת כיסוי" : "כיסויים חסרים")
      : premiumUnderReview > 0
        ? "פרמיה חודשית לבדיקה"
        : "פוטנציאל חיסכון שנתי";
  const heroDescription = scoreDisabled
    ? (healthCheck?.messageHe ?? "נדרשת השלמת מידע כדי לבדוק כפילויות, מחירים ופערי כיסוי.")
    : isReportWithoutPolicies
      ? "הדוח נקלט, אבל לא נמצאו בו פוליסות פעילות. הניתוח מבוסס על תשובות השאלון ומדגיש כיסויים שכדאי לבדוק."
      : "על בסיס כיסויים שדורשים בדיקה והשוואת פרמיות — ללא חיסכון מאומת.";

  const stats: { icon: LucideIcon; label: string; value: string; bg: string; fg: string }[] = [
    ...(score != null ? [{ icon: ShieldCheck, label: "ציון כיסוי", value: String(score), bg: "var(--peach-soft)", fg: "var(--peach-ink)" }] : []),
    { icon: AlertTriangle, label: "כיסויים לבדיקה", value: String((analysis?.duplicateCount ?? 0) + missing.length), bg: "var(--butter-soft)", fg: "var(--butter-ink)" },
    { icon: Lightbulb, label: "המלצות", value: String(recs.length), bg: "var(--mint-soft)", fg: "var(--mint-ink)" },
    { icon: FileText, label: "פוליסות פעילות בדוח", value: String(policies.length), bg: "var(--lav-100)", fg: "var(--lav-600)" },
    ...(!isReportWithoutPolicies ? [
      { icon: Shield, label: "הוצאה חודשית", value: fmt(totalPremium), bg: "var(--peach-soft)", fg: "var(--peach-ink)" },
      ...(premiumUnderReview > 0 ? [{ icon: TrendingDown, label: "פרמיה לבדיקה", value: fmt(premiumUnderReview), bg: "var(--butter-soft)", fg: "var(--butter-ink)" }] : []),
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
        <DocumentCenterCta documentId="insurance" variant="ghost" label="עדכן דוח במרכז המסמכים" />
      </div>

      {dataSources && (
        <Section title="מקורות הנתונים" sub="כיסויים פנסיוניים וביטוחים פרטיים — מקורות נפרדים">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))", gap: 12, marginBottom: 8 }}>
            <SourceStatusCard
              title="כיסויים ביטוחיים במסגרת הפנסיה"
              sourceLabel="מקור: דוח המסלקה הפנסיונית"
              status={dataSources.clearinghouse.status}
              detail={dataSources.clearinghouse.status === "ready"
                ? `${dataSources.clearinghouse.coverageCount} כיסויים פעילים`
                : dataSources.clearinghouse.status === "empty"
                  ? "דוח המסלקה קיים — לא נמצאו כיסויים ביטוחיים"
                  : "טרם יובא דוח מסלקה"}
              documentId="clearinghouse"
            />
            <SourceStatusCard
              title="ביטוחים פרטיים"
              sourceLabel="מקור: דוח הר הביטוח"
              status={dataSources.harHabituach.status}
              detail={dataSources.harHabituach.status === "ready"
                ? `${dataSources.harHabituach.policyCount} פוליסות פעילות`
                : "טרם יובא דוח הר הביטוח"}
              documentId="insurance"
            />
          </div>
          {dataSources.clearinghouse.coverages.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 12 }}>
              {dataSources.clearinghouse.coverages.slice(0, 8).map(cov => (
                <div key={`${cov.fundId}-${cov.coverageType}`} style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "12px 14px", background: "var(--card)", border: "1px solid var(--border-hair)", borderRadius: "var(--r-md)" }}>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: 14 }}>{cov.coverageType}</div>
                    <div style={{ fontSize: 12.5, color: "var(--text-muted)" }}>{cov.fundName}{cov.provider ? ` · ${cov.provider}` : ""}</div>
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 800, color: "var(--lav-600)", background: "var(--lav-100)", borderRadius: 999, padding: "4px 10px", alignSelf: "center" }}>מסלקה</span>
                </div>
              ))}
            </div>
          )}
        </Section>
      )}

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
      {healthCheck && (healthCheck.scoreDisabled || (healthCheck.categories?.length ?? 0) > 0) && (
        <Section title={healthCheck.headlineHe ?? "בדיקת בריאות ביטוח"} sub={healthCheck.scoreDisabled ? healthCheck.messageHe : `ציון כולל ${healthCheck.score}/100${healthCheck.level?.label ? ` · ${healthCheck.level.label}` : ""}`}>
          {healthCheck.scoreDisabled ? (
            <div style={{ padding: "14px 16px", background: "var(--card)", border: "1px solid var(--border-hair)", borderRadius: "var(--r-md)", fontSize: 14, color: "var(--text-muted)", lineHeight: 1.6 }}>
              {healthCheck.messageHe}
            </div>
          ) : (
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
          )}
        </Section>
      )}

      {/* overlaps for review */}
      {duplicates.length > 0 && (
        <Section title="כיסויים הדורשים בדיקה" sub="קיימת חפיפה אפשרית — לא אושר חיסכון">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))", gap: 14 }}>
            {duplicates.map((dup: InsuranceDuplicate, i: number) => (
              <div key={i} style={{ position: "relative", overflow: "hidden", padding: "16px 18px", background: "var(--card)", border: "1px solid var(--butter)", borderRadius: "var(--r-md)", boxShadow: "var(--shadow-soft)" }}>
                <span style={{ position: "absolute", insetInlineStart: 0, top: 0, bottom: 0, width: 3, background: "var(--butter-ink)" }} />
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <span style={{ fontWeight: 800, fontSize: 15, color: "var(--butter-ink)" }}>{dup.typeLabelHe ?? POLICY_TYPE_LABELS[dup.type] ?? dup.type}</span>
                  <span style={{ fontSize: 11, fontWeight: 800, color: "var(--butter-ink)", background: "var(--butter-soft)", borderRadius: 999, padding: "2px 9px" }}>{dup.policyCount ?? dup.policies.length} פוליסות</span>
                </div>
                <div style={{ fontSize: 12.5, color: "var(--text-muted)", marginBottom: 8 }}>{dup.reasonHe ?? (dup.policies.map(p => p.provider).filter(Boolean).join(" · ") || "—")}</div>
                {(dup.premiumUnderReviewMonthly ?? 0) > 0 && (
                  <div style={{ fontSize: 13.5, fontWeight: 800, color: "var(--butter-ink)" }}>פרמיה חודשית לבדיקה: {fmt(dup.premiumUnderReviewMonthly ?? 0)}</div>
                )}
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

      {/* policies — private insurance from Har HaBituach */}
      {policies.length > 0 && (
        <Section title="ביטוחים פרטיים" sub={`מקור: דוח הר הביטוח · ${policies.length} פוליסות · ${fmt(totalPremium)} / חודש`}>
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

function SourceStatusCard({
  title, sourceLabel, status, detail, documentId,
}: {
  title: string;
  sourceLabel: string;
  status: "missing" | "ready" | "empty";
  detail: string;
  documentId: "clearinghouse" | "insurance";
}) {
  const tone = status === "ready"
    ? { bg: "var(--mint-soft)", fg: "var(--mint-ink)", label: "מוכן" }
    : status === "empty"
      ? { bg: "var(--butter-soft)", fg: "var(--butter-ink)", label: "ללא נתונים" }
      : { bg: "var(--peach-soft)", fg: "var(--peach-ink)", label: "חסר" };

  return (
    <div style={{ padding: "16px 18px", background: "var(--card)", border: "1px solid var(--border-hair)", borderRadius: "var(--r-md)", boxShadow: "var(--shadow-soft)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, marginBottom: 8 }}>
        <div style={{ fontWeight: 900, fontSize: 14.5, color: "var(--text-strong)" }}>{title}</div>
        <span style={{ fontSize: 11, fontWeight: 800, color: tone.fg, background: tone.bg, borderRadius: 999, padding: "4px 10px", whiteSpace: "nowrap" }}>{tone.label}</span>
      </div>
      <div style={{ fontSize: 12, color: "var(--text-faint)", fontWeight: 700, marginBottom: 6 }}>{sourceLabel}</div>
      <div style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 12 }}>{detail}</div>
      {status !== "ready" && <DocumentCenterCta documentId={documentId} variant="ghost" />}
    </div>
  );
}

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
