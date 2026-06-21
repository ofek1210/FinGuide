/**
 * InsurancePage — guided Har HaBituach import flow
 *
 * Step "landing"  — hero + "ייבוא מהר הביטוח" CTA
 * Step "guide"    — step-by-step instructions + link to official site
 * Step "upload"   — drag-and-drop Excel upload
 * Step "results"  — AI analysis dashboard
 */
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Shield, Upload, AlertCircle, CheckCircle, ChevronLeft,
  Sparkles, Trash2, ExternalLink, ArrowLeft, FileSpreadsheet,
  RefreshCw,
} from "lucide-react";
import { InsightsPanel } from "../components/ai/InsightsPanel";
import { useNavigate } from "react-router-dom";
import PrivateTopbar from "../components/PrivateTopbar";
import AppFooter from "../components/AppFooter";
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

const HAR_HABITUACH_URL = "https://www.gov.il/he/service/har-habituach";

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

type FlowStep = "landing" | "guide" | "upload" | "results";

/* ════════════════════════════════════════════════════════════════
   MAIN PAGE
════════════════════════════════════════════════════════════════ */
export default function InsurancePage() {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<FlowStep>("landing");
  const [data, setData] = useState<InsuranceAnalysisResponse["data"] | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [visitedSite, setVisitedSite] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await getInsuranceAnalysis();
    if (res.ok && res.data?.success && res.data.data) {
      setData(res.data.data);
      // If user already has policies, go straight to results
      if ((res.data.data.policies ?? []).length > 0) {
        setStep("results");
      }
    }
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const handleUpload = async (file: File) => {
    const ext = file.name.split(".").pop()?.toLowerCase();
    if (!["xlsx", "xls"].includes(ext ?? "")) {
      setUploadMsg({ type: "error", text: "ניתן להעלות קבצי Excel בלבד (.xlsx / .xls)" });
      return;
    }
    setUploading(true);
    setUploadMsg(null);
    const res = await uploadInsuranceExcel(file);
    setUploading(false);
    if (res.success) {
      setUploadMsg({ type: "success", text: `יובאו ${res.data?.imported ?? 0} פוליסות בהצלחה — הסוכן מנתח...` });
      await load();
      setTimeout(() => setStep("results"), 1400);
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
    <div style={{
      minHeight: "100vh",
      background: "var(--lg-bg, #FAF7FF)",
      color: "#1F1F1F",
      fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
    }}>
      <PrivateTopbar />

      <main style={{ maxWidth: 860, margin: "0 auto", padding: "36px 24px 72px", direction: "rtl" }}>

        {/* ── Loading skeleton ── */}
        {loading && step === "landing" && (
          <div style={{ textAlign: "center", padding: "80px 0", color: "#9B7FE8", fontSize: 14 }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>⏳</div>
            טוען נתוני ביטוח...
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════
            STEP: LANDING
        ══════════════════════════════════════════════════════════ */}
        {!loading && step === "landing" && (
          <LandingStep onImport={() => setStep("guide")} />
        )}

        {/* ══════════════════════════════════════════════════════════
            STEP: GUIDE
        ══════════════════════════════════════════════════════════ */}
        {step === "guide" && (
          <GuideStep
            visitedSite={visitedSite}
            onVisitSite={() => {
              window.open(HAR_HABITUACH_URL, "_blank", "noopener,noreferrer");
              setVisitedSite(true);
            }}
            onContinue={() => setStep("upload")}
            onBack={() => setStep("landing")}
          />
        )}

        {/* ══════════════════════════════════════════════════════════
            STEP: UPLOAD
        ══════════════════════════════════════════════════════════ */}
        {step === "upload" && (
          <UploadStep
            fileInputRef={fileInputRef}
            uploading={uploading}
            uploadMsg={uploadMsg}
            isDragging={isDragging}
            setIsDragging={setIsDragging}
            onUpload={handleUpload}
            onBack={() => setStep("guide")}
          />
        )}

        {/* ══════════════════════════════════════════════════════════
            STEP: RESULTS
        ══════════════════════════════════════════════════════════ */}
        {step === "results" && (
          <ResultsStep
            analysis={analysis}
            policies={policies}
            recs={recs}
            totalPremium={totalPremium}
            deletingId={deletingId}
            onDelete={handleDelete}
            onReimport={() => setStep("guide")}
            navigate={navigate}
          />
        )}

      </main>
      <AppFooter variant="private" />
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════
   STEP: LANDING
════════════════════════════════════════════════════════════════ */
function LandingStep({ onImport }: { onImport: () => void }) {
  return (
    <div>
      {/* Hero */}
      <div style={{ textAlign: "center", marginBottom: 48 }}>
        <div style={{
          width: 80, height: 80, borderRadius: 24, margin: "0 auto 20px",
          background: "linear-gradient(135deg, rgba(123,94,167,0.12), rgba(155,127,232,0.18))",
          border: "1.5px solid rgba(155,127,232,0.22)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 38,
        }}>🛡️</div>
        <h1 style={{
          fontFamily: "'Fraunces', Georgia, serif",
          fontSize: "clamp(26px, 4vw, 38px)",
          fontWeight: 700, color: "#1F1F1F",
          margin: "0 0 14px", letterSpacing: "-0.03em",
        }}>
          הסוכן האישי שלי לביטוח ופוליסות
        </h1>
        <p style={{ fontSize: 16, color: "#7C6FA0", maxWidth: 520, margin: "0 auto 32px", lineHeight: 1.7 }}>
          ניתוח כל הפוליסות שלך, זיהוי כפילויות, פערים בכיסוי, ואיפה אפשר לחסוך —
          הכל ממקור אחד מהימן: <strong>הר הביטוח</strong>.
        </p>

        <button
          onClick={onImport}
          style={{
            display: "inline-flex", alignItems: "center", gap: 10,
            padding: "16px 36px", borderRadius: 16,
            background: "linear-gradient(135deg, #7B5EA7, #6B4FA0)",
            color: "#fff", border: "none", cursor: "pointer",
            fontFamily: "inherit", fontWeight: 800, fontSize: 17,
            boxShadow: "0 6px 24px rgba(123,94,167,0.40)",
            transition: "transform 0.15s, box-shadow 0.15s",
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.transform = "translateY(-2px)"; (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 10px 32px rgba(123,94,167,0.50)"; }}
          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.transform = "none"; (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 6px 24px rgba(123,94,167,0.40)"; }}
        >
          <FileSpreadsheet size={20} />
          ייבוא מהר הביטוח
        </button>
        <div style={{ fontSize: 13, color: "#A89CC8", marginTop: 12 }}>
          חינמי · מאובטח · לוקח ~2 דקות
        </div>
      </div>

      {/* What you'll get */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16, marginBottom: 48 }}>
        {[
          { icon: "♻️", title: "כפילויות", desc: "זיהוי פוליסות חופפות שגורמות לתשלום כפול" },
          { icon: "⚠️", title: "פערים בכיסוי", desc: "ביטוחים חיוניים שיש לך ולא אתה מכוסה בהם" },
          { icon: "💰", title: "חיסכון פוטנציאלי", desc: "כמה ניתן לחסוך בפרמיות ללא פגיעה בכיסוי" },
          { icon: "📊", title: "השוואה לשוק", desc: "האם אתה משלם יותר מהממוצע בשוק" },
        ].map(item => (
          <GlassCard key={item.title} padding="md" style={{ textAlign: "center" }}>
            <div style={{ fontSize: 28, marginBottom: 10 }}>{item.icon}</div>
            <div style={{ fontWeight: 800, fontSize: 15, color: "#1F1F1F", marginBottom: 6 }}>{item.title}</div>
            <div style={{ fontSize: 13, color: "#7C6FA0", lineHeight: 1.55 }}>{item.desc}</div>
          </GlassCard>
        ))}
      </div>

      {/* Trust note */}
      <GlassCard padding="md" style={{ display: "flex", alignItems: "center", gap: 14, background: "rgba(155,127,232,0.05)", border: "1px solid rgba(155,127,232,0.15)" }}>
        <div style={{ fontSize: 22, flexShrink: 0 }}>🔒</div>
        <div>
          <div style={{ fontWeight: 700, fontSize: 14, color: "#1F1F1F", marginBottom: 3 }}>המידע שלך מאובטח לחלוטין</div>
          <div style={{ fontSize: 13, color: "#7C6FA0", lineHeight: 1.5 }}>
            הנתונים מגיעים ישירות מאתר המדינה הרשמי. אנחנו לא שומרים פרטי פוליסה רגישים — רק מה שנדרש לניתוח.
          </div>
        </div>
      </GlassCard>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════
   STEP: GUIDE
════════════════════════════════════════════════════════════════ */
function GuideStep({
  visitedSite, onVisitSite, onContinue, onBack,
}: {
  visitedSite: boolean;
  onVisitSite: () => void;
  onContinue: () => void;
  onBack: () => void;
}) {
  const STEPS_LIST = [
    {
      num: "1",
      icon: "🌐",
      title: "כנסו לאתר הר הביטוח הרשמי",
      desc: "לחצו על הכפתור למטה — ייפתח אתר המדינה הרשמי בלשונית חדשה.",
      action: (
        <button
          onClick={onVisitSite}
          style={{
            display: "inline-flex", alignItems: "center", gap: 8,
            padding: "11px 20px", borderRadius: 12,
            background: visitedSite ? "#ECFDF5" : "linear-gradient(135deg, #7B5EA7, #6B4FA0)",
            color: visitedSite ? "#059669" : "#fff",
            border: visitedSite ? "1px solid rgba(5,150,105,0.25)" : "none",
            cursor: "pointer", fontFamily: "inherit", fontWeight: 700, fontSize: 14,
            boxShadow: visitedSite ? "none" : "0 4px 14px rgba(123,94,167,0.35)",
          }}
        >
          {visitedSite ? (
            <><CheckCircle size={15} /> ביקרת באתר</>
          ) : (
            <><ExternalLink size={15} /> פתח את הר הביטוח</>
          )}
        </button>
      ),
    },
    {
      num: "2",
      icon: "🔑",
      title: "התחברות עם תעודת זהות",
      desc: "היכנסו למערכת הר הביטוח עם תעודת הזהות שלכם. ניתן להתחבר גם דרך MyGov.",
    },
    {
      num: "3",
      icon: "📊",
      title: 'הורידו את הדוח בפורמט Excel',
      desc: 'בחרו "הורדת דוח ביטוחים" ושמרו את הקובץ (xlsx) במחשב שלכם.',
    },
    {
      num: "4",
      icon: "⬆️",
      title: "חזרו לכאן והעלו את הקובץ",
      desc: "לאחר שהורדתם — לחצו על המשך ועלו את קובץ ה-Excel. הסוכן ינתח הכל.",
    },
  ];

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 36 }}>
        <button
          onClick={onBack}
          style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", color: "#7C6FA0", cursor: "pointer", fontFamily: "inherit", fontWeight: 600, fontSize: 14, marginBottom: 20 }}
        >
          <ArrowLeft size={14} /> חזרה
        </button>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "rgba(123,94,167,0.10)", border: "1px solid rgba(123,94,167,0.22)", borderRadius: 20, padding: "4px 14px", marginBottom: 14 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: "#7B5EA7" }}>שלב 1 מתוך 2 — הכנת הדוח</span>
        </div>
        <h1 style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: "clamp(22px, 3.5vw, 30px)", fontWeight: 700, color: "#1F1F1F", margin: "0 0 10px", letterSpacing: "-0.03em" }}>
          כיצד להוריד את דוח הביטוח שלך?
        </h1>
        <p style={{ fontSize: 15, color: "#7C6FA0", margin: 0, lineHeight: 1.6 }}>
          <strong>הר הביטוח</strong> הוא שירות ממשלתי רשמי שמרכז את כל הפוליסות הביטוחיות שלך ממקורות אחד.
          <br />פשוט עקוב אחרי ארבעת השלבים הבאים:
        </p>
      </div>

      {/* Steps */}
      <div style={{ display: "flex", flexDirection: "column", gap: 16, marginBottom: 36 }}>
        {STEPS_LIST.map((s, i) => (
          <GlassCard key={i} padding="md" elevated style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
            {/* Step number */}
            <div style={{
              width: 40, height: 40, borderRadius: 12, flexShrink: 0,
              background: "linear-gradient(135deg, rgba(123,94,167,0.12), rgba(155,127,232,0.18))",
              border: "1.5px solid rgba(155,127,232,0.25)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontWeight: 800, fontSize: 16, color: "#7B5EA7",
            }}>
              {s.num}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5 }}>
                <span style={{ fontSize: 18 }}>{s.icon}</span>
                <span style={{ fontWeight: 800, fontSize: 15.5, color: "#1F1F1F" }}>{s.title}</span>
              </div>
              <p style={{ fontSize: 14, color: "#7C6FA0", margin: "0 0 10px", lineHeight: 1.6 }}>{s.desc}</p>
              {s.action}
            </div>
          </GlassCard>
        ))}
      </div>

      {/* Info note */}
      <GlassCard padding="md" style={{ background: "rgba(217,119,6,0.05)", border: "1px solid rgba(217,119,6,0.18)", marginBottom: 28 }}>
        <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
          <span style={{ fontSize: 16, flexShrink: 0 }}>💡</span>
          <div style={{ fontSize: 13.5, color: "#92400E", lineHeight: 1.6 }}>
            <strong>לא מוצאים את אפשרות הורדת ה-Excel?</strong> חפשו "יצוא נתונים" או "הורד דוח" בתפריט. בחלק מהדפדפנים ייתכן שתצטרכו לאפשר קובץ הורדה.
          </div>
        </div>
      </GlassCard>

      {/* CTA */}
      <div style={{ display: "flex", justifyContent: "flex-start", gap: 12 }}>
        <button
          onClick={onContinue}
          style={{
            display: "flex", alignItems: "center", gap: 8,
            padding: "14px 30px", borderRadius: 14,
            background: visitedSite ? "linear-gradient(135deg, #7B5EA7, #6B4FA0)" : "rgba(184,157,255,0.25)",
            color: visitedSite ? "#fff" : "#A89CC8",
            border: "none", cursor: "pointer",
            fontFamily: "inherit", fontWeight: 700, fontSize: 15,
            boxShadow: visitedSite ? "0 5px 20px rgba(123,94,167,0.35)" : "none",
            transition: "all 0.2s",
          }}
        >
          <Upload size={15} />
          {visitedSite ? "הורדתי את הקובץ — המשך להעלאה" : "כבר יש לי את הקובץ — המשך"}
        </button>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════
   STEP: UPLOAD
════════════════════════════════════════════════════════════════ */
function UploadStep({
  fileInputRef, uploading, uploadMsg, isDragging, setIsDragging, onUpload, onBack,
}: {
  fileInputRef: React.RefObject<HTMLInputElement>;
  uploading: boolean;
  uploadMsg: { type: "success" | "error"; text: string } | null;
  isDragging: boolean;
  setIsDragging: (v: boolean) => void;
  onUpload: (f: File) => void;
  onBack: () => void;
}) {
  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <button
          onClick={onBack}
          style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", color: "#7C6FA0", cursor: "pointer", fontFamily: "inherit", fontWeight: 600, fontSize: 14, marginBottom: 20 }}
        >
          <ArrowLeft size={14} /> חזרה
        </button>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "rgba(123,94,167,0.10)", border: "1px solid rgba(123,94,167,0.22)", borderRadius: 20, padding: "4px 14px", marginBottom: 14 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: "#7B5EA7" }}>שלב 2 מתוך 2 — העלאת הדוח</span>
        </div>
        <h1 style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: "clamp(22px, 3.5vw, 30px)", fontWeight: 700, color: "#1F1F1F", margin: "0 0 10px", letterSpacing: "-0.03em" }}>
          העלה את קובץ הביטוח שלך
        </h1>
        <p style={{ fontSize: 15, color: "#7C6FA0", margin: 0, lineHeight: 1.6 }}>
          גרור את קובץ ה-Excel מהר הביטוח לכאן, או לחץ לבחירה. הסוכן ינתח אוטומטית.
        </p>
      </div>

      {/* Upload zone */}
      <GlassCard padding="lg" elevated style={{ marginBottom: 20 }}>
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,.xls"
          onChange={e => { const f = e.target.files?.[0]; if (f) { onUpload(f); } e.target.value = ""; }}
          style={{ display: "none" }}
        />
        <div
          onClick={() => !uploading && fileInputRef.current?.click()}
          onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={e => {
            e.preventDefault(); setIsDragging(false);
            const f = e.dataTransfer.files?.[0]; if (f) onUpload(f);
          }}
          style={{
            border: `2px dashed ${isDragging ? "#7B5EA7" : uploading ? "rgba(5,150,105,0.4)" : "rgba(184,157,255,0.40)"}`,
            borderRadius: 20, padding: "52px 24px",
            textAlign: "center", cursor: uploading ? "wait" : "pointer",
            background: isDragging ? "rgba(123,94,167,0.05)" : uploading ? "rgba(5,150,105,0.04)" : "rgba(250,247,255,0.5)",
            transition: "all 0.2s",
          }}
        >
          {uploading ? (
            <>
              <div style={{ fontSize: 36, marginBottom: 12 }}>⚙️</div>
              <div style={{ fontSize: 15, color: "#7B5EA7", fontWeight: 700 }}>הסוכן מנתח את הפוליסות...</div>
              <div style={{ fontSize: 13, color: "#A89CC8", marginTop: 6 }}>זה יכול לקחת כמה שניות</div>
            </>
          ) : (
            <>
              <div style={{ fontSize: 44, marginBottom: 14 }}>📊</div>
              <div style={{ fontSize: 17, fontWeight: 700, color: "#1F1F1F", marginBottom: 6 }}>
                גרור את קובץ ה-Excel לכאן
              </div>
              <div style={{ fontSize: 14, color: "#7C6FA0", marginBottom: 20 }}>
                או לחץ לבחירה מהמחשב
              </div>
              <div style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "10px 22px", borderRadius: 12, background: "linear-gradient(135deg, #7B5EA7, #6B4FA0)", color: "#fff", fontSize: 14, fontWeight: 700 }}>
                <FileSpreadsheet size={15} /> בחר קובץ xlsx
              </div>
              <div style={{ fontSize: 12, color: "#A89CC8", marginTop: 12 }}>פורמטים נתמכים: .xlsx .xls · עד 5MB</div>
            </>
          )}
        </div>

        {uploadMsg && (
          <div style={{
            marginTop: 16, padding: "12px 16px", borderRadius: 12, fontWeight: 600, fontSize: 14,
            background: uploadMsg.type === "error" ? "#FEF2F2" : "#ECFDF5",
            color: uploadMsg.type === "error" ? "#DC2626" : "#059669",
            border: `1px solid ${uploadMsg.type === "error" ? "rgba(220,38,38,0.2)" : "rgba(5,150,105,0.2)"}`,
            display: "flex", alignItems: "center", gap: 8,
          }}>
            {uploadMsg.type === "error" ? <AlertCircle size={16} /> : <CheckCircle size={16} />}
            {uploadMsg.text}
          </div>
        )}
      </GlassCard>

      {/* What happens next */}
      <GlassCard padding="md" style={{ background: "rgba(155,127,232,0.05)", border: "1px solid rgba(155,127,232,0.15)" }}>
        <div style={{ fontWeight: 700, fontSize: 14, color: "#7B5EA7", marginBottom: 10 }}>✦ מה קורה לאחר ההעלאה?</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {[
            "הסוכן סורק ומזהה את כל הפוליסות בקובץ",
            "מחשב את הפרמיה הכוללת החודשית שלך",
            "מאתר כפילויות ופוליסות חופפות",
            "מזהה פערים בכיסוי לפי הפרופיל שלך",
            "מייצר המלצות מותאמות אישית לחיסכון",
          ].map(item => (
            <div key={item} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13.5, color: "#5A527A" }}>
              <span style={{ color: "#9B7FE8", flexShrink: 0 }}>✓</span> {item}
            </div>
          ))}
        </div>
      </GlassCard>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════
   STEP: RESULTS
