import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Check, ChevronRight, Sparkles } from "lucide-react";
import Loader from "../components/ui/Loader";
import { APP_ROUTES } from "../types/navigation";
import { useAuth } from "../auth/AuthProvider";
import {
  completeGeneralOnboarding,
  getGeneralOnboardingState,
  saveGeneralOnboardingAnswers,
  type SmartQuestionDTO,
} from "../api/smartOnboarding.api";

/**
 * Layer 1 — General smart onboarding (~1 minute).
 * Only asks questions that are still missing from profile / inferred data.
 */
export default function SmartOnboardingPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const editMode = searchParams.get("edit") === "1";
  const { refreshAuth } = useAuth();

  const [loading, setLoading] = useState(true);
  const [questions, setQuestions] = useState<SmartQuestionDTO[]>([]);
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [estimatedMinutes, setEstimatedMinutes] = useState(1);

  const load = useCallback(async () => {
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
      await refreshAuth();
      navigate(APP_ROUTES.hub, { replace: true });
      return;
    }
    setLoading(false);
  }, [editMode, navigate, refreshAuth]);

  useEffect(() => { void load(); }, [load]);

  const current = questions[step];
  const progress = questions.length ? ((step + (done ? 1 : 0)) / questions.length) * 100 : 0;

  const canContinue = useMemo(() => {
    if (!current) return false;
    const val = answers[current.id];
    if (current.type === "multi") return Array.isArray(val) && val.length > 0;
    if (current.type === "number") return val != null && String(val).trim() !== "";
    if (current.type === "yesno") return val === true || val === false;
    return val != null && String(val).trim() !== "";
  }, [answers, current]);

  const handleNext = async () => {
    if (!current || !canContinue) return;
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
      await refreshAuth();
      setTimeout(() => navigate(APP_ROUTES.hub, { replace: true }), 1200);
    }
  };

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "var(--surface-page)" }}>
        <Loader label="טוען שאלון..." />
      </div>
    );
  }

  if (done) {
    return (
      <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "var(--surface-page)", direction: "rtl", textAlign: "center", padding: 24 }}>
        <div style={{ fontSize: 48, marginBottom: 12 }}>✓</div>
        <h1 style={{ margin: 0, fontSize: 28, fontWeight: 900 }}>מעולה!</h1>
        <p style={{ color: "var(--text-muted)", marginTop: 8 }}>הפרופיל שלך מוכן — ממשיכים ללוח הבקרה</p>
      </div>
    );
  }

  if (!questions.length) {
    return (
      <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "var(--surface-page)", direction: "rtl" }}>
        <p>אין שאלות נוספות — מעבירים אותך ללוח הבקרה...</p>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "var(--surface-page)", backgroundImage: "radial-gradient(rgba(255,216,77,.08) 1px,transparent 1px)", backgroundSize: "22px 22px", direction: "rtl", fontFamily: "var(--font-body)" }}>
      <header style={{ maxWidth: 640, margin: "0 auto", padding: "20px 24px 0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 8, fontWeight: 900, color: "var(--text-strong)" }}>
          <Sparkles size={18} /> FinGuide
        </div>
        <span style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 700 }}>~{estimatedMinutes} דק׳</span>
      </header>

      <main style={{ maxWidth: 640, margin: "0 auto", padding: "28px 24px 48px" }}>
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: "var(--butter-ink)", marginBottom: 8 }}>היכרות קצרה</div>
          <div style={{ height: 8, borderRadius: 99, background: "var(--surface-sunken)", overflow: "hidden" }}>
            <div style={{ width: `${progress}%`, height: "100%", background: "var(--butter)", transition: "width .3s ease" }} />
          </div>
          <div style={{ marginTop: 8, fontSize: 12, color: "var(--text-muted)" }}>{step + 1} מתוך {questions.length}</div>
        </div>

        <section style={{ background: "var(--card)", border: "2px solid var(--text-strong)", borderRadius: "var(--radius)", padding: "28px 24px", boxShadow: "var(--shadow-sticker)" }}>
          <h1 style={{ margin: "0 0 10px", fontSize: 26, fontWeight: 900, lineHeight: 1.35, color: "var(--text-strong)" }}>{current.title}</h1>
          {current.sub ? <p style={{ margin: "0 0 18px", color: "var(--text-muted)", lineHeight: 1.6 }}>{current.sub}</p> : null}

          <QuestionBody question={current} value={answers[current.id]} onChange={v => setAnswers(p => ({ ...p, [current.id]: v }))} />

          <button
            type="button"
            disabled={!canContinue || saving}
            onClick={() => void handleNext()}
            style={{
              marginTop: 24, width: "100%", padding: "14px 18px", borderRadius: "var(--r-md)",
              border: "2px solid var(--text-strong)", background: canContinue ? "var(--butter)" : "var(--surface-sunken)",
              fontWeight: 900, fontSize: 16, cursor: canContinue ? "pointer" : "not-allowed",
              display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8,
            }}
          >
            {saving ? "שומר..." : step < questions.length - 1 ? <>המשך <ChevronRight size={18} /></> : <>סיום <Check size={18} /></>}
          </button>
        </section>

        <p style={{ marginTop: 16, fontSize: 12, color: "var(--text-muted)", textAlign: "center", lineHeight: 1.6 }}>
          נשאל רק מה שחסר — לא נחזור על מידע שכבר יש לנו מתלושים, דוחות או פרופיל קיים.
        </p>
      </main>
    </div>
  );
}

function QuestionBody({ question, value, onChange }: { question: SmartQuestionDTO; value: unknown; onChange: (v: unknown) => void }) {
  if (question.type === "number") {
    return (
      <input type="number" value={value != null ? String(value) : ""} onChange={e => onChange(e.target.value ? Number(e.target.value) : "")} placeholder="הזן/י גיל" style={{ width: "100%", padding: "14px", borderRadius: "var(--r-md)", border: "1px solid var(--border-hair)", fontSize: 18, fontWeight: 800 }} />
    );
  }
  if (question.type === "yesno") {
    return (
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        {[true, false].map(v => (
          <button key={String(v)} type="button" onClick={() => onChange(v)} style={cardBtn(value === v)}>{v ? "כן" : "לא"}</button>
        ))}
      </div>
    );
  }
  if (question.type === "multi") {
    const selected = Array.isArray(value) ? value as string[] : [];
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {(question.options || []).map(opt => {
          const on = selected.includes(opt.value);
          return (
            <button key={opt.value} type="button" onClick={() => onChange(on ? selected.filter(x => x !== opt.value) : [...selected, opt.value])} style={cardBtn(on)}>
              {opt.label}
            </button>
          );
        })}
      </div>
    );
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {(question.options || []).map(opt => (
        <button key={opt.value} type="button" onClick={() => onChange(opt.value)} style={cardBtn(value === opt.value)}>{opt.label}</button>
      ))}
    </div>
  );
}

function cardBtn(active: boolean): React.CSSProperties {
  return {
    padding: "14px 16px",
    borderRadius: "var(--r-md)",
    border: active ? "2px solid var(--text-strong)" : "1px solid var(--border-hair)",
    background: active ? "var(--butter-soft)" : "var(--card)",
    fontWeight: 800,
    textAlign: "right",
    cursor: "pointer",
    fontSize: 15,
  };
}
