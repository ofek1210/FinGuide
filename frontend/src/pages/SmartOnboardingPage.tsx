import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Check, ChevronRight } from "lucide-react";
import Loader from "../components/ui/Loader";
import { APP_ROUTES } from "../types/navigation";
import { useAuth } from "../auth/AuthProvider";
import {
  completeGeneralOnboarding,
  getGeneralOnboardingState,
  saveGeneralOnboardingAnswers,
  type SmartQuestionDTO,
} from "../api/smartOnboarding.api";

const SUGGESTED_CITIES = [
  "תל אביב-יפו", "ירושלים", "חיפה", "ראשון לציון", "פתח תקווה", "אשדוד",
  "נתניה", "באר שבע", "דימונה", "ערד", "אופקים", "נתיבות", "שדרות",
  "בני ברק", "חולון", "רמת גן", "הרצליה", "כפר סבא", "מודיעין", "רעננה",
];

const PREVIEW_QUESTIONS: SmartQuestionDTO[] = [
  { id: "general.age", type: "number", title: "בן כמה אתה?", required: true },
  {
    id: "general.gender",
    type: "single",
    title: "מה המין שלך?",
    sub: "משפיע על חישוב נקודות זיכוי במס.",
    options: [
      { value: "male", label: "זכר" },
      { value: "female", label: "נקבה" },
      { value: "other", label: "אחר / לא רוצה לציין" },
    ],
    required: true,
  },
  {
    id: "general.residenceCity",
    type: "text",
    title: "באיזו עיר אתה גר?",
    sub: "מגורים בפריפריה עשויים לזכות בהטבות מס.",
    placeholder: "לדוגמה: תל אביב-יפו, דימונה, באר שבע",
    required: true,
  },
  {
    id: "general.educationLevel",
    type: "single",
    title: "מה רמת ההשכלה שלך?",
    sub: "תואר ראשון מזכה בנקודת זיכוי במס.",
    options: [
      { value: "none", label: "ללא תואר אקדמי" },
      { value: "high_school", label: "תיכון / מקצועי" },
      { value: "student", label: "סטודנט/ית לתואר ראשון" },
      { value: "first_degree", label: "תואר ראשון" },
      { value: "second_degree", label: "תואר שני ומעלה" },
      { value: "vocational", label: "הכשרה מקצועית" },
    ],
    required: true,
  },
];

/**
 * Layer 1 — General smart onboarding (~1–2 minutes).
 * Visual language matches Hub / OnboardingPage (lav + ink).
 */
