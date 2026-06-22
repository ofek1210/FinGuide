/**
 * PayslipsAgentPage — 3-step wizard
 *
 * Step 1 (intake)  — one-question-at-a-time personal profile
 * Step 2 (upload)  — connect Gmail OR upload PDFs
 * Step 3 (results) — AI insights dashboard
 */
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Mail, Upload, FileText, RefreshCw,
  Sparkles, CheckCircle, ArrowLeft, ArrowRight,
  Pause, Play, Search, History,
} from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import PrivateTopbar from "../components/PrivateTopbar";
import AppFooter from "../components/AppFooter";
import GlassCard from "../components/ui/GlassCard";
import StatCard from "../components/ui/StatCard";
import SectionHeader from "../components/ui/SectionHeader";
import { uploadDocument } from "../api/documents.api";
import { InsightsPanel } from "../components/ai/InsightsPanel";
import { syncGmail, getGmailStatus, type GmailIntegrationStatus } from "../api/integrations.api";
import { APP_ROUTES } from "../types/navigation";
import { apiJson } from "../api/client";
import { getUserProfile, type UserProfileResponseData } from "../api/userProfile.api";
import { completeOnboarding } from "../api/onboarding.api";
import {
  fetchLastPayslipAnalysis,
  type PayslipAnalysisSummary,
  type MoneyFlow,
} from "../utils/payslipAnalysisSummary";
import { formatCurrencyPositiveOrDash } from "../utils/formatters";

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

interface IntakeProgress {
  data: IntakeData;
  questionIdx: number;
  savedAt: string;
}

const STORAGE_KEY = "fg_payslip_intake_v2";
const PROFILE_DONE_KEY = "fg_payslip_profile_done";

type WizardStep = "profile-check" | "intake" | "upload" | "results";

function profileToIntake(p: UserProfileResponseData): IntakeData {
  const name = p.personal?.fullName || "";
  return {
    ...EMPTY_INTAKE,
    firstName: name.split(/\s+/)[0] || "",
    age: p.personal?.age != null ? String(p.personal.age) : "",
    gender: p.personal?.gender || "",
    maritalStatus: p.personal?.maritalStatus || "",
    children: p.personal?.childrenCount != null ? String(p.personal.childrenCount) : "0",
    smoker: p.personal?.isSmoker === true ? "yes" : p.personal?.isSmoker === false ? "no" : "",
    ownsHome: p.assets?.ownsApartment === true ? "yes" : p.assets?.ownsApartment === false ? "no" : "",
    hasMortgage: p.assets?.hasMortgage === true ? "yes" : p.assets?.hasMortgage === false ? "no" : "",
    ownsCar: p.assets?.ownsCar === true ? "yes" : p.assets?.ownsCar === false ? "no" : "",
    estimatedIncome:
      p.employment?.expectedMonthlyGross != null
        ? String(p.employment.expectedMonthlyGross)
        : "",
    hasAnotherJob:
      p.employment?.hasMultipleEmployers === true
        ? "yes"
        : p.employment?.hasMultipleEmployers === false
          ? "no"
          : "",
  };
}

function hasSavedProfile(p?: UserProfileResponseData | null): boolean {
  if (!p) return false;
  return Boolean(
    p.completedAt ||
      p.personal?.fullName ||
      (p.personal?.age != null && p.personal.age > 0),
  );
}

function buildProfilePatch(data: IntakeData) {
  return {
    personal: {
      fullName: data.firstName || null,
      age: Number(data.age) || null,
      gender: (data.gender || null) as "male" | "female" | "other" | null,
      maritalStatus: (data.maritalStatus || null) as "single" | "married" | "divorced" | "widowed" | "partnered" | null,
      childrenCount: Number(data.children) || 0,
      isSmoker: data.smoker === "yes",
    },
    employment: {
      expectedMonthlyGross: Number(data.estimatedIncome) || null,
      hasMultipleEmployers: data.hasAnotherJob === "yes",
    },
    assets: {
      ownsApartment: data.ownsHome === "yes",
      hasMortgage: data.hasMortgage === "yes",
      ownsCar: data.ownsCar === "yes",
    },
  };
}

/* ── Question definitions ──────────────────────────────────────── */
type QuestionType = "text" | "number" | "chips" | "yesno";

interface QuestionDef {
  id: keyof IntakeData;
  label: string;
  hint?: string;
  type: QuestionType;
  placeholder?: string;
  chips?: Array<{ value: string; label: string }>;
  required?: boolean;
}

const QUESTIONS: QuestionDef[] = [
  {
    id: "firstName",
    label: "מה שמך?",
    hint: "שמך יעזור לנו להתאים את הניתוח עבורך",
    type: "text",
    placeholder: "שם פרטי",
    required: true,
  },
  {
    id: "age",
    label: "מה גילך?",
    type: "number",
    placeholder: "לדוגמה: 32",
    required: true,
  },
  {
    id: "gender",
    label: "מה המין שלך?",
    type: "chips",
    chips: [{ value: "female", label: "אישה" }, { value: "male", label: "גבר" }, { value: "other", label: "אחר" }],
    required: true,
  },
  {
    id: "maritalStatus",
    label: "מה מצבך המשפחתי?",
    type: "chips",
    chips: [
      { value: "single", label: "רווק/ה" },
      { value: "married", label: "נשוי/אה" },
      { value: "divorced", label: "גרוש/ה" },
      { value: "widowed", label: "אלמן/ה" },
    ],
    required: true,
  },
  {
    id: "children",
    label: "כמה ילדים יש לך?",
    type: "chips",
    chips: [0, 1, 2, 3, 4].map(n => ({ value: String(n), label: String(n) })).concat([{ value: "5+", label: "5+" }]),
    required: false,
  },
  {
    id: "city",
    label: "באיזה עיר אתה/את גר/ה?",
    type: "text",
    placeholder: "לדוגמה: תל אביב",
    required: false,
  },
  {
    id: "estimatedIncome",
    label: "מה ההכנסה החודשית שלך (בערך)?",
    hint: "לא חייב מדויק — עוזר לנו לכייל את הניתוח",
    type: "number",
    placeholder: "₪ לדוגמה: 12000",
    required: false,
  },
  {
    id: "ownsHome",
    label: "האם אתה/את בעל/ת דירה?",
    type: "yesno",
    required: false,
  },
  {
    id: "hasMortgage",
    label: "האם יש לך משכנתא?",
    type: "yesno",
    required: false,
  },
  {
    id: "hasAnotherJob",
    label: "האם יש לך מקור הכנסה נוסף?",
    hint: "עבודה נוספת עשויה להשפיע על חישוב המס שלך",
    type: "yesno",
    required: false,
  },
  {
    id: "changedEmployerThisYear",
    label: "האם החלפת מעסיק השנה?",
    hint: "שינוי מעסיק עשוי ליצור הפרשי מס",
    type: "yesno",
    required: false,
  },
  {
    id: "makesDonations",
    label: "האם אתה/את תורם/ת לצדקה?",
    hint: "תרומות לגופים מוכרים מזכות בניכוי מס",
    type: "yesno",
    required: false,
  },
  {
    id: "taxBenefits",
    label: "האם אתה/את זכאי/ת להטבות מס מיוחדות?",
    hint: "נכות, עולה חדש/ה, תושב/ת פריפריה, חייל משוחרר",
    type: "yesno",
    required: false,
  },
];

