/**
 * GemelPage — provident & study funds agent (קופות גמל וקרנות השתלמות).
 *
 * Loads /api/gemel/analysis + /api/gemel/funds and renders the flagship
 * GemelAdvisor. Har HaKesef imports run through the pension import flow
 * (the same report contains gemel funds), so "ייבוא דוח" deep-links there.
 */
import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { PiggyBank, Plus } from "lucide-react";
import PrivateTopbar from "../components/PrivateTopbar";
import AppFooter from "../components/AppFooter";
import AgentLandingHero from "../components/agent/AgentLandingHero";
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

  const hasGemelContent = funds.length > 0 || !!data?.summary?.hasData;
  const showLanding = !loading && !hasGemelContent && !showAddForm;

  return (
    <div data-agent="gemel" style={{ minHeight: "100vh", background: "var(--surface-page)", backgroundImage: "radial-gradient(rgba(185,139,22,.06) 1px,transparent 1px)", backgroundSize: "22px 22px", color: "var(--text-body)", fontFamily: "var(--font-body)", direction: "rtl" }}>
      <PrivateTopbar />
      {loading ? (
        <div style={{ textAlign: "center", padding: "80px 24px", color: "var(--butter-ink)", fontSize: 14, fontWeight: 600 }}>
          טוען נתוני גמל והשתלמות...
        </div>
      ) : showLanding ? (
        <AgentLandingHero
          agentId="gemel"
          title={<>קופות הגמל וההשתלמות שלך,<br />במבט אחד.</>}
          subtitle={
            <>
              ייבוא מ<b style={{ color: "var(--ink)", fontWeight: 800 }}>הר הכסף</b> (דרך סוכן הפנסיה) או הוספה ידנית — והסוכן משווה לדמי ניהול בגמל-נט ומזהה הזדמנויות חיסכון.
            </>
          }
          primaryLabel="ייבוא מהר הכסף"
          primaryIcon={<PiggyBank size={18} strokeWidth={2} />}
          onPrimary={() => navigate(APP_ROUTES.pension)}
          secondaryLabel="הוספה ידנית"
          secondaryIcon={<Plus size={18} strokeWidth={2} />}
          onSecondary={() => setShowAddForm(true)}
          trustNote="אותו דוח הר הכסף מכיל גם קופות גמל וקרנות השתלמות · ~2 דקות"
          visual={
            <div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                <span style={{ fontSize: 13.5, fontWeight: 800, color: "var(--ink)" }}>השוואה לגמל-נט</span>
                <span style={{ fontSize: 11, fontWeight: 800, color: "var(--text-faint)", letterSpacing: ".04em" }}>דוגמה</span>
              </div>
              <div style={{ display: "grid", gap: 12 }}>
                {[
                  { label: "דמי ניהול מצבירה", value: "0.18%", tone: "טוב מהשוק" },
                  { label: "חיסכון שנתי משוער", value: "₪1,840", tone: "פוטנציאל" },
                  { label: "קרנות פעילות", value: "2", tone: "מזוהה" },
                ].map((row) => (
                  <div
                    key={row.label}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "12px 14px",
                      borderRadius: "var(--r-btn)",
                      background: "var(--butter-soft)",
                      border: "1px solid var(--butter)",
                    }}
                  >
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-muted)" }}>{row.label}</div>
                      <div style={{ fontSize: 11, fontWeight: 700, color: "var(--butter-ink)", marginTop: 2 }}>{row.tone}</div>
                    </div>
                    <span style={{ fontSize: 15, fontWeight: 800, color: "var(--butter-ink)" }}>{row.value}</span>
                  </div>
                ))}
              </div>
            </div>
          }
        />
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