export default function SmartOnboardingPage({ previewMode = false }: { previewMode?: boolean }) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const editMode = searchParams.get("edit") === "1";
  const { refresh } = useAuth();

  const [loading, setLoading] = useState(!previewMode);
  const [questions, setQuestions] = useState<SmartQuestionDTO[]>(previewMode ? PREVIEW_QUESTIONS : []);
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [estimatedMinutes, setEstimatedMinutes] = useState(previewMode ? 2 : 1);

  useEffect(() => {
    if (document.getElementById("ob-progress-anim")) return;
    const st = document.createElement("style");
    st.id = "ob-progress-anim";
    st.textContent =
      "@keyframes obSheen{0%{transform:translateX(-160%) skewX(-18deg)}60%,100%{transform:translateX(260%) skewX(-18deg)}}@keyframes obHalo{0%{transform:scale(1);opacity:.7}70%,100%{transform:scale(2.7);opacity:0}}";
    document.head.appendChild(st);
  }, []);

  const load = useCallback(async () => {
    if (previewMode) return;
    setLoading(true);
    const res = await getGeneralOnboardingState();
    if (!res.ok || !res.data?.data) {
      setLoading(false);
      return;
    }
    const state = res.data.data;
    if (state.complete && !editMode) {
      navigate(APP_ROUTES.hub, { replace: true });
      return;
    }
    setQuestions(state.missingQuestions.length ? state.missingQuestions : []);
    setEstimatedMinutes(state.estimatedMinutes || 1);
    if (!state.missingQuestions.length && !editMode) {
      await completeGeneralOnboarding({});
      await refresh();
      navigate(APP_ROUTES.hub, { replace: true });
      return;
    }
    setLoading(false);
  }, [editMode, navigate, previewMode, refresh]);

  useEffect(() => {
    void load();
  }, [load]);

  const current = questions[step];
  const progress = questions.length ? (step + (done ? 1 : 0)) / questions.length : 0;

  const canContinue = useMemo(() => {
    if (!current) return false;
    const val = answers[current.id];
    if (current.type === "multi") return Array.isArray(val) && val.length > 0;
    if (current.type === "number") return val != null && String(val).trim() !== "";
    if (current.type === "yesno") return val === true || val === false;
    if (current.type === "text") return typeof val === "string" && val.trim().length > 0;
    return val != null && String(val).trim() !== "";
  }, [answers, current]);

  const handleNext = async () => {
    if (!current || !canContinue) return;
    if (previewMode) {
      if (step < questions.length - 1) {
        setStep(s => s + 1);
        return;
      }
      setDone(true);
      return;
    }
    setSaving(true);
    await saveGeneralOnboardingAnswers({ [current.id]: answers[current.id] });
    if (step < questions.length - 1) {
      setStep(s => s + 1);
      setSaving(false);
      return;
    }
    const res = await completeGeneralOnboarding(answers);
    setSaving(false);
    if (res.ok) {
      setDone(true);
      await refresh();
      setTimeout(() => navigate(APP_ROUTES.hub, { replace: true }), 1200);
    }
  };

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "var(--surface-page)" }}>
        <Loader />
        <p style={{ marginTop: 12, color: "var(--text-muted)", fontWeight: 600 }}>טוען שאלון...</p>
      </div>
    );
  }

  if (done) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          background: "var(--surface-page)",
          direction: "rtl",
          textAlign: "center",
          padding: 24,
        }}
      >
        <div>
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: "50%",
              margin: "0 auto 16px",
              background: "var(--mint-soft)",
              color: "var(--mint-ink)",
              display: "grid",
              placeItems: "center",
            }}
          >
            <Check size={28} strokeWidth={2.8} />
          </div>
          <h1 style={{ margin: 0, fontSize: 28, fontWeight: 900, color: "var(--ink)" }}>מעולה!</h1>
          <p style={{ color: "var(--text-muted)", marginTop: 8, fontWeight: 500 }}>
            הפרופיל שלך מוכן — ממשיכים ללוח הבקרה
          </p>
        </div>
      </div>
    );
  }

  if (!questions.length) {
    return (
      <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "var(--surface-page)", direction: "rtl" }}>
        <p style={{ color: "var(--text-muted)", fontWeight: 600 }}>אין שאלות נוספות — מעבירים אותך ללוח הבקרה...</p>
      </div>
    );
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        direction: "rtl",
        fontFamily: "var(--font-body)",
        background: "var(--surface-page)",
        display: "flex",
        flexDirection: "column",
        position: "relative",
      }}
    >
      <div
        style={{
          position: "fixed",
          inset: 0,
          backgroundImage: "radial-gradient(rgba(123,95,214,.06) 1px,transparent 1px)",
          backgroundSize: "22px 22px",
          pointerEvents: "none",
        }}
      />

      <header
        style={{
          position: "relative",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "20px 28px",
          gap: 16,
        }}
      >
        <div style={{ fontWeight: 900, fontSize: 15, color: "var(--ink)", letterSpacing: "-.02em" }}>FinGuide</div>
        <ProgressBar value={progress} label="היכרות קצרה" />
        <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text-muted)", whiteSpace: "nowrap" }}>
          ~{estimatedMinutes} דק׳ · {step + 1}/{questions.length}
        </span>
      </header>

      <main
        style={{
          position: "relative",
          flex: 1,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "20px 28px 48px",
        }}
      >
        <div style={{ width: "100%", maxWidth: 600, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 36 }}>
            <h1
              style={{
                fontSize: "clamp(26px,3.4vw,38px)",
                fontWeight: 900,
                letterSpacing: "-.03em",
                lineHeight: 1.12,
                margin: 0,
                color: "var(--ink)",
                textWrap: "balance",
              }}
            >
              {current.title}
            </h1>
            {current.sub ? (
              <p
                style={{
                  fontSize: 16,
                  color: "var(--text-muted)",
                  margin: "12px auto 0",
                  maxWidth: 460,
                  lineHeight: 1.6,
                  fontWeight: 500,
                }}
              >
                {current.sub}
              </p>
            ) : null}
          </div>

          <QuestionBody
            question={current}
            value={answers[current.id]}
            onChange={v => setAnswers(p => ({ ...p, [current.id]: v }))}
          />

          <div style={{ maxWidth: 600, margin: "34px auto 0" }}>
            <button
              type="button"
              disabled={!canContinue || saving}
              onClick={() => void handleNext()}
              style={{
                width: "100%",
                padding: "15px 24px",
                borderRadius: "var(--r-btn)",
                border: "none",
                cursor: !canContinue || saving ? "not-allowed" : "pointer",
                fontFamily: "inherit",
                fontWeight: 800,
                fontSize: 16,
                color: "#fff",
                background: canContinue ? "var(--ink)" : "var(--lav-300)",
                opacity: canContinue ? 1 : 0.7,
                boxShadow: canContinue ? "var(--shadow-ink)" : "none",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
              }}
            >
              {saving ? (
                "שומר..."
              ) : step < questions.length - 1 ? (
                <>
                  המשך <ChevronRight size={18} strokeWidth={2.6} />
                </>
              ) : (
                <>
                  סיום <Check size={18} strokeWidth={2.8} />
                </>
              )}
            </button>
          </div>

          <p
            style={{
              marginTop: 18,
              fontSize: 13,
              color: "var(--text-faint)",
              textAlign: "center",
              lineHeight: 1.6,
              fontWeight: 600,
            }}
          >
            נשאל רק מה שחסר — לא נחזור על מידע שכבר יש לנו מתלושים או פרופיל קיים.
          </p>
        </div>
      </main>
    </div>
  );
}

