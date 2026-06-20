import { useCallback, useEffect, useRef, useState } from "react";
import { Shield, Upload, AlertCircle, CheckCircle, ChevronLeft, Sparkles, Trash2, FileSpreadsheet } from "lucide-react";
import { useNavigate } from "react-router-dom";
import PrivateTopbar from "../components/PrivateTopbar";
import AppFooter from "../components/AppFooter";
import AgentHero from "../components/agent/AgentHero";
import GlassCard from "../components/ui/GlassCard";
import StatCard from "../components/ui/StatCard";
import SectionHeader from "../components/ui/SectionHeader";
import Badge from "../components/ui/Badge";
import {
  getInsuranceAnalysis,
  uploadInsuranceExcel,
  deleteInsurancePolicy,
  type InsuranceAnalysisResponse,
  type InsurancePolicyDTO,
} from "../api/insuranceAI.api";
import { APP_ROUTES } from "../types/navigation";

const POLICY_TYPE_LABELS: Record<string, string> = {
  life: "חיים", health: "בריאות", disability: 'אכ"ע',
  apartment: "דירה", car: "רכב", mortgage: "משכנתא",
  critical_illness: "מחלות קשות", other: "אחר",
};

const URGENCY_MAP: Record<string, "high" | "medium" | "low"> = {
  high: "high", medium: "medium", low: "low",
};

const fmt = (n: number | null | undefined) =>
  n != null ? `₪${Number(n).toLocaleString("he-IL")}` : "—";

