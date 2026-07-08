/**
 * InsuranceOnboardingWizard — dynamic advisor Q&A after Har HaBituach upload.
 * One question at a time, progress bar, skip, short "why" explanation per question.
 */
import { useCallback, useEffect, useState } from "react";
import {
  ArrowLeft, Check, ChevronLeft, HelpCircle, Loader2, MessageCircle, Shield, SkipForward, Sparkles,
} from "lucide-react";
import {
  completeInsuranceOnboarding,
  getInsuranceOnboardingSession,
  submitInsuranceOnboardingAnswer,
  type InsuranceOnboardingAnalysis,
  type InsuranceOnboardingQuestion,
  type InsuranceOnboardingSession,
} from "../../api/insuranceOnboarding.api";

const AGENT_ICON: Record<string, string> = {
  general: "🏠",
  life: "💙",
  health: "🩺",
};

const btnPrimary: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  background: "var(--peach)",
  color: "var(--ink)",
  border: "2px solid var(--ink)",
  borderRadius: "var(--r-btn)",
  padding: "12px 22px",
  fontFamily: "inherit",
  fontWeight: 800,
  fontSize: 14.5,
  cursor: "pointer",
  boxShadow: "var(--shadow-sticker)",
};

const btnGhost: React.CSSProperties = {
  ...btnPrimary,
  background: "transparent",
  boxShadow: "none",
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
      <button type="button" style={btnPrimary} disabled={busy} onClick={() => onSubmit(true)}>
        הבנתי, המשך <ChevronLeft size={16} />
      </button>
    );
  }

  if (question.type === "boolean") {
    return (
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        {[{ v: true, l: "כן" }, { v: false, l: "לא" }].map(({ v, l }) => (
          <button key={l} type="button" style={btnPrimary} disabled={busy} onClick={() => onSubmit(v)}>{l}</button>
        ))}
      </div>
    );
  }

  if (question.type === "select" && question.options) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {question.options.map(opt => (
          <button
            key={opt.value}
            type="button"
            disabled={busy}
            onClick={() => onSubmit(opt.value)}
            style={{
              textAlign: "right",
              padding: "12px 16px",
              borderRadius: 12,
              border: "1px solid var(--border-hair)",
              background: "var(--card)",
              fontFamily: "inherit",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            {opt.label}
          </button>
        ))}
      </div>
    );
  }

  if (question.type === "multiselect" && question.options) {
    const selected = Array.isArray(value) ? value : [];
    const toggle = (v: string) => {
      if (v === "none") { setValue(["none"]); return; }
      const next = selected.filter(x => x !== "none");
      setValue(next.includes(v) ? next.filter(x => x !== v) : [...next, v]);
    };
    return (
      <div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 14 }}>
          {question.options.map(opt => (
            <label key={opt.value} style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", fontWeight: 600 }}>
              <input
                type="checkbox"
                checked={selected.includes(opt.value)}
                onChange={() => toggle(opt.value)}
              />
              {opt.label}
            </label>
          ))}
        </div>
        <button type="button" style={btnPrimary} disabled={busy || selected.length === 0} onClick={() => onSubmit(selected)}>
          המשך
        </button>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
      <input
        type="number"
        value={value === "" ? "" : String(value)}
        onChange={e => setValue(e.target.value === "" ? "" : Number(e.target.value))}
        placeholder="הזן מספר"
        style={{
          flex: 1,
          minWidth: 140,
          padding: "12px 14px",
          borderRadius: 12,
          border: "1px solid var(--border-soft)",
          fontFamily: "inherit",
          fontSize: 15,
        }}
      />
      <button type="button" style={btnPrimary} disabled={busy || value === ""} onClick={() => onSubmit(Number(value))}>
        המשך
      </button>
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

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const res = await getInsuranceOnboardingSession();
    if (res.ok && res.data?.success && res.data.data) {
      setSession(res.data.data);
    } else {
      setError(!res.ok ? res.error.message : "לא הצלחנו לטעון את שאלון היועץ");
    }
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const question = session?.currentQuestion;

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

  if (loading) {
    return (
      <main style={{ maxWidth: 720, margin: "0 auto", padding: "48px 24px", textAlign: "center" }}>
        <Loader2 size={32} className="spin" style={{ animation: "spin 1s linear infinite", color: "var(--peach)" }} />
        <p style={{ marginTop: 16, color: "var(--text-muted)" }}>טוען את פרופיל הביטוח מהדוח...</p>
      </main>
    );
  }

  if (!session?.ready) {
    return (
      <main style={{ maxWidth: 720, margin: "0 auto", padding: "48px 24px" }}>
        <p style={{ color: "var(--text-body)" }}>{session?.message ?? error ?? "יש להעלות דוח מהר הביטוח תחילה"}</p>
        <button type="button" style={{ ...btnGhost, marginTop: 20 }} onClick={onBack}>חזרה</button>
      </main>
    );
  }

  if (analysis || session.completed) {
    const a = analysis;
    return (
      <main style={{ maxWidth: 760, margin: "0 auto", padding: "40px 24px 80px" }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 12.5, fontWeight: 800, letterSpacing: ".1em", color: "var(--peach-ink)" }}>
            <Check size={16} /> הניתוח מוכן
          </span>
          <h1 style={{ margin: "12px 0 0", fontSize: "clamp(26px,3vw,34px)", fontWeight: 900 }}>סיכום יועץ הביטוח</h1>
        </div>
        {a && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ background: "var(--card)", border: "1px solid var(--border-hair)", borderRadius: "var(--radius)", padding: 20 }}>
              <h3 style={{ margin: "0 0 12px", fontSize: 17, fontWeight: 800 }}>מה מצאנו</h3>
              <p style={{ margin: 0, color: "var(--text-muted)" }}>
                {a.summary.existingPolicies} פוליסות פעילות
                {a.summary.missingPolicies.length > 0 && ` · ${a.summary.missingPolicies.length} פערים בכיסוי`}
                {a.summary.duplicatePolicies.length > 0 && ` · ${a.summary.duplicatePolicies.length} כפילויות`}
              </p>
            </div>
            <div style={{ background: "var(--card)", border: "1px solid var(--border-hair)", borderRadius: "var(--radius)", padding: 20 }}>
              <h3 style={{ margin: "0 0 12px", fontSize: 17, fontWeight: 800 }}>פרמיה חודשית</h3>
              <p style={{ margin: 0, fontSize: 22, fontWeight: 900 }}>₪{Math.round(a.financial.totalMonthlyPremium).toLocaleString("en-US")}</p>
              <p style={{ margin: "8px 0 0", color: "var(--text-muted)", fontSize: 14 }}>
                {a.financial.premiumAssessment === "high" ? "גבוהה יחסית להכנסה" :
                  a.financial.premiumAssessment === "low" ? "נמוכה יחסית" :
                    a.financial.premiumAssessment === "normal" ? "בטווח סביר" : "נדרש מידע נוסף על הכנסה"}
              </p>
            </div>
            {a.recommendations.slice(0, 3).map(r => (
              <div key={r.title} style={{ background: "var(--peach-soft)", border: "1px solid var(--peach)", borderRadius: "var(--r-md)", padding: 16 }}>
                <div style={{ fontWeight: 800 }}>{r.title}</div>
                <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 4 }}>{r.reason}</div>
              </div>
            ))}
          </div>
        )}
        <button type="button" style={{ ...btnPrimary, marginTop: 28, width: "100%", justifyContent: "center" }} onClick={() => onComplete(analysis ?? undefined)}>
          צפה בלוח הביטוח המלא <ArrowLeft size={17} />
        </button>
      </main>
    );
  }

  const progress = session.progress;

  return (
    <main style={{ maxWidth: 720, margin: "0 auto", padding: "32px 24px 80px" }}>
      <button type="button" onClick={onBack} style={{ ...btnGhost, marginBottom: 24, padding: "8px 0" }}>
        <ArrowLeft size={16} /> חזרה
      </button>

      {/* report snapshot */}
      <div style={{ background: "var(--surface-sunken)", border: "1px solid var(--border-hair)", borderRadius: "var(--radius)", padding: 18, marginBottom: 28 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
          <Shield size={20} color="var(--peach-ink)" />
          <span style={{ fontWeight: 800 }}>פרופיל מהדוח — {session.reportProfile.policyCount} פוליסות</span>
        </div>
        <p style={{ margin: 0, fontSize: 13.5, color: "var(--text-muted)", lineHeight: 1.5 }}>
          סרקנו את דוח הר הביטוח. לא נשאל אותך על מה שכבר מופיע בדוח — רק על מה שחסר לניתוח מקצועי.
        </p>
        {session.reportProfile.companies.length > 0 && (
          <p style={{ margin: "10px 0 0", fontSize: 12.5, fontWeight: 700, color: "var(--peach-ink)" }}>
            {session.reportProfile.companies.join(" · ")} · ₪{Math.round(session.reportProfile.totalMonthlyPremium).toLocaleString("en-US")}/חודש
          </p>
        )}
      </div>

      {/* progress */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, fontWeight: 700, color: "var(--text-muted)", marginBottom: 8 }}>
          <span>שאלה {progress.answered + 1} מתוך {progress.total || 1}</span>
          <span>{progress.percent}%</span>
        </div>
        <div style={{ height: 8, borderRadius: 999, background: "var(--border-hair)", overflow: "hidden" }}>
          <div style={{ width: `${progress.percent}%`, height: "100%", background: "var(--peach)", transition: "width .35s ease" }} />
        </div>
      </div>

      {error && (
        <div style={{ background: "#FEE2E2", color: "#991B1B", padding: 12, borderRadius: 10, marginBottom: 16, fontSize: 14 }}>
          {error}
        </div>
      )}

      {question ? (
        <div style={{ background: "var(--card)", border: "2px solid var(--ink)", borderRadius: "var(--radius)", boxShadow: "var(--shadow-sticker)", padding: 24 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16, fontSize: 12.5, fontWeight: 800, color: "var(--peach-ink)", letterSpacing: ".06em" }}>
            <MessageCircle size={16} />
            {AGENT_ICON[question.agent]} {session.agentLabels?.[question.agent] ?? question.agent}
          </div>

          <p style={{ margin: "0 0 16px", fontSize: "clamp(18px,2.5vw,22px)", fontWeight: 800, lineHeight: 1.35, color: "var(--text-strong)" }}>
            {question.text}
          </p>

          <div style={{ display: "flex", gap: 8, alignItems: "flex-start", background: "var(--peach-soft)", borderRadius: 12, padding: "12px 14px", marginBottom: 22 }}>
            <HelpCircle size={18} style={{ flexShrink: 0, marginTop: 2, color: "var(--peach-ink)" }} />
            <p style={{ margin: 0, fontSize: 13.5, color: "var(--text-body)", lineHeight: 1.5 }}>{question.why}</p>
          </div>

          <QuestionInput question={question} onSubmit={v => void handleAnswer(v)} busy={busy} />

          {question.skipAllowed && question.type !== "info" && (
            <button
              type="button"
              disabled={busy}
              onClick={() => void handleAnswer(undefined, true)}
              style={{ ...btnGhost, marginTop: 16, fontSize: 13, padding: "8px 12px", opacity: 0.85 }}
            >
              <SkipForward size={14} /> דלג על שאלה זו
            </button>
          )}
        </div>
      ) : (
        <div style={{ textAlign: "center" }}>
          <Sparkles size={28} color="var(--peach-ink)" />
          <p style={{ fontWeight: 800, marginTop: 12 }}>סיימנו את השאלות!</p>
          <button type="button" style={{ ...btnPrimary, marginTop: 16 }} disabled={busy} onClick={() => void handleComplete()}>
            {busy ? <Loader2 size={18} style={{ animation: "spin 1s linear infinite" }} /> : "הפק ניתוח מלא"}
          </button>
        </div>
      )}
    </main>
  );
}