function ProgressBar({ value, label }: { value: number; label: string }) {
  const target = Math.round(value * 100);
  const glide = "0.9s cubic-bezier(.4,0,.15,1)";
  return (
    <div style={{ flex: 1, maxWidth: 540, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 9 }}>
        <span style={{ fontSize: 11.5, fontWeight: 800, letterSpacing: ".07em", color: "var(--lav-600)" }}>{label}</span>
        <span
          style={{
            fontSize: 13,
            fontWeight: 900,
            color: "var(--ink)",
            fontVariantNumeric: "tabular-nums",
            letterSpacing: "-.02em",
          }}
        >
          {target}%
        </span>
      </div>
      <div style={{ position: "relative", height: 10 }}>
        <div
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: 999,
            background: "var(--hair)",
            boxShadow: "inset 0 1px 2px rgba(70,40,130,.08)",
          }}
        />
        <div style={{ position: "absolute", inset: 0, borderRadius: 999, overflow: "hidden" }}>
          <div
            style={{
              position: "absolute",
              inset: 0,
              background:
                "linear-gradient(to left, var(--lav-500) 0%, var(--lav-600) 22%, var(--peach-ink) 60%, var(--mint-ink) 100%)",
            }}
          />
          <div
            style={{
              position: "absolute",
              insetBlock: -2,
              insetInlineStart: 0,
              width: "32%",
              background: "linear-gradient(90deg, transparent, rgba(255,255,255,.7), transparent)",
              animation: "obSheen 2.8s cubic-bezier(.5,0,.3,1) infinite",
            }}
          />
          <div
            style={{
              position: "absolute",
              insetBlock: 0,
              insetInlineEnd: 0,
              width: 100 - target + "%",
              background: "var(--hair)",
              transition: "width " + glide,
              willChange: "width",
            }}
          />
        </div>
        <div
          style={{
            position: "absolute",
            top: "50%",
            insetInlineStart: "calc(" + target + "% - 8px)",
            width: 16,
            height: 16,
            borderRadius: "50%",
            transform: "translateY(-50%)",
            background: "#fff",
            boxShadow: "0 0 0 3px var(--lav-500), 0 0 16px 3px rgba(155,127,232,.55)",
            opacity: target > 1 && target < 100 ? 1 : 0,
            transition: "inset-inline-start " + glide + ", opacity .3s",
            willChange: "inset-inline-start",
          }}
        >
          <span
            style={{
              position: "absolute",
              inset: 0,
              borderRadius: "50%",
              border: "2px solid var(--lav-500)",
              animation: "obHalo 2s ease-out infinite",
            }}
          />
        </div>
      </div>
    </div>
  );
}

