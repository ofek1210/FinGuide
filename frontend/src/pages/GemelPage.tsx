/**
 * GemelPage — provident & study funds agent (קופות גמל וקרנות השתלמות).
 *
 * Loads /api/gemel/analysis + /api/gemel/funds and renders the flagship
 * GemelAdvisor. Har HaKesef imports run through the pension import flow
 * (the same report contains gemel funds), so "ייבוא דוח" deep-links there.
 */
import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import PrivateTopbar from "../components/PrivateTopbar";
import AppFooter from "../components/AppFooter";
import GemelAdvisor from "../components/gemel/GemelAdvisor";
import {
  getGemelAnalysis,
  getGemelFunds,
  getGemelReport,
  createGemelFund,
  deleteGemelFund,
  uploadGemelExcel,
  type GemelAnalysisData,
  type GemelAdvisorReportDTO,
  type GemelFundDTO,
  type UploadGemelFundBody,
} from "../api/gemel.api";
import GemelAccountCards from "../components/gemel/GemelAccountCards";
import GemelAdvisorSummary from "../components/gemel/GemelAdvisorSummary";
import AgentOnboardingModal from "../components/onboarding/AgentOnboardingModal";
import { useAgentOnboarding } from "../hooks/useAgentOnboarding";
import { APP_ROUTES } from "../types/navigation";

const EMPTY_FORM: UploadGemelFundBody = {
  fundName: "", fundType: "study_fund", provider: "",
  currentBalance: 0, monthlyEmployeeDeposit: 0, monthlyEmployerDeposit: 0,
  managementFeeAccumulation: 0,
};

export default function GemelPage() {
  const navigate = useNavigate();
  const agentOnboarding = useAgentOnboarding("gemel");

  const [data, setData] = useState<GemelAnalysisData | null>(null);
  const [advisorReport, setAdvisorReport] = useState<GemelAdvisorReportDTO | null>(null);
  const [funds, setFunds] = useState<GemelFundDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [reportLoading, setReportLoading] = useState(true);
  const [excelUploading, setExcelUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState<string | null>(null);

  const [showAddForm, setShowAddForm] = useState(false);
  const [form, setForm] = useState<UploadGemelFundBody>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadAll = useCallback(async () => {
    const [analysisRes, fundsRes, reportRes] = await Promise.all([
      getGemelAnalysis(),
      getGemelFunds(),
      getGemelReport(true),
    ]);
    if (analysisRes.ok && analysisRes.data?.success && analysisRes.data.data) {
      setData(analysisRes.data.data);
    }
    if (fundsRes.ok && fundsRes.data?.data) setFunds(fundsRes.data.data.funds);
    if (reportRes.ok && reportRes.data?.data?.report) {
      setAdvisorReport(reportRes.data.data.report);
    }
    setReportLoading(false);
  }, []);

  useEffect(() => {
    void (async () => {
      await loadAll();
      setLoading(false);
    })();
  }, [loadAll]);

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

  const handleExcelUpload = async (file: File) => {
    setExcelUploading(true);
    setUploadMsg(null);
    const res = await uploadGemelExcel(file);
    setExcelUploading(false);
    if (res.ok && res.data?.success) {
      setUploadMsg(`יובאו ${res.data.data?.imported ?? 0} חשבונות${res.data.data?.warnings?.length ? ` (${res.data.data.warnings.length} אזהרות)` : ""}`);
      setReportLoading(true);
      await loadAll();
    } else {
      setUploadMsg("שגיאה בהעלאת הקובץ");
    }
  };

  return (
    <div data-agent="gemel" style={{ minHeight: "100vh", background: "var(--surface-page)", backgroundImage: "radial-gradient(rgba(185,139,22,.06) 1px,transparent 1px)", backgroundSize: "22px 22px", color: "var(--text-body)", fontFamily: "var(--font-body)", direction: "rtl" }}>
      <AgentOnboardingModal
        open={agentOnboarding.showModal}
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
      ) : (
        <div style={{ maxWidth: 1120, margin: "0 auto", padding: "20px 24px 0" }}>
          <GemelAdvisorSummary
            report={advisorReport}
            loading={reportLoading}
            onUpload={handleExcelUpload}
            uploading={excelUploading}
            uploadMsg={uploadMsg}
            knownFundCount={funds.length}
            knownTotalBalance={funds.reduce((sum, f) => sum + (f.currentBalance || 0), 0)}
            hasPayslipGemelData={Boolean(
              data?.summary?.hasStudyFund
              || data?.summary?.hasProvidentFund
              || (data?.summary?.fundCount ?? 0) > 0
              || (data?.summary?.totalMonthlyContribution ?? 0) > 0,
            )}
          />
          <GemelAccountCards report={advisorReport} loading={reportLoading} knownFundCount={funds.length} />
          <GemelAdvisor
            data={data}
            funds={funds}
            showAddForm={showAddForm}
            setShowAddForm={setShowAddForm}
            form={form}
            setForm={setForm}
            saving={saving}
            saveMsg={saveMsg}
            deletingId={deletingId}
            onSaveFund={handleSaveFund}
            onDeleteFund={handleDeleteFund}
            onImport={() => navigate(APP_ROUTES.pension)}
          />
        </div>
      )}
      <AppFooter variant="private" />
    </div>
  );
}
