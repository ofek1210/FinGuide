/**
 * PensionPage — guided Har HaKesef import flow + pension advisor analysis.
 *
 * Step "landing"  — hero + "ייבוא מהר הכסף" CTA
 * Step "guide"    — step-by-step instructions + direct link to הר הכסף
 * Step "upload"   — PDF / Excel upload
 * Step "results"  — flagship pension advisor (PensionAdvisor.jsx design),
 *                   wired to /api/pension/* (analysis, funds).
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import PrivateTopbar from "../components/PrivateTopbar";
import AppFooter from "../components/AppFooter";
import GlassCard from "../components/ui/GlassCard";
import PensionAdvisor from "../components/pension/PensionAdvisor";
import PensionImportGuide from "../components/pension/PensionImportGuide";
import PensionUpload from "../components/pension/PensionUpload";
import PensionOnboardingWizard from "../components/pension/PensionOnboardingWizard";
import {
  getPensionAnalysis,
  getPensionFunds,
  uploadPensionFund,
  uploadPensionFile,
  deletePensionFund,
  type PensionAnalysisData,
  type PensionFundDTO,
  type UploadPensionBody,
} from "../api/pension.api";
import { APP_ROUTES } from "../types/navigation";
import { UPLOAD_PROGRESS_STEPS } from "../utils/pensionDisplay";
import { GovReportImportFlow } from "../components/import/GovReportImportFlow";
import { PENSION_IMPORT_CONFIG } from "../config/govReportImportConfig";
import { useGovReportUploadProgress } from "../hooks/useGovReportUploadProgress";
import { useAiChat, useRegisterPageContext } from "../assistant/AiChatProvider";

const HAR_HAKESEF_URL = PENSION_IMPORT_CONFIG.siteUrl;

const EMPTY_FORM: UploadPensionBody = {
  fundName: "", fundType: "pension_comprehensive", provider: "",
  currentBalance: 0, monthlyEmployeeDeposit: 0, monthlyEmployerDeposit: 0,
  managementFeeAccumulation: 0.003, managementFeeDeposit: 0.001,
};

type FlowStep = "landing" | "onboarding" | "guide" | "upload" | "results";

export default function PensionPage() {
  const navigate = useNavigate();
  const { openPanel } = useAiChat();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { uploadProgressStep, start: startProgress, stop: stopProgress } = useGovReportUploadProgress(UPLOAD_PROGRESS_STEPS.length);

  const [step, setStep] = useState<FlowStep>("landing");
  const [data, setData] = useState<PensionAnalysisData | null>(null);
  const [loading, setLoading] = useState(true);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [visitedSite, setVisitedSite] = useState(false);

  // Upload state
  const [uploading, setUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [importSource, setImportSource] = useState<"har_hakesef" | "quarterly_report">("har_hakesef");

  // Funds + quick-add form
  const [funds, setFunds] = useState<PensionFundDTO[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [form, setForm] = useState<UploadPensionBody>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [lastImported, setLastImported] = useState<number | null>(null);

  const [showAgeModal, setShowAgeModal] = useState(false);

  const loadFunds = useCallback(async () => {
    const res = await getPensionFunds();
    if (res.ok && res.data?.data) setFunds(res.data.data);
  }, []);

  // Loads analysis data only — does NOT change the step, so the upload success
  // screen stays visible until the user clicks "צפה בניתוח הפנסיה".
  const loadAnalysis = useCallback(async () => {
    setAnalysisLoading(true);
    setAnalysisError(null);
    const res = await getPensionAnalysis();
    setAnalysisLoading(false);
    if (res.ok && res.data?.success && res.data.data) {
      setData(res.data.data);
      return res;
    }
    setAnalysisError(res.ok ? "לא התקבלו נתוני ניתוח מהשרת" : (res.error?.message ?? "שגיאה בטעינת הניתוח"));
    return res;
  }, []);

  useEffect(() => {
    void (async () => {
      setAnalysisLoading(true);
      setAnalysisError(null);
      const [analysisRes, fundsRes] = await Promise.all([getPensionAnalysis(), getPensionFunds()]);
      setAnalysisLoading(false);
      setLoading(false);
      const fundList = fundsRes.ok && fundsRes.data?.data ? fundsRes.data.data : [];
      setFunds(fundList);
      if (analysisRes.ok && analysisRes.data?.success && analysisRes.data.data) {
        setData(analysisRes.data.data);
      } else if (!analysisRes.ok) {
        setAnalysisError(analysisRes.error?.message ?? "שגיאה בטעינת הניתוח");
      }
      if (fundList.length > 0) {
        setStep("results");
        if (analysisRes.ok && analysisRes.data?.success && !analysisRes.data.data?.summary?.currentAge) {
          setShowAgeModal(true);
        }
      }
    })();
  }, []);

  const pensionContextLabel = (() => {
    const score = data?.healthCheck?.score;
    if (typeof score === "number" && Number.isFinite(score)) {
      return `פנסיה · ציון ${Math.round(score)}`;
    }
    if (step === "results") return "פנסיה · ניתוח";
    if (step === "upload" || step === "guide") return "פנסיה · ייבוא";
    return "פנסיה";
  })();

  const pensionContextDetail = (() => {
    const lines: string[] = [`שלב במסך: ${step}`];
    if (typeof data?.healthCheck?.score === "number") {
      lines.push(`ציון בריאות פנסיונית: ${Math.round(data.healthCheck.score)}/100`);
    }
    if (data?.summary?.fundCount != null) {
      lines.push(`מספר קרנות: ${data.summary.fundCount}`);
    }
    const topRec = data?.recommendations?.[0];
    if (topRec && typeof topRec === "object" && "title" in topRec && topRec.title) {
      lines.push(`המלצה מובילה: ${String(topRec.title)}`);
    }
    if (funds.length) lines.push(`קרנות ברשימה: ${funds.length}`);
    return lines.join("\n");
  })();

  useRegisterPageContext(pensionContextLabel, pensionContextDetail);

  const handleSaveFund = async () => {
    if (!form.fundName?.trim()) return;
    setSaving(true); setSaveMsg(null);
    const res = await uploadPensionFund(form);
    setSaving(false);
    if (res.ok) {
      setSaveMsg({ type: "success", text: "הקרן נשמרה בהצלחה" });
      setForm(EMPTY_FORM); setShowAddForm(false);
      void loadFunds(); void loadAnalysis();
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
    const [fundsRes, analysisRes] = await Promise.all([getPensionFunds(), getPensionAnalysis()]);
    const fundList = fundsRes.ok && fundsRes.data?.data ? fundsRes.data.data : [];
    setFunds(fundList);
    if (analysisRes.ok && analysisRes.data?.success && analysisRes.data.data) {
      setData(analysisRes.data.data);
    }
    if (fundList.length === 0) {
      setStep("landing");
      setShowAddForm(false);
      setShowAgeModal(false);
    }
  };

  const handleFileUpload = async (file: File) => {
    const ext = file.name.split(".").pop()?.toLowerCase();
    if (!["pdf", "xlsx", "xls"].includes(ext ?? "")) {
      setUploadMsg({ type: "error", text: "ניתן להעלות PDF, xlsx או xls בלבד" });
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setUploadMsg({ type: "error", text: "הקובץ גדול מדי. מקסימום 10MB." });
      return;
    }
    setUploading(true); setUploadMsg(null);
    const progressTimer = startProgress();
    const res = await uploadPensionFile(file, importSource);
    stopProgress(progressTimer);
    setUploading(false);
    if (res.success && res.data) {
      setLastImported(res.data.imported);
      setUploadMsg({ type: "success", text: `יובאו ${res.data.imported} קרנות בהצלחה` });
      await loadFunds();
      await loadAnalysis();
      // stay on the upload success screen; the user advances via the button
    } else {
      setUploadMsg({ type: "error", text: res.message ?? "שגיאה בייבוא הקובץ" });
    }
  };

  const shell = (children: React.ReactNode) => (
    <div data-agent="pension" style={{ minHeight: "100vh", background: "var(--surface-page)", backgroundImage: "radial-gradient(rgba(47,156,98,.06) 1px,transparent 1px)", backgroundSize: "22px 22px", color: "var(--text-body)", fontFamily: "var(--font-body)", direction: "rtl" }}>
      <PrivateTopbar />
      {children}
      <AppFooter variant="private" />
    </div>
  );

  // 2-option onboarding wizard (free manual vs paid clearinghouse)
  if (step === "onboarding") {
    return shell(
      <PensionOnboardingWizard
        onBack={() => setStep("landing")}
        onComplete={async () => {
          await loadFunds();
          await loadAnalysis();
          setStep("results");
        }}
      />,
    );
  }

  // Step 1/2 — green zigzag guide (legacy path)
  if (step === "guide") {
    return shell(
      <PensionImportGuide
        onBack={() => setStep("landing")}
        onContinue={() => setStep("upload")}
        onVisitSite={() => { window.open(HAR_HAKESEF_URL, "_blank", "noopener,noreferrer"); setVisitedSite(true); }}
      />,
    );
  }

  // Step 2/2 — green dropzone wired to uploadPensionFile
  if (step === "upload") {
    return shell(
      <PensionUpload
        onBack={() => setStep("guide")}
        onContinue={() => setStep("results")}
        onUpload={handleFileUpload}
        uploading={uploading}
        uploadMsg={uploadMsg}
        uploadProgressStep={uploadProgressStep}
        progressSteps={UPLOAD_PROGRESS_STEPS}
        isDragging={isDragging}
        setIsDragging={setIsDragging}
        importedCount={lastImported}
        importSource={importSource}
        onSourceChange={setImportSource}
      />,
    );
  }

  // Results — flagship pension advisor
  if (step === "results") {
    return shell(
      <>
        {showAgeModal && (
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
            <GlassCard padding="lg" elevated style={{ maxWidth: 420, width: "100%" }}>
              <h2 style={{ fontFamily: "var(--font-display)", fontSize: 22, margin: "0 0 10px", color: "var(--text-strong)" }}>חסר גיל בפרופיל</h2>
              <p style={{ fontSize: 14, color: "var(--text-muted)", lineHeight: 1.6, margin: "0 0 20px" }}>
                לניתוח מסלול סיכון ותחזית פרישה מדויקת, הגדר את גילך בפרופיל.
              </p>
              <div style={{ display: "flex", gap: 10 }}>
                <button onClick={() => { setShowAgeModal(false); navigate(APP_ROUTES.settings); }}
                  style={{ flex: 1, padding: "11px", borderRadius: "var(--r-card)", background: "var(--mint-ink)", color: "#fff", border: "none", cursor: "pointer", fontWeight: 700 }}>
                  עדכן פרופיל
                </button>
                <button onClick={() => setShowAgeModal(false)}
                  style={{ padding: "11px 16px", borderRadius: "var(--r-card)", background: "none", border: "1px solid var(--border-soft)", color: "var(--text-muted)", cursor: "pointer", fontWeight: 600 }}>
                  המשך בכל זאת
                </button>
              </div>
            </GlassCard>
          </div>
        )}
        <div style={{ maxWidth: 1120, margin: "0 auto", padding: "20px 24px 0" }}>
          <PensionAdvisor
            data={data}
            funds={funds}
            analysisLoading={analysisLoading}
            analysisError={analysisError}
            onRetryAnalysis={() => { void loadAnalysis(); }}
            showAddForm={showAddForm}
            setShowAddForm={setShowAddForm}
            form={form}
            setForm={setForm}
            saving={saving}
            saveMsg={saveMsg}
            deletingId={deletingId}
            onSaveFund={handleSaveFund}
            onDeleteFund={handleDeleteFund}
            onReimport={() => setStep("onboarding")}
            onOpenChat={() => openPanel()}
          />
        </div>
      </>,
    );
  }

  // Landing (+ initial loading) — same mint shell as guide/upload/results
  return shell(
    loading ? (
      <div style={{ textAlign: "center", padding: "80px 24px", color: "var(--mint-ink)", fontSize: 14 }}>
        <div style={{ fontSize: 32, marginBottom: 12 }}>⏳</div>
        טוען נתוני פנסיה...
      </div>
    ) : (
      <div style={{ maxWidth: 900, margin: "0 auto", padding: "20px 24px 40px" }}>
        <GovReportImportFlow
          domain="pension"
          step="landing"
          progressSteps={UPLOAD_PROGRESS_STEPS}
          onImport={() => setStep("onboarding")}
          onManual={() => { setStep("results"); setShowAddForm(true); }}
          visitedSite={visitedSite}
          onVisitSite={() => { window.open(HAR_HAKESEF_URL, "_blank", "noopener,noreferrer"); setVisitedSite(true); }}
          onContinue={() => setStep("upload")}
          onBack={() => setStep("landing")}
          fileInputRef={fileInputRef}
          uploading={uploading}
          uploadMsg={uploadMsg}
          uploadProgressStep={uploadProgressStep}
          isDragging={isDragging}
          setIsDragging={setIsDragging}
          onUpload={handleFileUpload}
        />
      </div>
    ),
  );
}
