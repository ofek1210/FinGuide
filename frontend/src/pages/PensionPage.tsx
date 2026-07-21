/**
 * PensionPage — pension advisor analysis (import lives in Hub document center).
 */
import { useCallback, useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import PrivateTopbar from "../components/PrivateTopbar";
import AppFooter from "../components/AppFooter";
import GlassCard from "../components/ui/GlassCard";
import PensionAdvisor from "../components/pension/PensionAdvisor";
import AgentOnboardingModal from "../components/onboarding/AgentOnboardingModal";
import AgentMissingDocumentPanel from "../components/hub/AgentMissingDocumentPanel";
import { useAgentOnboarding } from "../hooks/useAgentOnboarding";
import {
  getPensionAnalysis,
  getPensionFunds,
  uploadPensionFund,
  deletePensionFund,
  type PensionAnalysisData,
  type PensionFundDTO,
  type UploadPensionBody,
} from "../api/pension.api";
import { isThreeCardAdvisory } from "../api/financialAdvisory.types";
import { APP_ROUTES } from "../types/navigation";
import { hubDocumentUrl } from "../utils/hubDocuments";
import { useRegisterPageContext } from "../assistant/AiChatProvider";

const EMPTY_FORM: UploadPensionBody = {
  fundName: "", fundType: "pension_comprehensive", provider: "",
  currentBalance: 0, monthlyEmployeeDeposit: 0, monthlyEmployerDeposit: 0,
  managementFeeAccumulation: 0.003, managementFeeDeposit: 0.001,
};

export default function PensionPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const agentOnboarding = useAgentOnboarding("pension");

  const [data, setData] = useState<PensionAnalysisData | null>(null);
  const [loading, setLoading] = useState(true);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);

  const [funds, setFunds] = useState<PensionFundDTO[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [form, setForm] = useState<UploadPensionBody>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [showAgeModal, setShowAgeModal] = useState(false);

  const loadFunds = useCallback(async () => {
    const res = await getPensionFunds();
    if (res.ok && res.data?.data) setFunds(res.data.data);
  }, []);

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
        if (!analysisRes.data.data?.summary?.currentAge) {
          setShowAgeModal(true);
        }
      } else if (!analysisRes.ok) {
        setAnalysisError(analysisRes.error?.message ?? "שגיאה בטעינת הניתוח");
      }
    })();
  }, []);

  useEffect(() => {
    if (searchParams.get("flow") === "import") {
      navigate(hubDocumentUrl("clearinghouse"), { replace: true });
    }
  }, [searchParams, navigate]);

  const hasPensionDocument = funds.length > 0;
  const forceOnboardingModal = hasPensionDocument && agentOnboarding.needsQuestions;

  const pensionContextLabel = isThreeCardAdvisory(data)
    ? "פנסיה · ניתוח שלוש-כרטיסים"
    : hasPensionDocument
      ? "פנסיה · ניתוח"
      : "פנסיה";

  const pensionContextDetail = (() => {
    const lines: string[] = [hasPensionDocument ? "מסמך: קיים" : "מסמך: חסר"];
    if (isThreeCardAdvisory(data)) {
      lines.push(`כרטיסים: ${data.recommendationCards.length}`);
      const top = data.primaryRecommendations?.[0];
      if (top?.title) lines.push(`המלצה מובילה: ${top.title}`);
    }
    if (data?.summary?.fundCount != null) lines.push(`מספר קרנות: ${data.summary.fundCount}`);
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
      setShowAddForm(false);
      setShowAgeModal(false);
    }
  };

  const shell = (children: React.ReactNode) => (
    <div data-agent="pension" style={{ minHeight: "100vh", background: "var(--surface-page)", backgroundImage: "radial-gradient(rgba(47,156,98,.06) 1px,transparent 1px)", backgroundSize: "22px 22px", color: "var(--text-body)", fontFamily: "var(--font-body)", direction: "rtl" }}>
      <AgentOnboardingModal
        open={agentOnboarding.showModal || forceOnboardingModal}
        agentLabel="פנסיה"
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

  if (loading) {
    return shell(
      <div style={{ textAlign: "center", padding: "80px 24px", color: "var(--mint-ink)", fontSize: 14 }}>
        <div style={{ fontSize: 32, marginBottom: 12 }}>⏳</div>
        טוען נתוני פנסיה...
      </div>,
    );
  }

  if (!hasPensionDocument) {
    return shell(
      <AgentMissingDocumentPanel
        title="חסר דוח מסלקה פנסיונית"
        body="ייבוא דוח המסלקה מתבצע במרכז המסמכים ב-Hub. לאחר הייבוא, חזרו לכאן להשלמת האונבורדינג והניתוח."
        documentId="clearinghouse"
      />,
    );
  }

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
          documentCenterDocumentId="clearinghouse"
        />
      </div>
    </>,
  );
}
