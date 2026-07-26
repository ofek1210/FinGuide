import { useMemo, useState } from "react";
import { Check, ChevronRight } from "lucide-react";
import type { AgentId } from "../../api/smartOnboarding.api";
import type { SmartQuestionDTO } from "../../api/smartOnboarding.api";
import { getAgentOnboardingTheme } from "./agentOnboardingTheme";

export type AgentOnboardingFlowProps = {
  agentId: AgentId;
  agentLabel: string;
  estimatedMinutes?: number;
  questions: SmartQuestionDTO[];
  onSkip: () => void | Promise<void>;
  onSubmit: (answers: Record<string, unknown>) => Promise<boolean>;
};

export default function AgentOnboardingFlow({
  agentId,
  agentLabel,
  estimatedMinutes = 1,
  questions,
  onSkip,
  onSubmit,
}: AgentOnboardingFlowProps) {
  const theme = getAgentOnboardingTheme(agentId);
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

  return (
    <div style={{ direction: "rtl", fontFamily: "var(--font-body)" }}>
      <div style={{ marginBottom: 18 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
          <span style={{ fontSize: 12, fontWeight: 800, color: theme.accent }}>{agentLabel}</span>
          <span style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 600 }}>
            {step + 1} / {questions.length} · ~{estimatedMinutes} דק׳
          </span>
        </div>
        <div style={{ height: 6, borderRadius: 99, background: "var(--surface-sunken)", overflow: "hidden" }}>
          <div style={{ width: `${progress}%`, height: "100%", background: theme.accent, transition: "width .35s var(--ease)" }} />
        </div>
      </div>

      <section style={{
        background: "var(--card)",
        border: `1px solid ${theme.ring}`,
        borderRadius: "var(--radius)",
        padding: "28px 26px",
        boxShadow: "var(--shadow-card)",
      }}>
        <h2 style={{ margin: "0 0 10px", fontSize: "clamp(20px,2.6vw,26px)", fontWeight: 900, lineHeight: 1.35, color: "var(--text-strong)" }}>
          {current.title}
        </h2>
        {current.sub ? <p style={{ margin: "0 0 20px", color: "var(--text-muted)", lineHeight: 1.6, fontSize: 14.5 }}>{current.sub}</p> : null}

        <QuestionBody question={current} value={answers[current.id]} onChange={setAnswer} accent={theme.accent} soft={theme.soft} ring={theme.ring} />

        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, marginTop: 26, flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={() => void onSkip()}
            style={{
              padding: "12px 16px", borderRadius: "var(--r-md)", border: "1px solid var(--border-hair)",
              background: "transparent", fontWeight: 700, cursor: "pointer", color: "var(--text-muted)",
              fontFamily: "inherit", fontSize: 14,
            }}
          >
            דלג לעכשיו
          </button>
          <button
            type="button"
            disabled={!canContinue || saving}
            onClick={() => void handleNext()}
            style={{
              flex: 1, minWidth: 160, padding: "14px 20px", borderRadius: "var(--r-md)",
              border: "none",
              background: canContinue ? theme.accent : "var(--surface-sunken)",
              color: canContinue ? "#fff" : "var(--text-faint)",
              fontWeight: 800, fontSize: 15, cursor: canContinue ? "pointer" : "not-allowed",
              fontFamily: "inherit",
              display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8,
              boxShadow: canContinue ? "var(--shadow-soft)" : "none",
              transition: "background .2s var(--ease)",
            }}
          >
            {saving ? "שומר..." : step < questions.length - 1 ? <>המשך <ChevronRight size={18} style={{ transform: "scaleX(-1)" }} /></> : <>סיום והמשך לניתוח <Check size={18} /></>}
          </button>
        </div>
      </section>

      <p style={{ marginTop: 18, fontSize: 12.5, color: "var(--text-faint)", textAlign: "center", lineHeight: 1.6 }}>
        לא נחזור על מידע שכבר יש לנו מתלושים, דוחות או פרופיל קיים.
      </p>
    </div>
  );
}

function QuestionBody({
  question, value, onChange, accent, soft, ring,
}: {
  question: SmartQuestionDTO;
  value: unknown;
  onChange: (v: unknown) => void;
  accent: string;
  soft: string;
  ring: string;
}) {
  if (question.type === "number") {
    return (
      <input
        type="number"
        value={value != null ? String(value) : ""}
        onChange={e => onChange(e.target.value ? Number(e.target.value) : "")}
        placeholder="הזן/י מספר"
        style={{
          width: "100%", boxSizing: "border-box", padding: "14px 16px", borderRadius: "var(--r-md)",
          border: `1px solid ${ring}`, fontSize: 18, fontWeight: 800, fontFamily: "inherit",
          background: "var(--surface-sunken)",
        }}
      />
    );
  }

  if (question.type === "yesno") {
    return (
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        {[true, false].map(v => (
          <button key={String(v)} type="button" onClick={() => onChange(v)} style={choiceBtn(value === v, accent, soft, ring)}>{v ? "כן" : "לא"}</button>
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
            <button key={opt.value} type="button" onClick={() => onChange(on ? selected.filter(x => x !== opt.value) : [...selected, opt.value])} style={choiceBtn(on, accent, soft, ring)}>
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
        <button key={opt.value} type="button" onClick={() => onChange(opt.value)} style={choiceBtn(value === opt.value, accent, soft, ring)}>{opt.label}</button>
      ))}
    </div>
  );
}

function choiceBtn(active: boolean, accent: string, soft: string, ring: string): React.CSSProperties {
  return {
    padding: "14px 16px",
    borderRadius: "var(--r-md)",
    border: active ? `2px solid ${accent}` : `1px solid ${ring}`,
    background: active ? soft : "var(--card)",
    fontWeight: 800,
    textAlign: "right",
    cursor: "pointer",
    fontSize: 15,
    fontFamily: "inherit",
    color: "var(--text-strong)",
    transition: "border-color .2s, background .2s",
  };
}
