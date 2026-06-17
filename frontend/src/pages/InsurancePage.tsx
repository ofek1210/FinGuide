import { useCallback, useEffect, useRef, useState } from "react";
import {
  Shield, ShieldAlert, ShieldCheck, Upload, Trash2, AlertCircle,
  CheckCircle, Loader2, ChevronRight, FileSpreadsheet,
} from "lucide-react";
import PrivateTopbar from "../components/PrivateTopbar";
import AppFooter from "../components/AppFooter";
import {
  getInsuranceAnalysis,
  uploadInsuranceExcel,
  deleteInsurancePolicy,
  type InsuranceAnalysisResponse,
  type InsurancePolicyDTO,
} from "../api/insuranceAI.api";

const TYPE_LABELS: Record<string, string> = {
  life:             "חיים",
  health:           "בריאות",
  disability:       'אכ"ע',
  apartment:        "דירה",
  car:              "רכב",
  mortgage:         "משכנתא",
  critical_illness: "מחלות קשות",
  other:            "אחר",
};

const URGENCY_COLOR: Record<string, string> = {
  high:   "var(--figma-error, #ef4444)",
  medium: "var(--figma-warning, #eab308)",
  low:    "var(--figma-success, #22c55e)",
};

const URGENCY_LABEL: Record<string, string> = {
  high:   "דחוף",
  medium: "מומלץ",
  low:    "לידיעה",
};

const fmt = (n: number | null | undefined) =>
  n != null ? `₪${Number(n).toLocaleString("he-IL")}` : "—";

const AI_DISCLAIMER = "ניתוח זה נוצר על ידי מודל AI על בסיס הנתונים שהזנת. אינו מהווה ייעוץ פיננסי או ביטוחי מקצועי. לפני כל החלטה, פנה/י לסוכן ביטוח מורשה.";