/* ── Helpers ─────────────────────────────────────────────────── */
const fmt = formatCurrencyPositiveOrDash;

const loadSavedProgress = (): IntakeProgress | null => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as IntakeProgress) : null;
  } catch { return null; }
};

const saveProgress = (data: IntakeData, questionIdx: number) => {
  const progress: IntakeProgress = { data, questionIdx, savedAt: new Date().toISOString() };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
};

const clearProgress = () => localStorage.removeItem(STORAGE_KEY);

/* ════════════════════════════════════════════════════════════════
   MAIN PAGE
════════════════════════════════════════════════════════════════ */
export default function PayslipsAgentPage() {
  const [searchParams] = useSearchParams();

  // Handle Gmail OAuth callback — ?gmail=success
  const gmailResult = searchParams.get("gmail");

  const saved = loadSavedProgress();
  const [profileLoading, setProfileLoading] = useState(true);
  const [step, setStep] = useState<WizardStep>(() => {
    if (gmailResult === "success") return "results";
    if (saved?.questionIdx != null && saved.questionIdx > 0 && saved.questionIdx < QUESTIONS.length) return "intake";
    return "intake";
  });
  const [intake, setIntake] = useState<IntakeData>(saved?.data ?? EMPTY_INTAKE);
  const [resultsRefreshKey, setResultsRefreshKey] = useState(0);

  useEffect(() => {
    if (gmailResult === "success") {
      setResultsRefreshKey(k => k + 1);
    }
  }, [gmailResult]);

  useEffect(() => {
    let cancelled = false;
    void getUserProfile().then(res => {
      if (cancelled) return;
      if (res.success && res.data && hasSavedProfile(res.data)) {
        const fromProfile = profileToIntake(res.data);
        setIntake(prev => ({
          ...fromProfile,
          ...prev,
          firstName: prev.firstName || fromProfile.firstName,
        }));
        const profileKnown =
          localStorage.getItem(PROFILE_DONE_KEY) === "1" ||
          Boolean(res.data.completedAt) ||
          hasSavedProfile(res.data);
        if (res.data.completedAt) {
          localStorage.setItem(PROFILE_DONE_KEY, "1");
        }
        const midIntake = saved?.questionIdx != null && saved.questionIdx > 0 && saved.questionIdx < QUESTIONS.length;
        if (profileKnown && gmailResult !== "success" && !midIntake) {
          setStep(current => (current === "intake" ? "profile-check" : current));
        }
      }
      setProfileLoading(false);
    });
    return () => { cancelled = true; };
  }, [gmailResult, saved?.questionIdx]);

  const persistProfile = useCallback((data: IntakeData) => {
    const patch = buildProfilePatch(data);
    void apiJson("/api/onboarding", { method: "PUT", auth: true, body: { data: patch } });
    void completeOnboarding(patch);
    localStorage.setItem(PROFILE_DONE_KEY, "1");
  }, []);

  const handleIntakeDone = useCallback((data: IntakeData) => {
    setIntake(data);
    clearProgress();
    persistProfile(data);
    setStep("upload");
  }, [persistProfile]);

  const handleProfileContinue = useCallback(async () => {
    try {
      const data = await fetchLastPayslipAnalysis(3);
      if (data.count > 0) {
        setResultsRefreshKey(k => k + 1);
        setStep("results");
        return;
      }
    } catch {
      /* fall through to upload */
    }
    setStep("upload");
  }, []);

  return (
    <div style={{ minHeight: "100vh", background: "var(--lg-bg, #FAF7FF)", color: "#1F1F1F", fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" }}>
      <PrivateTopbar />

      <main style={{ maxWidth: 720, margin: "0 auto", padding: "36px 24px 72px", direction: "rtl" }}>
        <StepIndicator step={step} />

        {profileLoading && step !== "results" ? (
          <GlassCard padding="lg" style={{ textAlign: "center" }}>
            <div style={{ color: "#7C6FA0", fontSize: 14 }}>טוען את הפרופיל שלך...</div>
          </GlassCard>
        ) : null}

        {!profileLoading && step === "profile-check" && (
          <ProfileCheckStep
            intake={intake}
            onContinue={() => void handleProfileContinue()}
            onEdit={() => setStep("intake")}
          />
        )}
        {!profileLoading && step === "intake" && (
          <IntakeWizard
            onDone={handleIntakeDone}
            defaultValues={intake}
            savedProgress={saved}
            onSkipToResults={() => setStep("upload")}
          />
        )}
        {step === "upload" && (
          <UploadStep
            intake={intake}
            onComplete={(uploadedCount) => {
              if (uploadedCount > 0) setResultsRefreshKey(k => k + 1);
              setStep("results");
            }}
            onBack={() => setStep("intake")}
          />
        )}
        {step === "results" && (
          <ResultsStep
            intake={intake}
            refreshKey={resultsRefreshKey}
            onEditProfile={() => setStep("profile-check")}
            onAddMore={() => setStep("upload")}
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
  const mappedStep = step === "profile-check" ? "intake" : step;
  const idx = steps.findIndex(s => s.id === mappedStep);

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
                background: done || active ? "linear-gradient(135deg, #9B7FE8, #7B5EA7)" : "rgba(184,157,255,0.18)",
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
   PROFILE CHECK — returning users
════════════════════════════════════════════════════════════════ */
function ProfileCheckStep({
  intake, onContinue, onEdit,
}: {
  intake: IntakeData;
  onContinue: () => void | Promise<void>;
  onEdit: () => void;
}) {
  const [continuing, setContinuing] = useState(false);
  const marital =
    intake.maritalStatus === "married" ? "נשוי/אה"
      : intake.maritalStatus === "single" ? "רווק/ה"
        : intake.maritalStatus === "divorced" ? "גרוש/ה"
          : intake.maritalStatus === "widowed" ? "אלמן/ה"
            : null;

  return (
    <div>
      <GlassCard padding="lg" style={{ marginBottom: 24 }}>
        <div style={{ textAlign: "center", marginBottom: 20 }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>👋</div>
          <h2 style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 24, fontWeight: 700, margin: "0 0 8px", color: "#1F1F1F" }}>
            {intake.firstName ? `שלום ${intake.firstName}!` : "ברוך/ה הבא/ה חזרה"}
          </h2>
          <p style={{ fontSize: 14.5, color: "#7C6FA0", margin: 0, lineHeight: 1.65 }}>
            האתר זוכר את הפרטים שלך מהפעם הקודמת.
          </p>
        </div>

        <div style={{ padding: "14px 16px", borderRadius: 12, background: "rgba(155,127,232,0.08)", marginBottom: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#7B5EA7", marginBottom: 8 }}>הפרופיל השמור שלך</div>
          <div style={{ fontSize: 13.5, color: "#4A5568", lineHeight: 1.8 }}>
            {[
              intake.firstName && `שם: ${intake.firstName}`,
              intake.age && `גיל: ${intake.age}`,
              marital,
              intake.children && intake.children !== "0" ? `${intake.children} ילדים` : "ללא ילדים",
              intake.estimatedIncome && `שכר חודשי משוער: ₪${Number(intake.estimatedIncome).toLocaleString("he-IL")}`,
              intake.hasAnotherJob === "yes" ? "ריבוי מעסיקים: כן" : null,
            ].filter(Boolean).join(" · ")}
          </div>
        </div>

        <p style={{ fontSize: 15, fontWeight: 600, color: "#1F1F1F", textAlign: "center", margin: "0 0 20px", lineHeight: 1.6 }}>
          האם קיימים שינויים בפרטי המעסיק, בשכר החודשי שלך או בסטטוס שלך?
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <button
            onClick={() => {
              if (continuing) return;
              setContinuing(true);
              void Promise.resolve(onContinue()).finally(() => setContinuing(false));
            }}
            disabled={continuing}
            style={{ width: "100%", padding: "14px", borderRadius: 14, background: "linear-gradient(135deg, #9B7FE8, #7B5EA7)", color: "#fff", border: "none", cursor: continuing ? "wait" : "pointer", fontFamily: "inherit", fontWeight: 700, fontSize: 15, boxShadow: "0 4px 16px rgba(155,127,232,0.35)", opacity: continuing ? 0.85 : 1 }}
          >
            {continuing ? "טוען..." : "לא, הכל כמו קודם — המשך"}
          </button>
          <button
            onClick={onEdit}
            style={{ width: "100%", padding: "12px", borderRadius: 14, background: "rgba(255,255,255,0.9)", color: "#7B5EA7", border: "1px solid rgba(184,157,255,0.35)", cursor: "pointer", fontFamily: "inherit", fontWeight: 600, fontSize: 14 }}
          >
            כן, יש שינויים — עדכון פרטים
          </button>
        </div>
      </GlassCard>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════
   STEP 1 — ONE-QUESTION-AT-A-TIME INTAKE WIZARD
════════════════════════════════════════════════════════════════ */
function IntakeWizard({
  onDone, defaultValues, savedProgress, onSkipToResults,
}: {
  onDone: (d: IntakeData) => void;
  defaultValues: IntakeData;
  savedProgress: IntakeProgress | null;
  onSkipToResults: () => void;
}) {
  const navigate = useNavigate();
  const [data, setData] = useState<IntakeData>(defaultValues);
  const [qIdx, setQIdx] = useState<number>(() => {
    // Resume from saved progress if available (but not fully complete)
    if (savedProgress && savedProgress.questionIdx < QUESTIONS.length) {
      return savedProgress.questionIdx;
    }
    return 0;
  });
  const [animDir, setAnimDir] = useState<"forward" | "back">("forward");
  const [animKey, setAnimKey] = useState(0);

  const currentQ = QUESTIONS[qIdx];
  const progress = Math.round(((qIdx) / QUESTIONS.length) * 100);

  const set = (field: keyof IntakeData, value: string) =>
    setData(prev => ({ ...prev, [field]: value }));

  const currentValue = data[currentQ.id];
  const canAdvance = !currentQ.required || (currentValue !== "" && currentValue !== null && currentValue !== undefined);

  const goNext = useCallback(() => {
    const nextIdx = qIdx + 1;
    saveProgress(data, nextIdx);
    if (nextIdx >= QUESTIONS.length) {
      onDone(data);
      return;
    }
    setAnimDir("forward");
    setAnimKey(k => k + 1);
    setQIdx(nextIdx);
  }, [qIdx, data, onDone]);

  const goBack = useCallback(() => {
    if (qIdx === 0) return;
    setAnimDir("back");
    setAnimKey(k => k + 1);
    setQIdx(q => q - 1);
  }, [qIdx]);

  const handleSaveForLater = () => {
    saveProgress(data, qIdx);
    navigate(APP_ROUTES.hub);
  };

  // Auto-advance for chips/yesno after selection
  const handleChipSelect = (value: string) => {
    set(currentQ.id, value);
    // small delay for visual feedback before advancing
    setTimeout(() => {
      const nextIdx = qIdx + 1;
      saveProgress({ ...data, [currentQ.id]: value }, nextIdx);
      if (nextIdx >= QUESTIONS.length) {
        onDone({ ...data, [currentQ.id]: value });
        return;
      }
      setAnimDir("forward");
      setAnimKey(k => k + 1);
      setQIdx(nextIdx);
    }, 280);
  };

  // Handle Enter key
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && canAdvance) goNext();
  };

  return (
    <div>
      {/* Header */}
      <div style={{ textAlign: "center", marginBottom: 32 }}>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "rgba(155,127,232,0.10)", border: "1px solid rgba(155,127,232,0.22)", borderRadius: 20, padding: "4px 14px", marginBottom: 12 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: "#7B5EA7" }}>✨ כמה שאלות קצרות לפני הניתוח</span>
        </div>
        <h1 style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: "clamp(20px, 3vw, 26px)", fontWeight: 700, color: "#1F1F1F", margin: "0 0 8px", letterSpacing: "-0.03em" }}>
          הסוכן האישי שלי לתלושי שכר
        </h1>
        <p style={{ fontSize: 14, color: "#7C6FA0", margin: 0 }}>
          שאלה <strong style={{ color: "#9B7FE8" }}>{qIdx + 1}</strong> מתוך {QUESTIONS.length}
        </p>
      </div>

      {/* Progress bar */}
      <div style={{ height: 6, borderRadius: 3, background: "rgba(184,157,255,0.18)", marginBottom: 32, overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${progress}%`, background: "linear-gradient(90deg, #9B7FE8, #7B5EA7)", borderRadius: 3, transition: "width 0.4s ease" }} />
      </div>

      {/* Saved progress notice */}
      {savedProgress && qIdx > 0 && (
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 16px", borderRadius: 12, background: "rgba(155,127,232,0.08)", border: "1px solid rgba(155,127,232,0.18)", marginBottom: 20 }}>
          <Play size={14} color="#9B7FE8" />
          <span style={{ fontSize: 13, color: "#7B5EA7", fontWeight: 600 }}>
            ממשיך/ה מהמקום שנשמר אחרון · שמורה מ-{new Date(savedProgress.savedAt).toLocaleDateString("he-IL")}
          </span>
        </div>
      )}

      {/* Question Card */}
      <div
        key={animKey}
        style={{
          animation: `${animDir === "forward" ? "slideInFromRight" : "slideInFromLeft"} 0.25s ease-out`,
        }}
      >
        <GlassCard padding="lg" elevated>
          <div style={{ marginBottom: 28 }}>
            <h2 style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: "clamp(22px, 3.5vw, 30px)", fontWeight: 700, color: "#1F1F1F", margin: "0 0 8px", lineHeight: 1.25 }}>
              {currentQ.label}
            </h2>
            {currentQ.hint && (
              <p style={{ fontSize: 14, color: "#7C6FA0", margin: 0, lineHeight: 1.55 }}>{currentQ.hint}</p>
            )}
          </div>

          {/* Input */}
          <div style={{ marginBottom: 28 }}>
            {(currentQ.type === "text" || currentQ.type === "number") && (
              <input
                autoFocus
                type={currentQ.type}
                value={currentValue}
                onChange={e => set(currentQ.id, e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={currentQ.placeholder}
                style={{
                  width: "100%", padding: "14px 18px",
                  borderRadius: 14, fontSize: 18,
                  background: "rgba(255,255,255,0.92)",
                  border: "2px solid rgba(184,157,255,0.35)",
                  color: "#1F1F1F", fontFamily: "inherit",
                  boxSizing: "border-box", outline: "none",
                  transition: "border-color 0.2s",
                }}
                onFocus={e => (e.target.style.borderColor = "#9B7FE8")}
                onBlur={e => (e.target.style.borderColor = "rgba(184,157,255,0.35)")}
              />
            )}

            {currentQ.type === "chips" && currentQ.chips && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
                {currentQ.chips.map(chip => (
                  <button
                    key={chip.value}
                    type="button"
                    onClick={() => handleChipSelect(chip.value)}
                    style={{
                      padding: "12px 24px", borderRadius: 14, fontSize: 16,
                      fontFamily: "inherit", fontWeight: 700,
                      background: currentValue === chip.value ? "linear-gradient(135deg, #9B7FE8, #7B5EA7)" : "rgba(255,255,255,0.85)",
                      color: currentValue === chip.value ? "#fff" : "#3D3553",
                      border: `2px solid ${currentValue === chip.value ? "transparent" : "rgba(184,157,255,0.30)"}`,
                      cursor: "pointer", transition: "all 0.18s",
                      boxShadow: currentValue === chip.value ? "0 4px 16px rgba(155,127,232,0.30)" : "none",
                    }}
                  >
                    {chip.label}
                  </button>
                ))}
              </div>
            )}

            {currentQ.type === "yesno" && (
              <div style={{ display: "flex", gap: 14 }}>
                {[{ v: "yes", l: "✓ כן", color: "#059669" }, { v: "no", l: "✗ לא", color: "#9B7FE8" }].map(({ v, l, color }) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => handleChipSelect(v)}
                    style={{
                      flex: 1, padding: "16px", borderRadius: 16, fontSize: 18,
                      fontFamily: "inherit", fontWeight: 800,
                      background: currentValue === v ? (v === "yes" ? "linear-gradient(135deg, #059669, #047857)" : "linear-gradient(135deg, #9B7FE8, #7B5EA7)") : "rgba(255,255,255,0.85)",
                      color: currentValue === v ? "#fff" : color,
                      border: `2px solid ${currentValue === v ? "transparent" : `${color}40`}`,
                      cursor: "pointer", transition: "all 0.18s",
                      boxShadow: currentValue === v ? "0 6px 20px rgba(0,0,0,0.12)" : "none",
                    }}
                  >
                    {l}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Navigation */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            {/* Back */}
            <button
              type="button"
              onClick={goBack}
              disabled={qIdx === 0}
              style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", color: qIdx === 0 ? "transparent" : "#7C6FA0", cursor: qIdx === 0 ? "default" : "pointer", fontFamily: "inherit", fontWeight: 600, fontSize: 14 }}
            >
              <ArrowRight size={14} /> חזרה
            </button>

            {/* Skip / Next */}
            <div style={{ display: "flex", gap: 10 }}>
              {!currentQ.required && (currentQ.type === "text" || currentQ.type === "number") && (
                <button
                  type="button"
                  onClick={goNext}
                  style={{ padding: "10px 18px", borderRadius: 12, background: "none", border: "1px solid rgba(184,157,255,0.30)", color: "#7C6FA0", cursor: "pointer", fontFamily: "inherit", fontWeight: 600, fontSize: 14 }}
                >
                  דלג
                </button>
              )}
              {(currentQ.type === "text" || currentQ.type === "number") && (
                <button
                  type="button"
                  onClick={goNext}
                  disabled={!canAdvance}
                  style={{
                    display: "flex", alignItems: "center", gap: 7,
                    padding: "12px 24px", borderRadius: 14,
                    background: canAdvance ? "linear-gradient(135deg, #9B7FE8, #7B5EA7)" : "rgba(184,157,255,0.25)",
                    color: canAdvance ? "#fff" : "#A89CC8",
                    border: "none", cursor: canAdvance ? "pointer" : "not-allowed",
                    fontFamily: "inherit", fontWeight: 700, fontSize: 15,
                    boxShadow: canAdvance ? "0 4px 16px rgba(155,127,232,0.30)" : "none",
                    transition: "all 0.2s",
                  }}
                >
                  {qIdx === QUESTIONS.length - 1 ? "סיום" : "הבא"} <ArrowLeft size={14} />
                </button>
              )}
            </div>
          </div>
        </GlassCard>
      </div>

      {/* Bottom actions */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 20 }}>
        <button
          type="button"
          onClick={handleSaveForLater}
          style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", color: "#A89CC8", cursor: "pointer", fontFamily: "inherit", fontWeight: 600, fontSize: 13 }}
        >
          <Pause size={13} /> שמור ומלא מאוחר יותר
        </button>
        <button
          type="button"
          onClick={onSkipToResults}
          style={{ background: "none", border: "none", color: "#A89CC8", cursor: "pointer", fontFamily: "inherit", fontWeight: 600, fontSize: 13 }}
        >
          דלג לתוצאות ←
        </button>
      </div>

      {/* CSS for slide animation */}
      <style>{`
        @keyframes slideInFromRight {
          from { opacity: 0; transform: translateX(-24px); }
          to   { opacity: 1; transform: translateX(0); }
        }
        @keyframes slideInFromLeft {
          from { opacity: 0; transform: translateX(24px); }
          to   { opacity: 1; transform: translateX(0); }
        }
      `}</style>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════
   STEP 2 — UPLOAD
════════════════════════════════════════════════════════════════ */
function UploadStep({
  intake, onComplete, onBack,
}: {
  intake: IntakeData;
  onComplete: (uploadedCount: number) => void;
  onBack: () => void;
}) {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [gmail, setGmail] = useState<GmailIntegrationStatus | null>(null);
  const [gmailLoading, setGmailLoading] = useState(true);
  const [syncLoading, setSyncLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<string[]>([]);
  const [msg, setMsg] = useState<{ type: "success" | "error" | "info"; text: string } | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    void getGmailStatus().then(res => {
      if (res.success && res.data) setGmail(res.data);
      setGmailLoading(false);
    });
  }, []);

  // Navigate to Gmail integration page — OAuth callback happens there,
  // then it redirects back here with ?gmail=success
  const handleGmailConnect = () => {
    navigate(`${APP_ROUTES.integrationsEmail}?from=documents`);
  };

  const handleGmailSync = async () => {
    setSyncLoading(true);
    setMsg(null);
    const res = await syncGmail();
    setSyncLoading(false);
    if (res.success && res.data) {
      const count = res.data.imported;
      if (count > 0) {
        setMsg({ type: "success", text: `יובאו ${count} תלושים חדשים בהצלחה` });
      } else if (res.data.found === 0) {
        setMsg({ type: "info", text: "לא נמצאו תלושי שכר חדשים בתיבת הדואר" });
      } else {
        setMsg({ type: "info", text: `נמצאו ${res.data.found} קבצים, ${res.data.skippedDuplicates} כבר קיימים` });
      }
      if (count > 0) {
        setTimeout(() => onComplete(count), 1500);
      }
    } else {
      setMsg({ type: "error", text: res.message || "שגיאה בסנכרון Gmail" });
    }
  };

  const handleFileUpload = async (files: FileList) => {
    setUploading(true);
    setMsg(null);
    const newUploaded: string[] = [];
    const errors: string[] = [];

    for (const file of Array.from(files)) {
      if (!file.name.toLowerCase().endsWith(".pdf")) {
        errors.push(`${file.name}: רק קובצי PDF נתמכים`);
        continue;
      }
      const res = await uploadDocument(file, { category: "payslip" });
      if (res.success) {
        newUploaded.push(file.name);
      } else {
        errors.push(`${file.name}: ${res.message || "שגיאה בהעלאה"}`);
      }
    }

    setUploading(false);

    if (newUploaded.length > 0) {
      setUploadedFiles(prev => [...prev, ...newUploaded]);
      setMsg({
        type: "success",
        text: `${newUploaded.length} תלוש/ים הועלו בהצלחה ✓`,
      });
    }
    if (errors.length > 0) {
      setMsg({ type: "error", text: errors.join(" · ") });
    }
  };

  return (
    <div>
      {/* Welcome */}
      <div style={{ textAlign: "center", marginBottom: 36 }}>
        <div style={{ fontSize: 36, marginBottom: 12 }}>👋</div>
        <h2 style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: "clamp(22px, 4vw, 30px)", fontWeight: 700, color: "#1F1F1F", margin: "0 0 10px" }}>
          {intake.firstName ? `תודה, ${intake.firstName}!` : "מצוין!"}
        </h2>
        <p style={{ fontSize: 15, color: "#7C6FA0", margin: 0, lineHeight: 1.6 }}>
          עכשיו בחר/י איך להעביר לסוכן את תלושי השכר שלך.
          <br />
          <span style={{ fontSize: 13 }}>ניתן להשתמש בשתי הדרכים — כל אחת מוסיפה מידע לניתוח.</span>
        </p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 24 }}>

        {/* ── Gmail option ── */}
        <GlassCard padding="lg" elevated style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 16 }}>
            <div style={{ width: 44, height: 44, borderRadius: 13, background: "rgba(234,67,53,0.10)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <Mail size={21} color="#EA4335" />
            </div>
            <div>
              <div style={{ fontWeight: 800, fontSize: 16, color: "#1F1F1F" }}>חיבור Gmail</div>
              <div style={{ fontSize: 12, color: "#7C6FA0", marginTop: 2 }}>אוטומטי · הכי מדויק</div>
            </div>
            <span style={{ marginRight: "auto", fontSize: 11, fontWeight: 700, color: "#9B7FE8", background: "rgba(155,127,232,0.10)", border: "1px solid rgba(155,127,232,0.22)", borderRadius: 20, padding: "3px 10px" }}>מומלץ</span>
          </div>

          <div style={{ flex: 1 }}>
            <p style={{ fontSize: 13.5, color: "#7C6FA0", lineHeight: 1.65, marginBottom: 14 }}>
              הסוכן מייבא את כל תלושי השכר מהמייל — אוטומטית, כל חודש. גישה לתלושים בלבד.
            </p>
            <ul style={{ margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 7 }}>
              {["ייבוא אוטומטי כל חודש", "גישה לתלושים בלבד", "ניתן לנתק בכל רגע"].map(f => (
                <li key={f} style={{ display: "flex", gap: 8, fontSize: 13, color: "#5A527A", listStyle: "none" }}>
                  <span style={{ color: "#9B7FE8", flexShrink: 0 }}>✓</span> {f}
                </li>
              ))}
            </ul>
          </div>

          {gmailLoading ? (
            <div style={{ marginTop: 16, textAlign: "center", color: "#9B7FE8", fontSize: 13 }}>בודק חיבור...</div>
          ) : gmail?.connected ? (
            <div style={{ marginTop: 16 }}>
              <div style={{ padding: "10px 14px", borderRadius: 11, background: "#ECFDF5", border: "1px solid rgba(5,150,105,0.15)", marginBottom: 12 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#059669" }}>✓ {gmail.gmailEmail}</div>
                <div style={{ fontSize: 12, color: "#059669", marginTop: 2, opacity: 0.7 }}>מחובר · {gmail.importedCount} תלושים</div>
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
          ) : gmail?.oauthConfigured === false ? (
            <div style={{ marginTop: 16, padding: "12px 14px", borderRadius: 11, background: "#FFF7ED", border: "1px solid rgba(217,119,6,0.25)" }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#D97706", marginBottom: 4 }}>חיבור Gmail לא מוגדר בשרת</div>
              <div style={{ fontSize: 12, color: "#92400E", lineHeight: 1.55 }}>
                יש להוסיף GOOGLE_CLIENT_SECRET לקובץ backend/.env ולהפעיל מחדש את השרת.
              </div>
            </div>
          ) : (
            <button
              onClick={handleGmailConnect}
              style={{ marginTop: 16, width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "13px", borderRadius: 12, background: "linear-gradient(135deg, #9B7FE8, #7B5EA7)", color: "#fff", border: "none", cursor: "pointer", fontFamily: "inherit", fontWeight: 700, fontSize: 15, boxShadow: "0 4px 16px rgba(155,127,232,0.35)" }}
            >
              <Mail size={16} /> חבר Gmail
            </button>
          )}
        </GlassCard>

        {/* ── Manual upload option ── */}
        <GlassCard padding="lg" elevated style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 16 }}>
            <div style={{ width: 44, height: 44, borderRadius: 13, background: "rgba(155,127,232,0.10)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <Upload size={21} color="#9B7FE8" />
            </div>
            <div>
              <div style={{ fontWeight: 800, fontSize: 16, color: "#1F1F1F" }}>העלאה ידנית</div>
              <div style={{ fontSize: 12, color: "#7C6FA0", marginTop: 2 }}>PDF בלבד</div>
            </div>
          </div>

          <p style={{ fontSize: 13.5, color: "#7C6FA0", lineHeight: 1.65, marginBottom: 16 }}>
            העלה עד 3 תלושי שכר אחרונים. ככל שתעלה יותר — הניתוח יהיה מדויק יותר.
          </p>

          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf"
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
                <div style={{ fontSize: 12.5, color: "#7C6FA0" }}>או לחץ לבחירה</div>
              </>
            )}
          </div>

          {/* Uploaded files list */}
          {uploadedFiles.length > 0 && (
            <div style={{ marginBottom: 10 }}>
              {uploadedFiles.map(name => (
                <div key={name} style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 10px", borderRadius: 8, background: "#ECFDF5", marginBottom: 4 }}>
                  <CheckCircle size={13} color="#059669" />
                  <span style={{ fontSize: 12, color: "#059669", fontWeight: 600, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name}</span>
                </div>
              ))}
            </div>
          )}

          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            style={{ padding: "10px", borderRadius: 12, background: "rgba(155,127,232,0.08)", color: "#7B5EA7", border: "1px solid rgba(184,157,255,0.30)", cursor: uploading ? "wait" : "pointer", fontFamily: "inherit", fontWeight: 700, fontSize: 13 }}
          >
            {uploadedFiles.length > 0 ? `+ הוסף תלוש נוסף (${uploadedFiles.length} הועלו)` : "בחר קבצים להעלאה"}
          </button>
        </GlassCard>
      </div>

      {/* Message */}
      {msg && (
        <div style={{
          padding: "14px 20px", borderRadius: 14, fontWeight: 600, fontSize: 14, marginBottom: 16, textAlign: "center",
          background: msg.type === "error" ? "#FEF2F2" : msg.type === "success" ? "#ECFDF5" : "#F3EEFF",
          color: msg.type === "error" ? "#DC2626" : msg.type === "success" ? "#059669" : "#7B5EA7",
          border: `1px solid ${msg.type === "error" ? "rgba(220,38,38,0.2)" : msg.type === "success" ? "rgba(5,150,105,0.2)" : "rgba(155,127,232,0.25)"}`,
        }}>
          {msg.text}
        </div>
      )}

      {/* Nav */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <button onClick={onBack} style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", color: "#7C6FA0", cursor: "pointer", fontFamily: "inherit", fontWeight: 600, fontSize: 13.5 }}>
          <ArrowRight size={14} /> חזרה לפרטים
        </button>
        <button
          onClick={() => onComplete(uploadedFiles.length)}
          style={{
            display: "flex", alignItems: "center", gap: 8,
            padding: uploadedFiles.length > 0 ? "13px 28px" : "11px 22px",
            borderRadius: 14,
            background: uploadedFiles.length > 0 ? "linear-gradient(135deg, #9B7FE8, #7B5EA7)" : "rgba(184,157,255,0.18)",
            color: uploadedFiles.length > 0 ? "#fff" : "#A89CC8",
            border: "none", cursor: "pointer",
            fontFamily: "inherit", fontWeight: 700,
            fontSize: uploadedFiles.length > 0 ? 15 : 14,
            boxShadow: uploadedFiles.length > 0 ? "0 4px 20px rgba(155,127,232,0.35)" : "none",
            transition: "all 0.2s",
          }}
        >
          <Sparkles size={15} />
          {uploadedFiles.length > 0 ? "הצג תוצאות ניתוח" : "דלג לתוצאות"}
        </button>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════
   MONEY FLOW — לאן הולך הכסף מברוטו לנטו
════════════════════════════════════════════════════════════════ */
function MoneyFlowSection({ flow }: { flow: MoneyFlow }) {
  const pctNet = flow.avgGross > 0 ? Math.round((flow.avgNet / flow.avgGross) * 100) : 0;
  const pctWithheld = flow.avgGross > 0 ? Math.round((flow.totalWithheld / flow.avgGross) * 100) : 0;

  return (
    <section style={{ marginBottom: 36 }}>
      <SectionHeader
        title="לאן הולך הכסף?"
        subtitle={`מ-₪${flow.avgGross.toLocaleString("he-IL")} ברוטו → ₪${flow.avgNet.toLocaleString("he-IL")} נטו · ₪${flow.totalWithheld.toLocaleString("he-IL")} ניכויים (${pctWithheld}%)`}
      />
      <GlassCard padding="md">
        {/* Visual bar: gross → net */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, fontWeight: 700, marginBottom: 8 }}>
            <span style={{ color: "#9B7FE8" }}>ברוטו ₪{flow.avgGross.toLocaleString("he-IL")}</span>
            <span style={{ color: "#059669" }}>נטו ₪{flow.avgNet.toLocaleString("he-IL")} ({pctNet}%)</span>
          </div>
          <div style={{ height: 12, borderRadius: 8, background: "rgba(184,157,255,0.15)", overflow: "hidden", display: "flex" }}>
            <div style={{ width: `${pctNet}%`, background: "linear-gradient(90deg, #059669, #34D399)", borderRadius: "0 8px 8px 0" }} />
          </div>
          <div style={{ fontSize: 12, color: "#7C6FA0", marginTop: 6, textAlign: "center" }}>
            ₪{flow.totalWithheld.toLocaleString("he-IL")} ניכויים והפרשות מהברוטו
          </div>
        </div>

        {/* Itemised breakdown */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {flow.items.map(item => (
            <div key={item.label}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4 }}>
                <span style={{ fontSize: 14, fontWeight: 600, color: "#1F1F1F" }}>{item.label}</span>
                <span style={{ fontSize: 14, fontWeight: 800, color: "#7B5EA7" }}>
                  ₪{item.avgAmount.toLocaleString("he-IL")}
                  <span style={{ fontSize: 11.5, fontWeight: 500, color: "#7C6FA0", marginRight: 6 }}>
                    ({item.pctOfGross}% מהברוטו)
                  </span>
                </span>
              </div>
              <div style={{ height: 6, borderRadius: 4, background: "rgba(184,157,255,0.12)", overflow: "hidden" }}>
                <div
                  style={{
                    width: `${Math.min(item.pctOfGross, 100)}%`,
                    height: "100%",
                    background: "linear-gradient(90deg, #9B7FE8, #7B5EA7)",
                    borderRadius: 4,
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </GlassCard>
    </section>
  );
}

/* ════════════════════════════════════════════════════════════════
   STEP 3 — RESULTS
════════════════════════════════════════════════════════════════ */
function ResultsStep({
  intake, refreshKey, onEditProfile, onAddMore,
}: {
  intake: IntakeData;
  refreshKey: number;
  onEditProfile: () => void;
  onAddMore: () => void;
}) {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<PayslipAnalysisSummary | null>(null);

  const loadAnalysis = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchLastPayslipAnalysis(3);
      setSummary(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "שגיאה בטעינת התלושים");
      setSummary(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAnalysis();
  }, [refreshKey, loadAnalysis]);

  const handleFileUpload = async (file: File) => {
    setUploading(true);
    const res = await uploadDocument(file, { category: "payslip" });
    setUploading(false);
    if (res.success) {
      setUploadMsg("התלוש הועלה ועובד בהצלחה!");
      await loadAnalysis();
    } else {
      setUploadMsg(res.message || "שגיאה בהעלאה — נסה שוב");
    }
  };

  const rows = summary?.rows ?? [];
  const hasData = rows.length > 0;

  return (
    <div>
      {/* Profile summary bar */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 28, padding: "14px 20px", borderRadius: 16, background: "rgba(255,255,255,0.75)", border: "1px solid rgba(184,157,255,0.20)", boxShadow: "0 2px 12px rgba(155,127,232,0.08)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 36, height: 36, borderRadius: "50%", background: "linear-gradient(135deg, #9B7FE8, #7B5EA7)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 800, fontSize: 14 }}>
            {intake.firstName?.charAt(0)?.toUpperCase() ?? "✦"}
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 14, color: "#1F1F1F" }}>{intake.firstName || "תוצאות ניתוח"}</div>
            <div style={{ fontSize: 12, color: "#7C6FA0" }}>
              {[
                intake.age ? `גיל ${intake.age}` : null,
                intake.maritalStatus === "married" ? "נשוי/אה" : intake.maritalStatus === "single" ? "רווק/ה" : null,
                intake.children && intake.children !== "0" ? `${intake.children} ילדים` : null,
                intake.city,
              ].filter(Boolean).join(" · ")}
            </div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button onClick={() => navigate(APP_ROUTES.findings)} style={{ display: "flex", alignItems: "center", gap: 6, background: "rgba(155,127,232,0.10)", border: "1px solid rgba(184,157,255,0.30)", color: "#7B5EA7", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", borderRadius: 10, padding: "6px 12px" }}>
            <Search size={14} /> ממצאים
          </button>
          <button onClick={() => navigate(APP_ROUTES.payslipHistory)} style={{ display: "flex", alignItems: "center", gap: 6, background: "rgba(155,127,232,0.10)", border: "1px solid rgba(184,157,255,0.30)", color: "#7B5EA7", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", borderRadius: 10, padding: "6px 12px" }}>
            <History size={14} /> היסטוריית תלושים
          </button>
          <button onClick={onAddMore} style={{ background: "none", border: "1px solid rgba(184,157,255,0.30)", color: "#9B7FE8", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", borderRadius: 10, padding: "6px 12px" }}>+ הוסף תלושים</button>
          <button onClick={onEditProfile} style={{ background: "none", border: "none", color: "#A89CC8", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>עדכן פרופיל</button>
        </div>
      </div>

      {/* Loading state */}
      {loading ? (
        <GlassCard padding="lg" style={{ textAlign: "center", marginBottom: 36 }}>
          <div style={{ fontSize: 28, marginBottom: 8 }}>⏳</div>
          <div style={{ color: "#7C6FA0", fontSize: 14 }}>טוען 3 תלושים אחרונים ומפעיל ניתוח AI...</div>
        </GlassCard>
      ) : error ? (
        <GlassCard padding="lg" style={{ textAlign: "center", marginBottom: 36 }}>
          <div style={{ fontSize: 28, marginBottom: 8 }}>⚠️</div>
          <div style={{ color: "#DC2626", fontSize: 14, marginBottom: 12 }}>{error}</div>
          <button
            onClick={() => void loadAnalysis()}
            style={{ padding: "10px 20px", borderRadius: 10, background: "#9B7FE8", color: "#fff", border: "none", cursor: "pointer", fontFamily: "inherit", fontWeight: 600 }}
          >
            נסה שוב
          </button>
        </GlassCard>
      ) : hasData && summary ? (
        <>
          {/* KPI Cards — ממוצע 3 תלושים אחרונים */}
          <section style={{ marginBottom: 36 }}>
            <SectionHeader
              title="תמונת השכר שלך"
              subtitle={`ממוצע ${summary.count} תלושים אחרונים · ברוטו ₪${summary.avgGross?.toLocaleString("he-IL") ?? "—"} → נטו ₪${summary.avgNet?.toLocaleString("he-IL") ?? "—"}`}
            />
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 14 }}>
              <StatCard icon="💰" label="ממוצע נטו" value={fmt(summary.avgNet)} accent="#059669" />
              <StatCard icon="📊" label="ממוצע ברוטו" value={fmt(summary.avgGross)} accent="#9B7FE8" />
              <StatCard icon="🏛️" label="ממוצע מס הכנסה" value={fmt(summary.avgTax)} accent="#D97706" />
              <StatCard icon="🏥" label="ביטוח לאומי" value={fmt(summary.avgNationalInsurance)} accent="#6366F1" />
              <StatCard icon="🏦" label="פנסיה (עובד)" value={fmt(summary.avgPensionEmployee)} accent="#7B5EA7" />
              <StatCard icon="📚" label="קרן השתלמות" value={fmt(summary.avgStudyFundEmployee)} accent="#EC4899" />
              <StatCard icon="🏖️" label="ימי חופשה" value={summary.avgVacationDays != null ? String(summary.avgVacationDays) : "—"} accent="#059669" />
              <StatCard icon="🤒" label="ימי מחלה" value={summary.avgSickDays != null ? String(summary.avgSickDays) : "—"} accent="#D97706" />
            </div>
          </section>

          {/* לאן הולך הכסף? */}
          {summary.moneyFlow && (
            <MoneyFlowSection flow={summary.moneyFlow} />
          )}

          {/* Monthly breakdown */}
          {summary.breakdown.length > 0 && !summary.moneyFlow && (
            <section style={{ marginBottom: 36 }}>
              <SectionHeader title="פירוט ניכויים והפרשות" subtitle="ממוצע חודשי לפי 3 התלושים האחרונים" />
              <GlassCard padding="md">
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {summary.breakdown.map(item => (
                    <div key={item.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: "1px solid rgba(184,157,255,0.15)" }}>
                      <span style={{ fontSize: 14, color: "#4A5568" }}>{item.label}</span>
                      <span style={{ fontSize: 14, fontWeight: 700, color: "#1F1F1F" }}>{fmt(item.avgAmount)}</span>
                    </div>
                  ))}
                </div>
              </GlassCard>
            </section>
          )}

          {/* Last 3 payslips */}
          <section style={{ marginBottom: 36 }}>
            <SectionHeader title={`${summary.count} תלושים אחרונים`} />
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {rows.map(p => (
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
                      <div style={{ fontWeight: 700, fontSize: 14, color: "#1F1F1F" }}>{p.displayLabel}</div>
                      <div style={{ fontSize: 12.5, color: "#7C6FA0" }}>
                        ברוטו {fmt(p.grossSalary)} · {p.employerName || "מעסיק"}
                      </div>
                    </div>
                  </div>
                  <div style={{ textAlign: "left" }}>
                    <div style={{ fontWeight: 800, fontSize: 16, color: "#059669" }}>{fmt(p.netSalary)}</div>
                    <div style={{ fontSize: 11.5, color: "#7C6FA0" }}>נטו</div>
                  </div>
                </GlassCard>
              ))}
            </div>
          </section>
        </>
      ) : (
        /* No payslips yet */
        <GlassCard padding="lg" style={{ textAlign: "center", marginBottom: 36 }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>{refreshKey > 0 ? "⏳" : "📋"}</div>
          <h3 style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 20, fontWeight: 700, color: "#1F1F1F", margin: "0 0 10px" }}>
            {refreshKey > 0 ? "מעבד את התלושים שהעלית" : "אין עדיין תלושים לניתוח"}
          </h3>
          <p style={{ fontSize: 14.5, color: "#7C6FA0", margin: "0 0 20px", lineHeight: 1.65 }}>
            {refreshKey > 0
              ? "התלושים הועלו בהצלחה. אם הנתונים לא מופיעים — לחצי רענון או המתיני רגע לסיום העיבוד."
              : "העלה את התלוש הראשון שלך כדי שהסוכן יתחיל לנתח."}
          </p>
          {refreshKey > 0 && (
            <button
              onClick={() => void loadAnalysis()}
              style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "11px 22px", borderRadius: 12, background: "rgba(155,127,232,0.12)", color: "#7B5EA7", border: "1px solid rgba(184,157,255,0.35)", cursor: "pointer", fontFamily: "inherit", fontWeight: 700, fontSize: 14, marginBottom: 12 }}
            >
              <RefreshCw size={14} /> רענן תוצאות
            </button>
          )}
          <input ref={fileInputRef} type="file" accept=".pdf"
            onChange={e => { const f = e.target.files?.[0]; if (f) void handleFileUpload(f); e.target.value = ""; }}
            style={{ display: "none" }}
          />
          <div
            onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={e => { e.preventDefault(); setIsDragging(false); const f = e.dataTransfer.files?.[0]; if (f) void handleFileUpload(f); }}
            onClick={() => fileInputRef.current?.click()}
            style={{ border: `2px dashed ${isDragging ? "#9B7FE8" : "rgba(184,157,255,0.40)"}`, borderRadius: 16, padding: "24px", cursor: uploading ? "wait" : "pointer", marginBottom: 12 }}
          >
            {uploading ? (
              <div style={{ fontSize: 14, color: "#9B7FE8", fontWeight: 600 }}>מעלה...</div>
            ) : (
              <>
                <div style={{ fontSize: 14, fontWeight: 600, color: "#1F1F1F" }}>גרור תלוש לכאן</div>
                <div style={{ fontSize: 12.5, color: "#7C6FA0", marginTop: 4 }}>PDF בלבד</div>
              </>
            )}
          </div>
          {uploadMsg && <div style={{ fontSize: 13, color: uploadMsg.includes("שגיאה") ? "#DC2626" : "#059669", fontWeight: 600 }}>{uploadMsg}</div>}
          <button onClick={onAddMore} style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "11px 22px", borderRadius: 12, background: "linear-gradient(135deg, #9B7FE8, #7B5EA7)", color: "#fff", border: "none", cursor: "pointer", fontFamily: "inherit", fontWeight: 700, fontSize: 14, marginTop: 8 }}>
            <Upload size={14} /> הוסף תלושים
          </button>
        </GlassCard>
      )}

      {/* AI Insights Panel */}
      {(hasData || summary?.moneyFlow) && (
        <section style={{ marginBottom: 36 }}>
          <SectionHeader title="תובנות AI" subtitle="מחקר מעמיק: מאיפה נעלם ההפרש בין ברוטו לנטו?" />
          <GlassCard padding="lg">
            <InsightsPanel agent="payslip" trigger={refreshKey + (summary?.count ?? 0)} />
          </GlassCard>
        </section>
      )}

      {/* AI Copilot CTA */}
      <GlassCard padding="lg" style={{ background: "linear-gradient(135deg, rgba(155,127,232,0.08), rgba(184,157,255,0.14))", border: "1px solid rgba(184,157,255,0.35)", textAlign: "center" }}>
        <div style={{ fontSize: 28, marginBottom: 10 }}>🤖</div>
        <h3 style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 22, fontWeight: 700, color: "#1F1F1F", margin: "0 0 8px" }}>
          שאל את הסוכן שאלות
        </h3>
        <p style={{ fontSize: 14.5, color: "#7C6FA0", margin: "0 0 20px", lineHeight: 1.65 }}>
          "למה המשכורת ירדה?", "כמה מס שילמתי?", "האם מגיע לי החזר מס?"
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
