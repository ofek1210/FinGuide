import { useCallback, useEffect, useState } from "react";
import { PiggyBank, Sparkles, Plus, Trash2, TrendingUp, AlertCircle, Loader2, SlidersHorizontal } from "lucide-react";
import { useNavigate } from "react-router-dom";
import PrivateTopbar from "../components/PrivateTopbar";
import AppFooter from "../components/AppFooter";
import AgentHero from "../components/agent/AgentHero";
import GlassCard from "../components/ui/GlassCard";
import StatCard from "../components/ui/StatCard";
import SectionHeader from "../components/ui/SectionHeader";
import Badge from "../components/ui/Badge";
import {
  getPensionAnalysis,
  simulatePensionScenario,
  getPensionFunds,
  uploadPensionFund,
  deletePensionFund,
  type PensionAnalysisResponse,
  type SimulationResponse,
  type PensionFundDTO,
  type UploadPensionBody,
} from "../api/pension.api";
import { APP_ROUTES } from "../types/navigation";

const fmt = (n: number | null | undefined) =>
  n != null ? `₪${Number(n).toLocaleString("he-IL")}` : "—";

const FUND_TYPE_LABELS: Record<string, string> = {
  pension_comprehensive: "פנסיה מקיפה", pension_old: "פנסיה ותיקה",
  managers_insurance: "ביטוח מנהלים", provident_fund: "קופת גמל",
  study_fund: "קרן השתלמות", other: "אחר",
};

const EMPTY_FORM: UploadPensionBody = {
  fundName: "", fundType: "pension_comprehensive", provider: "",
  currentBalance: 0, monthlyEmployeeDeposit: 0, monthlyEmployerDeposit: 0,
  managementFeeAccumulation: 0.003, managementFeeDeposit: 0.001,
};