export default function InsurancePage() {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [data, setData] = useState<InsuranceAnalysisResponse["data"] | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await getInsuranceAnalysis();
    if (res.ok && res.data?.success && res.data.data) setData(res.data.data);
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const handleUpload = async (file: File) => {
    const ext = file.name.split(".").pop()?.toLowerCase();
    if (!["xlsx", "xls"].includes(ext ?? "")) {
      setUploadMsg({ type: "error", text: "ניתן להעלות קבצי Excel בלבד (.xlsx/.xls)" });
      return;
    }
    setUploading(true);
    setUploadMsg(null);
    const res = await uploadInsuranceExcel(file);
    setUploading(false);
    if (res.success) {
      setUploadMsg({ type: "success", text: `יובאו ${res.data?.imported ?? 0} פוליסות בהצלחה` });
      void load();
    } else {
      setUploadMsg({ type: "error", text: res.message ?? "שגיאה בייבוא הקובץ" });
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("למחוק פוליסה זו?")) return;
    setDeletingId(id);
    await deleteInsurancePolicy(id);
    setDeletingId(null);
    void load();
  };

  const analysis = data?.analysis;
  const policies = data?.policies ?? [];
  const recs = data?.recommendations ?? [];
  const totalPremium = policies.reduce((s, p) => s + (p.monthlyPremium ?? 0), 0);

  return (
    <div style={{ minHeight: "100vh", background: "var(--lg-bg, #FAF7FF)", color: "var(--lg-text, #1F1F1F)", fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" }}>
      <PrivateTopbar />

      <main style={{ maxWidth: 1100, margin: "0 auto", padding: "32px 24px 64px", direction: "rtl" }}>

        <AgentHero
          icon="🛡️"
          title="הסוכן האישי שלי לביטוח ופוליסות"
          subtitle="מנתח את כל הפוליסות שלך, מוצא כפילויות, פערים בכיסוי, וחיסכון פוטנציאלי."
          accentColor="#7B5EA7"
        >
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button
              onClick={() => navigate(APP_ROUTES.copilot)}
              style={{ display: "flex", alignItems: "center", gap: 7, padding: "10px 20px", borderRadius: 12, background: "linear-gradient(135deg, #7B5EA7, #6B4FA0)", color: "#fff", border: "none", cursor: "pointer", fontFamily: "inherit", fontWeight: 700, fontSize: 14, boxShadow: "0 4px 16px rgba(123,94,167,0.35)" }}
            >
              <Sparkles size={15} /> שוחח עם סוכן הביטוח
            </button>
            <button
              onClick={() => fileInputRef.current?.click()}
              style={{ display: "flex", alignItems: "center", gap: 7, padding: "10px 18px", borderRadius: 12, background: "rgba(255,255,255,0.8)", color: "#3D3553", border: "1px solid rgba(184,157,255,0.35)", cursor: "pointer", fontFamily: "inherit", fontWeight: 600, fontSize: 14 }}
            >
              <FileSpreadsheet size={14} /> ייבא הר הביטוח
            </button>
          </div>
        </AgentHero>

        {/* KPI cards */}
        {analysis && (
          <section style={{ marginBottom: 40 }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 16 }}>
              <StatCard icon="💸" label="הוצאה חודשית" value={fmt(totalPremium)} sub="סך הפוליסות" accent="#7B5EA7" />
              <StatCard icon="♻️" label="בזבוז מכפילויות" value={fmt(analysis.totalMonthlyWaste)} sub="לחודש" accent="#DC2626" trend={analysis.totalMonthlyWaste > 0 ? "down" : "flat"} trendValue={analysis.duplicateCount > 0 ? `${analysis.duplicateCount} כפולים` : undefined} />
              <StatCard icon="💰" label="חיסכון שנתי פוטנציאלי" value={fmt(analysis.savings.annualSavings)} accent="#059669" trend="up" />
              <StatCard icon="📋" label="פוליסות פעילות" value={policies.length.toString()} accent="#9B7FE8" />
              {analysis.missingCoverage.length > 0 && (
                <StatCard icon="⚠️" label="כיסויים חסרים" value={analysis.missingCoverage.length.toString()} accent="#D97706" />
              )}
            </div>
          </section>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, marginBottom: 40 }}>

          {/* Upload panel */}
          <GlassCard padding="lg" elevated>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
              <div style={{ width: 42, height: 42, borderRadius: 13, background: "rgba(123,94,167,0.10)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Upload size={20} color="#7B5EA7" />
              </div>
              <div>
                <div style={{ fontWeight: 800, fontSize: 15.5, color: "#1F1F1F" }}>ייבוא הר הביטוח</div>
                <div style={{ fontSize: 12.5, color: "#7C6FA0" }}>קובץ Excel מ-Har HaBituach</div>
              </div>
            </div>

            <input ref={fileInputRef} type="file" accept=".xlsx,.xls" onChange={e => { const f = e.target.files?.[0]; if (f) void handleUpload(f); e.target.value = ""; }} style={{ display: "none" }} />

            <div
              onClick={() => !uploading && fileInputRef.current?.click()}
              onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={e => { e.preventDefault(); setIsDragging(false); const f = e.dataTransfer.files?.[0]; if (f) void handleUpload(f); }}
              style={{
                border: `2px dashed ${isDragging ? "#7B5EA7" : "rgba(184,157,255,0.40)"}`,
                borderRadius: 16, padding: "28px 16px", textAlign: "center",
                cursor: uploading ? "wait" : "pointer",
                background: isDragging ? "rgba(123,94,167,0.06)" : "rgba(250,247,255,0.5)",
                transition: "all 0.2s", marginBottom: 14,
              }}
            >
              <div style={{ fontSize: 28, marginBottom: 8 }}>📊</div>
              {uploading ? (
                <div style={{ fontSize: 14, color: "#7B5EA7", fontWeight: 600 }}>מייבא פוליסות...</div>
              ) : (
                <>
                  <div style={{ fontSize: 14, fontWeight: 600, color: "#1F1F1F", marginBottom: 4 }}>גרור קובץ Excel לכאן</div>
                  <div style={{ fontSize: 12.5, color: "#7C6FA0" }}>xlsx / xls · עד 5MB</div>
                </>
              )}
            </div>

            {uploadMsg && (
              <div style={{ fontSize: 13, padding: "10px 14px", borderRadius: 10, fontWeight: 600, marginBottom: 12, background: uploadMsg.type === "error" ? "#FEF2F2" : "#ECFDF5", color: uploadMsg.type === "error" ? "#DC2626" : "#059669" }}>
                {uploadMsg.text}
              </div>
            )}

            <div style={{ fontSize: 12.5, color: "#7C6FA0", lineHeight: 1.6 }}>
              💡 ניתן להוריד את קובץ ה-Excel מאתר{" "}
              <a href="https://www.gov.il/he/departments/ministry_of_finance" target="_blank" rel="noreferrer" style={{ color: "#7B5EA7", textDecoration: "underline" }}>הר הביטוח</a>
            </div>
          </GlassCard>

          {/* Recommendations panel */}
          <GlassCard padding="lg" elevated>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
              <div style={{ width: 42, height: 42, borderRadius: 13, background: "rgba(155,127,232,0.10)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Sparkles size={20} color="#9B7FE8" />
              </div>
              <div style={{ fontWeight: 800, fontSize: 15.5, color: "#1F1F1F" }}>המלצות ה-AI</div>
            </div>

            {loading ? (
              <div style={{ textAlign: "center", padding: "24px 0", color: "#9B7FE8" }}>טוען ניתוח...</div>
            ) : recs.length === 0 ? (
              <div style={{ textAlign: "center", padding: "24px 0", color: "#7C6FA0", fontSize: 14 }}>
                {data?.hasImportedPolicies ? "לא נמצאו המלצות — הכיסוי שלך תקין!" : "ייבא פוליסות כדי לקבל המלצות מותאמות אישית"}
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10, maxHeight: 340, overflowY: "auto" }}>
                {recs.slice(0, 5).map((rec, i) => (
                  <div key={i} style={{ padding: "12px 14px", borderRadius: 14, background: "rgba(250,247,255,0.7)", border: "1px solid rgba(184,157,255,0.18)", display: "flex", gap: 10 }}>
                    <Badge variant={URGENCY_MAP[rec.urgency] ?? "neutral"}>
                      {rec.urgency === "high" ? "דחוף" : rec.urgency === "medium" ? "מומלץ" : "לידיעה"}
                    </Badge>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, fontSize: 13.5, color: "#1F1F1F", marginBottom: 3 }}>{rec.title}</div>
                      <div style={{ fontSize: 12.5, color: "#7C6FA0", lineHeight: 1.5 }}>{rec.reason}</div>
                      {rec.financialImpact && (
                        <div style={{ fontSize: 12, color: "#059669", fontWeight: 600, marginTop: 4 }}>{rec.financialImpact}</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </GlassCard>
        </div>

        {/* Duplicate alerts */}
        {analysis && analysis.duplicates.length > 0 && (
          <section style={{ marginBottom: 32 }}>
            <SectionHeader title="כיסויים כפולים שזוהו" subtitle="פוליסות אשר ייתכן ומיותרות" />
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 14 }}>
              {analysis.duplicates.map((dup, i) => (
                <GlassCard key={i} padding="md" style={{ borderRight: "4px solid #DC2626" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                    <div style={{ fontWeight: 800, fontSize: 15, color: "#DC2626" }}>{POLICY_TYPE_LABELS[dup.type] ?? dup.type}</div>
                    <Badge variant="high">{dup.policies.length} כפולים</Badge>
                  </div>
                  <div style={{ fontSize: 12.5, color: "#7C6FA0", marginBottom: 6 }}>
                    {dup.policies.map(p => p.provider).filter(Boolean).join(" · ")}
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "#DC2626" }}>
                    בזבוז: {fmt(dup.estimatedMonthlyWaste)} / חודש
                  </div>
                </GlassCard>
              ))}
            </div>
          </section>
        )}

        {/* Missing coverage */}
        {analysis && analysis.missingCoverage.length > 0 && (
          <section style={{ marginBottom: 32 }}>
            <SectionHeader title="כיסויים חסרים" subtitle="ביטוחים שכדאי לשקול" />
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
              {analysis.missingCoverage.map(cov => (
                <div key={cov} style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 16px", borderRadius: 12, background: "rgba(217,119,6,0.06)", border: "1px solid rgba(217,119,6,0.2)" }}>
                  <AlertCircle size={15} color="#D97706" />
                  <span style={{ fontSize: 13.5, fontWeight: 600, color: "#D97706" }}>{POLICY_TYPE_LABELS[cov] ?? cov}</span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Policies list */}
        {policies.length > 0 && (
          <section style={{ marginBottom: 40 }}>
            <SectionHeader
              title="הפוליסות שלך"
              subtitle={`${policies.length} פוליסות · ${fmt(totalPremium)} / חודש`}
            />
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
                        {p.provider ?? "—"}
                        {p.policyNumber ? ` · ${p.policyNumber}` : ""}
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
                      onClick={() => void handleDelete(p.id)}
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
        )}

        {/* Copilot CTA */}
        <GlassCard padding="lg" style={{ background: "linear-gradient(135deg, rgba(123,94,167,0.08), rgba(155,127,232,0.14))", border: "1px solid rgba(184,157,255,0.35)", textAlign: "center" }}>
          <div style={{ fontSize: 28, marginBottom: 12 }}>🤖</div>
          <h3 style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 22, fontWeight: 700, color: "#1F1F1F", margin: "0 0 10px", letterSpacing: "-0.02em" }}>
            שאל את סוכן הביטוח
          </h3>
          <p style={{ fontSize: 14.5, color: "#7C6FA0", margin: "0 0 22px", lineHeight: 1.65 }}>
            "האם אני צריך ביטוח חיים?", "כמה אני משלם יותר מהממוצע?", "מה הסיכון הכי גדול שלי?" — הסוכן יענה.
          </p>
          <button
            onClick={() => navigate(APP_ROUTES.copilot)}
            style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "12px 28px", borderRadius: 14, background: "linear-gradient(135deg, #7B5EA7, #6B4FA0)", color: "#fff", border: "none", cursor: "pointer", fontFamily: "inherit", fontWeight: 700, fontSize: 15, boxShadow: "0 4px 20px rgba(123,94,167,0.35)" }}
          >
            <Sparkles size={16} /> פתח שיחה עם הסוכן
          </button>
        </GlassCard>

        <div style={{ height: 4 }} />
        <button
          onClick={() => navigate(APP_ROUTES.findings)}
          style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", color: "#9B7FE8", fontWeight: 600, fontSize: 13.5, cursor: "pointer", fontFamily: "inherit", marginTop: 8 }}
        >
          כל הממצאים וההתראות <ChevronLeft size={14} />
        </button>
      </main>
      <AppFooter variant="private" />
    </div>
  );
}