function QuestionBody({
  question,
  value,
  onChange,
}: {
  question: SmartQuestionDTO;
  value: unknown;
  onChange: (v: unknown) => void;
}) {
  if (question.type === "number") {
    return (
      <input
        type="number"
        value={value != null ? String(value) : ""}
        onChange={e => onChange(e.target.value ? Number(e.target.value) : "")}
        placeholder="הזן/י גיל"
        style={fieldInputStyle}
      />
    );
  }

  if (question.type === "text") {
    const text = typeof value === "string" ? value : "";
    const isCity = question.id === "general.residenceCity";
    return (
      <div>
        <input
          type="text"
          value={text}
          onChange={e => onChange(e.target.value)}
          placeholder={question.placeholder || "הזן/י תשובה"}
          style={fieldInputStyle}
        />
        {isCity ? (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 14, justifyContent: "center" }}>
            {SUGGESTED_CITIES.map(city => {
              const on = text === city;
              return (
                <button
                  key={city}
                  type="button"
                  onClick={() => onChange(city)}
                  style={{
                    padding: "8px 14px",
                    borderRadius: "var(--r-pill)",
                    border: on ? "1.5px solid var(--lav-500)" : "1px solid var(--border-soft)",
                    background: on ? "var(--lav-100)" : "var(--card)",
                    color: on ? "var(--lav-700)" : "var(--text-body)",
                    fontWeight: 700,
                    fontSize: 13,
                    cursor: "pointer",
                    fontFamily: "inherit",
                  }}
                >
                  {city}
                </button>
              );
            })}
          </div>
        ) : null}
      </div>
    );
  }

  if (question.type === "yesno") {
    return (
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        {[true, false].map(v => (
          <OptionRow key={String(v)} label={v ? "כן" : "לא"} selected={value === v} onClick={() => onChange(v)} />
        ))}
      </div>
    );
  }

  if (question.type === "multi") {
    const selected = Array.isArray(value) ? (value as string[]) : [];
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {(question.options || []).map(opt => {
          const on = selected.includes(opt.value);
          return (
            <OptionRow
              key={opt.value}
              label={opt.label}
              selected={on}
              multi
              onClick={() => onChange(on ? selected.filter(x => x !== opt.value) : [...selected, opt.value])}
            />
          );
        })}
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {(question.options || []).map(opt => (
        <OptionRow
          key={opt.value}
          label={opt.label}
          selected={value === opt.value}
          onClick={() => onChange(opt.value)}
        />
      ))}
    </div>
  );
}

function OptionRow({
  label,
  selected,
  multi,
  onClick,
}: {
  label: string;
  selected: boolean;
  multi?: boolean;
  onClick: () => void;
}) {
  const [hover, setHover] = useState(false);
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 14,
        width: "100%",
        padding: "16px 18px",
        borderRadius: "var(--r-md)",
        border: selected ? "1.5px solid var(--lav-500)" : "1px solid var(--border-soft)",
        background: selected ? "var(--lav-100)" : hover ? "var(--surface-sunken)" : "var(--card)",
        boxShadow: selected ? "0 0 0 3px var(--accent-soft)" : "var(--shadow-soft)",
        cursor: "pointer",
        fontFamily: "inherit",
        textAlign: "right",
        transition: "border-color .15s ease, background .15s ease, box-shadow .15s ease",
      }}
    >
      <span
        style={{
          width: 22,
          height: 22,
          borderRadius: multi ? 6 : "50%",
          flex: "none",
          border: selected ? "none" : "1.5px solid var(--border-soft)",
          background: selected ? "var(--ink)" : "var(--card)",
          color: "#fff",
          display: "grid",
          placeItems: "center",
        }}
      >
        {selected ? <Check size={13} strokeWidth={3} /> : null}
      </span>
      <span style={{ flex: 1, fontWeight: 800, fontSize: 15.5, color: "var(--ink)" }}>{label}</span>
    </button>
  );
}

const fieldInputStyle: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  padding: "16px 18px",
  borderRadius: "var(--r-md)",
  border: "1.5px solid var(--border-soft)",
  background: "var(--card)",
  fontSize: 18,
  fontWeight: 800,
  fontFamily: "inherit",
  color: "var(--ink)",
  textAlign: "center",
  boxShadow: "var(--shadow-soft)",
  outline: "none",
};
