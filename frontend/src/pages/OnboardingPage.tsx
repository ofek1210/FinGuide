import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import Loader from "../components/ui/Loader";
import { APP_ROUTES } from "../types/navigation";
import { useAuth } from "../auth/AuthProvider";
import {
  completeOnboarding,
  getOnboarding,
  updateOnboarding,
  type OnboardingData,
  type SalaryType,
} from "../api/onboarding.api";

const EMPTY: OnboardingData = {
  salaryType: null,
  expectedMonthlyGross: null,
  hourlyRate: null,
  expectedMonthlyHours: null,
  jobPercentage: null,
  isPrimaryJob: null,
  hasMultipleEmployers: null,
  employmentStartDate: null,
  hasPension: null,
  hasStudyFund: null,
};

type FieldErrors = Partial<Record<keyof OnboardingData, string>>;

function toNumberOrNull(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : null;
}

export default function OnboardingPage() {
  const navigate = useNavigate();
  const { refresh } = useAuth();
  const rootRef = useRef<HTMLDivElement | null>(null);

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [introOpen, setIntroOpen] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [data, setData] = useState<OnboardingData>(EMPTY);

  const progressPct = useMemo(() => (step / 3) * 100, [step]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const res = await getOnboarding();
    setLoading(false);

    if (!res.success) {
      setError(res.message ?? "לא הצלחנו לטעון את ה-onboarding.");
      return;
    }

    const serverData = res.data?.data ?? {};
    setData((prev) => ({ ...prev, ...serverData }));
    if (res.data?.completed) {
      await refresh();
      navigate(APP_ROUTES.dashboard, { replace: true });
    }
  }, [navigate, refresh]);

  useEffect(() => {
    const id = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(id);
  }, [load]);

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return undefined;

    const rand = (min: number, max: number) => min + Math.random() * (max - min);

    const tick = () => {
      // Offsets are intentionally large enough to be noticeable.
      el.style.setProperty("--ob-a-x", `${Math.round(rand(-140, 140))}px`);
      el.style.setProperty("--ob-a-y", `${Math.round(rand(-120, 120))}px`);
      el.style.setProperty("--ob-a-s", `${rand(0.98, 1.08).toFixed(3)}`);

      el.style.setProperty("--ob-b-x", `${Math.round(rand(-160, 160))}px`);
      el.style.setProperty("--ob-b-y", `${Math.round(rand(-140, 140))}px`);
      el.style.setProperty("--ob-b-s", `${rand(0.98, 1.08).toFixed(3)}`);
    };

    // Initial positions + periodic random drift.
    tick();
    const id = window.setInterval(tick, 5200);
    return () => window.clearInterval(id);
  }, []);

  const applyErrors = (errs?: Array<{ field?: string; message?: string }>) => {
    if (!errs?.length) return;
    const next: FieldErrors = {};
    for (const e of errs) {
      const field = e.field as keyof OnboardingData | undefined;
      if (!field) continue;
      next[field] = e.message || "שדה לא תקין";
    }
    setFieldErrors(next);
  };

  const saveDraft = useCallback(
    async (patch: Partial<OnboardingData>) => {
      setSaving(true);
      setError(null);
      setFieldErrors({});
      const res = await updateOnboarding(patch);
      setSaving(false);

      if (!res.success) {
        setError(res.message ?? "לא הצלחנו לשמור.");
        applyErrors(res.errors);
        return false;
      }
      const serverData = res.data?.data ?? {};
      setData((prev) => ({ ...prev, ...serverData }));
      return true;
    },
    [],
  );

  const handleNext = useCallback(async () => {
    if (saving || finishing) return;

    const ok = await saveDraft(data);
    if (!ok) return;
    setStep((s) => (s === 3 ? 3 : ((s + 1) as 2 | 3)));
  }, [data, finishing, saveDraft, saving]);

  const handleBack = useCallback(() => {
    if (saving || finishing) return;
    setError(null);
    setFieldErrors({});
    setStep((s) => (s === 1 ? 1 : ((s - 1) as 1 | 2)));
  }, [finishing, saving]);

  const handleFinish = useCallback(async () => {
    if (saving || finishing) return;
    setFinishing(true);
    setError(null);
    setFieldErrors({});
    const res = await completeOnboarding(data);
    setFinishing(false);

    if (!res.success || !res.data?.completed) {
      // Don't show raw backend message like "Onboarding incomplete" – show a friendly local one.
      if (res.errors && res.errors.length > 0) {
        setError("חסרים עוד כמה פרטים כדי לסיים.");
      } else {
        setError("לא הצלחנו להשלים את ה-onboarding. נסו שוב.");
      }
      applyErrors(res.errors);
      return;
    }

    await refresh();
    navigate(APP_ROUTES.dashboard, { replace: true });
  }, [data, finishing, refresh, saving, navigate]);

  const salaryType = data.salaryType;
  const showMonthlyGross = salaryType === "global";
  const showHourly = salaryType === "hourly";

  if (loading) {
    return (
      <div ref={rootRef} className="auth-page onboarding-page" dir="rtl">
        <div
          className="auth-shell"
          style={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            width: "100%",
          }}
        >
          <section className="auth-card" style={{ width: "min(560px, 92vw)" }}>
            <div className="findings-placeholder">
              <Loader />
              טוענים onboarding...
            </div>
          </section>
        </div>
      </div>
    );
  }

  return (
    <div ref={rootRef} className="auth-page onboarding-page" dir="rtl">
      <div
        className="auth-shell"
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          width: "100%",
        }}
      >
        <section className="auth-card" style={{ width: "min(560px, 92vw)" }}>
          <header className="auth-card-header">
            <h1>הגדרה מהירה</h1>
            <p>כמה פרטים קצרים כדי שנוכל להשוות תלושים ולזהות חריגות.</p>
          </header>

          <div style={{ marginTop: "0.75rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.95rem" }}>
              <span>שלב {step} מתוך 3</span>
              <span style={{ opacity: 0.8 }}>{Math.round(progressPct)}%</span>
            </div>
            <div
              style={{
                height: 6,
                background: "rgba(0,0,0,0.08)",
                borderRadius: 999,
                overflow: "hidden",
                marginTop: 8,
              }}
            >
              <div
                style={{
                  width: `${progressPct}%`,
                  height: "100%",
                  background: "rgba(124, 58, 237, 0.9)",
                  transition: "width 220ms ease",
                }}
              />
            </div>
          </div>

          {error ? <div className="auth-error" style={{ marginTop: "1rem" }}>{error}</div> : null}

          <div className="auth-form" style={{ marginTop: "1rem", opacity: introOpen ? 0.35 : 1, pointerEvents: introOpen ? "none" : "auto", transition: "opacity 180ms ease" }}>
            {step === 1 ? (
              <>
                <h2 style={{ margin: "0.25rem 0 0.5rem", fontSize: "1.25rem" }}>
                  איך השכר שלך מחושב?
                </h2>

                <div className="settings-field onboarding-field">
                  <label>סוג שכר</label>
                  <div className="onboarding-choice-grid" style={{ marginTop: 10 }}>
                    {(
                      [
                        { id: "global", label: "גלובלי (חודשי)" },
                        { id: "hourly", label: "שעתי" },
                      ] as Array<{ id: SalaryType; label: string }>
                    ).map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        className={`onboarding-choice ${data.salaryType === opt.id ? "is-selected" : ""}`}
                        onClick={() => setData((prev) => ({ ...prev, salaryType: opt.id }))}
                        disabled={saving || finishing}
                        aria-pressed={data.salaryType === opt.id}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                  {fieldErrors.salaryType ? (
                    <span className="settings-field-error">{fieldErrors.salaryType}</span>
                  ) : null}
                </div>

                <div className="settings-field onboarding-field">
                  <label>זו העבודה העיקרית שלי</label>
                  <div className="onboarding-choice-row" style={{ marginTop: 10 }}>
                    <button
                      type="button"
                      className={`onboarding-choice ${data.isPrimaryJob === true ? "is-selected" : ""}`}
                      onClick={() => setData((p) => ({ ...p, isPrimaryJob: true }))}
                      disabled={saving || finishing}
                      aria-pressed={data.isPrimaryJob === true}
                    >
                      כן
                    </button>
                    <button
                      type="button"
                      className={`onboarding-choice ${data.isPrimaryJob === false ? "is-selected" : ""}`}
                      onClick={() => setData((p) => ({ ...p, isPrimaryJob: false }))}
                      disabled={saving || finishing}
                      aria-pressed={data.isPrimaryJob === false}
                    >
                      לא
                    </button>
                  </div>
                  {fieldErrors.isPrimaryJob ? (
                    <span className="settings-field-error">{fieldErrors.isPrimaryJob}</span>
                  ) : null}
                </div>

                <div className="settings-field onboarding-field">
                  <label htmlFor="employmentStartDate">תאריך תחילת עבודה</label>
                  <input
                    id="employmentStartDate"
                    type="date"
                    value={data.employmentStartDate ?? ""}
                    onChange={(e) => setData((p) => ({ ...p, employmentStartDate: e.target.value || null }))}
                    className="settings-input"
                    dir="ltr"
                  />
                  {fieldErrors.employmentStartDate ? (
                    <span className="settings-field-error">{fieldErrors.employmentStartDate}</span>
                  ) : null}
                </div>
              </>
            ) : null}

            {step === 2 ? (
              <>
                <h2 style={{ margin: "0.25rem 0 0.5rem", fontSize: "1.25rem" }}>
                  מה מצופה להופיע בתלוש?
                </h2>

                {showMonthlyGross ? (
                  <div className="settings-field onboarding-field">
                    <label htmlFor="expectedMonthlyGross">ברוטו חודשי צפוי (הערכה)</label>
                    <input
                      id="expectedMonthlyGross"
                      type="number"
                      inputMode="decimal"
                      className="settings-input"
                      value={data.expectedMonthlyGross ?? ""}
                      onChange={(e) =>
                        setData((p) => ({ ...p, expectedMonthlyGross: toNumberOrNull(e.target.value) }))
                      }
                    />
                    {fieldErrors.expectedMonthlyGross ? (
                      <span className="settings-field-error">{fieldErrors.expectedMonthlyGross}</span>
                    ) : null}
                  </div>
                ) : null}

                {showHourly ? (
                  <>
                    <div className="settings-field onboarding-field">
                      <label htmlFor="hourlyRate">שכר שעתי</label>
                      <input
                        id="hourlyRate"
                        type="number"
                        inputMode="decimal"
                        className="settings-input"
                        value={data.hourlyRate ?? ""}
                        onChange={(e) => setData((p) => ({ ...p, hourlyRate: toNumberOrNull(e.target.value) }))}
                      />
                      {fieldErrors.hourlyRate ? (
                        <span className="settings-field-error">{fieldErrors.hourlyRate}</span>
                      ) : null}
                    </div>

                    <div className="settings-field onboarding-field">
                      <label htmlFor="expectedMonthlyHours">שעות חודשיות צפויות</label>
                      <input
                        id="expectedMonthlyHours"
                        type="number"
                        inputMode="numeric"
                        className="settings-input"
                        value={data.expectedMonthlyHours ?? ""}
                        onChange={(e) =>
                          setData((p) => ({ ...p, expectedMonthlyHours: toNumberOrNull(e.target.value) }))
                        }
                      />
                      {fieldErrors.expectedMonthlyHours ? (
                        <span className="settings-field-error">{fieldErrors.expectedMonthlyHours}</span>
                      ) : null}
                    </div>
                  </>
                ) : null}

                <div className="settings-field onboarding-field">
                  <label htmlFor="jobPercentage">אחוז משרה</label>
                  <input
                    id="jobPercentage"
                    type="number"
                    inputMode="numeric"
                    className="settings-input"
                    value={data.jobPercentage ?? ""}
                    onChange={(e) => setData((p) => ({ ...p, jobPercentage: toNumberOrNull(e.target.value) }))}
                  />
                  {fieldErrors.jobPercentage ? (
                    <span className="settings-field-error">{fieldErrors.jobPercentage}</span>
                  ) : null}
                </div>
              </>
            ) : null}

            {step === 3 ? (
              <>
                <h2 style={{ margin: "0.25rem 0 0.5rem", fontSize: "1.25rem" }}>
                  האם אמורות להיות הטבות בתלוש?
                </h2>

                <div className="settings-field onboarding-field">
                  <label>יש לי פנסיה</label>
                  <div className="onboarding-choice-row" style={{ marginTop: 10 }}>
                    <button
                      type="button"
                      className={`onboarding-choice ${data.hasPension === true ? "is-selected" : ""}`}
                      onClick={() => setData((p) => ({ ...p, hasPension: true }))}
                      disabled={saving || finishing}
                      aria-pressed={data.hasPension === true}
                    >
                      כן
                    </button>
                    <button
                      type="button"
                      className={`onboarding-choice ${data.hasPension === false ? "is-selected" : ""}`}
                      onClick={() => setData((p) => ({ ...p, hasPension: false }))}
                      disabled={saving || finishing}
                      aria-pressed={data.hasPension === false}
                    >
                      לא
                    </button>
                  </div>
                  {fieldErrors.hasPension ? (
                    <span className="settings-field-error">{fieldErrors.hasPension}</span>
                  ) : null}
                </div>

                <div className="settings-field onboarding-field">
                  <label>יש לי קרן השתלמות</label>
                  <div className="onboarding-choice-row" style={{ marginTop: 10 }}>
                    <button
                      type="button"
                      className={`onboarding-choice ${data.hasStudyFund === true ? "is-selected" : ""}`}
                      onClick={() => setData((p) => ({ ...p, hasStudyFund: true }))}
                      disabled={saving || finishing}
                      aria-pressed={data.hasStudyFund === true}
                    >
                      כן
                    </button>
                    <button
                      type="button"
                      className={`onboarding-choice ${data.hasStudyFund === false ? "is-selected" : ""}`}
                      onClick={() => setData((p) => ({ ...p, hasStudyFund: false }))}
                      disabled={saving || finishing}
                      aria-pressed={data.hasStudyFund === false}
                    >
                      לא
                    </button>
                  </div>
                  {fieldErrors.hasStudyFund ? (
                    <span className="settings-field-error">{fieldErrors.hasStudyFund}</span>
                  ) : null}
                </div>

                <div className="settings-field onboarding-field">
                  <label>יש לי יותר ממעסיק אחד</label>
                  <div className="onboarding-choice-row" style={{ marginTop: 10 }}>
                    <button
                      type="button"
                      className={`onboarding-choice ${data.hasMultipleEmployers === true ? "is-selected" : ""}`}
                      onClick={() => setData((p) => ({ ...p, hasMultipleEmployers: true }))}
                      disabled={saving || finishing}
                      aria-pressed={data.hasMultipleEmployers === true}
                    >
                      כן
                    </button>
                    <button
                      type="button"
                      className={`onboarding-choice ${data.hasMultipleEmployers === false ? "is-selected" : ""}`}
                      onClick={() => setData((p) => ({ ...p, hasMultipleEmployers: false }))}
                      disabled={saving || finishing}
                      aria-pressed={data.hasMultipleEmployers === false}
                    >
                      לא
                    </button>
                  </div>
                  {fieldErrors.hasMultipleEmployers ? (
                    <span className="settings-field-error">{fieldErrors.hasMultipleEmployers}</span>
                  ) : null}
                </div>
              </>
            ) : null}

            <div style={{ display: "flex", gap: 10, marginTop: "1.25rem" }}>
              {step > 1 ? (
                <button
                  className="auth-link is-inline"
                  type="button"
                  onClick={handleBack}
                  disabled={saving || finishing}
                >
                  חזרה
                </button>
              ) : null}

              {step < 3 ? (
                <button
                  className="auth-button"
                  type="button"
                  onClick={handleNext}
                  disabled={saving || finishing}
                >
                  {saving ? "שומר..." : "המשך"}
                </button>
              ) : (
                <button
                  className="auth-button"
                  type="button"
                  onClick={handleFinish}
                  disabled={saving || finishing}
                >
                  {finishing ? "מסיים..." : "סיום"}
                </button>
              )}
            </div>
          </div>

          {introOpen ? (
            <div
              className="auth-modal-backdrop"
              role="presentation"
              onClick={() => {}}
              style={{ cursor: "default" }}
            >
              <section
                className="auth-modal"
                role="dialog"
                aria-modal="true"
                aria-labelledby="onboarding-intro-title"
                onClick={(event) => event.stopPropagation()}
              >
                <header className="auth-modal-header">
                  <div>
                    <h2 id="onboarding-intro-title">הגדרה קצרה (פחות מדקה)</h2>
                    <p>כדי שנוכל להגן על השכר שלך ולזהות טעויות בתלושים.</p>
                  </div>
                </header>
                <div style={{ display: "grid", gap: 10, marginTop: 10 }}>
                  <ul style={{ margin: 0, paddingInlineStart: 18, lineHeight: 1.6 }}>
                    <li>ננתח תלושים ונזהה טעויות או פערים בשכר.</li>
                    <li>נשווה בין מה שמגיע לך לבין מה שמופיע בתלוש.</li>
                    <li>זה עוזר להגן על השכר שלך לאורך זמן.</li>
                  </ul>
                  <button
                    className="auth-button"
                    type="button"
                    onClick={() => setIntroOpen(false)}
                  >
                    בואו נתחיל
                  </button>
                </div>
              </section>
            </div>
          ) : null}
        </section>
      </div>
    </div>
  );
}

