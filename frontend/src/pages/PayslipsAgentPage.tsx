/**
 * PayslipsAgentPage — 3-step wizard
 *
 * Step 1 (intake)  — personal profile form
 * Step 2 (upload)  — connect Gmail OR upload PDFs
 * Step 3 (results) — AI insights dashboard
 */
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Mail, Upload, FileText, TrendingUp, RefreshCw,
  ChevronLeft, Sparkles, CheckCircle, User, Users,
  GraduationCap, Home, Car, ArrowLeft, ArrowRight,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import PrivateTopbar from "../components/PrivateTopbar";
import AppFooter from "../components/AppFooter";
import GlassCard from "../components/ui/GlassCard";
import StatCard from "../components/ui/StatCard";
import SectionHeader from "../components/ui/SectionHeader";
import {
  getGmailStatus,
  connectGmail,
  syncGmail,
  type GmailIntegrationStatus,
} from "../api/integrations.api";
import { uploadDocument } from "../api/documents.api";
import { APP_ROUTES } from "../types/navigation";
import { usePayslipHistory } from "../hooks/usePayslipHistory";
import { apiJson } from "../api/client";

/* ── Types ───────────────────────────────────────────────────── */
interface IntakeData {
  firstName: string;
  age: string;
  gender: string;
  maritalStatus: string;
  children: string;
  education: string;
  city: string;
  smoker: string;
  ownsHome: string;
  hasMortgage: string;
  ownsCar: string;
  estimatedIncome: string;
  hasAnotherJob: string;
  changedEmployerThisYear: string;
  hasDegree: string;
  makesDonations: string;
  taxBenefits: string;
}

const EMPTY_INTAKE: IntakeData = {
  firstName: "", age: "", gender: "", maritalStatus: "",
  children: "0", education: "", city: "",
  smoker: "", ownsHome: "", hasMortgage: "", ownsCar: "",
  estimatedIncome: "", hasAnotherJob: "", changedEmployerThisYear: "",
  hasDegree: "", makesDonations: "", taxBenefits: "",
};

const STORAGE_KEY = "fg_payslip_intake";

/* ── Helpers ─────────────────────────────────────────────────── */
const fmt = (n: number | null | undefined) =>
  n != null ? `₪${Number(n).toLocaleString("he-IL")}` : "—";

const loadSavedIntake = (): IntakeData | null => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as IntakeData) : null;
  } catch { return null; }
};

