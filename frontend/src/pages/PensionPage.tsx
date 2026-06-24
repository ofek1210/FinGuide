/**
 * PensionPage — guided Har HaKesef import flow
 *
 * Step "landing"  — hero + "ייבוא מהר הכסף" CTA
 * Step "guide"    — step-by-step instructions + direct link to הר הכסף
 * Step "upload"   — PDF / Excel upload
 * Step "results"  — AI analysis dashboard + simulation panel
 */
import { useCallback, useEffect, useRef, useState } from "react";
import {
  PiggyBank, Plus, Trash2, TrendingUp, AlertCircle,
  Loader2, SlidersHorizontal,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { PrivateDomainPageLayout } from "../components/layout/PrivateDomainPageLayout";
import GlassCard from "../components/ui/GlassCard";
import StatCard from "../components/ui/StatCard";
import SectionHeader from "../components/ui/SectionHeader";
import Badge from "../components/ui/Badge";
import {
  getPensionAnalysis,
  getPensionImportHistory,
  simulatePensionScenario,
  getPensionFunds,
  uploadPensionFund,
  uploadPensionFile,
  deletePensionFund,
  updatePensionFund,
  type PensionAnalysisData,
  type PensionBenchmarkFundDTO,
  type PensionImportSnapshotDTO,
  type SimulationResponse,
  type PensionFundDTO,
  type UploadPensionBody,
} from "../api/pension.api";
import { APP_ROUTES } from "../types/navigation";
import { formatCurrencyOrDash } from "../utils/formatters";
import {
  FUND_TYPE_LABELS,
  RANK_BADGE,
  UPLOAD_PROGRESS_STEPS,
} from "../utils/pensionDisplay";
import { HealthCheckPanel, SavingsDeltaCard } from "../components/import/HealthCheckPanel";
import { GovReportImportFlow } from "../components/import/GovReportImportFlow";
import { PENSION_IMPORT_CONFIG } from "../config/govReportImportConfig";
import { DomainResultsHeader } from "../components/import/DomainResultsHeader";
import { DomainRecommendationsSection } from "../components/import/DomainRecommendationsSection";
import { DomainResultsFooter } from "../components/import/DomainResultsFooter";
import { useGovReportUploadProgress } from "../hooks/useGovReportUploadProgress";
import { computeImportHistoryDelta } from "../utils/domainImportHistory";

const HAR_HAKESEF_URL = PENSION_IMPORT_CONFIG.siteUrl;

const fmt = formatCurrencyOrDash;

const EMPTY_FORM: UploadPensionBody = {
  fundName: "", fundType: "pension_comprehensive", provider: "",
  currentBalance: 0, monthlyEmployeeDeposit: 0, monthlyEmployerDeposit: 0,
  managementFeeAccumulation: 0.003, managementFeeDeposit: 0.001,
};

type FlowStep = "landing" | "guide" | "upload" | "results";

/* ════════════════════════════════════════════════════════════════
   MAIN PAGE
════════════════════════════════════════════════════════════════ */
export default function PensionPage() {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { uploadProgressStep, start: startProgress, stop: stopProgress } = useGovReportUploadProgress(UPLOAD_PROGRESS_STEPS.length);

  const [step, setStep] = useState<FlowStep>("landing");
  const [data, setData] = useState<PensionAnalysisData | null>(null);
  const [loading, setLoading] = useState(true);
  const [visitedSite, setVisitedSite] = useState(false);

  // Upload state
  const [uploading, setUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Manual fund form
  const [funds, setFunds] = useState<PensionFundDTO[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [form, setForm] = useState<UploadPensionBody>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Simulation
  const [simAge, setSimAge] = useState("");
  const [simExtra, setSimExtra] = useState("");
  const [simFee, setSimFee] = useState("");
  const [simResult, setSimResult] = useState<SimulationResponse["data"] | null>(null);
  const [simLoading, setSimLoading] = useState(false);
  const [insightsTrigger, setInsightsTrigger] = useState(0);
  const [importWarnings, setImportWarnings] = useState<string[]>([]);
  const [importSource, setImportSource] = useState<"har_hakesef" | "quarterly_report">("har_hakesef");
  const [showAgeModal, setShowAgeModal] = useState(false);
  const [importHistory, setImportHistory] = useState<PensionImportSnapshotDTO[]>([]);
  const [lastSavingsDelta, setLastSavingsDelta] = useState<number | null>(null);

  const loadFunds = useCallback(async () => {
    const res = await getPensionFunds();
    if (res.ok && res.data?.data) setFunds(res.data.data);
  }, []);

  const loadImportHistory = useCallback(async () => {
    const res = await getPensionImportHistory();
    if (res.ok && res.data?.success && res.data.data) {
      setImportHistory(res.data.data);
    }
  }, []);

  const loadAnalysis = useCallback(async () => {
    const res = await getPensionAnalysis();
    if (res.ok && res.data?.success && res.data.data) {
      setData(res.data.data);
      if (res.data.data.summary?.hasData) {
        setStep("results");
      }
    }
    return res;
  }, []);

  useEffect(() => {
    void getPensionAnalysis().then(res => {
      setLoading(false);
      if (res.ok && res.data?.success && res.data.data) {
        setData(res.data.data);
        if (res.data.data.summary?.hasData) {
          setStep("results");
          if (!res.data.data.summary.currentAge) {
            setShowAgeModal(true);
          }
        }
      }
    });
    void loadFunds();
    void loadImportHistory();
  }, [loadFunds, loadImportHistory]);

  const handleSaveFund = async () => {
    if (!form.fundName?.trim()) return;
    setSaving(true); setSaveMsg(null);
    const res = await uploadPensionFund(form);
    setSaving(false);
    if (res.ok) {
      setSaveMsg({ type: "success", text: "הקרן נשמרה בהצלחה" });
      setForm(EMPTY_FORM); setShowAddForm(false);
      void loadFunds();
      void loadAnalysis();
      setInsightsTrigger(t => t + 1);
      setStep("results");
    } else {
      setSaveMsg({ type: "error", text: "שגיאה בשמירה" });
    }
  };

  const handleDeleteFund = async (id: string) => {
    if (!window.confirm("למחוק קרן זו?")) return;
    setDeletingId(id);
    await deletePensionFund(id);
    setDeletingId(null);
    void loadFunds();
    void loadAnalysis();
  };

  const handleSimulate = async () => {
    setSimLoading(true); setSimResult(null);
    const res = await simulatePensionScenario({
      retirementAge: simAge ? Number(simAge) : undefined,
      additionalMonthlyContribution: simExtra ? Number(simExtra) : undefined,
      targetMgmtFee: simFee ? Number(simFee) / 100 : undefined,
    });
    setSimLoading(false);
    if (res.ok && res.data?.success && res.data.data) setSimResult(res.data.data);
  };

  const handleFileUpload = async (file: File) => {
    const ext = file.name.split(".").pop()?.toLowerCase();
    const allowed = ["pdf", "xlsx", "xls"];
    if (!allowed.includes(ext ?? "")) {
      setUploadMsg({ type: "error", text: "ניתן להעלות PDF, xlsx או xls בלבד" });
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setUploadMsg({ type: "error", text: "הקובץ גדול מדי. מקסימום 10MB." });
      return;
    }
    setUploading(true);
    setUploadMsg(null);
    const progressTimer = startProgress();
    const res = await uploadPensionFile(file, importSource);
    stopProgress(progressTimer);
    setUploading(false);
    if (res.success && res.data) {
      const warnings = res.data.warnings ?? [];
      setImportWarnings(warnings);
      if (res.data.savingsDelta != null) setLastSavingsDelta(res.data.savingsDelta);
      setUploadMsg({
        type: "success",
        text: `יובאו ${res.data.imported} קרנות בהצלחה — הסוכן מנתח...`,
      });
      await loadFunds();
      const analysisRes = await loadAnalysis();
      void loadImportHistory();
      setInsightsTrigger(t => t + 1);
      const age = analysisRes.ok && analysisRes.data?.success
        ? analysisRes.data.data?.summary?.currentAge
        : undefined;
      if (!age) setShowAgeModal(true);
      setTimeout(() => setStep("results"), 800);
    } else {
      setUploadMsg({ type: "error", text: res.message ?? "שגיאה בייבוא הקובץ" });
    }
  };

  const summary = data?.summary;
  const projection = data?.projection;
  const benchmark = data?.benchmark;
  const healthCheck = data?.healthCheck;
  const recs = data?.recommendations ?? [];

  return (
    <PrivateDomainPageLayout maxWidth={900}>

        {showAgeModal && (
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
            <GlassCard padding="lg" elevated style={{ maxWidth: 420, width: "100%" }}>
              <h2 style={{ fontFamily: "var(--font-display)", fontSize: 22, margin: "0 0 10px", color: "var(--text-strong)" }}>חסר גיל בפרופיל</h2>
              <p style={{ fontSize: 14, color: "var(--text-muted)", lineHeight: 1.6, margin: "0 0 20px" }}>
                לניתוח מסלול סיכון ותחזית פרישה מדויקת, הגדר את גילך בפרופיל.
              </p>
              <div style={{ display: "flex", gap: 10 }}>
                <button
                  onClick={() => { setShowAgeModal(false); navigate(APP_ROUTES.settings); }}
                  style={{ flex: 1, padding: "11px", borderRadius: "var(--r-card)", background: "var(--mint-ink)", color: "#fff", border: "none", cursor: "pointer", fontWeight: "var(--fw-bold)" as React.CSSProperties["fontWeight"] }}
                >
                  עדכן פרופיל
                </button>
                <button
                  onClick={() => setShowAgeModal(false)}
                  style={{ padding: "11px 16px", borderRadius: "var(--r-card)", background: "none", border: "1px solid var(--border-soft)", color: "var(--text-muted)", cursor: "pointer", fontWeight: "var(--fw-semibold)" as React.CSSProperties["fontWeight"] }}
                >
                  המשך בכל זאת
                </button>
              </div>
            </GlassCard>
          </div>
        )}

        {loading && step === "landing" && (
          <div style={{ textAlign: "center", padding: "80px 0", color: "var(--mint-ink)", fontSize: 14 }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>⏳</div>
            טוען נתוני פנסיה...
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════
            STEP: LANDING
        ══════════════════════════════════════════════════════════ */}
        {!loading && (step === "landing" || step === "guide" || step === "upload") && (
          <GovReportImportFlow
            domain="pension"
            step={step}
            progressSteps={UPLOAD_PROGRESS_STEPS}
            onImport={() => setStep("guide")}
            onManual={() => { setStep("results"); setShowAddForm(true); }}
            visitedSite={visitedSite}
            onVisitSite={() => {
              window.open(HAR_HAKESEF_URL, "_blank", "noopener,noreferrer");
              setVisitedSite(true);
            }}
            onContinue={() => setStep("upload")}
            onBack={() => setStep(step === "upload" ? "guide" : "landing")}
            fileInputRef={fileInputRef}
            uploading={uploading}
            uploadMsg={uploadMsg}
            uploadProgressStep={uploadProgressStep}
            isDragging={isDragging}
            setIsDragging={setIsDragging}
            onUpload={handleFileUpload}
            uploadHeaderExtra={step === "upload" ? (
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                {([
                  { id: "har_hakesef" as const, label: "הר הכסף", sub: "Excel / PDF מהמסלקה" },
                  { id: "quarterly_report" as const, label: "דוח תקופתי", sub: "PDF מהגוף המנהל" },
                ]).map(opt => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setImportSource(opt.id)}
                    style={{
                      flex: "1 1 160px", padding: "12px 16px", borderRadius: "var(--r-card)", textAlign: "right", cursor: "pointer",
                      fontFamily: "inherit", border: importSource === opt.id ? "2px solid var(--mint-ink)" : "1px solid var(--border-soft)",
                      background: importSource === opt.id ? "var(--mint-soft)" : "var(--surface-card)",
                    }}
                  >
                    <div style={{ fontWeight: "var(--fw-bold)" as React.CSSProperties["fontWeight"], fontSize: 14, color: "var(--text-strong)" }}>{opt.label}</div>
                    <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>{opt.sub}</div>
                  </button>
                ))}
              </div>
            ) : undefined}
            uploadOverrides={step === "upload" && importSource === "quarterly_report" ? {
              subtitle: "העלה דוח תקופתי מהגוף המנהל (מגדל, הראל, כלל וכו') — מקור עשיר יותר לדמי ניהול ומסלולים.",
              idleTitle: "גרור דוח תקופתי לכאן",
              idleSub: "PDF מהגוף המנהל",
              progressFallback: "מנתח מול השוק...",
            } : undefined}
          />
        )}

        {/* ══════════════════════════════════════════════════════════
            STEP: RESULTS
        ══════════════════════════════════════════════════════════ */}
        {step === "results" && (
          <ResultsStep
            loading={loading}
            funds={funds}
            summary={summary}
            projection={projection}
            benchmark={benchmark}
            healthCheck={healthCheck}
            recs={recs}
            importHistory={importHistory}
            lastSavingsDelta={lastSavingsDelta}
            onReloadAnalysis={() => { void loadAnalysis(); void loadFunds(); }}
            showAddForm={showAddForm}
            setShowAddForm={setShowAddForm}
            form={form}
            setForm={setForm}
            saving={saving}
            saveMsg={saveMsg}
            deletingId={deletingId}
            simAge={simAge} setSimAge={setSimAge}
            simExtra={simExtra} setSimExtra={setSimExtra}
            simFee={simFee} setSimFee={setSimFee}
            simResult={simResult}
            simLoading={simLoading}
            onSaveFund={handleSaveFund}
            onDeleteFund={handleDeleteFund}
            onSimulate={handleSimulate}
            onReimport={() => setStep("guide")}
            navigate={navigate}
            insightsTrigger={insightsTrigger}
            importWarnings={importWarnings}
          />
        )}

    </PrivateDomainPageLayout>
  );
}


/* ════════════════════════════════════════════════════════════════
   STEP: RESULTS
════════════════════════════════════════════════════════════════ */
interface ResultsProps {
  loading: boolean;
  funds: PensionFundDTO[];
  summary: PensionAnalysisData["summary"] | null | undefined;
  projection: PensionAnalysisData["projection"] | null | undefined;
  benchmark: PensionAnalysisData["benchmark"] | undefined;
  healthCheck: PensionAnalysisData["healthCheck"] | undefined;
  recs: PensionAnalysisData["recommendations"];
  importHistory: PensionImportSnapshotDTO[];
  lastSavingsDelta: number | null;
  onReloadAnalysis: () => void;
  showAddForm: boolean;
  setShowAddForm: React.Dispatch<React.SetStateAction<boolean>>;
  form: UploadPensionBody;
  setForm: React.Dispatch<React.SetStateAction<UploadPensionBody>>;
  saving: boolean;
  saveMsg: { type: "success" | "error"; text: string } | null;
  deletingId: string | null;
  simAge: string; setSimAge: (v: string) => void;
  simExtra: string; setSimExtra: (v: string) => void;
  simFee: string; setSimFee: (v: string) => void;
  simResult: SimulationResponse["data"] | null;
  simLoading: boolean;
  onSaveFund: () => void;
  onDeleteFund: (id: string) => void;
  onSimulate: () => void;
  onReimport: () => void;
  navigate: ReturnType<typeof useNavigate>;
  insightsTrigger: number;
  importWarnings: string[];
}

function ResultsStep({
  loading, funds, summary, projection, benchmark, healthCheck, recs,
  importHistory, lastSavingsDelta, onReloadAnalysis,
  showAddForm, setShowAddForm, form, setForm,
  saving, saveMsg, deletingId,
  simAge, setSimAge, simExtra, setSimExtra, simFee, setSimFee,
  simResult, simLoading,
  onSaveFund, onDeleteFund, onSimulate, onReimport, navigate,
  insightsTrigger, importWarnings,
}: ResultsProps) {
  const [editingFundId, setEditingFundId] = useState<string | null>(null);
  const [editTrack, setEditTrack] = useState("");
  const [editFeePct, setEditFeePct] = useState("");
  const [editSaving, setEditSaving] = useState(false);

  const benchmarkByFundId = new Map(
    (benchmark?.funds ?? []).map(b => [b.fundId, b] as const),
  );
  const benchmarkByName = new Map(
    (benchmark?.funds ?? []).map(b => [b.fundName, b] as const),
  );

  const getFundBenchmark = (f: PensionFundDTO): PensionBenchmarkFundDTO | undefined =>
    benchmarkByFundId.get(f.id) ?? benchmarkByName.get(f.fundName);

  const historyDelta = computeImportHistoryDelta(
    importHistory,
    "totalPotentialSavings",
    lastSavingsDelta,
  );

  const startEditFund = (f: PensionFundDTO) => {
    setEditingFundId(f.id);
    setEditTrack(f.investmentTrack || "");
    setEditFeePct(((f.managementFeeAccumulation ?? 0) * 100).toFixed(2));
  };

  const saveEditFund = async (id: string) => {
    setEditSaving(true);
    await updatePensionFund(id, {
      investmentTrack: editTrack || undefined,
      managementFeeAccumulation: parseFloat(editFeePct) / 100 || undefined,
    });
    setEditSaving(false);
    setEditingFundId(null);
    onReloadAnalysis();
  };

  return (
    <div>
      <DomainResultsHeader
        emoji="📈"
        title="ניתוח הפנסיה שלך"
        subtitle={`${funds.length} קרנות · ${summary?.currentAccumulation ? `צבירה ${fmt(summary.currentAccumulation)}` : "הוסף נתונים לניתוח"}`}
        accentColor="var(--mint-ink)"
        onReimport={onReimport}
        actions={
          <button
            type="button"
            onClick={() => setShowAddForm(v => !v)}
            style={{ display: "flex", alignItems: "center", gap: 7, padding: "10px 18px", borderRadius: "var(--r-card)", background: "var(--mint-ink)", color: "#fff", border: "none", cursor: "pointer", fontFamily: "inherit", fontWeight: "var(--fw-bold)" as React.CSSProperties["fontWeight"], fontSize: 13.5 }}
          >
            <Plus size={13} /> הוסף קרן ידנית
          </button>
        }
      />

      {loading ? (
        <div style={{ textAlign: "center", padding: "40px 0" }}>
          <Loader2 size={28} color="var(--mint-ink)" style={{ animation: "spin 0.8s linear infinite" }} />
        </div>
      ) : (
        <>
          {importWarnings.length > 0 && (
            <GlassCard padding="md" style={{ marginBottom: 24, borderRight: "4px solid var(--warning)", background: "var(--butter-soft)" }}>
              <div style={{ fontWeight: "var(--fw-bold)" as React.CSSProperties["fontWeight"], fontSize: 14, color: "var(--butter-ink)", marginBottom: 8 }}>נתונים חלקיים מהדוח</div>
              <div style={{ fontSize: 13, color: "var(--butter-ink)", lineHeight: 1.55 }}>
                {importWarnings.slice(0, 3).map(w => <div key={w}>• {w}</div>)}
                {importWarnings.length > 3 && <div>...ועוד {importWarnings.length - 3}</div>}
              </div>
              <button
                onClick={() => setShowAddForm(true)}
                style={{ marginTop: 12, padding: "8px 16px", borderRadius: "var(--r-btn)", background: "var(--mint-soft)", color: "var(--mint-ink)", border: "1px solid var(--mint)", cursor: "pointer", fontFamily: "inherit", fontWeight: "var(--fw-bold)" as React.CSSProperties["fontWeight"], fontSize: 13 }}
              >
                השלם נתונים חסרים
              </button>
            </GlassCard>
          )}

          {/* FINQ-style bottom line + health check */}
          {(benchmark?.summary || healthCheck) && summary?.hasData && (
            <section style={{ marginBottom: 32 }}>
              {historyDelta != null && historyDelta !== 0 && (
                <SavingsDeltaCard
                  delta={historyDelta}
                  label="שינוי בחיסכון עד פרישה"
                  formatValue={n => fmt(n)}
                />
              )}
              {benchmark?.summary && benchmark.summary.totalPotentialSavings > 0 && (
                <GlassCard padding="lg" elevated style={{ marginBottom: 16, background: "var(--mint-soft)", border: "1px solid var(--mint)" }}>
                  <div style={{ fontSize: 13, fontWeight: "var(--fw-semibold)" as React.CSSProperties["fontWeight"], color: "var(--mint-ink)", marginBottom: 8 }}>שורה תחתונה</div>
                  <div style={{ fontFamily: "var(--font-display)", fontSize: "clamp(24px, 4vw, 32px)", fontWeight: "var(--fw-extrabold)" as React.CSSProperties["fontWeight"], color: "var(--text-strong)", letterSpacing: "-0.03em" }}>
                    {fmt(benchmark.summary.totalPotentialSavings)} חיסכון פוטנציאלי עד פרישה
                  </div>
                  <div style={{ fontSize: 14, color: "var(--text-muted)", marginTop: 8 }}>
                    {benchmark.summary.fundsAboveMarketFee > 0
                      ? `${benchmark.summary.fundsAboveMarketFee} קרנות עם דמי ניהול מעל ממוצע השוק`
                      : "דמי הניהול שלך בממוצע שוק או טובים יותר"}
                    {benchmark.summary.avgRankPercentile != null && ` · דירוג ממוצע: אחוזון ${benchmark.summary.avgRankPercentile}`}
                  </div>
                  <div style={{ fontSize: 11.5, color: "var(--text-faint)", marginTop: 10 }}>⚠️ אינו מהווה ייעוץ פנסיוני מקצועי.</div>
                </GlassCard>
              )}

              {healthCheck && (
                <HealthCheckPanel
                  title="בדיקת בריאות פנסיונית"
                  healthCheck={healthCheck}
                  accentColor="var(--mint-ink)"
                />
              )}
            </section>
          )}

          {/* Projection KPIs */}
          {projection?.available ? (
            <section style={{ marginBottom: 40 }}>
              <SectionHeader title="תחזית הפנסיה שלך" subtitle={`${projection.monthsToRetirement} חודשים עד פרישה`} />
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 14 }}>
                <StatCard icon={<PiggyBank size={18} />} label="צבירה צפויה" value={fmt(projection.projectedAccumulation)} sub="בגיל פרישה" accent="var(--mint-ink)" />
                <StatCard icon={<TrendingUp size={18} />} label="קצבה חודשית" value={fmt(projection.monthlyPensionEstimate)} sub="אחרי פרישה" accent="var(--success)" />
                {summary?.currentAccumulation ? <StatCard icon="💼" label="צבירה נוכחית" value={fmt(summary.currentAccumulation)} accent="var(--mint)" /> : null}
                {summary?.totalMonthlyContribution ? <StatCard icon="📥" label="הפקדה חודשית" value={fmt(summary.totalMonthlyContribution)} accent="var(--mint-ink)" /> : null}
                {projection.replacementRatio != null && (
                  <StatCard icon="📊" label="שיעור חלופה" value={`${projection.replacementRatio}%`} sub="מהשכר האחרון" accent={projection.replacementRatio >= 70 ? "var(--success)" : "var(--warning)"} />
                )}
              </div>

              {projection.scenarios && (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16, marginTop: 16 }}>
                  {[
                    { label: "תרחיש בסיס", s: projection.scenarios.base, color: "var(--mint-ink)" },
                    { label: "תרחיש אופטימי", s: projection.scenarios.optimistic, color: "var(--success)" },
                  ].map(({ label, s, color }) => (
                    <GlassCard key={label} padding="md" style={{ borderTop: `3px solid ${color}` }}>
                      <div style={{ fontSize: 12.5, color: "var(--text-muted)", marginBottom: 6, fontWeight: "var(--fw-semibold)" as React.CSSProperties["fontWeight"] }}>{label}</div>
                      <div style={{ display: "flex", gap: 24 }}>
                        <div>
                          <div style={{ fontSize: 22, fontWeight: "var(--fw-extrabold)" as React.CSSProperties["fontWeight"], color, fontFamily: "var(--font-display)", letterSpacing: "-0.02em" }}>{fmt(s.accumulation)}</div>
                          <div style={{ fontSize: 11.5, color: "var(--text-muted)" }}>צבירה</div>
                        </div>
                        <div>
                          <div style={{ fontSize: 22, fontWeight: "var(--fw-extrabold)" as React.CSSProperties["fontWeight"], color, fontFamily: "var(--font-display)", letterSpacing: "-0.02em" }}>{fmt(s.monthlyPension)}</div>
                          <div style={{ fontSize: 11.5, color: "var(--text-muted)" }}>קצבה / חודש</div>
                        </div>
                      </div>
                    </GlassCard>
                  ))}
                </div>
              )}
            </section>
          ) : !summary?.hasData && (
            <GlassCard padding="lg" style={{ textAlign: "center", marginBottom: 40 }}>
              <div style={{ fontSize: 36, marginBottom: 12 }}>📋</div>
              <h3 style={{ fontFamily: "var(--font-display)", fontSize: 20, fontWeight: "var(--fw-bold)" as React.CSSProperties["fontWeight"], color: "var(--text-strong)", margin: "0 0 10px" }}>אין עדיין נתוני פנסיה</h3>
              <p style={{ fontSize: 14.5, color: "var(--text-muted)", margin: "0 0 20px" }}>הוסף קרן פנסיה ידנית כדי לקבל תחזית מלאה</p>
              <button onClick={() => setShowAddForm(true)} style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "11px 24px", borderRadius: "var(--r-card)", background: "var(--mint-ink)", color: "#fff", border: "none", cursor: "pointer", fontFamily: "inherit", fontWeight: "var(--fw-bold)" as React.CSSProperties["fontWeight"], fontSize: 14 }}>
                <Plus size={15} /> הוסף קרן ראשונה
              </button>
            </GlassCard>
          )}

          <DomainRecommendationsSection
            recommendations={recs}
            title="✦ המלצות — ממוינות לפי השפעה כספית"
            subtitle="מה כדאי לעשות עכשיו"
            limit={recs.length}
          />

          {/* Mgmt fee warning */}
          {projection?.mgmtFeeSavings && projection.mgmtFeeSavings.savingsByRetirement > 10000 && (
            <GlassCard padding="md" style={{ display: "flex", gap: 14, alignItems: "center", marginBottom: 32, borderRight: "4px solid var(--warning)", background: "var(--butter-soft)" }}>
              <AlertCircle size={22} color="var(--warning)" style={{ flexShrink: 0 }} />
              <div>
                <div style={{ fontWeight: "var(--fw-bold)" as React.CSSProperties["fontWeight"], fontSize: 15, color: "var(--butter-ink)", marginBottom: 3 }}>דמי ניהול גבוהים זוהו</div>
                <div style={{ fontSize: 13.5, color: "var(--butter-ink)" }}>
                  הורדת דמי הניהול עשויה לחסוך {fmt(projection.mgmtFeeSavings.savingsByRetirement)} עד הפרישה
                  {" "}ולהוסיף {fmt(projection.mgmtFeeSavings.additionalMonthlyPension)} לקצבה החודשית.
                </div>
              </div>
            </GlassCard>
          )}
        </>
      )}

      {/* Funds + Simulation side-by-side */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 24, marginBottom: 40 }}>

        {/* Fund list */}
        <GlassCard padding="lg" elevated>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
            <div>
              <div style={{ fontWeight: "var(--fw-extrabold)" as React.CSSProperties["fontWeight"], fontSize: 15.5, color: "var(--text-strong)", display: "flex", alignItems: "center", gap: 8 }}>
                <PiggyBank size={17} color="var(--mint-ink)" /> קרנות פנסיה
              </div>
              <div style={{ fontSize: 12.5, color: "var(--text-muted)", marginTop: 2 }}>{funds.length} קרנות פעילות</div>
            </div>
            <button onClick={() => setShowAddForm(v => !v)} style={{ display: "flex", alignItems: "center", gap: 5, padding: "7px 13px", borderRadius: "var(--r-btn)", background: "var(--mint-soft)", color: "var(--mint-ink)", border: "1px solid var(--mint)", cursor: "pointer", fontFamily: "inherit", fontWeight: "var(--fw-bold)" as React.CSSProperties["fontWeight"], fontSize: 13 }}>
              <Plus size={13} /> הוסף
            </button>
          </div>

          {funds.length === 0 ? (
            <div style={{ textAlign: "center", padding: "20px 0", color: "var(--text-muted)", fontSize: 14 }}>אין קרנות. הוסף קרן ראשונה.</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {funds.map(f => {
                const bf = getFundBenchmark(f);
                const rank = bf ? RANK_BADGE[bf.rankLabel] ?? RANK_BADGE.unknown : null;
                return (
                <div key={f.id} style={{ padding: "12px 14px", borderRadius: "var(--r-card)", background: "var(--mint-soft)", border: "1px solid var(--border-hair)", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <div style={{ fontWeight: "var(--fw-bold)" as React.CSSProperties["fontWeight"], fontSize: 13.5, color: "var(--text-strong)" }}>{f.fundName}</div>
                      {rank && (
                        <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 20, color: rank.color, background: rank.bg }}>
                          {bf && bf.matchConfidence < 60 ? "לא מזוהה" : rank.label}
                        </span>
                      )}
                      {bf && bf.matchConfidence < 60 && (
                        <span style={{ fontSize: 11, color: "#7C6FA0" }}>({bf.matchConfidence}% התאמה)</span>
                      )}
                      {bf?.riskMismatch && (
                        <span style={{ fontSize: 11, fontWeight: "var(--fw-bold)" as React.CSSProperties["fontWeight"], padding: "2px 8px", borderRadius: "var(--r-pill)", color: "var(--danger)", background: "rgba(220,38,38,0.10)" }}>
                          סיכון לא מתאים
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>{FUND_TYPE_LABELS[f.fundType] ?? f.fundType}{f.provider ? ` · ${f.provider}` : ""}</div>
                    <div style={{ fontSize: 12.5, fontWeight: "var(--fw-semibold)" as React.CSSProperties["fontWeight"], color: "var(--mint-ink)", marginTop: 3 }}>{fmt(f.currentBalance)} צבירה</div>
                    {bf && bf.userFee != null && (
                      <div style={{ fontSize: 11.5, color: bf.feeVsMarket === "above_market" || bf.feeVsMarket === "high" ? "var(--danger)" : "var(--success)", marginTop: 4 }}>
                        דמ"צ {(bf.userFee * 100).toFixed(2)}% vs שוק {((bf.marketAvgFee ?? 0) * 100).toFixed(2)}%
                      </div>
                    )}
                    {bf && bf.matchConfidence < 60 && editingFundId !== f.id && (
                      <button type="button" onClick={() => startEditFund(f)} style={{ marginTop: 6, fontSize: 12, color: "var(--mint-ink)", background: "none", border: "none", cursor: "pointer", fontWeight: "var(--fw-bold)" as React.CSSProperties["fontWeight"], padding: 0 }}>
                        השלם מסלול / דמ"צ
                      </button>
                    )}
                    {editingFundId === f.id && (
                      <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 6 }}>
                        <input value={editTrack} onChange={e => setEditTrack(e.target.value)} placeholder="מסלול השקעה" style={{ padding: "6px 8px", borderRadius: "var(--r-btn)", fontSize: 12, border: "1px solid var(--border-soft)" }} />
                        <input value={editFeePct} onChange={e => setEditFeePct(e.target.value)} placeholder="דמ%צ (%)" type="number" style={{ padding: "6px 8px", borderRadius: "var(--r-btn)", fontSize: 12, border: "1px solid var(--border-soft)" }} />
                        <div style={{ display: "flex", gap: 6 }}>
                          <button type="button" disabled={editSaving} onClick={() => void saveEditFund(f.id)} style={{ padding: "6px 10px", borderRadius: "var(--r-btn)", background: "var(--mint-ink)", color: "#fff", border: "none", fontSize: 12, fontWeight: "var(--fw-bold)" as React.CSSProperties["fontWeight"], cursor: "pointer" }}>שמור</button>
                          <button type="button" onClick={() => setEditingFundId(null)} style={{ padding: "6px 10px", borderRadius: "var(--r-btn)", background: "none", border: "1px solid var(--border-soft)", fontSize: 12, cursor: "pointer" }}>ביטול</button>
                        </div>
                      </div>
                    )}
                  </div>
                  <button onClick={() => void onDeleteFund(f.id)} disabled={deletingId === f.id} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--danger)", padding: 6, display: "flex", flexShrink: 0 }}>
                    {deletingId === f.id ? <Loader2 size={14} style={{ animation: "spin 0.8s linear infinite" }} /> : <Trash2 size={14} />}
                  </button>
                </div>
              );})}
            </div>
          )}

          {showAddForm && (
            <div style={{ marginTop: 16, borderTop: "1px solid var(--border-hair)", paddingTop: 16 }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10 }}>
                {([
                  { label: "שם הקרן *", field: "fundName" as const, type: "text" },
                  { label: "ספק / חברה", field: "provider" as const, type: "text" },
                  { label: "צבירה (₪)", field: "currentBalance" as const, type: "number" },
                  { label: "הפקדת עובד (₪/חודש)", field: "monthlyEmployeeDeposit" as const, type: "number" },
                  { label: "הפקדת מעסיק (₪/חודש)", field: "monthlyEmployerDeposit" as const, type: "number" },
                  { label: "דמי ניהול מצבירה (%)", field: "managementFeeAccumulation" as const, type: "number", scale: 100 },
                ] as Array<{ label: string; field: keyof UploadPensionBody; type: string; scale?: number }>).map(({ label, field, type, scale = 1 }) => (
                  <div key={field as string}>
                    <label style={{ fontSize: 11.5, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>{label}</label>
                    <input
                      type={type}
                      value={type === "number" ? ((form[field] as number ?? 0) * scale).toString() : (form[field] as string ?? "")}
                      onChange={e => setForm(prev => ({ ...prev, [field]: type === "number" ? (parseFloat(e.target.value) || 0) / scale : e.target.value }))}
                      style={{ width: "100%", padding: "8px 10px", borderRadius: "var(--r-btn)", fontSize: 13, background: "var(--surface-sunken)", border: "1px solid var(--border-soft)", color: "var(--text-strong)", fontFamily: "inherit", boxSizing: "border-box" }}
                    />
                  </div>
                ))}
              </div>
              <select value={form.fundType} onChange={e => setForm(prev => ({ ...prev, fundType: e.target.value }))} style={{ width: "100%", marginTop: 10, padding: "8px 10px", borderRadius: "var(--r-btn)", fontSize: 13, background: "var(--surface-sunken)", border: "1px solid var(--border-soft)", color: "var(--text-strong)", fontFamily: "inherit" }}>
                {Object.entries(FUND_TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
              {saveMsg && <div style={{ fontSize: 13, padding: "8px 12px", borderRadius: "var(--r-btn)", marginTop: 10, fontWeight: "var(--fw-semibold)" as React.CSSProperties["fontWeight"], background: saveMsg.type === "error" ? "rgba(220,38,38,0.08)" : "var(--mint-soft)", color: saveMsg.type === "error" ? "var(--danger)" : "var(--mint-ink)" }}>{saveMsg.text}</div>}
              <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                <button onClick={() => { setShowAddForm(false); }} style={{ flex: 1, padding: "9px", borderRadius: "var(--r-btn)", background: "none", border: "1px solid var(--border-soft)", color: "var(--text-muted)", cursor: "pointer", fontFamily: "inherit", fontSize: 13 }}>ביטול</button>
                <button onClick={onSaveFund} disabled={saving || !form.fundName?.trim()} style={{ flex: 2, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "9px", borderRadius: "var(--r-btn)", background: "var(--mint-ink)", color: "#fff", border: "none", cursor: "pointer", fontFamily: "inherit", fontWeight: "var(--fw-bold)" as React.CSSProperties["fontWeight"], fontSize: 14 }}>
                  {saving ? <Loader2 size={13} style={{ animation: "spin 0.8s linear infinite" }} /> : <Plus size={13} />} שמור
                </button>
              </div>
            </div>
          )}
        </GlassCard>

        {/* Simulation */}
        <GlassCard padding="lg" elevated>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18 }}>
            <SlidersHorizontal size={17} color="var(--mint-ink)" />
            <div style={{ fontWeight: "var(--fw-extrabold)" as React.CSSProperties["fontWeight"], fontSize: 15.5, color: "var(--text-strong)" }}>סימולציית תרחישים</div>
          </div>

          {!summary?.hasData ? (
            <div style={{ fontSize: 14, color: "var(--text-muted)", textAlign: "center", padding: "20px 0" }}>
              הוסף קרן פנסיה כדי להפעיל את הסימולציה
            </div>
          ) : (
            <>
              <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 16 }}>
                {([
                  { label: "גיל פרישה", field: "simAge", val: simAge, setter: setSimAge, placeholder: summary?.retirementAge?.toString() ?? "67" },
                  { label: "הפקדה נוספת (₪/חודש)", field: "simExtra", val: simExtra, setter: setSimExtra, placeholder: "0" },
                  { label: "דמי ניהול יעד (%)", field: "simFee", val: simFee, setter: setSimFee, placeholder: ((summary?.currentMgmtFee ?? 0.003) * 100).toFixed(2) },
                ] as Array<{ label: string; field: string; val: string; setter: (v: string) => void; placeholder: string }>).map(item => (
                  <div key={item.field}>
                    <label style={{ fontSize: 12, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>{item.label}</label>
                    <input type="number" value={item.val} onChange={e => item.setter(e.target.value)} placeholder={item.placeholder} style={{ width: "100%", padding: "9px 12px", borderRadius: "var(--r-btn)", fontSize: 14, background: "var(--surface-sunken)", border: "1px solid var(--border-soft)", color: "var(--text-strong)", fontFamily: "inherit", boxSizing: "border-box" }} />
                  </div>
                ))}
              </div>
              <button onClick={onSimulate} disabled={simLoading} style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 7, padding: "11px", borderRadius: "var(--r-card)", background: "var(--mint-ink)", color: "#fff", border: "none", cursor: simLoading ? "wait" : "pointer", fontFamily: "inherit", fontWeight: "var(--fw-bold)" as React.CSSProperties["fontWeight"], fontSize: 14, boxShadow: "var(--shadow-soft)", marginBottom: 16 }}>
                {simLoading ? <Loader2 size={14} style={{ animation: "spin 0.8s linear infinite" }} /> : <TrendingUp size={14} />}
                {simLoading ? "מחשב..." : "הרץ סימולציה"}
              </button>

              {simResult && (
                <div style={{ padding: "16px", borderRadius: "var(--r-card)", background: "var(--mint-soft)", border: "1px solid var(--mint)" }}>
                  <div style={{ fontSize: 12.5, color: "var(--text-muted)", fontWeight: "var(--fw-semibold)" as React.CSSProperties["fontWeight"], marginBottom: 10 }}>תוצאת הסימולציה</div>
                  {[
                    { label: "צבירה בגיל פרישה", val: fmt(simResult.simulation.projectedAccumulation), base: fmt(simResult.baseline.projectedAccumulation), diff: simResult.delta.accumulationDiff },
                    { label: "קצבה חודשית", val: fmt(simResult.simulation.monthlyPensionEstimate), base: fmt(simResult.baseline.monthlyPensionEstimate), diff: simResult.delta.monthlyPensionDiff },
                  ].map(row => (
                    <div key={row.label} style={{ marginBottom: 10 }}>
                      <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{row.label}</div>
                      <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 3, flexWrap: "wrap" }}>
                        <span style={{ fontFamily: "var(--font-display)", fontSize: 20, fontWeight: "var(--fw-bold)" as React.CSSProperties["fontWeight"], color: "var(--mint-ink)" }}>{row.val}</span>
                        <span style={{ fontSize: 11.5, color: "var(--text-muted)" }}>לעומת {row.base} בבסיס</span>
                        {row.diff !== 0 && <Badge variant={row.diff > 0 ? "success" : "high"}>{row.diff > 0 ? "+" : ""}{fmt(row.diff)}</Badge>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </GlassCard>
      </div>

      <DomainResultsFooter
        agent="pension"
        insightsTrigger={insightsTrigger}
        insightsTitle="תובנות AI פנסיוניות"
        insightsSubtitle="ניתוח מסלול סיכון, דמי ניהול, וריכוז קרנות מותאם לגילך"
        copilot={{
          title: "שאל את יועץ הפנסיה",
          description: '"מתי כדאי לפרוש?", "האם כדאי לאחד קרנות?", "כמה אני משלם בדמי ניהול?"',
          buttonLabel: "פתח שיחה עם יועץ הפנסיה",
          gradientFrom: "#6B4FA0",
          gradientTo: "#5A3E8F",
        }}
        disclaimer="⚠️ התחזיות מבוססות על הנחות ממוצעות. אינן מהוות ייעוץ פנסיוני מקצועי."
        onNavigate={route => navigate(route)}
      />
    </div>
  );
}
