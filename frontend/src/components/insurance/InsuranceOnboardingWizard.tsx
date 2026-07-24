/**
 * InsuranceOnboardingWizard — dynamic advisor Q&A after Har HaBituach upload.
 * One question at a time, progress bar, skip, short "why" explanation per question.
 */
import { useEffect, useState } from "react";
import {
  ArrowLeft, Check, ChevronLeft, ChevronRight, HelpCircle, Loader2, MessageCircle, Shield, SkipForward, Sparkles,
} from "lucide-react";
import {
  completeInsuranceOnboarding,
  getInsuranceOnboardingSession,
  submitInsuranceOnboardingAnswer,
  type InsuranceOnboardingAnalysis,
  type InsuranceOnboardingQuestion,
  type InsuranceOnboardingSession,
} from "../../api/insuranceOnboarding.api";
import { AgentGhostButton, AgentPrimaryButton } from "../agent/AgentButtons";
import AgentOptionCard from "../agent/AgentOptionCard";

const AGENT_ICON: Record<string, string> = {
  general: "🏠",
  life: "💙",
  health: "🩺",
};

function QuestionInput({
  question,
  onSubmit,
  busy,
}: {
  question: InsuranceOnboardingQuestion;
  onSubmit: (value: unknown) => void;
  busy: boolean;
}) {
  const [value, setValue] = useState<string | number | boolean | string[]>("");

  if (question.type === "info") {
    return (
      <AgentPrimaryButton disabled={busy} onClick={() => onSubmit(true)}>
        הבנתי, המשך <ChevronLeft size={16} />
      </AgentPrimaryButton>
    );
  }

  if (question.type === "boolean") {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {[{ v: true, l: "כן" }, { v: false, l: "לא" }].map(({ v, l }) => (
          <AgentOptionCard key={l} label={l} disabled={busy} onClick={() => onSubmit(v)} />
        ))}
      </div>
    );
  }

  if (question.type === "select" && question.options) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {question.options.map((opt) => (
          <AgentOptionCard
            key={opt.value}
            label={opt.label}
            disabled={busy}
            onClick={() => onSubmit(opt.value)}
          />
        ))}
      </div>
    );
  }

  if (question.type === "multiselect" && question.options) {
    const selected = Array.isArray(value) ? value : [];
    const toggle = (v: string) => {
      if (v === "none") {
        setValue(["none"]);
        return;
      }
      const next = selected.filter((x) => x !== "none");
      setValue(next.includes(v) ? next.filter((x) => x !== v) : [...next, v]);
    };
    return (
      <div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 14 }}>
          {question.options.map((opt) => (
            <AgentOptionCard
              key={opt.value}
              label={opt.label}
              multi
              selected={selected.includes(opt.value)}
              disabled={busy}
              onClick={() => toggle(opt.value)}
            />
          ))}
        </div>
        <AgentPrimaryButton disabled={busy || selected.length === 0} onClick={() => onSubmit(selected)}>
          המשך
        </AgentPrimaryButton>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
      <input
        type="number"
        aria-label="תשובה מספרית"
        min={0}
        value={value === "" ? "" : String(value)}
        onChange={(e) => setValue(e.target.value === "" ? "" : Number(e.target.value))}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !busy && value !== "") onSubmit(Number(value));
        }}
        placeholder="הזן מספר"
        style={{
          flex: 1,
          minWidth: 140,
          height: 52,
          padding: "0 15px",
          borderRadius: "var(--r-btn)",
          border: "1.5px solid var(--border-soft)",
          fontFamily: "inherit",
          fontSize: 15,
          fontWeight: 600,
          color: "var(--ink)",
          background: "var(--card)",
          boxSizing: "border-box",
        }}
      />
      <AgentPrimaryButton disabled={busy || value === ""} onClick={() => onSubmit(Number(value))}>
        המשך
      </AgentPrimaryButton>
    </div>
  );
}