/* ════════════════════════════════════════════════════════════════
   MAIN PAGE
════════════════════════════════════════════════════════════════ */
export default function PayslipsAgentPage() {
  const navigate = useNavigate();

  // Wizard step: "intake" | "upload" | "results"
  const saved = loadSavedIntake();
  const [step, setStep] = useState<"intake" | "upload" | "results">(
    saved ? "results" : "intake"
  );
  const [intake, setIntake] = useState<IntakeData>(saved ?? EMPTY_INTAKE);

  const handleIntakeDone = (data: IntakeData) => {
    setIntake(data);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    // Send to backend onboarding
    void apiJson("/api/onboarding", {
      method: "PUT",
      auth: true,
      body: JSON.stringify({
        data: {
          personal: {
            age: Number(data.age) || null,
            gender: data.gender || null,
            maritalStatus: data.maritalStatus || null,
            numberOfChildren: Number(data.children) || 0,
            city: data.city || null,
            isSmoker: data.smoker === "yes",
          },
          financial: {
            estimatedMonthlyIncome: Number(data.estimatedIncome) || null,
            hasAnotherJob: data.hasAnotherJob === "yes",
            changedEmployerThisYear: data.changedEmployerThisYear === "yes",
            makesDonations: data.makesDonations === "yes",
            hasTaxBenefits: data.taxBenefits === "yes",
          },
          assets: {
            ownsApartment: data.ownsHome === "yes",
            hasMortgage: data.hasMortgage === "yes",
            ownsCar: data.ownsCar === "yes",
          },
        },
      }),
    });
    setStep("upload");
  };

  return (
    <div style={{ minHeight: "100vh", background: "var(--lg-bg, #FAF7FF)", color: "#1F1F1F", fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" }}>
      <PrivateTopbar />

      <main style={{ maxWidth: 900, margin: "0 auto", padding: "36px 24px 72px", direction: "rtl" }}>
        {/* Step progress indicator */}
        <StepIndicator step={step} />

        {step === "intake" && (
          <IntakeWizard onDone={handleIntakeDone} defaultValues={intake} />
        )}
        {step === "upload" && (
          <UploadStep
            intake={intake}
            onComplete={() => setStep("results")}
            onBack={() => setStep("intake")}
          />
        )}
        {step === "results" && (
          <ResultsStep
            intake={intake}
            onEditProfile={() => setStep("intake")}
          />
        )}
      </main>
      <AppFooter variant="private" />
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════
   STEP INDICATOR
════════════════════════════════════════════════════════════════ */
function StepIndicator({ step }: { step: string }) {
  const steps = [
    { id: "intake", label: "פרטים אישיים" },
    { id: "upload", label: "העלאת תלושים" },
    { id: "results", label: "תובנות AI" },
  ];
  const idx = steps.findIndex(s => s.id === step);

  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 0, marginBottom: 40 }}>
      {steps.map((s, i) => {
        const done = i < idx;
        const active = i === idx;
        return (
          <div key={s.id} style={{ display: "flex", alignItems: "center" }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
              <div style={{
                width: 36, height: 36, borderRadius: "50%",
                background: done ? "linear-gradient(135deg, #9B7FE8, #7B5EA7)" : active ? "linear-gradient(135deg, #9B7FE8, #7B5EA7)" : "rgba(184,157,255,0.18)",
                border: `2px solid ${active ? "#9B7FE8" : done ? "#9B7FE8" : "rgba(184,157,255,0.30)"}`,
                display: "flex", alignItems: "center", justifyContent: "center",
                color: done || active ? "#fff" : "#A89CC8",
                fontWeight: 800, fontSize: 14,
                boxShadow: active ? "0 4px 16px rgba(155,127,232,0.35)" : "none",
                transition: "all 0.3s",
              }}>
                {done ? <CheckCircle size={16} /> : i + 1}
              </div>
              <span style={{ fontSize: 11.5, fontWeight: active ? 700 : 500, color: active ? "#9B7FE8" : done ? "#7B5EA7" : "#A89CC8", whiteSpace: "nowrap" }}>
                {s.label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div style={{ width: 80, height: 2, background: done ? "linear-gradient(90deg, #9B7FE8, #7B5EA7)" : "rgba(184,157,255,0.22)", margin: "0 8px", marginBottom: 20, borderRadius: 2 }} />
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════
   STEP 1 — INTAKE WIZARD
════════════════════════════════════════════════════════════════ */
function IntakeWizard({ onDone, defaultValues }: { onDone: (d: IntakeData) => void; defaultValues: IntakeData }) {
  const [data, setData] = useState<IntakeData>(defaultValues);
  const [page, setPage] = useState(0); // 0 = personal, 1 = financial/tax

  const set = (field: keyof IntakeData, value: string) =>
    setData(prev => ({ ...prev, [field]: value }));

  const isPage0Valid =
    data.firstName.trim().length > 0 &&
    data.age.trim().length > 0 &&
    data.gender !== "" &&
    data.maritalStatus !== "";

  return (
    <div>
      {/* Hero */}
      <div style={{
        borderRadius: 28, padding: "36px 40px 32px",
        background: "linear-gradient(135deg, #FAF7FF 0%, rgba(184,157,255,0.12) 100%)",
        border: "1px solid rgba(184,157,255,0.22)",
        boxShadow: "0 4px 28px rgba(155,127,232,0.10)",
        marginBottom: 28, position: "relative", overflow: "hidden",
      }}>
        <div style={{ position: "absolute", top: -30, left: -30, width: 160, height: 160, borderRadius: "50%", background: "radial-gradient(circle, rgba(184,157,255,0.18), transparent 70%)", pointerEvents: "none" }} />
        <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 12 }}>
          <div style={{ width: 52, height: 52, borderRadius: 16, background: "rgba(155,127,232,0.15)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24 }}>📄</div>
          <div>
            <h1 style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: "clamp(20px, 3vw, 28px)", fontWeight: 700, color: "#1F1F1F", margin: 0, letterSpacing: "-0.03em" }}>
              הסוכן האישי שלי לתלושי שכר
            </h1>
            <p style={{ fontSize: 14, color: "#7C6FA0", margin: "5px 0 0", lineHeight: 1.5 }}>
              כדי להפיק תובנות מדויקות — נדרש מידע אישי בסיסי. הנתונים מוצפנים ומאובטחים.
            </p>
          </div>
        </div>
      </div>

      {page === 0 ? (
        /* ── Page 0: Personal info ── */
        <GlassCard padding="lg" elevated>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 24 }}>
            <User size={18} color="#9B7FE8" />
            <h2 style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 20, fontWeight: 700, color: "#1F1F1F", margin: 0 }}>פרטים אישיים</h2>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }}>
            <FormField label="שם פרטי *">
              <input type="text" value={data.firstName} onChange={e => set("firstName", e.target.value)} placeholder="לדוגמה: נועה" style={inputStyle} />
            </FormField>

            <FormField label="גיל *">
              <input type="number" value={data.age} onChange={e => set("age", e.target.value)} placeholder="לדוגמה: 32" min={18} max={99} style={inputStyle} />
            </FormField>

            <FormField label="מין *">
              <SegmentedControl
                value={data.gender}
                onChange={v => set("gender", v)}
                options={[{ value: "female", label: "אישה" }, { value: "male", label: "גבר" }, { value: "other", label: "אחר" }]}
              />
            </FormField>

            <FormField label="מצב משפחתי *">
              <SegmentedControl
                value={data.maritalStatus}
                onChange={v => set("maritalStatus", v)}
                options={[
                  { value: "single", label: "רווק/ה" },
                  { value: "married", label: "נשוי/אה" },
                  { value: "divorced", label: "גרוש/ה" },
                  { value: "widowed", label: "אלמן/ה" },
                ]}
              />
            </FormField>

            <FormField label="מספר ילדים">
              <div style={{ display: "flex", gap: 8 }}>
                {["0", "1", "2", "3", "4", "5+"].map(n => (
                  <button key={n} type="button" onClick={() => set("children", n)} style={{ ...chipStyle, background: data.children === n ? "linear-gradient(135deg, #9B7FE8, #7B5EA7)" : "rgba(184,157,255,0.10)", color: data.children === n ? "#fff" : "#3D3553", border: `1px solid ${data.children === n ? "transparent" : "rgba(184,157,255,0.30)"}` }}>
                    {n}
                  </button>
                ))}
              </div>
            </FormField>

            <FormField label="השכלה">
              <select value={data.education} onChange={e => set("education", e.target.value)} style={inputStyle}>
                <option value="">בחר...</option>
                <option value="high_school">תיכון</option>
                <option value="certificate">תעודה מקצועית</option>
                <option value="bachelor">תואר ראשון</option>
                <option value="master">תואר שני</option>
                <option value="phd">דוקטורט</option>
                <option value="other">אחר</option>
              </select>
            </FormField>

            <FormField label="עיר מגורים">
              <input type="text" value={data.city} onChange={e => set("city", e.target.value)} placeholder="לדוגמה: תל אביב" style={inputStyle} />
            </FormField>

            <FormField label="הכנסה חודשית משוערת (₪)">
              <input type="number" value={data.estimatedIncome} onChange={e => set("estimatedIncome", e.target.value)} placeholder="לדוגמה: 12000" style={inputStyle} />
            </FormField>
          </div>

          <div style={{ marginTop: 28, display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14 }}>
            <YesNoField label="מעשן/ת?" icon="🚬" value={data.smoker} onChange={v => set("smoker", v)} />
            <YesNoField label="בעל/ת דירה?" icon={<Home size={16} />} value={data.ownsHome} onChange={v => set("ownsHome", v)} />
            <YesNoField label="יש משכנתא?" icon="🏦" value={data.hasMortgage} onChange={v => set("hasMortgage", v)} />
            <YesNoField label="יש רכב?" icon={<Car size={16} />} value={data.ownsCar} onChange={v => set("ownsCar", v)} />
          </div>

          <div style={{ marginTop: 28, display: "flex", justifyContent: "flex-start" }}>
            <button
              type="button"
              onClick={() => setPage(1)}
              disabled={!isPage0Valid}
              style={{ display: "flex", alignItems: "center", gap: 8, padding: "13px 28px", borderRadius: 14, background: isPage0Valid ? "linear-gradient(135deg, #9B7FE8, #7B5EA7)" : "rgba(184,157,255,0.30)", color: isPage0Valid ? "#fff" : "#A89CC8", border: "none", cursor: isPage0Valid ? "pointer" : "not-allowed", fontFamily: "inherit", fontWeight: 700, fontSize: 15, boxShadow: isPage0Valid ? "0 4px 20px rgba(155,127,232,0.35)" : "none", transition: "all 0.2s" }}
            >
              המשך <ArrowLeft size={15} />
            </button>
          </div>
        </GlassCard>
      ) : (
        /* ── Page 1: Tax/financial questions ── */
        <GlassCard padding="lg" elevated>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 24 }}>
            <GraduationCap size={18} color="#9B7FE8" />
            <h2 style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 20, fontWeight: 700, color: "#1F1F1F", margin: 0 }}>שאלות לצורך ניתוח מס</h2>
          </div>
          <p style={{ fontSize: 14, color: "#7C6FA0", margin: "0 0 24px", lineHeight: 1.6 }}>
            שאלות אלו עוזרות לסוכן ה-AI לזהות הזדמנויות להחזרי מס וניכויים.
          </p>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }}>
            <YesNoField label="יש לי עוד מקום עבודה?" icon={<Users size={16} />} value={data.hasAnotherJob} onChange={v => set("hasAnotherJob", v)} />
            <YesNoField label="החלפתי מעסיק השנה?" icon="🔄" value={data.changedEmployerThisYear} onChange={v => set("changedEmployerThisYear", v)} />
            <YesNoField label="יש לי תואר אקדמי?" icon={<GraduationCap size={16} />} value={data.hasDegree} onChange={v => set("hasDegree", v)} />
            <YesNoField label="אני תורם/ת לצדקה?" icon="❤️" value={data.makesDonations} onChange={v => set("makesDonations", v)} />
            <YesNoField label="זכאי/ת להטבות מס?" icon="💫" value={data.taxBenefits} onChange={v => set("taxBenefits", v)} description="נכות, עולה חדש/ה, תושב/ת פריפריה" />
          </div>

          <div style={{ marginTop: 28, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <button
              type="button"
              onClick={() => setPage(0)}
              style={{ display: "flex", alignItems: "center", gap: 7, padding: "11px 20px", borderRadius: 12, background: "none", border: "1px solid rgba(184,157,255,0.35)", color: "#7C6FA0", cursor: "pointer", fontFamily: "inherit", fontWeight: 600, fontSize: 14 }}
            >
              <ArrowRight size={14} /> חזרה
            </button>
            <button
              type="button"
              onClick={() => onDone(data)}
              style={{ display: "flex", alignItems: "center", gap: 8, padding: "13px 32px", borderRadius: 14, background: "linear-gradient(135deg, #9B7FE8, #7B5EA7)", color: "#fff", border: "none", cursor: "pointer", fontFamily: "inherit", fontWeight: 700, fontSize: 15, boxShadow: "0 4px 20px rgba(155,127,232,0.35)" }}
            >
              <Sparkles size={15} /> המשך לניתוח
            </button>
          </div>
        </GlassCard>
      )}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════
   STEP 2 — UPLOAD
