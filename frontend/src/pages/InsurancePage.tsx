import { useCallback, useEffect, useRef, useState } from "react";
import {
  Shield, ShieldAlert, ShieldCheck, Upload, Trash2, AlertCircle,
  CheckCircle, Loader2, ChevronRight, FileSpreadsheet, Lightbulb, BarChart3, ExternalLink,
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

/* ── Market data from mygemel.net ── */
const INSURANCE_MARKET_DATA = [
  { label: 'אכ"ע (אובדן כושר)', min: 80, max: 450, avg: 200, color: "#818CF8" },
  { label: "חיים (ריסק)", min: 40, max: 350, avg: 150, color: "#34D399" },
  { label: "בריאות פרטי", min: 150, max: 600, avg: 320, color: "#F472B6" },
  { label: 'שב"ן (משלים)', min: 30, max: 80, avg: 55, color: "#FBBF24" },
  { label: "דירה (מבנה+תכולה)", min: 35, max: 200, avg: 100, color: "#60A5FA" },
];

const PENSION_FEE_DATA = [
  { label: "דמי ניהול מהפקדה", market: 1.5, recommended: 0, unit: "%" },
  { label: "דמי ניהול מצבירה", market: 0.2, recommended: 0.1, unit: "%" },
  { label: "דמי ניהול קה\"ש מצבירה", market: 0.67, recommended: 0.3, unit: "%" },
];

const MARKET_TIPS = [
  { icon: "💡", text: "ביטוח אכ\"ע בקרן הפנסיה מכסה בד\"כ 75% מהשכר המבוטח — בדוק אם זה מספיק לך" },
  { icon: "🔍", text: "ביטוח חיים מומלץ: הכנסה שנתית × 10 או לפחות גובה המשכנתא" },
  { icon: "💰", text: "משא ומתן על דמי ניהול יכול לחסוך עשרות אלפי ₪ לאורך השנים" },
  { icon: "⚠️", text: "בדוק תקופת המתנה, חריגות מצבים קיימים, והאם הפרמיה עולה עם הגיל" },
  { icon: "📊", text: "השווה פוליסות באתר mygemel.net לפני חידוש או רכישת ביטוח חדש" },
];

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

  const recommendations = data?.recommendations ?? [];
  const criticalCount = recommendations.filter(r => r.importance === "critical").length;
  const highCount = recommendations.filter(r => r.importance === "high").length;

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
                ניתוח ביטוחי חכם
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

        {/* ── Market Data Section (always visible) ── */}
        {!loading && (
          <div style={{ display: "flex", flexDirection: "column", gap: 24, marginTop: data ? 24 : 0 }}>

            {/* ── Insurance Cost Ranges Chart ── */}
            <div className="dashboard-card" style={{ padding: "24px 28px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
                <BarChart3 size={20} style={{ color: "#818CF8" }} />
                <h2 style={{ fontSize: 17, fontWeight: 700, margin: 0, color: "var(--rapyd-text)" }}>
                  עלויות ביטוח בשוק — 2026
                </h2>
                <span style={{ fontSize: 11, color: "var(--rapyd-text-muted)", marginRight: "auto" }}>
                  מקור: mygemel.net
                </span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                {INSURANCE_MARKET_DATA.map(item => {
                  const maxVal = 600;
                  return (
                    <div key={item.label}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                        <span style={{ fontSize: 14, fontWeight: 600, color: "var(--rapyd-text)" }}>{item.label}</span>
                        <span style={{ fontSize: 13, color: "var(--rapyd-text-muted)" }}>
                          ₪{item.min}–₪{item.max}/חודש
                        </span>
                      </div>
                      <div style={{ position: "relative", height: 28, borderRadius: 8, background: "rgba(255,255,255,0.05)", overflow: "hidden" }}>
                        {/* Range bar */}
                        <div style={{
                          position: "absolute",
                          right: `${(1 - item.max / maxVal) * 100}%`,
                          width: `${((item.max - item.min) / maxVal) * 100}%`,
                          height: "100%",
                          background: `${item.color}22`,
                          borderRadius: 8,
                          border: `1px solid ${item.color}44`,
                        }} />
                        {/* Average marker */}
                        <div style={{
                          position: "absolute",
                          right: `${(1 - item.avg / maxVal) * 100}%`,
                          top: 2, bottom: 2,
                          width: 3,
                          background: item.color,
                          borderRadius: 2,
                        }} />
                        {/* Average label */}
                        <span style={{
                          position: "absolute",
                          right: `${(1 - item.avg / maxVal) * 100 + 1}%`,
                          top: "50%", transform: "translateY(-50%)",
                          fontSize: 11, fontWeight: 700, color: item.color,
                        }}>
                          ממוצע ₪{item.avg}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* ── Management Fees Comparison ── */}
            <div className="dashboard-card" style={{ padding: "24px 28px" }}>
              <h2 style={{ fontSize: 17, fontWeight: 700, margin: "0 0 18px", color: "var(--rapyd-text)" }}>
                דמי ניהול — ממוצע שוק vs. מומלץ
              </h2>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 14 }}>
                {PENSION_FEE_DATA.map(fee => (
                  <div key={fee.label} style={{
                    background: "rgba(255,255,255,0.03)", borderRadius: 10, padding: "16px 20px",
                    border: "1px solid rgba(255,255,255,0.07)", textAlign: "center",
                  }}>
                    <div style={{ fontSize: 12, color: "var(--rapyd-text-muted)", marginBottom: 10, fontWeight: 600 }}>
                      {fee.label}
                    </div>
                    <div style={{ display: "flex", justifyContent: "center", gap: 24, alignItems: "baseline" }}>
                      <div>
                        <div style={{ fontSize: 22, fontWeight: 800, color: "#F87171" }}>{fee.market}{fee.unit}</div>
                        <div style={{ fontSize: 11, color: "var(--rapyd-text-muted)" }}>ממוצע שוק</div>
                      </div>
                      <ChevronRight size={16} style={{ color: "var(--rapyd-text-muted)", transform: "scaleX(-1)" }} />
                      <div>
                        <div style={{ fontSize: 22, fontWeight: 800, color: "#34D399" }}>{fee.recommended}{fee.unit}</div>
                        <div style={{ fontSize: 11, color: "var(--rapyd-text-muted)" }}>מומלץ</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* ── Tips from mygemel.net ── */}
            <div className="dashboard-card" style={{ padding: "24px 28px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18 }}>
                <Lightbulb size={20} style={{ color: "#FBBF24" }} />
                <h2 style={{ fontSize: 17, fontWeight: 700, margin: 0, color: "var(--rapyd-text)" }}>
                  טיפים לחיסכון בביטוח
                </h2>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {MARKET_TIPS.map((tip, i) => (
                  <div key={i} style={{
                    display: "flex", alignItems: "flex-start", gap: 12,
                    background: "rgba(255,255,255,0.03)", borderRadius: 10, padding: "14px 18px",
                    border: "1px solid rgba(255,255,255,0.07)",
                  }}>
                    <span style={{ fontSize: 18, flexShrink: 0 }}>{tip.icon}</span>
                    <span style={{ fontSize: 14, color: "var(--rapyd-text)", lineHeight: 1.6 }}>{tip.text}</span>
                  </div>
                ))}
              </div>
              <a
                href="https://www.mygemel.net"
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: "inline-flex", alignItems: "center", gap: 6,
                  marginTop: 16, fontSize: 13, color: "#818CF8",
                  textDecoration: "none", fontWeight: 600,
                }}
              >
                <ExternalLink size={14} />
                השוואת פוליסות מלאה באתר mygemel.net
              </a>
            </div>

            {/* ── Disclaimer ── */}
            <p style={{ fontSize: 12, color: "var(--rapyd-text-muted)", textAlign: "center", margin: "8px 0 0", lineHeight: 1.6 }}>
              {AI_DISCLAIMER}
            </p>

          </div>
        )}
      </main>

      <AppFooter variant="private" />
    </div>
  );
}

