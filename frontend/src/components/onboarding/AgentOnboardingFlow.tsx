import { useMemo, useState } from "react";
import { Check, ChevronRight } from "lucide-react";
import type { SmartQuestionDTO } from "../../api/smartOnboarding.api";

export type AgentOnboardingFlowProps = {
  agentLabel: string;
  estimatedMinutes?: number;
  questions: SmartQuestionDTO[];
  onSkip: () => void | Promise<void>;
  onSubmit: (answers: Record<string, unknown>) => Promise<boolean>;
  variant?: "inline" | "modal";
};

export default function AgentOnboardingFlow({
  agentLabel,
  estimatedMinutes = 1,
  questions,
  onSkip,
  onSubmit,
  variant = "inline",
}: AgentOnboardingFlowProps) {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  const [saving, setSaving] = useState(false);

  const current = questions[step];
  const progress = questions.length ? ((step + 1) / questions.length) * 100 : 100;

  const canContinue = useMemo(() => {
    if (!current) return false;
    const val = answers[current.id];
    if (current.type === "multi") return Array.isArray(val) && val.length > 0;
    if (current.type === "number") return val != null && String(val).trim() !== "";
    if (current.type === "yesno") return val === true || val === false || val === "yes" || val === "no";
    return val != null && String(val).trim() !== "";
  }, [answers, current]);

  if (!questions.length || !current) return null;

  const setAnswer = (val: unknown) => {
    setAnswers(prev => ({ ...prev, [current.id]: val }));
  };

  const handleNext = async () => {
    if (!canContinue) return;
    if (step < questions.length - 1) {
      setStep(s => s + 1);
      return;
    }
    setSaving(true);
    const ok = await onSubmit(answers);
    setSaving(false);
    if (ok) {
      setStep(0);
      setAnswers({});
    }
  };

  const card = (
    <>
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 12, fontWeight: 800, color: "var(--butter-ink)", marginBottom: 8 }}>{agentLabel}</div>
        <div style={{ height: 8, borderRadius: 99, background: "var(--surface-sunken)", overflow: "hidden" }}>
          <div style={{ width: `${progress}%`, height: "100%", background: "var(--butter)", transition: "width .3s ease" }} />
        </div>
        <div style={{ marginTop: 8, fontSize: 12, color: "var(--text-muted)" }}>
          {step + 1} מתוך {questions.length} · ~{estimatedMinutes} דק׳
        </div>
      </div>

      <section style={{
        background: "var(--card)",
        border: "2px solid var(--text-strong)",
        borderRadius: "var(--radius)",
        padding: variant === "modal" ? "22px 24px" : "28px 24px",
        boxShadow: "var(--shadow-sticker)",
      }}>
        <h2 style={{ margin: "0 0 10px", fontSize: variant === "modal" ? 20 : 26, fontWeight: 900, lineHeight: 1.35, color: "var(--text-strong)" }}>
          {current.title}
        </h2>
        {current.sub ? <p style={{ margin: "0 0 18px", color: "var(--text-muted)", lineHeight: 1.6 }}>{current.sub}</p> : null}

        <QuestionBody question={current} value={answers[current.id]} onChange={setAnswer} />

        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, marginTop: 24, flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={() => void onSkip()}
            style={{ padding: "12px 14px", borderRadius: "var(--r-md)", border: "1px solid var(--border-hair)", background: "transparent", fontWeight: 700, cursor: "pointer", color: "var(--text-muted)" }}
          >
            דלג לעכשיו
          </button>
          <button
            type="button"
            disabled={!canContinue || saving}
            onClick={() => void handleNext()}
            style={{
              flex: 1, minWidth: 160, padding: "14px 18px", borderRadius: "var(--r-md)",
              border: "2px solid var(--text-strong)", background: canContinue ? "var(--butter)" : "var(--surface-sunken)",
              fontWeight: 900, fontSize: 16, cursor: canContinue ? "pointer" : "not-allowed",
              display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8,
            }}
          >
            {saving ? "שומר..." : step < questions.length - 1 ? <>המשך <ChevronRight size={18} /></> : <>סיום <Check size={18} /></>}
          </button>
        </div>
      </section>

      <p style={{ marginTop: 16, fontSize: 12, color: "var(--text-muted)", textAlign: "center", lineHeight: 1.6 }}>
        נשאל רק מה שחסר — לא נחזור על מידע שכבר יש לנו מתלושים, דוחות או פרופיל קיים.
      </p>
    </>
  );

  if (variant === "modal") {
    return (
      <div style={{ position: "fixed", inset: 0, zIndex: 200, background: "rgba(0,0,0,.45)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16, direction: "rtl" }}>
        <div style={{ width: "min(640px,100%)", maxHeight: "90vh", overflowY: "auto", direction: "rtl", fontFamily: "var(--font-body)" }}>
          {card}
        </div>
      </div>
    );
  }

  return (
    <div style={{ direction: "rtl", fontFamily: "var(--font-body)" }}>
      {card}
    </div>
  );
}

function QuestionBody({ question, value, onChange }: { question: SmartQuestionDTO; value: unknown; onChange: (v: unknown) => void }) {
  if (question.type === "number") {
    return (
      <input
        type="number"
        value={value != null ? String(value) : ""}
        onChange={e => onChange(e.target.value ? Number(e.target.value) : "")}
        placeholder="הזן/י מספר"
        style={{ width: "100%", padding: "14px", borderRadius: "var(--r-md)", border: "1px solid var(--border-hair)", fontSize: 18, fontWeight: 800 }}
      />
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