════════════════════════════════════════════════════════════════ */
function UploadStep({ intake, onComplete, onBack }: { intake: IntakeData; onComplete: () => void; onBack: () => void }) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [gmail, setGmail] = useState<GmailIntegrationStatus | null>(null);
  const [gmailLoading, setGmailLoading] = useState(true);
  const [syncLoading, setSyncLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadedCount, setUploadedCount] = useState(0);
  const [msg, setMsg] = useState<{ type: "success" | "error" | "info"; text: string } | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    void getGmailStatus().then(res => {
      if (res.success && res.data) setGmail(res.data);
      setGmailLoading(false);
    });
  }, []);

  const handleGmailConnect = async () => {
    const res = await connectGmail();
    if (res.success && res.data?.authUrl) window.location.href = res.data.authUrl;
  };

  const handleGmailSync = async () => {
    setSyncLoading(true);
    const res = await syncGmail();
    setSyncLoading(false);
    if (res.success && res.data) {
      setMsg({ type: "success", text: `יובאו ${res.data.imported} תלושים חדשים. הסוכן מנתח...` });
      setTimeout(onComplete, 1500);
    }
  };

  const handleFileUpload = async (files: FileList) => {
    setUploading(true);
    let count = 0;
    for (const file of Array.from(files)) {
      if (!file.name.toLowerCase().endsWith(".pdf") &&
          !file.type.startsWith("image/")) {
        setMsg({ type: "error", text: "ניתן להעלות PDF, PNG או JPEG בלבד" });
        continue;
      }
      const fd = new FormData();
      fd.append("file", file);
      fd.append("category", "payslip");
      const res = await uploadDocument(fd);
      if (res.ok) count++;
    }
    setUploading(false);
    setUploadedCount(count);
    if (count > 0) {
      setMsg({ type: "success", text: `${count} תלוש/ים הועלו בהצלחה — הסוכן מנתח...` });
      setTimeout(onComplete, 1800);
    }
  };

  return (
    <div>
      {/* Welcome message with name */}
      <div style={{ textAlign: "center", marginBottom: 36 }}>
        <div style={{ fontSize: 36, marginBottom: 12 }}>👋</div>
        <h2 style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: "clamp(22px, 4vw, 32px)", fontWeight: 700, color: "#1F1F1F", margin: "0 0 10px", letterSpacing: "-0.03em" }}>
          {intake.firstName ? `תודה, ${intake.firstName}!` : "תודה!"}
        </h2>
        <p style={{ fontSize: 15, color: "#7C6FA0", margin: 0, lineHeight: 1.6 }}>
          עכשיו בחר/י איך להעביר לסוכן את תלושי השכר שלך.
        </p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 24 }}>

        {/* Gmail option */}
        <GlassCard padding="lg" elevated style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 16 }}>
            <div style={{ width: 44, height: 44, borderRadius: 13, background: "rgba(234,67,53,0.10)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <Mail size={21} color="#EA4335" />
            </div>
            <div>
              <div style={{ fontWeight: 800, fontSize: 16, color: "#1F1F1F" }}>חיבור Gmail</div>
              <div style={{ fontSize: 12, color: "#7C6FA0", marginTop: 2 }}>אוטומטי · מדויק יותר</div>
            </div>
          </div>

          <div style={{ flex: 1 }}>
            <div style={{ padding: "10px 14px", borderRadius: 12, background: "rgba(155,127,232,0.06)", border: "1px solid rgba(184,157,255,0.18)", marginBottom: 16 }}>
              <div style={{ fontSize: 12.5, color: "#7B5EA7", fontWeight: 700, marginBottom: 6 }}>✦ מומלץ — תוצאות הרבה יותר מדויקות</div>
              <p style={{ fontSize: 13, color: "#7C6FA0", margin: 0, lineHeight: 1.6 }}>
                הסוכן מייבא את כל תלושי השכר מהמייל שלך — אוטומטית, כל חודש.
              </p>
            </div>
            <ul style={{ margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 7 }}>
              {["גישה לתלושים בלבד, לא לאימיילים אחרים", "ייבוא אוטומטי כל חודש", "ניתן לנתק בכל רגע"].map(f => (
                <li key={f} style={{ display: "flex", gap: 8, fontSize: 13, color: "#5A527A", listStyle: "none" }}>
                  <span style={{ color: "#9B7FE8", flexShrink: 0 }}>✓</span> {f}
                </li>
              ))}
            </ul>
          </div>

          {gmailLoading ? (
            <div style={{ textAlign: "center", padding: "12px 0", color: "#9B7FE8", fontSize: 13 }}>בודק חיבור...</div>
          ) : gmail?.connected ? (
            <div style={{ marginTop: 16 }}>
              <div style={{ padding: "10px 14px", borderRadius: 11, background: "#ECFDF5", border: "1px solid rgba(5,150,105,0.15)", marginBottom: 12 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#059669" }}>✓ {gmail.gmailEmail}</div>
                <div style={{ fontSize: 12, color: "#6EE7B7", marginTop: 2 }}>מחובר · {gmail.importedCount} תלושים</div>
              </div>
              <button
                onClick={handleGmailSync}
                disabled={syncLoading}
                style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 7, padding: "11px", borderRadius: 12, background: "rgba(155,127,232,0.10)", color: "#9B7FE8", border: "1px solid rgba(155,127,232,0.25)", cursor: syncLoading ? "wait" : "pointer", fontFamily: "inherit", fontWeight: 700, fontSize: 14 }}
              >
                <RefreshCw size={14} style={{ animation: syncLoading ? "spin 0.8s linear infinite" : "none" }} />
                {syncLoading ? "מסנכרן..." : "סנכרן ונתח"}
              </button>
            </div>
          ) : (
            <button
              onClick={handleGmailConnect}
              style={{ marginTop: 16, width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "13px", borderRadius: 12, background: "linear-gradient(135deg, #9B7FE8, #7B5EA7)", color: "#fff", border: "none", cursor: "pointer", fontFamily: "inherit", fontWeight: 700, fontSize: 15, boxShadow: "0 4px 16px rgba(155,127,232,0.35)" }}
            >
              <Mail size={16} /> חבר Gmail ונתח
            </button>
          )}
        </GlassCard>

        {/* Manual upload option */}
        <GlassCard padding="lg" elevated style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 16 }}>
            <div style={{ width: 44, height: 44, borderRadius: 13, background: "rgba(155,127,232,0.10)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <Upload size={21} color="#9B7FE8" />
            </div>
            <div>
              <div style={{ fontWeight: 800, fontSize: 16, color: "#1F1F1F" }}>העלאה ידנית</div>
              <div style={{ fontSize: 12, color: "#7C6FA0", marginTop: 2 }}>PDF · PNG · JPEG</div>
            </div>
          </div>

          <p style={{ fontSize: 13.5, color: "#7C6FA0", lineHeight: 1.65, marginBottom: 16 }}>
            העלה עד 3 תלושי שכר אחרונים. ככל שתעלה יותר — הניתוח יהיה מדויק יותר.
          </p>

          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,image/png,image/jpeg"
            multiple
            onChange={e => { if (e.target.files?.length) void handleFileUpload(e.target.files); e.target.value = ""; }}
            style={{ display: "none" }}
          />

          <div
            onClick={() => !uploading && fileInputRef.current?.click()}
            onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={e => { e.preventDefault(); setIsDragging(false); if (e.dataTransfer.files.length) void handleFileUpload(e.dataTransfer.files); }}
            style={{
              flex: 1,
              border: `2px dashed ${isDragging ? "#9B7FE8" : "rgba(184,157,255,0.40)"}`,
              borderRadius: 16, padding: "24px 14px",
              textAlign: "center", cursor: uploading ? "wait" : "pointer",
              background: isDragging ? "rgba(155,127,232,0.06)" : "rgba(250,247,255,0.5)",
              transition: "all 0.2s", marginBottom: 14,
            }}
          >
            <div style={{ fontSize: 24, marginBottom: 8 }}>📎</div>
            {uploading ? (
              <div style={{ fontSize: 14, color: "#9B7FE8", fontWeight: 600 }}>מעלה ומעבד...</div>
            ) : (
              <>
                <div style={{ fontSize: 14, fontWeight: 600, color: "#1F1F1F", marginBottom: 3 }}>גרור קבצים לכאן</div>
                <div style={{ fontSize: 12.5, color: "#7C6FA0" }}>או לחץ לבחירה · עד 3 קבצים</div>
              </>
            )}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            {["תלוש אחד", "3 תלושים אחרונים"].map(label => (
              <button
                key={label}
                onClick={() => fileInputRef.current?.click()}
                style={{ padding: "10px", borderRadius: 12, background: "rgba(155,127,232,0.08)", color: "#7B5EA7", border: "1px solid rgba(184,157,255,0.30)", cursor: "pointer", fontFamily: "inherit", fontWeight: 700, fontSize: 13 }}
              >
                {label}
              </button>
            ))}
          </div>
        </GlassCard>
      </div>

      {msg && (
        <div style={{ padding: "14px 20px", borderRadius: 14, fontWeight: 600, fontSize: 14, background: msg.type === "error" ? "#FEF2F2" : msg.type === "success" ? "#ECFDF5" : "#F3EEFF", color: msg.type === "error" ? "#DC2626" : msg.type === "success" ? "#059669" : "#7B5EA7", border: `1px solid ${msg.type === "error" ? "rgba(220,38,38,0.2)" : msg.type === "success" ? "rgba(5,150,105,0.2)" : "rgba(155,127,232,0.25)"}`, marginBottom: 16, textAlign: "center" }}>
          {msg.text}
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <button onClick={onBack} style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", color: "#7C6FA0", cursor: "pointer", fontFamily: "inherit", fontWeight: 600, fontSize: 13.5 }}>
          <ArrowRight size={14} /> חזרה לפרטים
        </button>
        {uploadedCount > 0 && (
          <button onClick={onComplete} style={{ display: "flex", alignItems: "center", gap: 8, padding: "11px 24px", borderRadius: 12, background: "linear-gradient(135deg, #9B7FE8, #7B5EA7)", color: "#fff", border: "none", cursor: "pointer", fontFamily: "inherit", fontWeight: 700, fontSize: 14 }}>
            <Sparkles size={14} /> הצג תוצאות
          </button>
        )}
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════
   STEP 3 — RESULTS
════════════════════════════════════════════════════════════════ */
function ResultsStep({ intake, onEditProfile }: { intake: IntakeData; onEditProfile: () => void }) {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const { data: historyData } = usePayslipHistory();
  const payslips = historyData?.items ?? [];
  const latestPayslip = payslips[0] ?? null;
  const netSalary = latestPayslip?.netSalary ?? null;
  const grossSalary = latestPayslip?.grossSalary ?? null;
  const taxPaid = latestPayslip?.tax ?? null;
  const pensionPct = grossSalary && latestPayslip?.pensionEmployee
    ? ((latestPayslip.pensionEmployee / grossSalary) * 100).toFixed(1) + "%"
    : null;
  const avgNet = payslips.length > 1
    ? payslips.reduce((s, p) => s + (p.netSalary ?? 0), 0) / payslips.length
    : null;

  const handleFileUpload = async (file: File) => {
    setUploading(true);
    const fd = new FormData();
    fd.append("file", file);
    fd.append("category", "payslip");
    const res = await uploadDocument(fd);
    setUploading(false);
    setUploadMsg(res.ok ? "התלוש הועלה ועובד בהצלחה!" : "שגיאה בהעלאה");
  };

  return (
    <div>
      {/* Profile summary bar */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 28, padding: "14px 20px", borderRadius: 16, background: "rgba(255,255,255,0.75)", border: "1px solid rgba(184,157,255,0.20)", boxShadow: "0 2px 12px rgba(155,127,232,0.08)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 36, height: 36, borderRadius: "50%", background: "linear-gradient(135deg, #9B7FE8, #7B5EA7)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 800, fontSize: 14 }}>
            {intake.firstName?.charAt(0)?.toUpperCase() ?? "?"}
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 14, color: "#1F1F1F" }}>{intake.firstName || "משתמש"}</div>
            <div style={{ fontSize: 12, color: "#7C6FA0" }}>
              {[intake.age ? `גיל ${intake.age}` : null, intake.maritalStatus === "married" ? "נשוי/אה" : intake.maritalStatus === "single" ? "רווק/ה" : null, intake.children !== "0" ? `${intake.children} ילדים` : null, intake.city].filter(Boolean).join(" · ")}
            </div>
          </div>
        </div>
        <button onClick={onEditProfile} style={{ background: "none", border: "none", color: "#9B7FE8", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>עדכן פרופיל</button>
      </div>

      {/* KPI Cards */}
      {payslips.length > 0 ? (
        <section style={{ marginBottom: 36 }}>
          <SectionHeader
            title="תמונת השכר שלך"
            subtitle={`לפי תלוש ${latestPayslip?.periodLabel ?? ""}`}
            action={
              <button onClick={() => navigate(APP_ROUTES.payslipHistory)} style={{ display: "flex", alignItems: "center", gap: 5, background: "none", border: "none", color: "#9B7FE8", fontWeight: 600, fontSize: 13.5, cursor: "pointer", fontFamily: "inherit" }}>
                כל ההיסטוריה <ChevronLeft size={14} />
              </button>
            }
          />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 14 }}>
            <StatCard icon="💰" label="שכר נטו" value={fmt(netSalary)} accent="#059669" />
            <StatCard icon="📊" label="שכר ברוטו" value={fmt(grossSalary)} accent="#9B7FE8" />
            <StatCard icon="🏛️" label="מס הכנסה" value={fmt(taxPaid)} accent="#D97706" />
            {pensionPct && <StatCard icon="📈" label="הפרשת פנסיה" value={pensionPct} sub="מהברוטו" accent="#7B5EA7" />}
            {avgNet && <StatCard icon="📉" label="ממוצע נטו" value={fmt(avgNet)} sub={`${payslips.length} תלושים`} accent="#6B4FA0" />}
          </div>
        </section>
      ) : (
        /* No payslips yet — upload prompt */
        <GlassCard padding="lg" style={{ textAlign: "center", marginBottom: 36 }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>📋</div>
          <h3 style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 20, fontWeight: 700, color: "#1F1F1F", margin: "0 0 10px" }}>
            אין עדיין תלושים לניתוח
          </h3>
          <p style={{ fontSize: 14.5, color: "#7C6FA0", margin: "0 0 20px", lineHeight: 1.65 }}>
            העלה את התלוש הראשון שלך כדי שהסוכן יתחיל לנתח.
          </p>
          <input ref={fileInputRef} type="file" accept=".pdf,image/png,image/jpeg" onChange={e => { const f = e.target.files?.[0]; if (f) void handleFileUpload(f); e.target.value = ""; }} style={{ display: "none" }} />
          <div
            onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={e => { e.preventDefault(); setIsDragging(false); const f = e.dataTransfer.files?.[0]; if (f) void handleFileUpload(f); }}
            onClick={() => fileInputRef.current?.click()}
            style={{ border: `2px dashed ${isDragging ? "#9B7FE8" : "rgba(184,157,255,0.40)"}`, borderRadius: 16, padding: "24px", cursor: "pointer", marginBottom: 16 }}
          >
            <div style={{ fontSize: 14, fontWeight: 600, color: "#1F1F1F" }}>גרור תלוש לכאן</div>
            <div style={{ fontSize: 12.5, color: "#7C6FA0", marginTop: 4 }}>PDF · PNG · JPEG</div>
          </div>
          {uploadMsg && <div style={{ fontSize: 13, color: uploadMsg.includes("שגיאה") ? "#DC2626" : "#059669", fontWeight: 600, marginTop: 8 }}>{uploadMsg}</div>}
        </GlassCard>
      )}

      {/* Recent payslips */}
      {payslips.length > 0 && (
        <section style={{ marginBottom: 36 }}>
          <SectionHeader title="תלושים אחרונים" />
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {payslips.slice(0, 6).map(p => (
              <GlassCard
                key={p.id}
                padding="sm"
                onClick={() => navigate(`${APP_ROUTES.payslipHistory}/${p.id}`)}
                style={{ display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer" }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{ width: 38, height: 38, borderRadius: 11, background: "rgba(155,127,232,0.10)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <FileText size={17} color="#9B7FE8" />
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14, color: "#1F1F1F" }}>{p.periodLabel}</div>
                    <div style={{ fontSize: 12.5, color: "#7C6FA0" }}>ברוטו {fmt(p.grossSalary)}</div>
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                  <div style={{ textAlign: "left" }}>
                    <div style={{ fontWeight: 800, fontSize: 16, color: "#059669" }}>{fmt(p.netSalary)}</div>
                    <div style={{ fontSize: 11.5, color: "#7C6FA0" }}>נטו</div>
                  </div>
                  <TrendingUp size={16} color="#9B7FE8" />
                </div>
              </GlassCard>
            ))}
          </div>
        </section>
      )}

      {/* AI Copilot CTA */}
      <GlassCard padding="lg" style={{ background: "linear-gradient(135deg, rgba(155,127,232,0.08), rgba(184,157,255,0.14))", border: "1px solid rgba(184,157,255,0.35)", textAlign: "center" }}>
        <div style={{ fontSize: 28, marginBottom: 10 }}>🤖</div>
        <h3 style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 22, fontWeight: 700, color: "#1F1F1F", margin: "0 0 8px", letterSpacing: "-0.02em" }}>
          שאל את הסוכן שאלות
        </h3>
        <p style={{ fontSize: 14.5, color: "#7C6FA0", margin: "0 0 20px", lineHeight: 1.65 }}>
          "למה המשכורת ירדה?", "כמה מס שילמתי השנה?", "האם מגיע לי החזר מס?" — הסוכן יענה.
        </p>
        <button
          onClick={() => navigate(APP_ROUTES.copilot)}
          style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "12px 28px", borderRadius: 14, background: "linear-gradient(135deg, #9B7FE8, #7B5EA7)", color: "#fff", border: "none", cursor: "pointer", fontFamily: "inherit", fontWeight: 700, fontSize: 15, boxShadow: "0 4px 20px rgba(155,127,232,0.35)" }}
        >
          <Sparkles size={16} /> פתח שיחה עם הסוכן
        </button>
      </GlassCard>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════
   SMALL SHARED COMPONENTS
════════════════════════════════════════════════════════════════ */
function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ fontSize: 12.5, fontWeight: 600, color: "#7C6FA0", display: "block", marginBottom: 6 }}>{label}</label>
      {children}
    </div>
  );
}