export default function InsurancePage() {
  const [data, setData] = useState<InsuranceAnalysisResponse["data"] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const loadAnalysis = useCallback(async () => {
    setLoading(true);
    setError(null);
    const res = await getInsuranceAnalysis();
    setLoading(false);
    if (res.ok && res.data.success && res.data.data) {
      setData(res.data.data);
    } else {
      setError("לא הצלחנו לטעון את נתוני הביטוח");
    }
  }, []);

  useEffect(() => { void loadAnalysis(); }, [loadAnalysis]);

  const handleFileUpload = useCallback(async (file: File) => {
    setUploading(true);
    setUploadMsg(null);
    const res = await uploadInsuranceExcel(file);
    setUploading(false);
    if (res.success) {
      setUploadMsg({ ok: true, text: res.message ?? `ייבאנו ${res.data?.imported ?? 0} פוליסות` });
      await loadAnalysis();
    } else {
      setUploadMsg({ ok: false, text: res.message ?? "שגיאה בהעלאת הקובץ" });
    }
  }, [loadAnalysis]);

  const handleDelete = useCallback(async (policy: InsurancePolicyDTO) => {
    if (!window.confirm(`למחוק את פוליסת ${TYPE_LABELS[policy.type] ?? policy.type}?`)) return;
    setDeletingId(policy.id);
    await deleteInsurancePolicy(policy.id);
    setDeletingId(null);
    await loadAnalysis();
  }, [loadAnalysis]);

  const analysis = data?.analysis;

  const criticalCount = items.filter(r => r.importance === "critical").length;
  const highCount = items.filter(r => r.importance === "high").length;

  return (
    <div style={{ minHeight: "100vh", background: "var(--rapyd-bg)", direction: "rtl" }}>
      <PrivateTopbar />

      <main style={{ maxWidth: 1000, margin: "0 auto", padding: "40px 24px 80px" }}>

        {/* ── Header ── */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 32, gap: 16, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <span style={{
              width: 48, height: 48, background: "rgba(99,102,241,0.15)",
              borderRadius: 14, display: "flex", alignItems: "center", justifyContent: "center",
              color: "#818CF8",
            }}>
              <ShieldCheck size={24} />
            </span>
            <div>
              <h1 style={{ fontSize: 26, fontWeight: 800, margin: 0, color: "var(--rapyd-text)" }}>
                AI Insurance Shield
              </h1>
              <p style={{ color: "var(--rapyd-text-muted)", margin: "4px 0 0", fontSize: 14 }}>
                זיהוי כיסוי חסר, ביטוח כפול וחיסכון פוטנציאלי
              </p>
            </div>
          </div>

          {/* Upload button */}
          <button
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            style={{
              background: "rgba(129,140,248,0.12)", color: "#818CF8",
              border: "1px solid rgba(129,140,248,0.3)", borderRadius: 10,
              padding: "10px 20px", fontSize: 14, fontWeight: 700,
              cursor: uploading ? "not-allowed" : "pointer",
              fontFamily: "inherit", display: "flex", alignItems: "center", gap: 8,
            }}
          >
            {uploading
              ? <><Loader2 size={15} style={{ animation: "spin 1s linear infinite" }} /> מייבא...</>
              : <><FileSpreadsheet size={15} /> ייבא מהר הביטוח</>}
          </button>
          <input
            ref={fileRef} type="file" accept=".xlsx,.xls" style={{ display: "none" }}
            onChange={e => { const f = e.target.files?.[0]; if (f) void handleFileUpload(f); e.target.value = ""; }}
          />
        </div>

        {/* Upload feedback */}
        {uploadMsg && (
          <div style={{
            marginBottom: 20,
            background: uploadMsg.ok ? "rgba(5,150,105,0.1)" : "rgba(239,68,68,0.1)",
            border: `1px solid ${uploadMsg.ok ? "rgba(5,150,105,0.3)" : "rgba(239,68,68,0.3)"}`,
            borderRadius: 10, padding: "12px 18px",
            display: "flex", alignItems: "center", gap: 10,
            color: uploadMsg.ok ? "#34D399" : "#FCA5A5", fontSize: 14,
          }}>
            {uploadMsg.ok ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
            {uploadMsg.text}
          </div>
        )}

        {loading && (
          <div style={{ display: "flex", alignItems: "center", gap: 12, color: "var(--rapyd-text-muted)", padding: "60px 0" }}>
            <Loader2 size={20} style={{ animation: "spin 1s linear infinite" }} />
            <span>טוען ניתוח ביטוחי...</span>
          </div>
        )}

        {error && (
          <div style={{
            background: "rgba(220,38,38,0.1)", border: "1px solid rgba(220,38,38,0.3)",
            borderRadius: 12, padding: "16px 20px", color: "#FCA5A5",
            display: "flex", alignItems: "center", gap: 10,
          }}>
            <AlertCircle size={18} /> {error}
          </div>
        )}

        {data && !loading && (
          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>

            {/* ── Critical alert strip ── */}
            {analysis?.hasCriticalGap && (
              <div style={{
                background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.3)",
                borderRadius: 12, padding: "16px 22px",
                display: "flex", alignItems: "center", gap: 14,
              }}>
                <ShieldAlert size={22} style={{ color: "#F87171", flexShrink: 0 }} />
                <div>
                  <div style={{ fontWeight: 700, color: "#FCA5A5", marginBottom: 3 }}>
                    זוהו פערים קריטיים בכיסוי הביטוחי שלך
                  </div>
                  <div style={{ fontSize: 13, color: "rgba(252,165,165,0.75)" }}>
                    {analysis.duplicateCount > 0 && `${analysis.duplicateCount} ביטוח כפול · `}
                    {analysis.missingCoverage.length > 0 && `${analysis.missingCoverage.length} כיסוי חסר`}
                  </div>
                </div>
              </div>
            )}

            {/* ── Stats bar ── */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 14 }}>
              {[
                {
                  label: "ביטוחים כפולים",
                  value: analysis?.duplicateCount ?? 0,
                  sub: analysis?.totalMonthlyWaste ? `${fmt(analysis.totalMonthlyWaste)}/חודש מיותר` : null,
                  alert: (analysis?.duplicateCount ?? 0) > 0,
                },
                {
                  label: "כיסוי חסר",
                  value: analysis?.missingCoverage.length ?? 0,
                  sub: analysis?.missingUrgency === "high" ? "דחוי לטיפול" : null,
                  alert: (analysis?.missingCoverage.length ?? 0) > 0,
                },
                {
                  label: "חיסכון פוטנציאלי",
                  value: fmt(analysis?.savings?.annualSavings ?? null),
                  sub: "לשנה",
                  alert: false,
                },
                {
                  label: "פוליסות מיובאות",
                  value: data.policies.length,
                  sub: data.hasImportedPolicies ? "מהר הביטוח" : "ללא ייבוא",
                  alert: false,
                },
              ].map(card => (
                <div key={card.label} className="dashboard-card" style={{
                  padding: "18px 22px",
                  borderColor: card.alert ? "rgba(239,68,68,0.3)" : undefined,
                }}>
                  <div style={{ fontSize: 12, color: "var(--rapyd-text-muted)", marginBottom: 6, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                    {card.label}
                  </div>
                  <div style={{ fontSize: 24, fontWeight: 800, color: card.alert ? "#F87171" : "var(--rapyd-text)" }}>
                    {card.value}
                  </div>
                  {card.sub && (
                    <div style={{ fontSize: 12, color: "var(--rapyd-text-muted)", marginTop: 4 }}>
                      {card.sub}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* ── Recommendations ── */}
            {data.recommendations.length > 0 && (
              <div className="dashboard-card" style={{ padding: "24px 28px" }}>
                <h2 style={{ fontSize: 17, fontWeight: 700, margin: "0 0 18px", color: "var(--rapyd-text)" }}>
                  המלצות AI
                </h2>
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {data.recommendations.map((rec) => {
                    const uc = URGENCY_COLOR[rec.urgency] ?? URGENCY_COLOR.low;
                    return (
                      <div key={rec.type} style={{
                        background: "rgba(255,255,255,0.03)", borderRadius: 10, padding: "14px 18px",
                        border: "1px solid rgba(255,255,255,0.07)", display: "flex", gap: 14, alignItems: "flex-start",
                      }}>
                        <span style={{
                          background: `${uc}22`, color: uc, borderRadius: 6,
                          padding: "2px 10px", fontSize: 12, fontWeight: 700,
                          whiteSpace: "nowrap", marginTop: 2,
                        }}>
                          {URGENCY_LABEL[rec.urgency] ?? rec.urgency}
                        </span>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 700, color: "var(--rapyd-text)", marginBottom: 4, fontSize: 15 }}>
                            {rec.title}
                          </div>
                          <div style={{ fontSize: 13, color: "var(--rapyd-text-muted)" }}>
                            {rec.reason}
                          </div>
                          {rec.financialImpact && (
                            <div style={{ fontSize: 13, color: "#34D399", marginTop: 6, fontWeight: 600 }}>
                              💰 {rec.financialImpact}
                            </div>
                          )}
                        </div>
                        <div style={{ fontSize: 12, color: "var(--rapyd-text-muted)", whiteSpace: "nowrap" }}>
                          {rec.confidenceScore}%
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ── Imported policies table ── */}
            {data.policies.length > 0 && (
              <div className="dashboard-card" style={{ padding: "24px 28px" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
                  <h2 style={{ fontSize: 17, fontWeight: 700, margin: 0, color: "var(--rapyd-text)" }}>
                    פוליסות מיובאות
                  </h2>
                  <span style={{ fontSize: 13, color: "var(--rapyd-text-muted)" }}>
                    {data.policies.length} פוליסות
                  </span>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {data.policies.map(p => (
                    <div key={p.id} style={{
                      background: "rgba(255,255,255,0.03)", borderRadius: 8, padding: "12px 16px",
                      display: "flex", alignItems: "center", gap: 14,
                      border: "1px solid rgba(255,255,255,0.06)",
                    }}>
                      <Shield size={16} style={{ color: "#818CF8", flexShrink: 0 }} />
                      <div style={{ flex: 1 }}>
                        <span style={{ fontWeight: 700, color: "var(--rapyd-text)", fontSize: 14 }}>
                          {TYPE_LABELS[p.type] ?? p.type}
                        </span>
                        {p.provider && (
                          <span style={{ fontSize: 13, color: "var(--rapyd-text-muted)", marginRight: 10 }}>
                            {p.provider}
                          </span>
                        )}
                      </div>
                      {p.monthlyPremium != null && (
                        <div style={{ fontSize: 14, fontWeight: 600, color: "var(--rapyd-text)", whiteSpace: "nowrap" }}>
                          {fmt(p.monthlyPremium)}/חודש
                        </div>
                      )}
                      <button
                        onClick={() => void handleDelete(p)}
                        disabled={deletingId === p.id}
                        style={{
                          background: "none", border: "none", cursor: "pointer",
                          color: "var(--rapyd-text-muted)", padding: 4,
                          opacity: deletingId === p.id ? 0.5 : 1,
                        }}
                      >
                        {deletingId === p.id
                          ? <Loader2 size={15} style={{ animation: "spin 1s linear infinite" }} />
                          : <Trash2 size={15} />}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── No data / prompt to upload ── */}
            {!data.hasImportedPolicies && data.policies.length === 0 && (
              <div className="dashboard-card" style={{ padding: "48px 28px", textAlign: "center" }}>
                <Upload size={38} style={{ color: "var(--rapyd-text-muted)", marginBottom: 16 }} />
                <h3 style={{ color: "var(--rapyd-text)", marginBottom: 8 }}>ייבא נתוני ביטוח</h3>
                <p style={{ color: "var(--rapyd-text-muted)", fontSize: 14, marginBottom: 20, maxWidth: 380, margin: "0 auto 20px" }}>
                  הורד את קובץ הנתונים מ-<strong>הר הביטוח</strong> (gov.il) והעלה אותו כאן לניתוח מלא
                </p>
                <button
                  onClick={() => fileRef.current?.click()}
                  style={{
                    background: "#5B4FF5", color: "#fff", border: "none", borderRadius: 10,
                    padding: "12px 28px", fontSize: 15, fontWeight: 700, cursor: "pointer",
                    fontFamily: "inherit", display: "inline-flex", alignItems: "center", gap: 8,
                  }}
                >
                  <FileSpreadsheet size={16} /> העלה קובץ Excel
                </button>
                <p style={{ fontSize: 12, color: "var(--rapyd-text-muted)", marginTop: 12 }}>
                  תומך ב-.xlsx ו-.xls · עד 5MB · הנתונים מוצפנים
                </p>
              </div>
            )}

            {/* ── Coverage flags from profile ── */}
            {analysis?.flags && analysis.flags.length > 0 && (
              <div className="dashboard-card" style={{ padding: "22px 28px" }}>
                <h2 style={{ fontSize: 17, fontWeight: 700, margin: "0 0 16px", color: "var(--rapyd-text)" }}>
                  תובנות מהפרופיל שלך
                </h2>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {analysis.flags.map(flag => (
                    <div key={flag.code} style={{
                      display: "flex", alignItems: "center", gap: 12,
                      background: "rgba(255,255,255,0.03)", borderRadius: 8,
                      padding: "12px 16px", border: "1px solid rgba(255,255,255,0.06)",
                    }}>
                      <ChevronRight size={16} style={{ color: URGENCY_COLOR[flag.urgency] ?? "#818CF8" }} />
                      <span style={{ fontSize: 14, color: "var(--rapyd-text)" }}>{flag.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

          </div>
        )}
      </main>

      <AppFooter variant="private" />
    </div>
  );
}

