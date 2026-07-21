/**
 * GemelPage — provident & study funds agent (קופות גמל וקרנות השתלמות).
 *
 * Loads /api/gemel/analysis + /api/gemel/funds and renders the flagship
 * GemelAdvisor (three_card_v5 only). Har HaKesef imports run through the
 * pension import flow; "ייבוא דוח" deep-links there.
 */
import { useCallback, useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import PrivateTopbar from "../components/PrivateTopbar";
import AppFooter from "../components/AppFooter";
import GemelAdvisor from "../components/gemel/GemelAdvisor";
import AgentMissingDocumentPanel from "../components/hub/AgentMissingDocumentPanel";
import {
  getGemelAnalysis,
  getGemelFunds,
  createGemelFund,
  deleteGemelFund,
  type GemelAnalysisData,
  type GemelFundDTO,
  type UploadGemelFundBody,
} from "../api/gemel.api";
import { isThreeCardAdvisory } from "../api/financialAdvisory.types";
import AgentOnboardingModal from "../components/onboarding/AgentOnboardingModal";
import { useAgentOnboarding } from "../hooks/useAgentOnboarding";
import { APP_ROUTES } from "../types/navigation";
import { useRegisterPageContext } from "../assistant/AiChatProvider";

const EMPTY_FORM: UploadGemelFundBody = {
  fundName: "", fundType: "study_fund", provider: "",
  currentBalance: 0, monthlyEmployeeDeposit: 0, monthlyEmployerDeposit: 0,
  managementFeeAccumulation: 0,
};

export default function GemelPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const agentOnboarding = useAgentOnboarding("gemel");

  const [data, setData] = useState<GemelAnalysisData | null>(null);
  const [funds, setFunds] = useState<GemelFundDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);

  const [showAddForm, setShowAddForm] = useState(false);
  const [form, setForm] = useState<UploadGemelFundBody>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadAll = useCallback(async () => {
    setAnalysisLoading(true);
    setAnalysisError(null);
    const [analysisRes, fundsRes] = await Promise.all([
      getGemelAnalysis(),
      getGemelFunds(),
    ]);
    setAnalysisLoading(false);
    if (analysisRes.ok && analysisRes.data?.success && analysisRes.data.data) {
      setData(analysisRes.data.data);
    } else if (!analysisRes.ok) {
      setAnalysisError(analysisRes.error?.message ?? "שגיאה בטעינת הניתוח");
    } else {
      setAnalysisError("לא התקבלו נתוני ניתוח מהשרת");
    }
    if (fundsRes.ok && fundsRes.data?.data) setFunds(fundsRes.data.data.funds);
  }, []);

  useEffect(() => {
    void (async () => {
      await loadAll();
      setLoading(false);
    })();
  }, [loadAll]);

  const hasPayslipGemelData = Boolean(
    data?.summary?.hasStudyFund
    || data?.summary?.hasProvidentFund
    || (data?.summary?.fundCount ?? 0) > 0
    || (data?.summary?.totalMonthlyContribution ?? 0) > 0,
  );
  const hasGemelDocument = funds.length > 0 || hasPayslipGemelData || Boolean(data?.summary?.hasData);
  const forceOnboardingModal = hasGemelDocument && agentOnboarding.needsQuestions;

  useEffect(() => {
    if (searchParams.get("flow") === "import") {
      navigate(`${APP_ROUTES.hub}?document=clearinghouse`, { replace: true });
    }
  }, [searchParams, navigate]);

  const gemelLabel = isThreeCardAdvisory(data)
    ? "גמל והשתלמות · ניתוח שלוש-כרטיסים"
    : data?.summary
      ? `גמל והשתלמות · ${data.summary.fundCount ?? funds.length} קופות`
      : "גמל והשתלמות";

  const gemelDetail = [
    data?.summary?.fundCount != null ? `מספר קופות: ${data.summary.fundCount}` : null,
    data?.summary?.totalBalance != null
      ? `צבירה כוללת: ₪${Math.round(Number(data.summary.totalBalance)).toLocaleString("he-IL")}`
      : null,
    funds.length ? `קרנות ברשימה: ${funds.length}` : null,
    isThreeCardAdvisory(data) ? `כרטיסים: ${data.recommendationCards.length}` : null,
  ]
    .filter(Boolean)
    .join("\n");
  useRegisterPageContext(gemelLabel, gemelDetail || null);

  const handleSaveFund = async () => {
    if (!form.fundName?.trim()) return;
    setSaving(true); setSaveMsg(null);
    const res = await createGemelFund(form);
    setSaving(false);
    if (res.ok) {
      setSaveMsg({ type: "success", text: "הקופה נשמרה בהצלחה" });
      setForm(EMPTY_FORM); setShowAddForm(false);
      void loadAll();
    } else {
      setSaveMsg({ type: "error", text: "שגיאה בשמירה" });
    }
  };

  const handleDeleteFund = async (id: string) => {
    if (!window.confirm("למחוק קופה זו?")) return;
    setDeletingId(id);
    await deleteGemelFund(id);
    setDeletingId(null);
    void loadAll();
  };

  return (
    <div data-agent="gemel" style={{ minHeight: "100vh", background: "var(--surface-page)", backgroundImage: "radial-gradient(rgba(185,139,22,.06) 1px,transparent 1px)", backgroundSize: "22px 22px", color: "var(--text-body)", fontFamily: "var(--font-body)", direction: "rtl" }}>
      <AgentOnboardingModal
        open={agentOnboarding.showModal || forceOnboardingModal}
        agentLabel="גמל והשתלמות"
        estimatedMinutes={agentOnboarding.state?.estimatedMinutes}
        questions={agentOnboarding.state?.missingQuestions || []}
        onClose={agentOnboarding.dismiss}
        onSubmit={agentOnboarding.submit}
      />
      <PrivateTopbar />
      {loading ? (
        <div style={{ textAlign: "center", padding: "80px 24px", color: "var(--butter-ink)", fontSize: 14 }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>⏳</div>
          טוען נתוני גמל והשתלמות...
        </div>
      ) : !hasGemelDocument ? (
        <AgentMissingDocumentPanel
          title="חסר דוח מסלקה לגמל והשתלמות"
          body="קופות גמל וקרנות השתלמות נקלטות מדוח המסלקה הפנסיונית במרכז המסמכים. לאחר הייבוא, חזרו לכאן להשלמת האונבורדינג."
          documentId="clearinghouse"
        />
      ) : (
        <div style={{ maxWidth: 1120, margin: "0 auto", padding: "20px 24px 0" }}>
          <GemelAdvisor
            data={data}
            funds={funds}
            analysisLoading={analysisLoading}
            analysisError={analysisError}
            onRetryAnalysis={() => void loadAll()}
            hasPayslipGemelData={hasPayslipGemelData}
            showAddForm={showAddForm}
            setShowAddForm={setShowAddForm}
            form={form}
            setForm={setForm}
            saving={saving}
            saveMsg={saveMsg}
            deletingId={deletingId}
            onSaveFund={handleSaveFund}
            onDeleteFund={handleDeleteFund}
          />
        </div>
      )}
      <AppFooter variant="private" />
    </div>
  );
}