function SegmentedControl({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }) {
  return (
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
      {options.map(o => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          style={{
            padding: "7px 13px", borderRadius: 10, fontSize: 13, fontFamily: "inherit",
            fontWeight: value === o.value ? 700 : 500,
            background: value === o.value ? "linear-gradient(135deg, #9B7FE8, #7B5EA7)" : "rgba(184,157,255,0.10)",
            color: value === o.value ? "#fff" : "#3D3553",
            border: `1px solid ${value === o.value ? "transparent" : "rgba(184,157,255,0.28)"}`,
            cursor: "pointer", transition: "all 0.15s",
          }}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function YesNoField({ label, icon, value, onChange, description }: { label: string; icon: React.ReactNode; value: string; onChange: (v: string) => void; description?: string }) {
  return (
    <div style={{ padding: "14px 16px", borderRadius: 16, background: "rgba(250,247,255,0.7)", border: "1px solid rgba(184,157,255,0.18)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <span style={{ fontSize: 16, color: "#9B7FE8" }}>{icon}</span>
        <div>
          <div style={{ fontSize: 13.5, fontWeight: 700, color: "#1F1F1F" }}>{label}</div>
          {description && <div style={{ fontSize: 11.5, color: "#7C6FA0", marginTop: 2 }}>{description}</div>}
        </div>
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        {[{ v: "yes", l: "כן" }, { v: "no", l: "לא" }].map(({ v, l }) => (
          <button
            key={v}
            type="button"
            onClick={() => onChange(v)}
            style={{
              flex: 1, padding: "7px", borderRadius: 10, fontSize: 13,
              fontFamily: "inherit", fontWeight: 700,
              background: value === v ? (v === "yes" ? "linear-gradient(135deg, #059669, #047857)" : "linear-gradient(135deg, #9B7FE8, #7B5EA7)") : "rgba(255,255,255,0.8)",
              color: value === v ? "#fff" : "#7C6FA0",
              border: `1px solid ${value === v ? "transparent" : "rgba(184,157,255,0.25)"}`,
              cursor: "pointer", transition: "all 0.15s",
            }}
          >
            {l}
          </button>
        ))}
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%", padding: "10px 14px", borderRadius: 12, fontSize: 14,
  background: "rgba(255,255,255,0.9)", border: "1px solid rgba(184,157,255,0.32)",
  color: "#1F1F1F", fontFamily: "inherit", boxSizing: "border-box",
  outline: "none", transition: "border-color 0.2s",
};

const chipStyle: React.CSSProperties = {
  padding: "6px 12px", borderRadius: 20, fontSize: 13,
  fontFamily: "inherit", fontWeight: 700,
  cursor: "pointer", transition: "all 0.15s",
};
