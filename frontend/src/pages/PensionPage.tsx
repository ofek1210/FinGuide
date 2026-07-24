/**
 * PensionPage — guided Har HaKesef import flow + pension advisor analysis.
 *
 * Step "landing"  — hero + "ייבוא מהר הכסף" CTA
 * Step "guide"    — step-by-step instructions + direct link to הר הכסף
 * Step "upload"   — PDF / Excel upload
 * Step "results"  — flagship pension advisor (PensionAdvisor.jsx design),
 *                   wired to /api/pension/* (analysis, funds).
 */
import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FileText, PiggyBank } from "lucide-react";
import PrivateTopbar from "../components/PrivateTopbar";
import AppFooter from "../components/AppFooter";
import AgentLandingHero from "../components/agent/AgentLandingHero";
import { AgentGhostButton, AgentPrimaryButton } from "../components/agent/AgentButtons";
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
import { PENSION_IMPORT_CONFIG } from "../config/govReportImportConfig";
import { useGovReportUploadProgress } from "../hooks/useGovReportUploadProgress";

const HAR_HAKESEF_URL = PENSION_IMPORT_CONFIG.siteUrl;

const EMPTY_FORM: UploadPensionBody = {
  fundName: "", fundType: "pension_comprehensive", provider: "",
  currentBalance: 0, monthlyEmployeeDeposit: 0, monthlyEmployerDeposit: 0,
  managementFeeAccumulation: 0.003, managementFeeDeposit: 0.001,
};

type FlowStep = "landing" | "onboarding" | "guide" | "upload" | "results";

export default function PensionPage() {
  const navigate = useNavigate();
  const { uploadProgressStep, start: startProgress, stop: stopProgress } = useGovReportUploadProgress(UPLOAD_PROGRESS_STEPS.length);

  const [step, setStep] = useState<FlowStep>("landing");
  const [data, setData] = useState<PensionAnalysisData | null>(null);
  const [loading, setLoading] = useState(true);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);

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

  useEffect(() => {
    if (!showAgeModal) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setShowAgeModal(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [showAgeModal]);

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
        onVisitSite={() => { window.open(HAR_HAKESEF_URL, "_blank", "noopener,noreferrer"); }}
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
          <div
            role="presentation"
            onClick={() => setShowAgeModal(false)}
            onKeyDown={(e) => { if (e.key === "Escape") setShowAgeModal(false); }}
            style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}
          >
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="pension-age-modal-title"
              onClick={(e) => e.stopPropagation()}
              style={{ maxWidth: 420, width: "100%", background: "var(--card)", border: "1px solid var(--border-hair)", borderRadius: "var(--r-card)", boxShadow: "var(--shadow-card)", padding: "32px 36px" }}
            >
              <h2 id="pension-age-modal-title" style={{ fontFamily: "var(--font-display)", fontSize: 22, fontWeight: 900, margin: "0 0 10px", color: "var(--text-strong)" }}>חסר גיל בפרופיל</h2>
              <p style={{ fontSize: 14, color: "var(--text-muted)", lineHeight: 1.6, margin: "0 0 20px" }}>
                לניתוח מסלול סיכון ותחזית פרישה מדויקת, הגדר את גילך בפרופיל.
              </p>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <AgentPrimaryButton size="sm" onClick={() => { setShowAgeModal(false); navigate(APP_ROUTES.settings); }} style={{ flex: 1 }}>
                  עדכן פרופיל
                </AgentPrimaryButton>
                <AgentGhostButton size="sm" onClick={() => setShowAgeModal(false)}>
                  המשך בכל זאת
                </AgentGhostButton>
              </div>
            </div>
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
            onOpenChat={() => navigate(`${APP_ROUTES.hub}?chat=1`)}
          />
        </div>
      </>,
    );
  }

  // Landing (+ initial loading) — FinGuide AgentLandingHero (mint)
  return shell(
    loading ? (
      <div style={{ textAlign: "center", padding: "80px 24px", color: "var(--mint-ink)", fontSize: 14, fontWeight: 600 }}>
        טוען נתוני פנסיה...
      </div>
    ) : (
      <AgentLandingHero
        agentId="pension"
        title={<>כל הפנסיה שלך,<br />מנותחת במקום אחד.</>}
        subtitle={
          <>
            ייבוא חד‑פעמי מ<b style={{ color: "var(--ink)", fontWeight: 800 }}>הר הכסף</b> והסוכן מזהה קרנות, דמי ניהול ומסלולי השקעה — עם תחזית פרישה ברורה.
          </>
        }
        primaryLabel="ייבוא מהר הכסף"
        primaryIcon={<PiggyBank size={18} strokeWidth={2} />}
        onPrimary={() => setStep("onboarding")}
        secondaryLabel="הזנה ידנית"
        onSecondary={() => { setStep("results"); setShowAddForm(true); }}
        trustNote="מבוסס על נתוני הר הכסף — אתר רשמי של משרד האוצר · ~2 דקות"
        visual={
          <div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
              <span style={{ fontSize: 13.5, fontWeight: 800, color: "var(--ink)" }}>תחזית פרישה</span>
              <span style={{ fontSize: 11, fontWeight: 800, color: "var(--text-faint)", letterSpacing: ".04em" }}>דוגמה</span>
            </div>
            <div style={{ display: "grid", gap: 12 }}>
              {[
                { label: "צבירה נוכחית", value: "₪428,000" },
                { label: "הפקדה חודשית", value: "₪3,200" },
                { label: "גיל פרישה משוער", value: "67" },
              ].map((row) => (
                <div
                  key={row.label}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "12px 14px",
                    borderRadius: "var(--r-btn)",
                    background: "var(--mint-soft)",
                    border: "1px solid var(--mint)",
                  }}
                >
                  <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-muted)" }}>{row.label}</span>
                  <span style={{ fontSize: 15, fontWeight: 800, color: "var(--mint-ink)" }}>{row.value}</span>
                </div>
              ))}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 16, fontSize: 12.5, color: "var(--text-faint)", fontWeight: 600 }}>
              <FileText size={14} /> ניתוח מלא אחרי ייבוא הדוח
            </div>
          </div>
        }
      />
    ),
  );
}
