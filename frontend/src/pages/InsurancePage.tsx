/**
 * InsurancePage — guided Har HaBituach import flow
 */
import { useCallback, useEffect, useState } from "react";
import {
  Shield, AlertCircle, CheckCircle, Trash2, Loader2,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
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
import { GovReportImportFlow } from "../components/import/GovReportImportFlow";
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
    uploadSuccessMessage: res => `יובאו ${res.data?.imported ?? 0} פוליסות בהצלחה — הסוכן מנתח...`,
    reloadAfterUpload: load,
    reloadImportHistory: loadImportHistory,
  });

  const {
    step, setStep, fileInputRef, uploading, uploadMsg, uploadProgressStep,
    isDragging, setIsDragging, visitedSite, setVisitedSite,
    lastSavingsDelta, handleUpload,
  } = flow;

  useEffect(() => {
    void load();
    void loadImportHistory();
  }, [load, loadImportHistory]);

  useEffect(() => {
    if ((data?.policies ?? []).length > 0) {
      setStep("results");
    }
  }, [data, setStep]);

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

  return (
    <PrivateDomainPageLayout>

        {loading && step === "landing" && (
          <div style={{ textAlign: "center", padding: "80px 0", color: "#9B7FE8", fontSize: 14 }}>
            <Loader2 size={28} style={{ animation: "spin 0.8s linear infinite", marginBottom: 12 }} />
            טוען נתוני ביטוח...
          </div>
        )}

        {!loading && (step === "landing" || step === "guide" || step === "upload") && (
          <GovReportImportFlow
            domain="insurance"
            step={step}
            progressSteps={UPLOAD_PROGRESS_STEPS}
            onImport={() => setStep("guide")}
            visitedSite={visitedSite}
            onVisitSite={() => {
              window.open(HAR_HABITUACH_URL, "_blank", "noopener,noreferrer");
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
            onUpload={handleUpload}
          />
        )}

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
        <Loader2 size={28} color="#7B5EA7" style={{ animation: "spin 0.8s linear infinite" }} />
        <div style={{ marginTop: 12, fontSize: 14, color: "#7C6FA0" }}>מנתח את הפוליסות...</div>
      </div>
    );
  }

  if (analysisError) {
    return (
      <GlassCard padding="lg" style={{ textAlign: "center", borderRight: "4px solid #DC2626" }}>
        <AlertCircle size={28} color="#DC2626" style={{ marginBottom: 12 }} />
        <div style={{ fontWeight: 700, fontSize: 16, color: "#1F1F1F", marginBottom: 8 }}>שגיאה בטעינת הניתוח</div>
        <div style={{ fontSize: 14, color: "#7C6FA0", marginBottom: 16 }}>{analysisError}</div>
        <button type="button" onClick={onRetry} style={{ padding: "10px 20px", borderRadius: 10, background: "#7B5EA7", color: "#fff", border: "none", cursor: "pointer", fontFamily: "inherit", fontWeight: 700 }}>
          נסה שוב
        </button>
      </GlassCard>
    );
  }

  if (policies.length === 0) {
    return (
      <GlassCard padding="lg" style={{ textAlign: "center" }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>🛡️</div>
        <h2 style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 22, fontWeight: 700, color: "#1F1F1F", margin: "0 0 10px" }}>
          אין עדיין פוליסות ביטוח
        </h2>
        <p style={{ fontSize: 14.5, color: "#7C6FA0", margin: "0 0 20px" }}>
          ייבא דוח מהר הביטוח כדי לקבל ניתוח מלא
        </p>
        <button
          type="button"
          onClick={onReimport}
          style={{ padding: "12px 24px", borderRadius: 12, background: "linear-gradient(135deg, #7B5EA7, #6B4FA0)", color: "#fff", border: "none", cursor: "pointer", fontFamily: "inherit", fontWeight: 700, fontSize: 14 }}
        >
          ייבא דוח ביטוח
        </button>
      </GlassCard>
    );
  }

  return (
    <div>
      <DomainResultsHeader
        emoji="🛡️"
        title="ניתוח הביטוח שלך"
        subtitle={`${policies.length} פוליסות פעילות · עלות חודשית ${fmt(totalPremium)}`}
        accentColor="#7B5EA7"
        onReimport={onReimport}
      />

      {analysis && (
        <section style={{ marginBottom: 36 }}>
          {historyDelta != null && historyDelta !== 0 && (
            <SavingsDeltaCard delta={historyDelta} label="שינוי בחיסכון שנתי" formatValue={n => fmt(n)} />
          )}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 14 }}>
            <StatCard icon="💸" label="הוצאה חודשית" value={fmt(totalPremium)} sub="כל הפוליסות" accent="#7B5EA7" />
            <StatCard icon="♻️" label="בזבוז מכפילויות" value={fmt(analysis.totalMonthlyWaste)} sub="לחודש" accent="#DC2626" trend={analysis.totalMonthlyWaste > 0 ? "down" : "flat"} />
            <StatCard icon="💰" label="חיסכון שנתי" value={fmt(analysis.savings.annualSavings)} accent="#059669" trend="up" />
            <StatCard icon="📋" label="פוליסות פעילות" value={policies.length.toString()} accent="#9B7FE8" />
            {analysis.missingCoverage.length > 0 && (
              <StatCard icon="⚠️" label="כיסויים חסרים" value={analysis.missingCoverage.length.toString()} accent="#D97706" />
            )}
          </div>
        </section>
      )}

      {healthCheck && (
        <HealthCheckPanel title="בדיקת בריאות ביטוח" healthCheck={healthCheck} accentColor="#7B5EA7" />
      )}

      {analysis && analysis.duplicates.length > 0 && (
        <section style={{ marginBottom: 32 }}>
          <SectionHeader title="⚠️ כיסויים כפולים שזוהו" subtitle="פוליסות אשר ייתכן ומיותרות — שווה לבדוק" />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 14 }}>
            {analysis.duplicates.map((dup: InsuranceDuplicate, i: number) => (
              <GlassCard key={i} padding="md" style={{ borderRight: "4px solid #DC2626" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                  <div style={{ fontWeight: 800, fontSize: 15, color: "#DC2626" }}>{POLICY_TYPE_LABELS[dup.type] ?? dup.type}</div>
                  <Badge variant="high">{dup.policies.length} כפולים</Badge>
                </div>
                <div style={{ fontSize: 12.5, color: "#7C6FA0", marginBottom: 6 }}>
                  {dup.policies.map((p: { provider?: string }) => p.provider).filter(Boolean).join(" · ")}
                </div>
                <div style={{ fontSize: 14, fontWeight: 700, color: "#DC2626" }}>
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
              <div key={cov} style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 16px", borderRadius: 12, background: "rgba(217,119,6,0.06)", border: "1px solid rgba(217,119,6,0.2)" }}>
                <AlertCircle size={15} color="#D97706" />
                <span style={{ fontSize: 13.5, fontWeight: 600, color: "#D97706" }}>{POLICY_TYPE_LABELS[cov] ?? cov}</span>
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
            <GlassCard key={p.id} padding="sm" style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ width: 38, height: 38, borderRadius: 11, background: "rgba(123,94,167,0.10)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Shield size={17} color="#7B5EA7" />
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14, color: "#1F1F1F" }}>{POLICY_TYPE_LABELS[p.type] ?? p.type}</div>
                  <div style={{ fontSize: 12.5, color: "#7C6FA0" }}>
                    {p.provider ?? "—"}{p.policyNumber ? ` · ${p.policyNumber}` : ""}
                  </div>
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                <div style={{ textAlign: "left" }}>
                  <div style={{ fontWeight: 800, fontSize: 15.5, color: "#1F1F1F" }}>{fmt(p.monthlyPremium)}</div>
                  <div style={{ fontSize: 11.5, color: "#7C6FA0" }}>לחודש</div>
                </div>
                {p.status === "active"
                  ? <CheckCircle size={16} color="#059669" />
                  : <AlertCircle size={16} color="#D97706" />
                }
                <button
                  type="button"
                  onClick={() => void onDelete(p.id)}
                  disabled={deletingId === p.id}
                  style={{ background: "none", border: "none", cursor: "pointer", color: "#DC2626", padding: 4, display: "flex" }}
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
          gradientFrom: "#7B5EA7",
          gradientTo: "#6B4FA0",
        }}
        disclaimer="⚠️ הניתוח מבוסס על נתוני הדוח שיובא. אינו מהווה ייעוץ ביטוחי מקצועי."
        onNavigate={route => navigate(route)}
      />
    </div>
  );
}
