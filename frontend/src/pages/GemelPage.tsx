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
  createGemelFund,
  deleteGemelFund,
  type GemelAnalysisData,
  type GemelFundDTO,
  type UploadGemelFundBody,
} from "../api/gemel.api";
import { APP_ROUTES } from "../types/navigation";

const EMPTY_FORM: UploadGemelFundBody = {
  fundName: "", fundType: "study_fund", provider: "",
  currentBalance: 0, monthlyEmployeeDeposit: 0, monthlyEmployerDeposit: 0,
  managementFeeAccumulation: 0,
};

export default function GemelPage() {
  const navigate = useNavigate();

  const [data, setData] = useState<GemelAnalysisData | null>(null);
  const [funds, setFunds] = useState<GemelFundDTO[]>([]);
  const [loading, setLoading] = useState(true);

  const [showAddForm, setShowAddForm] = useState(false);
  const [form, setForm] = useState<UploadGemelFundBody>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadAll = useCallback(async () => {
    const [analysisRes, fundsRes] = await Promise.all([getGemelAnalysis(), getGemelFunds()]);
    if (analysisRes.ok && analysisRes.data?.success && analysisRes.data.data) {
      setData(analysisRes.data.data);
    }
    if (fundsRes.ok && fundsRes.data?.data) setFunds(fundsRes.data.data.funds);
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

  return (
    <div data-agent="gemel" style={{ minHeight: "100vh", background: "var(--surface-page)", backgroundImage: "radial-gradient(rgba(185,139,22,.06) 1px,transparent 1px)", backgroundSize: "22px 22px", color: "var(--text-body)", fontFamily: "var(--font-body)", direction: "rtl" }}>
      <PrivateTopbar />
      {loading ? (
        <div style={{ textAlign: "center", padding: "80px 24px", color: "var(--butter-ink)", fontSize: 14 }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>⏳</div>
          טוען נתוני גמל והשתלמות...
        </div>
      ) : (
        <div style={{ maxWidth: 1120, margin: "0 auto", padding: "20px 24px 0" }}>
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
            onOpenChat={() => navigate(`${APP_ROUTES.hub}?chat=1`)}
          />
        </div>
      )}
      <AppFooter variant="private" />
    </div>
  );
}