export default function InsuranceOnboardingWizard({
  onBack,
  onComplete,
}: {
  onBack: () => void;
  onComplete: (analysis?: InsuranceOnboardingAnalysis) => void;
}) {
  const [session, setSession] = useState<InsuranceOnboardingSession | null>(null);
  const [analysis, setAnalysis] = useState<InsuranceOnboardingAnalysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void getInsuranceOnboardingSession().then((res) => {
      if (cancelled) return;
      if (res.ok && res.data?.success && res.data.data) {
        setSession(res.data.data);
      } else {
        setError(!res.ok ? res.error.message : "לא הצלחנו לטעון את שאלון היועץ");
      }
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const question = session?.currentQuestion;

  const handleComplete = async () => {
    setBusy(true);
    const res = await completeInsuranceOnboarding();
    setBusy(false);
    if (res.ok && res.data?.success && res.data.data) {
      setSession(res.data.data.session);
      setAnalysis(res.data.data.analysis);
    } else {
      setError(!res.ok ? res.error.message : "שגיאה בניתוח");
    }
  };

  const handleAnswer = async (value: unknown, skipped = false) => {
    if (!question) return;
    setBusy(true);
    setError(null);
    const res = await submitInsuranceOnboardingAnswer({
      questionId: question.id,
      value: skipped ? undefined : value,
      skipped,
    });
    setBusy(false);
    if (res.ok && res.data?.success && res.data.data) {
      setSession(res.data.data);
      if (res.data.data.questions.length === 0 && !res.data.data.completed) {
        await handleComplete();
      }
    } else {
      setError(!res.ok ? res.error.message : "שגיאה בשמירת התשובה");
    }
  };

  if (loading) {
    return (
      <main style={{ maxWidth: 720, margin: "0 auto", padding: "48px 24px", textAlign: "center" }}>
        <Loader2 size={32} style={{ animation: "spin 1s linear infinite", color: "var(--peach-ink)" }} />
        <p style={{ marginTop: 16, color: "var(--text-muted)" }}>טוען את פרופיל הביטוח מהדוח...</p>
      </main>
    );
  }

  if (!session?.ready) {
    return (
      <main style={{ maxWidth: 720, margin: "0 auto", padding: "48px 24px" }}>
        <p style={{ color: "var(--text-body)" }}>{session?.message ?? error ?? "יש להעלות דוח מהר הביטוח תחילה"}</p>
        <AgentGhostButton style={{ marginTop: 20 }} onClick={onBack}>
          חזרה
        </AgentGhostButton>
      </main>
    );
  }

  if (analysis || session.completed) {
    const a = analysis;
    return (
      <main style={{ maxWidth: 760, margin: "0 auto", padding: "40px 24px 80px" }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              fontSize: 12.5,
              fontWeight: 800,
              letterSpacing: ".1em",
              color: "var(--peach-ink)",
            }}
          >
            <Check size={16} /> הניתוח מוכן
          </span>
          <h1 style={{ margin: "12px 0 0", fontSize: "clamp(26px,3vw,34px)", fontWeight: 900, fontFamily: "var(--font-display)" }}>
            סיכום יועץ הביטוח
          </h1>
        </div>
        {a && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div
              style={{
                background: "var(--card)",
                border: "1px solid var(--border-hair)",
                borderRadius: "var(--r-card)",
                boxShadow: "var(--shadow-soft)",
                padding: 20,
              }}
            >
              <h3 style={{ margin: "0 0 12px", fontSize: 17, fontWeight: 800 }}>מה מצאנו</h3>
              <p style={{ margin: 0, color: "var(--text-muted)" }}>
                {a.summary.existingPolicies} פוליסות פעילות
                {a.summary.missingPolicies.length > 0 && ` · ${a.summary.missingPolicies.length} פערים בכיסוי`}
                {a.summary.duplicatePolicies.length > 0 && ` · ${a.summary.duplicatePolicies.length} כפילויות`}
              </p>
            </div>
            <div
              style={{
                background: "var(--card)",
                border: "1px solid var(--border-hair)",
                borderRadius: "var(--r-card)",
                boxShadow: "var(--shadow-soft)",
                padding: 20,
              }}
            >
              <h3 style={{ margin: "0 0 12px", fontSize: 17, fontWeight: 800 }}>פרמיה חודשית</h3>
              <p style={{ margin: 0, fontSize: 22, fontWeight: 900 }}>
                ₪{Math.round(a.financial.totalMonthlyPremium).toLocaleString("en-US")}
              </p>
              <p style={{ margin: "8px 0 0", color: "var(--text-muted)", fontSize: 14 }}>
                {a.financial.premiumAssessment === "high"
                  ? "גבוהה יחסית להכנסה"
                  : a.financial.premiumAssessment === "low"
                    ? "נמוכה יחסית"
                    : a.financial.premiumAssessment === "normal"
                      ? "בטווח סביר"
                      : "נדרש מידע נוסף על הכנסה"}
              </p>
            </div>
            {a.recommendations.slice(0, 3).map((r) => (
              <div
                key={r.title}
                style={{
                  background: "var(--peach-soft)",
                  border: "1px solid var(--peach)",
                  borderRadius: "var(--r-card)",
                  padding: 16,
                }}
              >
                <div style={{ fontWeight: 800 }}>{r.title}</div>
                <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 4 }}>{r.reason}</div>
              </div>
            ))}
          </div>
        )}
        <AgentPrimaryButton
          style={{ marginTop: 28, width: "100%" }}
          onClick={() => onComplete(analysis ?? undefined)}
        >
          צפה בלוח הביטוח המלא <ArrowLeft size={17} />
        </AgentPrimaryButton>
      </main>
    );
  }

  const progress = session.progress;

  return (
    <main style={{ maxWidth: 720, margin: "0 auto", padding: "32px 24px 80px" }}>
      <button
        type="button"
        onClick={onBack}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          background: "none",
          border: "none",
          color: "var(--text-muted)",
          cursor: "pointer",
          fontFamily: "inherit",
          fontWeight: 600,
          fontSize: 14,
          marginBottom: 24,
          padding: 0,
        }}
      >
        <ChevronRight size={16} /> חזרה
      </button>

      <div
        style={{
          background: "var(--surface-sunken)",
          border: "1px solid var(--border-hair)",
          borderRadius: "var(--r-card)",
          padding: 18,
          marginBottom: 28,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
          <Shield size={20} color="var(--peach-ink)" />
          <span style={{ fontWeight: 800 }}>פרופיל מהדוח — {session.reportProfile.policyCount} פוליסות</span>
        </div>
        <p style={{ margin: 0, fontSize: 13.5, color: "var(--text-muted)", lineHeight: 1.5 }}>
          סרקנו את דוח הר הביטוח. לא נשאל אותך על מה שכבר מופיע בדוח — רק על מה שחסר לניתוח מקצועי.
        </p>
        {session.reportProfile.companies.length > 0 && (
          <p style={{ margin: "10px 0 0", fontSize: 12.5, fontWeight: 700, color: "var(--peach-ink)" }}>
            {session.reportProfile.companies.join(" · ")} · ₪
            {Math.round(session.reportProfile.totalMonthlyPremium).toLocaleString("en-US")}/חודש
          </p>
        )}
      </div>

      <div style={{ marginBottom: 28 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontSize: 13,
            fontWeight: 700,
            color: "var(--text-muted)",
            marginBottom: 8,
          }}
        >
          <span>
            שאלה {progress.answered + 1} מתוך {progress.total || 1}
          </span>
          <span>{progress.percent}%</span>
        </div>
        <div
          role="progressbar"
          aria-label="התקדמות בשאלון הביטוח"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={progress.percent}
          style={{ height: 8, borderRadius: 999, background: "var(--border-hair)", overflow: "hidden" }}
        >
          <div
            style={{
              width: `${progress.percent}%`,
              height: "100%",
              background: "var(--peach)",
              transition: "width .35s ease",
            }}
          />
        </div>
      </div>

      {error && (
        <div
          role="alert"
          style={{
            background: "var(--danger-soft, #FEE2E2)",
            color: "var(--danger)",
            padding: 12,
            borderRadius: "var(--r-btn)",
            marginBottom: 16,
            fontSize: 14,
            fontWeight: 600,
          }}
        >
          {error}
        </div>
      )}

      {question ? (
        <div
          aria-busy={busy}
          style={{
            background: "var(--card)",
            border: "1px solid var(--border-hair)",
            borderRadius: "var(--r-card)",
            boxShadow: "var(--shadow-card)",
            padding: 24,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              marginBottom: 16,
              fontSize: 12.5,
              fontWeight: 800,
              color: "var(--peach-ink)",
              letterSpacing: ".06em",
            }}
          >
            <MessageCircle size={16} />
            {AGENT_ICON[question.agent]} {session.agentLabels?.[question.agent] ?? question.agent}
          </div>

          <p
            style={{
              margin: "0 0 16px",
              fontSize: "clamp(18px,2.5vw,22px)",
              fontWeight: 800,
              lineHeight: 1.35,
              color: "var(--text-strong)",
            }}
          >
            {question.text}
          </p>

          <div
            style={{
              display: "flex",
              gap: 8,
              alignItems: "flex-start",
              background: "var(--peach-soft)",
              borderRadius: 12,
              padding: "12px 14px",
              marginBottom: 22,
            }}
          >
            <HelpCircle size={18} style={{ flexShrink: 0, marginTop: 2, color: "var(--peach-ink)" }} />
            <p style={{ margin: 0, fontSize: 13.5, color: "var(--text-body)", lineHeight: 1.5 }}>{question.why}</p>
          </div>

          <QuestionInput key={question.id} question={question} onSubmit={(v) => void handleAnswer(v)} busy={busy} />

          {question.skipAllowed && question.type !== "info" && (
            <AgentGhostButton
              size="sm"
              disabled={busy}
              onClick={() => void handleAnswer(undefined, true)}
              style={{ marginTop: 16, opacity: 0.9 }}
            >
              <SkipForward size={14} /> דלג על שאלה זו
            </AgentGhostButton>
          )}
        </div>
      ) : (
        <div style={{ textAlign: "center" }}>
          <Sparkles size={28} color="var(--peach-ink)" />
          <p style={{ fontWeight: 800, marginTop: 12 }}>סיימנו את השאלות!</p>
          <AgentPrimaryButton style={{ marginTop: 16 }} disabled={busy} onClick={() => void handleComplete()}>
            {busy ? <Loader2 size={18} style={{ animation: "spin 1s linear infinite" }} /> : "הפק ניתוח מלא"}
          </AgentPrimaryButton>
        </div>
      )}
    </main>
  );
}