export default function PensionPage() {
  const navigate = useNavigate();
  const [data, setData] = useState<PensionAnalysisResponse["data"] | null>(null);
  const [loading, setLoading] = useState(true);

  // Funds
  const [funds, setFunds] = useState<PensionFundDTO[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [form, setForm] = useState<UploadPensionBody>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Simulation
  const [showSim, setShowSim] = useState(false);
  const [simAge, setSimAge] = useState("");
  const [simExtra, setSimExtra] = useState("");
  const [simFee, setSimFee] = useState("");
  const [simResult, setSimResult] = useState<SimulationResponse["data"] | null>(null);
  const [simLoading, setSimLoading] = useState(false);

  const loadFunds = useCallback(async () => {
    const res = await getPensionFunds();
    if (res.ok && res.data?.data) setFunds(res.data.data);
  }, []);

  useEffect(() => {
    void getPensionAnalysis().then(res => {
      setLoading(false);
      if (res.ok && res.data?.success && res.data.data) setData(res.data.data);
    });
    void loadFunds();
  }, [loadFunds]);

  const handleSaveFund = async () => {
    if (!form.fundName?.trim()) return;
    setSaving(true);
    setSaveMsg(null);
    const res = await uploadPensionFund(form);
    setSaving(false);
    if (res.ok) {
      setSaveMsg({ type: "success", text: "הקרן נשמרה בהצלחה" });
      setForm(EMPTY_FORM);
      setShowAddForm(false);
      void loadFunds();
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
  };

  const handleSimulate = async () => {
    setSimLoading(true);
    setSimResult(null);
    const res = await simulatePensionScenario({
      retirementAge: simAge ? Number(simAge) : undefined,
      additionalMonthlyContribution: simExtra ? Number(simExtra) : undefined,
      targetMgmtFee: simFee ? Number(simFee) / 100 : undefined,
    });
    setSimLoading(false);
    if (res.ok && res.data?.success && res.data.data) setSimResult(res.data.data);
  };

  const summary = data?.summary;
  const projection = data?.projection;
  const recs = data?.recommendations ?? [];

  return (
    <div style={{ minHeight: "100vh", background: "var(--lg-bg, #FAF7FF)", color: "var(--lg-text, #1F1F1F)", fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" }}>
      <PrivateTopbar />

      <main style={{ maxWidth: 1100, margin: "0 auto", padding: "32px 24px 64px", direction: "rtl" }}>

        <AgentHero
          icon="📈"
          title="הסוכן האישי שלי לפנסיה וחיסכון"
          subtitle="מנתח קרנות פנסיה, מחשב תחזית פרישה, ומגלה דמי ניהול יקרים."
          accentColor="#6B4FA0"
        >
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button
              onClick={() => navigate(APP_ROUTES.copilot)}
              style={{ display: "flex", alignItems: "center", gap: 7, padding: "10px 20px", borderRadius: 12, background: "linear-gradient(135deg, #6B4FA0, #5A3E8F)", color: "#fff", border: "none", cursor: "pointer", fontFamily: "inherit", fontWeight: 700, fontSize: 14, boxShadow: "0 4px 16px rgba(107,79,160,0.35)" }}
            >
              <Sparkles size={15} /> שוחח עם יועץ הפנסיה
            </button>
            <button
              onClick={() => setShowAddForm(true)}
              style={{ display: "flex", alignItems: "center", gap: 7, padding: "10px 18px", borderRadius: 12, background: "rgba(255,255,255,0.8)", color: "#3D3553", border: "1px solid rgba(184,157,255,0.35)", cursor: "pointer", fontFamily: "inherit", fontWeight: 600, fontSize: 14 }}
            >
              <Plus size={14} /> הוסף קרן פנסיה
            </button>
          </div>
        </AgentHero>

        {/* Projection KPIs */}
        {loading ? (
          <div style={{ textAlign: "center", padding: "40px 0" }}>
            <Loader2 size={28} color="#9B7FE8" style={{ animation: "spin 0.8s linear infinite" }} />
          </div>
        ) : (
          <>
            {projection?.available ? (
              <section style={{ marginBottom: 40 }}>
                <SectionHeader title="תחזית הפנסיה שלך" subtitle={`${projection.monthsToRetirement} חודשים עד פרישה`} />
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 16 }}>
                  <StatCard icon={<PiggyBank size={18} />} label="צבירה צפויה" value={fmt(projection.projectedAccumulation)} sub="בגיל פרישה" accent="#6B4FA0" />
                  <StatCard icon={<TrendingUp size={18} />} label="קצבה חודשית" value={fmt(projection.monthlyPensionEstimate)} sub="אחרי פרישה" accent="#059669" />
                  {summary?.currentAccumulation ? <StatCard icon="💼" label="צבירה נוכחית" value={fmt(summary.currentAccumulation)} accent="#9B7FE8" /> : null}
                  {summary?.totalMonthlyContribution ? <StatCard icon="📥" label="הפקדה חודשית" value={fmt(summary.totalMonthlyContribution)} accent="#7B5EA7" /> : null}
                  {projection.replacementRatio != null && (
                    <StatCard icon="📊" label="שיעור חלופה" value={`${(projection.replacementRatio * 100).toFixed(0)}%`} sub="מהשכר האחרון" accent={projection.replacementRatio >= 0.7 ? "#059669" : "#D97706"} />
                  )}
                </div>

                {/* Scenarios */}
                {projection.scenarios && (
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginTop: 16 }}>
                    {[
                      { label: "תרחיש בסיס", s: projection.scenarios.base, color: "#9B7FE8" },
                      { label: "תרחיש אופטימי", s: projection.scenarios.optimistic, color: "#059669" },
                    ].map(({ label, s, color }) => (
                      <GlassCard key={label} padding="md" style={{ borderTop: `3px solid ${color}` }}>
                        <div style={{ fontSize: 12.5, color: "#7C6FA0", marginBottom: 6, fontWeight: 600 }}>{label}</div>
                        <div style={{ display: "flex", gap: 24 }}>
                          <div>
                            <div style={{ fontSize: 22, fontWeight: 800, color, fontFamily: "'Fraunces', Georgia, serif", letterSpacing: "-0.02em" }}>{fmt(s.accumulation)}</div>
                            <div style={{ fontSize: 11.5, color: "#7C6FA0" }}>צבירה</div>
                          </div>
                          <div>
                            <div style={{ fontSize: 22, fontWeight: 800, color, fontFamily: "'Fraunces', Georgia, serif", letterSpacing: "-0.02em" }}>{fmt(s.monthlyPension)}</div>
                            <div style={{ fontSize: 11.5, color: "#7C6FA0" }}>קצבה / חודש</div>
                          </div>
                        </div>
                      </GlassCard>
                    ))}
                  </div>
                )}
              </section>
            ) : !summary?.hasData ? (
              <GlassCard padding="lg" style={{ textAlign: "center", marginBottom: 40 }}>
                <div style={{ fontSize: 36, marginBottom: 12 }}>📋</div>
                <h3 style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 20, fontWeight: 700, color: "#1F1F1F", margin: "0 0 10px" }}>אין עדיין נתוני פנסיה</h3>
                <p style={{ fontSize: 14.5, color: "#7C6FA0", margin: "0 0 20px" }}>הוסף קרן פנסיה ידנית כדי לקבל תחזית מלאה</p>
                <button onClick={() => setShowAddForm(true)} style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "11px 24px", borderRadius: 12, background: "linear-gradient(135deg, #6B4FA0, #5A3E8F)", color: "#fff", border: "none", cursor: "pointer", fontFamily: "inherit", fontWeight: 700, fontSize: 14 }}>
                  <Plus size={15} /> הוסף קרן ראשונה
                </button>
              </GlassCard>
            ) : null}

            {/* Recommendations */}
            {recs.length > 0 && (
              <section style={{ marginBottom: 40 }}>
                <SectionHeader title="המלצות" subtitle="מה כדאי לעשות עכשיו" />
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {recs.map((rec, i) => (
                    <GlassCard key={i} padding="md" style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
                      <Badge variant={rec.urgency === "high" ? "high" : rec.urgency === "medium" ? "medium" : "low"}>
                        {rec.urgency === "high" ? "דחוף" : rec.urgency === "medium" ? "מומלץ" : "לידיעה"}
                      </Badge>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 700, fontSize: 14.5, color: "#1F1F1F", marginBottom: 4 }}>{rec.title}</div>
                        <div style={{ fontSize: 13, color: "#7C6FA0", lineHeight: 1.55 }}>{rec.reason}</div>
                        {rec.financialImpact && (
                          <div style={{ fontSize: 12.5, color: "#059669", fontWeight: 700, marginTop: 6 }}>{rec.financialImpact}</div>
                        )}
                      </div>
                    </GlassCard>
                  ))}
                </div>
              </section>
            )}
          </>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, marginBottom: 40 }}>
          {/* Fund list */}
          <GlassCard padding="lg" elevated>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
              <div>
                <div style={{ fontWeight: 800, fontSize: 15.5, color: "#1F1F1F", display: "flex", alignItems: "center", gap: 8 }}>
                  <PiggyBank size={17} color="#6B4FA0" /> קרנות פנסיה
                </div>
                <div style={{ fontSize: 12.5, color: "#7C6FA0", marginTop: 2 }}>נתונים ידניים</div>
              </div>
              <button onClick={() => setShowAddForm(v => !v)} style={{ display: "flex", alignItems: "center", gap: 5, padding: "7px 13px", borderRadius: 10, background: "rgba(107,79,160,0.10)", color: "#6B4FA0", border: "1px solid rgba(107,79,160,0.20)", cursor: "pointer", fontFamily: "inherit", fontWeight: 700, fontSize: 13 }}>
                <Plus size={13} /> הוסף
              </button>
            </div>

            {funds.length === 0 ? (
              <div style={{ textAlign: "center", padding: "20px 0", color: "#7C6FA0", fontSize: 14 }}>אין קרנות. הוסף קרן ראשונה.</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {funds.map(f => (
                  <div key={f.id} style={{ padding: "12px 14px", borderRadius: 14, background: "rgba(250,247,255,0.8)", border: "1px solid rgba(184,157,255,0.18)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 13.5, color: "#1F1F1F" }}>{f.fundName}</div>
                      <div style={{ fontSize: 12, color: "#7C6FA0", marginTop: 2 }}>
                        {FUND_TYPE_LABELS[f.fundType] ?? f.fundType}{f.provider ? ` · ${f.provider}` : ""}
                      </div>
                      <div style={{ fontSize: 12.5, fontWeight: 600, color: "#6B4FA0", marginTop: 3 }}>{fmt(f.currentBalance)} צבירה</div>
                    </div>
                    <button onClick={() => void handleDeleteFund(f.id)} disabled={deletingId === f.id} style={{ background: "none", border: "none", cursor: "pointer", color: "#DC2626", padding: 6, display: "flex" }}>
                      {deletingId === f.id ? <Loader2 size={14} style={{ animation: "spin 0.8s linear infinite" }} /> : <Trash2 size={14} />}
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Add form */}
            {showAddForm && (
              <div style={{ marginTop: 16, borderTop: "1px solid rgba(184,157,255,0.2)", paddingTop: 16 }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  {[
                    { label: "שם הקרן *", field: "fundName" as const, type: "text" },
                    { label: "ספק / חברה", field: "provider" as const, type: "text" },
                    { label: "צבירה (₪)", field: "currentBalance" as const, type: "number" },
                    { label: "הפקדת עובד (₪/חודש)", field: "monthlyEmployeeDeposit" as const, type: "number" },
                    { label: "הפקדת מעסיק (₪/חודש)", field: "monthlyEmployerDeposit" as const, type: "number" },
                    { label: "דמי ניהול מצבירה (%)", field: "managementFeeAccumulation" as const, type: "number", scale: 100 },
                  ].map(({ label, field, type, scale = 1 }) => (
                    <div key={field}>
                      <label style={{ fontSize: 11.5, color: "#7C6FA0", display: "block", marginBottom: 4 }}>{label}</label>
                      <input
                        type={type}
                        value={type === "number" ? ((form[field] as number ?? 0) * scale).toString() : (form[field] as string ?? "")}
                        onChange={e => setForm(prev => ({ ...prev, [field]: type === "number" ? (parseFloat(e.target.value) || 0) / scale : e.target.value }))}
                        style={{ width: "100%", padding: "8px 10px", borderRadius: 8, fontSize: 13, background: "rgba(250,247,255,0.9)", border: "1px solid rgba(184,157,255,0.35)", color: "#1F1F1F", fontFamily: "inherit", boxSizing: "border-box" }}
                      />
                    </div>
                  ))}
                </div>
                <select value={form.fundType} onChange={e => setForm(prev => ({ ...prev, fundType: e.target.value }))} style={{ width: "100%", marginTop: 10, padding: "8px 10px", borderRadius: 8, fontSize: 13, background: "rgba(250,247,255,0.9)", border: "1px solid rgba(184,157,255,0.35)", color: "#1F1F1F", fontFamily: "inherit" }}>
                  {Object.entries(FUND_TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
                {saveMsg && <div style={{ fontSize: 13, padding: "8px 12px", borderRadius: 8, marginTop: 10, fontWeight: 600, background: saveMsg.type === "error" ? "#FEF2F2" : "#ECFDF5", color: saveMsg.type === "error" ? "#DC2626" : "#059669" }}>{saveMsg.text}</div>}
                <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                  <button onClick={() => { setShowAddForm(false); setSaveMsg(null); }} style={{ flex: 1, padding: "9px", borderRadius: 10, background: "none", border: "1px solid rgba(184,157,255,0.3)", color: "#7C6FA0", cursor: "pointer", fontFamily: "inherit", fontSize: 13 }}>ביטול</button>
                  <button onClick={handleSaveFund} disabled={saving || !form.fundName?.trim()} style={{ flex: 2, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "9px", borderRadius: 10, background: "linear-gradient(135deg, #6B4FA0, #5A3E8F)", color: "#fff", border: "none", cursor: "pointer", fontFamily: "inherit", fontWeight: 700, fontSize: 14 }}>
                    {saving ? <Loader2 size={13} style={{ animation: "spin 0.8s linear infinite" }} /> : <Plus size={13} />} שמור
                  </button>
                </div>
              </div>
            )}
          </GlassCard>

          {/* Simulation panel */}
          <GlassCard padding="lg" elevated>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18 }}>
              <SlidersHorizontal size={17} color="#9B7FE8" />
              <div style={{ fontWeight: 800, fontSize: 15.5, color: "#1F1F1F" }}>סימולציית תרחישים</div>
            </div>

            {!summary?.hasData ? (
              <div style={{ fontSize: 14, color: "#7C6FA0", textAlign: "center", padding: "20px 0" }}>
                הוסף קרן פנסיה כדי להפעיל את הסימולציה
              </div>
            ) : (
              <>
                <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 16 }}>
                  {[
                    { label: "גיל פרישה", field: "simAge", val: simAge, setter: setSimAge, placeholder: summary?.retirementAge?.toString() ?? "67" },
                    { label: "הפקדה נוספת (₪/חודש)", field: "simExtra", val: simExtra, setter: setSimExtra, placeholder: "0" },
                    { label: "דמי ניהול יעד (%)", field: "simFee", val: simFee, setter: setSimFee, placeholder: ((summary?.currentMgmtFee ?? 0.003) * 100).toFixed(2) },
                  ].map(item => (
                    <div key={item.field}>
                      <label style={{ fontSize: 12, color: "#7C6FA0", display: "block", marginBottom: 4 }}>{item.label}</label>
                      <input
                        type="number"
                        value={item.val}
                        onChange={e => item.setter(e.target.value)}
                        placeholder={item.placeholder}
                        style={{ width: "100%", padding: "9px 12px", borderRadius: 10, fontSize: 14, background: "rgba(250,247,255,0.9)", border: "1px solid rgba(184,157,255,0.35)", color: "#1F1F1F", fontFamily: "inherit", boxSizing: "border-box" }}
                      />
                    </div>
                  ))}
                </div>

                <button
                  onClick={handleSimulate}
                  disabled={simLoading}
                  style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 7, padding: "11px", borderRadius: 12, background: "linear-gradient(135deg, #9B7FE8, #7B5EA7)", color: "#fff", border: "none", cursor: simLoading ? "wait" : "pointer", fontFamily: "inherit", fontWeight: 700, fontSize: 14, boxShadow: "0 4px 16px rgba(155,127,232,0.30)", marginBottom: 16 }}
                >
                  {simLoading ? <Loader2 size={14} style={{ animation: "spin 0.8s linear infinite" }} /> : <TrendingUp size={14} />}
                  {simLoading ? "מחשב..." : "הרץ סימולציה"}
                </button>

                {simResult && (
                  <div style={{ padding: "16px", borderRadius: 14, background: "rgba(155,127,232,0.06)", border: "1px solid rgba(184,157,255,0.25)" }}>
                    <div style={{ fontSize: 12.5, color: "#7C6FA0", fontWeight: 600, marginBottom: 10 }}>תוצאת הסימולציה</div>
                    {[
                      { label: "צבירה בגיל פרישה", val: fmt(simResult.simulation.projectedAccumulation), base: fmt(simResult.baseline.projectedAccumulation), diff: simResult.delta.accumulationDiff },
                      { label: "קצבה חודשית", val: fmt(simResult.simulation.monthlyPensionEstimate), base: fmt(simResult.baseline.monthlyPensionEstimate), diff: simResult.delta.monthlyPensionDiff },
                    ].map(row => (
                      <div key={row.label} style={{ marginBottom: 10 }}>
                        <div style={{ fontSize: 12, color: "#7C6FA0" }}>{row.label}</div>
                        <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 3 }}>
                          <span style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 20, fontWeight: 700, color: "#6B4FA0" }}>{row.val}</span>
                          <span style={{ fontSize: 11.5, color: "#7C6FA0" }}>לעומת {row.base} בבסיס</span>
                          {row.diff !== 0 && (
                            <Badge variant={row.diff > 0 ? "success" : "high"}>
                              {row.diff > 0 ? "+" : ""}{fmt(row.diff)}
                            </Badge>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </GlassCard>
        </div>

        {/* Mgmt fee warning */}
        {projection?.mgmtFeeSavings && projection.mgmtFeeSavings.savingsByRetirement > 10000 && (
          <GlassCard padding="md" style={{ display: "flex", gap: 14, alignItems: "center", marginBottom: 32, borderRight: "4px solid #D97706", background: "rgba(255,251,235,0.85)" }}>
            <AlertCircle size={22} color="#D97706" style={{ flexShrink: 0 }} />
            <div>
              <div style={{ fontWeight: 700, fontSize: 15, color: "#92400E", marginBottom: 3 }}>דמי ניהול גבוהים זוהו</div>
              <div style={{ fontSize: 13.5, color: "#78350F" }}>
                הורדת דמי הניהול עשויה לחסוך {fmt(projection.mgmtFeeSavings.savingsByRetirement)} עד הפרישה
                {" "} ולהוסיף {fmt(projection.mgmtFeeSavings.additionalMonthlyPension)} לקצבה החודשית.
              </div>
            </div>
          </GlassCard>
        )}

        {/* CTA */}
        <GlassCard padding="lg" style={{ background: "linear-gradient(135deg, rgba(107,79,160,0.08), rgba(155,127,232,0.14))", border: "1px solid rgba(184,157,255,0.35)", textAlign: "center" }}>
          <div style={{ fontSize: 28, marginBottom: 12 }}>🤖</div>
          <h3 style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 22, fontWeight: 700, color: "#1F1F1F", margin: "0 0 10px", letterSpacing: "-0.02em" }}>שאל את יועץ הפנסיה</h3>
          <p style={{ fontSize: 14.5, color: "#7C6FA0", margin: "0 0 22px", lineHeight: 1.65 }}>
            "מתי כדאי לי לפרוש?", "האם כדאי להגדיל הפקדות?", "איזו קרן מומלצת לי?" — הסוכן יענה.
          </p>
          <button
            onClick={() => navigate(APP_ROUTES.copilot)}
            style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "12px 28px", borderRadius: 14, background: "linear-gradient(135deg, #6B4FA0, #5A3E8F)", color: "#fff", border: "none", cursor: "pointer", fontFamily: "inherit", fontWeight: 700, fontSize: 15, boxShadow: "0 4px 20px rgba(107,79,160,0.35)" }}
          >
            <Sparkles size={16} /> פתח שיחה עם יועץ הפנסיה
          </button>
        </GlassCard>

        <p style={{ fontSize: 11.5, color: "#A89CC8", textAlign: "center", margin: "24px 0 0", lineHeight: 1.6 }}>
          ⚠️ התחזיות מבוססות על הנחות ממוצעות. אינן מהוות ייעוץ פנסיוני מקצועי.
        </p>
      </main>
      <AppFooter variant="private" />
    </div>
  );
}