════════════════════════════════════════════════════════════════ */
function ResultsStep({
  analysis, policies, recs, totalPremium, deletingId, onDelete, onReimport, navigate,
}: {
  analysis: InsuranceAnalysisResponse["data"]["analysis"] | null | undefined;
  policies: InsurancePolicyDTO[];
  recs: InsuranceAnalysisResponse["data"]["recommendations"];
  totalPremium: number;
  deletingId: string | null;
  onDelete: (id: string) => void;
  onReimport: () => void;
  navigate: ReturnType<typeof useNavigate>;
}) {
  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 32 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
            <span style={{ fontSize: 22 }}>🛡️</span>
            <h1 style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: "clamp(20px, 3vw, 26px)", fontWeight: 700, color: "#1F1F1F", margin: 0, letterSpacing: "-0.03em" }}>
              ניתוח הביטוח שלך
            </h1>
          </div>
          <div style={{ fontSize: 14, color: "#7C6FA0" }}>
            {policies.length} פוליסות פעילות · עלות חודשית {fmt(totalPremium)}
          </div>
        </div>
        <button
          onClick={onReimport}
          style={{ display: "flex", alignItems: "center", gap: 7, padding: "10px 18px", borderRadius: 12, background: "rgba(255,255,255,0.8)", color: "#7B5EA7", border: "1px solid rgba(155,127,232,0.30)", cursor: "pointer", fontFamily: "inherit", fontWeight: 700, fontSize: 13.5 }}
        >
          <RefreshCw size={13} /> עדכן דוח
        </button>
      </div>

      {/* KPI cards */}
      {analysis && (
        <section style={{ marginBottom: 36 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 14 }}>
            <StatCard icon="💸" label="הוצאה חודשית" value={fmt(totalPremium)} sub="כל הפוליסות" accent="#7B5EA7" />
            <StatCard icon="♻️" label="בזבוז מכפילויות" value={fmt(analysis.totalMonthlyWaste)} sub="לחודש" accent="#DC2626" trend={analysis.totalMonthlyWaste > 0 ? "down" : "flat"} />
            <StatCard icon="💰" label="חיסכון שנתי" value={fmt(analysis.savings.annualSavings)} accent="#059669" trend="up" />
            <StatCard icon="📋" label="פוליסות פעילות" value={policies.length.toString()} accent="#9B7FE8" />
            {analysis.missingCoverage.length > 0 && (
              <StatCard icon="⚠️" label="כיסויים חסרים" value={analysis.missingCoverage.length.toString()} accent="#D97706" />
            )}
          </div>
        </section>
      )}

      {/* Duplicate alerts */}
      {analysis && analysis.duplicates.length > 0 && (
        <section style={{ marginBottom: 32 }}>
          <SectionHeader title="⚠️ כיסויים כפולים שזוהו" subtitle="פוליסות אשר ייתכן ומיותרות — שווה לבדוק" />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 14 }}>
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
          <SectionHeader title="כיסויים חסרים" subtitle="ביטוחים שכדאי לשקול בהתאם לפרופיל שלך" />
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

      {/* AI Recommendations */}
      {recs.length > 0 && (
        <section style={{ marginBottom: 36 }}>
          <SectionHeader title="✦ המלצות הסוכן" subtitle="פעולות מומלצות לשיפור הכיסוי וחיסכון בפרמיות" />
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {recs.slice(0, 6).map((rec, i) => (
              <GlassCard key={i} padding="md" style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
                <Badge variant={URGENCY_MAP[rec.urgency] ?? "neutral"}>
                  {rec.urgency === "high" ? "דחוף" : rec.urgency === "medium" ? "מומלץ" : "לידיעה"}
                </Badge>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: 14, color: "#1F1F1F", marginBottom: 3 }}>{rec.title}</div>
                  <div style={{ fontSize: 13, color: "#7C6FA0", lineHeight: 1.55 }}>{rec.reason}</div>
                  {rec.financialImpact && (
                    <div style={{ fontSize: 12.5, color: "#059669", fontWeight: 700, marginTop: 5 }}>{rec.financialImpact}</div>
                  )}
                </div>
              </GlassCard>
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
                      {p.provider ?? "—"}{p.policyNumber ? ` · ${p.policyNumber}` : ""}
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
                    onClick={() => void onDelete(p.id)}
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

      {/* AI Profile Insights */}
      <section style={{ marginBottom: 36 }}>
        <div style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 18, fontWeight: 700, color: "#1F1F1F", marginBottom: 4 }}>תובנות AI מותאמות לפרופיל שלך</div>
        <div style={{ fontSize: 13, color: "#7C6FA0", marginBottom: 14 }}>ניתוח הפוליסות שלך ביחס לגיל, מצב משפחתי, נכסים ועוד</div>
        <GlassCard padding="lg">
          <InsightsPanel agent="insurance" trigger={policies.length} />
        </GlassCard>
      </section>

      {/* AI Copilot CTA */}
      <GlassCard padding="lg" style={{ background: "linear-gradient(135deg, rgba(123,94,167,0.08), rgba(155,127,232,0.14))", border: "1px solid rgba(184,157,255,0.35)", textAlign: "center" }}>
        <div style={{ fontSize: 28, marginBottom: 10 }}>🤖</div>
        <h3 style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 22, fontWeight: 700, color: "#1F1F1F", margin: "0 0 8px" }}>
          שאל את סוכן הביטוח
        </h3>
        <p style={{ fontSize: 14.5, color: "#7C6FA0", margin: "0 0 20px", lineHeight: 1.65 }}>
          "האם אני צריך ביטוח חיים?", "כמה אני משלם יותר מהממוצע?", "מה הסיכון הכי גדול שלי?"
        </p>
        <button
          onClick={() => navigate(APP_ROUTES.copilot)}
          style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "12px 28px", borderRadius: 14, background: "linear-gradient(135deg, #7B5EA7, #6B4FA0)", color: "#fff", border: "none", cursor: "pointer", fontFamily: "inherit", fontWeight: 700, fontSize: 15, boxShadow: "0 4px 20px rgba(123,94,167,0.35)" }}
        >
          <Sparkles size={16} /> פתח שיחה עם הסוכן
        </button>
      </GlassCard>

      <button
        onClick={() => navigate(APP_ROUTES.findings)}
        style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", color: "#9B7FE8", fontWeight: 600, fontSize: 13.5, cursor: "pointer", fontFamily: "inherit", marginTop: 16 }}
      >
        כל הממצאים וההתראות <ChevronLeft size={14} />
      </button>
    </div>
  );
}
