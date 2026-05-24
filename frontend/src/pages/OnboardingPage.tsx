import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import Loader from "../components/ui/Loader";
import { APP_ROUTES } from "../types/navigation";
import { useAuth } from "../auth/AuthProvider";
import {
  EMPTY_PROFILE,
  completeOnboarding,
  getOnboarding,
  updateOnboarding,
  type InvestmentType,
  type MaritalStatus,
  type OnboardingPatch,
  type OnboardingProfile,
  type SalaryType,
} from "../api/onboarding.api";

const TOTAL_STEPS = 6;
type StepNumber = 1 | 2 | 3 | 4 | 5 | 6;

const MARITAL_OPTIONS: Array<{ id: MaritalStatus; label: string }> = [
  { id: "single", label: "רווק/ה" },
  { id: "married", label: "נשוי/ה" },
  { id: "partnered", label: "ידוע/ה בציבור" },
  { id: "divorced", label: "גרוש/ה" },
  { id: "widowed", label: "אלמן/ה" },
];

const INVESTMENT_OPTIONS: Array<{ id: InvestmentType; label: string }> = [
  { id: "stocks", label: "מניות" },
  { id: "bonds", label: "אג\"ח" },
  { id: "real_estate", label: "נדל\"ן" },
  { id: "crypto", label: "קריפטו" },
  { id: "other", label: "אחר" },
];

type FieldErrors = Record<string, string>;

function toNumberOrNull(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : null;
}

function trimOrNull(raw: string): string | null {
  const t = raw.trim();
  return t ? t : null;
}

function deepMerge(base: OnboardingProfile, patch: Partial<OnboardingProfile>): OnboardingProfile {
  return {
    personal: { ...base.personal, ...(patch.personal ?? {}) },
    financial: { ...base.financial, ...(patch.financial ?? {}) },
    assets: { ...base.assets, ...(patch.assets ?? {}) },
    insurance: { ...base.insurance, ...(patch.insurance ?? {}) },
    retirement: {
      ...base.retirement,
      ...(patch.retirement ?? {}),
      investmentTypes: patch.retirement?.investmentTypes ?? base.retirement.investmentTypes,
    },
    employment: { ...base.employment, ...(patch.employment ?? {}) },
  };
}

export default function OnboardingPage() {
  const navigate = useNavigate();
  const { refresh } = useAuth();
  const rootRef = useRef<HTMLDivElement | null>(null);

  const [step, setStep] = useState<StepNumber>(1);
  const [introOpen, setIntroOpen] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [profile, setProfile] = useState<OnboardingProfile>(EMPTY_PROFILE);

  const progressPct = useMemo(() => (step / TOTAL_STEPS) * 100, [step]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const res = await getOnboarding();
    setLoading(false);

    if (!res.success) {
      setError(res.message ?? "לא הצלחנו לטעון את ה-onboarding.");
      return;
    }

    const serverData = res.data?.data;
    if (serverData) {
      setProfile((prev) => deepMerge(prev, serverData));
    }
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
      el.style.setProperty("--ob-a-x", `${Math.round(rand(-140, 140))}px`);
      el.style.setProperty("--ob-a-y", `${Math.round(rand(-120, 120))}px`);
      el.style.setProperty("--ob-a-s", `${rand(0.98, 1.08).toFixed(3)}`);
      el.style.setProperty("--ob-b-x", `${Math.round(rand(-160, 160))}px`);
      el.style.setProperty("--ob-b-y", `${Math.round(rand(-140, 140))}px`);
      el.style.setProperty("--ob-b-s", `${rand(0.98, 1.08).toFixed(3)}`);
    };
    tick();
    const id = window.setInterval(tick, 5200);
    return () => window.clearInterval(id);
  }, []);

  const applyErrors = (errs?: Array<{ field?: string; message?: string }>) => {
    if (!errs?.length) return;
    const next: FieldErrors = {};
    for (const e of errs) {
      if (!e.field) continue;
      next[e.field] = e.message || "שדה לא תקין";
    }
    setFieldErrors(next);
  };

  const buildPatchForStep = useCallback(
    (s: StepNumber): OnboardingPatch => {
      switch (s) {
        case 1:
          return { personal: profile.personal };
        case 2:
          return { employment: profile.employment };
        case 3:
          return { assets: profile.assets };
        case 4:
          return { insurance: profile.insurance };
        case 5:
          return {
            retirement: profile.retirement,
            financial: profile.financial,
          };
        case 6:
        default:
          return {};
      }
    },
    [profile],
  );

  const saveStep = useCallback(
    async (s: StepNumber) => {
      const patch = buildPatchForStep(s);
      if (Object.keys(patch).length === 0) return true;

      setSaving(true);
      setError(null);
      setFieldErrors({});
      const res = await updateOnboarding(patch, [`step-${s}`]);
      setSaving(false);

      if (!res.success) {
        setError(res.message ?? "לא הצלחנו לשמור.");
        applyErrors(res.errors);
        return false;
      }
      if (res.data?.data) {
        setProfile((prev) => deepMerge(prev, res.data!.data));
      }
      return true;
    },
    [buildPatchForStep],
  );

  const handleNext = useCallback(async () => {
    if (saving || finishing) return;
    const ok = await saveStep(step);
    if (!ok) return;
    setStep((s) => (s < TOTAL_STEPS ? ((s + 1) as StepNumber) : s));
  }, [finishing, saveStep, saving, step]);

  const handleBack = useCallback(() => {
    if (saving || finishing) return;
    setError(null);
    setFieldErrors({});
    setStep((s) => (s > 1 ? ((s - 1) as StepNumber) : s));
  }, [finishing, saving]);

  const handleFinish = useCallback(async () => {
    if (saving || finishing) return;
    setFinishing(true);
    setError(null);
    setFieldErrors({});

    // Save the current step's data first, then complete.
    const stepOk = await saveStep(step);
    if (!stepOk) {
      setFinishing(false);
      return;
    }

    const res = await completeOnboarding();
    setFinishing(false);

    if (!res.success || !res.data?.completed) {
      if (res.errors && res.errors.length > 0) {
        setError("חסרים עוד כמה פרטים כדי לסיים.");
      } else {
        setError(res.message ?? "לא הצלחנו להשלים את ה-onboarding. נסו שוב.");
      }
      applyErrors(res.errors);
      return;
    }

    await refresh();
    navigate(APP_ROUTES.dashboard, { replace: true });
  }, [finishing, navigate, refresh, saveStep, saving, step]);

  const updatePersonal = (patch: Partial<OnboardingProfile["personal"]>) =>
    setProfile((p) => ({ ...p, personal: { ...p.personal, ...patch } }));
  const updateEmployment = (patch: Partial<OnboardingProfile["employment"]>) =>
    setProfile((p) => ({ ...p, employment: { ...p.employment, ...patch } }));
  const updateAssets = (patch: Partial<OnboardingProfile["assets"]>) =>
    setProfile((p) => ({ ...p, assets: { ...p.assets, ...patch } }));
  const updateInsurance = (patch: Partial<OnboardingProfile["insurance"]>) =>
    setProfile((p) => ({ ...p, insurance: { ...p.insurance, ...patch } }));
  const updateRetirement = (patch: Partial<OnboardingProfile["retirement"]>) =>
    setProfile((p) => ({ ...p, retirement: { ...p.retirement, ...patch } }));
  const updateFinancial = (patch: Partial<OnboardingProfile["financial"]>) =>
    setProfile((p) => ({ ...p, financial: { ...p.financial, ...patch } }));

  const toggleInvestmentType = (type: InvestmentType) => {
    setProfile((p) => {
      const has = p.retirement.investmentTypes.includes(type);
      const next = has
        ? p.retirement.investmentTypes.filter((t) => t !== type)
        : [...p.retirement.investmentTypes, type];
      return { ...p, retirement: { ...p.retirement, investmentTypes: next } };
    });
  };

  const renderError = (path: string) =>
    fieldErrors[path] ? <span className="settings-field-error">{fieldErrors[path]}</span> : null;

  if (loading) {
    return (
      <div ref={rootRef} className="auth-page onboarding-page" dir="rtl">
        <div className="auth-shell" style={{ display: "flex", justifyContent: "center", alignItems: "center", width: "100%" }}>
          <section className="auth-card" style={{ width: "min(620px, 92vw)" }}>
            <div className="findings-placeholder">
              <Loader />
              טוענים onboarding...
            </div>
          </section>
        </div>
      </div>
    );
  }

  const showMonthlyGross = profile.employment.salaryType === "global";
  const showHourly = profile.employment.salaryType === "hourly";

  return (
    <div ref={rootRef} className="auth-page onboarding-page" dir="rtl">
      <div className="auth-shell" style={{ display: "flex", justifyContent: "center", alignItems: "center", width: "100%" }}>
        <section className="auth-card" style={{ width: "min(620px, 92vw)" }}>
          <header className="auth-card-header">
            <h1>הגדרה מהירה</h1>
            <p>כדי שנוכל להציע לך תובנות, התראות והמלצות מותאמות אישית.</p>
          </header>

          <div style={{ marginTop: "0.75rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.95rem" }}>
              <span>שלב {step} מתוך {TOTAL_STEPS}</span>
              <span style={{ opacity: 0.8 }}>{Math.round(progressPct)}%</span>
            </div>
            <div style={{ height: 6, background: "rgba(0,0,0,0.08)", borderRadius: 999, overflow: "hidden", marginTop: 8 }}>
              <div style={{ width: `${progressPct}%`, height: "100%", background: "rgba(124, 58, 237, 0.9)", transition: "width 220ms ease" }} />
            </div>
          </div>

          {error ? <div className="auth-error" style={{ marginTop: "1rem" }}>{error}</div> : null}

          <div className="auth-form" style={{ marginTop: "1rem", opacity: introOpen ? 0.35 : 1, pointerEvents: introOpen ? "none" : "auto", transition: "opacity 180ms ease" }}>
            {/* STEP 1: Personal */}
            {step === 1 ? (
              <>
                <h2 style={{ margin: "0.25rem 0 0.5rem", fontSize: "1.25rem" }}>קצת עליך</h2>

                <div className="settings-field onboarding-field">
                  <label htmlFor="fullName">שם מלא</label>
                  <input
                    id="fullName"
                    type="text"
                    className="settings-input"
                    value={profile.personal.fullName ?? ""}
                    onChange={(e) => updatePersonal({ fullName: trimOrNull(e.target.value) || e.target.value })}
                    placeholder="לדוגמה: דנה כהן"
                  />
                  {renderError("personal.fullName")}
                </div>

                <div className="settings-field onboarding-field">
                  <label htmlFor="age">גיל</label>
                  <input
                    id="age"
                    type="number"
                    inputMode="numeric"
                    className="settings-input"
                    value={profile.personal.age ?? ""}
                    onChange={(e) => updatePersonal({ age: toNumberOrNull(e.target.value) })}
                    min={16}
                    max={120}
                  />
                  {renderError("personal.age")}
                </div>

                <div className="settings-field onboarding-field">
                  <label htmlFor="occupation">עיסוק / תפקיד</label>
                  <input
                    id="occupation"
                    type="text"
                    className="settings-input"
                    value={profile.personal.occupation ?? ""}
                    onChange={(e) => updatePersonal({ occupation: e.target.value || null })}
                    placeholder="לדוגמה: מהנדס/ת תוכנה"
                  />
                  {renderError("personal.occupation")}
                </div>

                <div className="settings-field onboarding-field">
                  <label>מצב משפחתי</label>
                  <div className="onboarding-choice-grid" style={{ marginTop: 10, gridTemplateColumns: "1fr 1fr" }}>
                    {MARITAL_OPTIONS.map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        className={`onboarding-choice ${profile.personal.maritalStatus === opt.id ? "is-selected" : ""}`}
                        onClick={() => updatePersonal({ maritalStatus: opt.id })}
                        disabled={saving || finishing}
                        aria-pressed={profile.personal.maritalStatus === opt.id}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                  {renderError("personal.maritalStatus")}
                </div>

                <div className="settings-field onboarding-field">
                  <label htmlFor="childrenCount">מספר ילדים</label>
                  <input
                    id="childrenCount"
                    type="number"
                    inputMode="numeric"
                    className="settings-input"
                    value={profile.personal.childrenCount ?? ""}
                    onChange={(e) => updatePersonal({ childrenCount: toNumberOrNull(e.target.value) })}
                    min={0}
                    max={20}
                  />
                  {renderError("personal.childrenCount")}
                </div>
              </>
            ) : null}

            {/* STEP 2: Employment */}
            {step === 2 ? (
              <>
                <h2 style={{ margin: "0.25rem 0 0.5rem", fontSize: "1.25rem" }}>תעסוקה ושכר</h2>

                <div className="settings-field onboarding-field">
                  <label>סוג שכר</label>
                  <div className="onboarding-choice-grid" style={{ marginTop: 10, gridTemplateColumns: "1fr 1fr" }}>
                    {([
                      { id: "global", label: "גלובלי (חודשי)" },
                      { id: "hourly", label: "שעתי" },
                    ] as Array<{ id: SalaryType; label: string }>).map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        className={`onboarding-choice ${profile.employment.salaryType === opt.id ? "is-selected" : ""}`}
                        onClick={() => updateEmployment({ salaryType: opt.id })}
                        disabled={saving || finishing}
                        aria-pressed={profile.employment.salaryType === opt.id}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                  {renderError("employment.salaryType")}
                </div>

                {showMonthlyGross ? (
                  <div className="settings-field onboarding-field">
                    <label htmlFor="expectedMonthlyGross">ברוטו חודשי צפוי (הערכה)</label>
                    <input
                      id="expectedMonthlyGross"
                      type="number"
                      inputMode="decimal"
                      className="settings-input"
                      value={profile.employment.expectedMonthlyGross ?? ""}
                      onChange={(e) => updateEmployment({ expectedMonthlyGross: toNumberOrNull(e.target.value) })}
                    />
                    {renderError("employment.expectedMonthlyGross")}
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
                        value={profile.employment.hourlyRate ?? ""}
                        onChange={(e) => updateEmployment({ hourlyRate: toNumberOrNull(e.target.value) })}
                      />
                      {renderError("employment.hourlyRate")}
                    </div>
                    <div className="settings-field onboarding-field">
                      <label htmlFor="expectedMonthlyHours">שעות חודשיות צפויות</label>
                      <input
                        id="expectedMonthlyHours"
                        type="number"
                        inputMode="numeric"
                        className="settings-input"
                        value={profile.employment.expectedMonthlyHours ?? ""}
                        onChange={(e) => updateEmployment({ expectedMonthlyHours: toNumberOrNull(e.target.value) })}
                      />
                      {renderError("employment.expectedMonthlyHours")}
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
                    value={profile.employment.jobPercentage ?? ""}
                    onChange={(e) => updateEmployment({ jobPercentage: toNumberOrNull(e.target.value) })}
                  />
                  {renderError("employment.jobPercentage")}
                </div>

                <div className="settings-field onboarding-field">
                  <label>זו העבודה העיקרית שלי</label>
                  <div className="onboarding-choice-row" style={{ marginTop: 10 }}>
                    <button type="button" className={`onboarding-choice ${profile.employment.isPrimaryJob === true ? "is-selected" : ""}`} onClick={() => updateEmployment({ isPrimaryJob: true })} disabled={saving || finishing}>כן</button>
                    <button type="button" className={`onboarding-choice ${profile.employment.isPrimaryJob === false ? "is-selected" : ""}`} onClick={() => updateEmployment({ isPrimaryJob: false })} disabled={saving || finishing}>לא</button>
                  </div>
                  {renderError("employment.isPrimaryJob")}
                </div>

                <div className="settings-field onboarding-field">
                  <label>יש לי יותר ממעסיק אחד</label>
                  <div className="onboarding-choice-row" style={{ marginTop: 10 }}>
                    <button type="button" className={`onboarding-choice ${profile.employment.hasMultipleEmployers === true ? "is-selected" : ""}`} onClick={() => updateEmployment({ hasMultipleEmployers: true })} disabled={saving || finishing}>כן</button>
                    <button type="button" className={`onboarding-choice ${profile.employment.hasMultipleEmployers === false ? "is-selected" : ""}`} onClick={() => updateEmployment({ hasMultipleEmployers: false })} disabled={saving || finishing}>לא</button>
                  </div>
                  {renderError("employment.hasMultipleEmployers")}
                </div>

                <div className="settings-field onboarding-field">
                  <label htmlFor="employmentStartDate">תאריך תחילת עבודה</label>
                  <input
                    id="employmentStartDate"
                    type="date"
                    className="settings-input"
                    dir="ltr"
                    value={profile.employment.employmentStartDate ?? ""}
                    onChange={(e) => updateEmployment({ employmentStartDate: e.target.value || null })}
                  />
                  {renderError("employment.employmentStartDate")}
                </div>
              </>
            ) : null}

            {/* STEP 3: Assets */}
            {step === 3 ? (
              <>
                <h2 style={{ margin: "0.25rem 0 0.5rem", fontSize: "1.25rem" }}>נכסים והתחייבויות</h2>

                <div className="settings-field onboarding-field">
                  <label>בבעלותי דירה</label>
                  <div className="onboarding-choice-row" style={{ marginTop: 10 }}>
                    <button type="button" className={`onboarding-choice ${profile.assets.ownsApartment === true ? "is-selected" : ""}`} onClick={() => updateAssets({ ownsApartment: true })} disabled={saving || finishing}>כן</button>
                    <button type="button" className={`onboarding-choice ${profile.assets.ownsApartment === false ? "is-selected" : ""}`} onClick={() => updateAssets({ ownsApartment: false })} disabled={saving || finishing}>לא</button>
                  </div>
                  {renderError("assets.ownsApartment")}
                </div>

                <div className="settings-field onboarding-field">
                  <label>בבעלותי רכב</label>
                  <div className="onboarding-choice-row" style={{ marginTop: 10 }}>
                    <button type="button" className={`onboarding-choice ${profile.assets.ownsCar === true ? "is-selected" : ""}`} onClick={() => updateAssets({ ownsCar: true })} disabled={saving || finishing}>כן</button>
                    <button type="button" className={`onboarding-choice ${profile.assets.ownsCar === false ? "is-selected" : ""}`} onClick={() => updateAssets({ ownsCar: false })} disabled={saving || finishing}>לא</button>
                  </div>
                  {renderError("assets.ownsCar")}
                </div>

                <div className="settings-field onboarding-field">
                  <label>יש לי משכנתא</label>
                  <div className="onboarding-choice-row" style={{ marginTop: 10 }}>
                    <button type="button" className={`onboarding-choice ${profile.assets.hasMortgage === true ? "is-selected" : ""}`} onClick={() => updateAssets({ hasMortgage: true })} disabled={saving || finishing}>כן</button>
                    <button type="button" className={`onboarding-choice ${profile.assets.hasMortgage === false ? "is-selected" : ""}`} onClick={() => updateAssets({ hasMortgage: false, mortgageMonthlyPayment: null })} disabled={saving || finishing}>לא</button>
                  </div>
                  {renderError("assets.hasMortgage")}
                </div>

                {profile.assets.hasMortgage === true ? (
                  <div className="settings-field onboarding-field">
                    <label htmlFor="mortgageMonthlyPayment">תשלום משכנתא חודשי (אופציונלי)</label>
                    <input
                      id="mortgageMonthlyPayment"
                      type="number"
                      inputMode="decimal"
                      className="settings-input"
                      value={profile.assets.mortgageMonthlyPayment ?? ""}
                      onChange={(e) => updateAssets({ mortgageMonthlyPayment: toNumberOrNull(e.target.value) })}
                    />
                    {renderError("assets.mortgageMonthlyPayment")}
                  </div>
                ) : null}
              </>
            ) : null}

            {/* STEP 4: Insurance */}
            {step === 4 ? (
              <>
                <h2 style={{ margin: "0.25rem 0 0.5rem", fontSize: "1.25rem" }}>ביטוחים קיימים</h2>
                <p style={{ opacity: 0.75, fontSize: "0.95rem", marginBottom: "0.75rem" }}>
                  סמנו אילו ביטוחים כבר יש לכם. נשתמש בזה כדי להמליץ על מה שחסר.
                </p>

                {([
                  ["hasLifeInsurance", "ביטוח חיים"],
                  ["hasHealthInsurance", "ביטוח בריאות פרטי"],
                  ["hasDisabilityInsurance", "ביטוח אובדן כושר עבודה"],
                  ["hasApartmentInsurance", "ביטוח דירה / תכולה"],
                  ["hasCarInsurance", "ביטוח רכב"],
                ] as Array<[keyof OnboardingProfile["insurance"], string]>).map(([key, label]) => (
                  <div key={key} className="settings-field onboarding-field">
                    <label>{label}</label>
                    <div className="onboarding-choice-row" style={{ marginTop: 10 }}>
                      <button
                        type="button"
                        className={`onboarding-choice ${profile.insurance[key] === true ? "is-selected" : ""}`}
                        onClick={() => updateInsurance({ [key]: true } as Partial<OnboardingProfile["insurance"]>)}
                        disabled={saving || finishing}
                      >
                        יש לי
                      </button>
                      <button
                        type="button"
                        className={`onboarding-choice ${profile.insurance[key] === false ? "is-selected" : ""}`}
                        onClick={() => updateInsurance({ [key]: false } as Partial<OnboardingProfile["insurance"]>)}
                        disabled={saving || finishing}
                      >
                        אין לי
                      </button>
                    </div>
                    {renderError(`insurance.${key}`)}
                  </div>
                ))}
              </>
            ) : null}

            {/* STEP 5: Retirement + Investments + Financial */}
            {step === 5 ? (
              <>
                <h2 style={{ margin: "0.25rem 0 0.5rem", fontSize: "1.25rem" }}>פנסיה, חיסכון והשקעות</h2>

                <div className="settings-field onboarding-field">
                  <label>יש לי פנסיה פעילה</label>
                  <div className="onboarding-choice-row" style={{ marginTop: 10 }}>
                    <button type="button" className={`onboarding-choice ${profile.retirement.hasPension === true ? "is-selected" : ""}`} onClick={() => updateRetirement({ hasPension: true })} disabled={saving || finishing}>כן</button>
                    <button type="button" className={`onboarding-choice ${profile.retirement.hasPension === false ? "is-selected" : ""}`} onClick={() => updateRetirement({ hasPension: false })} disabled={saving || finishing}>לא</button>
                  </div>
                  {renderError("retirement.hasPension")}
                </div>

                <div className="settings-field onboarding-field">
                  <label>יש לי קרן השתלמות</label>
                  <div className="onboarding-choice-row" style={{ marginTop: 10 }}>
                    <button type="button" className={`onboarding-choice ${profile.retirement.hasStudyFund === true ? "is-selected" : ""}`} onClick={() => updateRetirement({ hasStudyFund: true })} disabled={saving || finishing}>כן</button>
                    <button type="button" className={`onboarding-choice ${profile.retirement.hasStudyFund === false ? "is-selected" : ""}`} onClick={() => updateRetirement({ hasStudyFund: false })} disabled={saving || finishing}>לא</button>
                  </div>
                  {renderError("retirement.hasStudyFund")}
                </div>

                <div className="settings-field onboarding-field">
                  <label>יש לי השקעות פיננסיות נוספות</label>
                  <div className="onboarding-choice-row" style={{ marginTop: 10 }}>
                    <button type="button" className={`onboarding-choice ${profile.retirement.hasInvestmentFunds === true ? "is-selected" : ""}`} onClick={() => updateRetirement({ hasInvestmentFunds: true })} disabled={saving || finishing}>כן</button>
                    <button type="button" className={`onboarding-choice ${profile.retirement.hasInvestmentFunds === false ? "is-selected" : ""}`} onClick={() => updateRetirement({ hasInvestmentFunds: false, investmentTypes: [] })} disabled={saving || finishing}>לא</button>
                  </div>
                  {renderError("retirement.hasInvestmentFunds")}
                </div>

                {profile.retirement.hasInvestmentFunds === true ? (
                  <div className="settings-field onboarding-field">
                    <label>סוגי השקעה (ניתן לסמן מספר)</label>
                    <div className="onboarding-choice-grid" style={{ marginTop: 10, gridTemplateColumns: "1fr 1fr" }}>
                      {INVESTMENT_OPTIONS.map((opt) => {
                        const selected = profile.retirement.investmentTypes.includes(opt.id);
                        return (
                          <button
                            key={opt.id}
                            type="button"
                            className={`onboarding-choice ${selected ? "is-selected" : ""}`}
                            onClick={() => toggleInvestmentType(opt.id)}
                            disabled={saving || finishing}
                            aria-pressed={selected}
                          >
                            {opt.label}
                          </button>
                        );
                      })}
                    </div>
                    {renderError("retirement.investmentTypes")}
                  </div>
                ) : null}

                <div className="settings-field onboarding-field">
                  <label htmlFor="monthlyExpensesEstimate">הוצאות חודשיות משוערות (אופציונלי)</label>
                  <input
                    id="monthlyExpensesEstimate"
                    type="number"
                    inputMode="decimal"
                    className="settings-input"
                    value={profile.financial.monthlyExpensesEstimate ?? ""}
                    onChange={(e) => updateFinancial({ monthlyExpensesEstimate: toNumberOrNull(e.target.value) })}
                  />
                  {renderError("financial.monthlyExpensesEstimate")}
                </div>
              </>
            ) : null}

            {/* STEP 6: Summary */}
            {step === 6 ? (
              <>
                <h2 style={{ margin: "0.25rem 0 0.5rem", fontSize: "1.25rem" }}>סיכום</h2>
                <p style={{ opacity: 0.75, fontSize: "0.95rem", marginBottom: "1rem" }}>
                  בסיום נכין עבורך תובנות והמלצות מותאמות אישית. אפשר לחזור ולערוך את הפרטים בכל זמן מ-הגדרות.
                </p>

                <SummaryBlock label="פרטים אישיים" rows={[
                  ["שם", profile.personal.fullName],
                  ["גיל", profile.personal.age],
                  ["עיסוק", profile.personal.occupation],
                  ["מצב משפחתי", MARITAL_OPTIONS.find((o) => o.id === profile.personal.maritalStatus)?.label ?? null],
                  ["ילדים", profile.personal.childrenCount],
                ]} />

                <SummaryBlock label="תעסוקה" rows={[
                  ["סוג שכר", profile.employment.salaryType === "global" ? "גלובלי" : profile.employment.salaryType === "hourly" ? "שעתי" : null],
                  ["ברוטו חודשי צפוי", profile.employment.expectedMonthlyGross],
                  ["שכר שעתי", profile.employment.hourlyRate],
                  ["אחוז משרה", profile.employment.jobPercentage],
                  ["עבודה עיקרית", profile.employment.isPrimaryJob == null ? null : profile.employment.isPrimaryJob ? "כן" : "לא"],
                ]} />

                <SummaryBlock label="נכסים" rows={[
                  ["דירה", profile.assets.ownsApartment == null ? null : profile.assets.ownsApartment ? "כן" : "לא"],
                  ["רכב", profile.assets.ownsCar == null ? null : profile.assets.ownsCar ? "כן" : "לא"],
                  ["משכנתא", profile.assets.hasMortgage == null ? null : profile.assets.hasMortgage ? "כן" : "לא"],
                ]} />

                <SummaryBlock label="ביטוחים קיימים" rows={[
                  ["ביטוח חיים", profile.insurance.hasLifeInsurance == null ? null : profile.insurance.hasLifeInsurance ? "כן" : "לא"],
                  ["ביטוח בריאות פרטי", profile.insurance.hasHealthInsurance == null ? null : profile.insurance.hasHealthInsurance ? "כן" : "לא"],
                  ["אובדן כושר", profile.insurance.hasDisabilityInsurance == null ? null : profile.insurance.hasDisabilityInsurance ? "כן" : "לא"],
                  ["דירה", profile.insurance.hasApartmentInsurance == null ? null : profile.insurance.hasApartmentInsurance ? "כן" : "לא"],
                  ["רכב", profile.insurance.hasCarInsurance == null ? null : profile.insurance.hasCarInsurance ? "כן" : "לא"],
                ]} />

                <SummaryBlock label="חיסכון" rows={[
                  ["פנסיה", profile.retirement.hasPension == null ? null : profile.retirement.hasPension ? "כן" : "לא"],
                  ["קרן השתלמות", profile.retirement.hasStudyFund == null ? null : profile.retirement.hasStudyFund ? "כן" : "לא"],
                  ["השקעות נוספות", profile.retirement.hasInvestmentFunds == null ? null : profile.retirement.hasInvestmentFunds ? "כן" : "לא"],
                ]} />
              </>
            ) : null}

            <div style={{ display: "flex", gap: 10, marginTop: "1.25rem" }}>
              {step > 1 ? (
                <button className="auth-link is-inline" type="button" onClick={handleBack} disabled={saving || finishing}>
                  חזרה
                </button>
              ) : null}

              {step < TOTAL_STEPS ? (
                <button className="auth-button" type="button" onClick={handleNext} disabled={saving || finishing}>
                  {saving ? "שומר..." : "המשך"}
                </button>
              ) : (
                <button className="auth-button" type="button" onClick={handleFinish} disabled={saving || finishing}>
                  {finishing ? "מסיים..." : "סיום"}
                </button>
              )}
            </div>
          </div>

          {introOpen ? (
            <div className="auth-modal-backdrop" role="presentation" onClick={() => {}} style={{ cursor: "default" }}>
              <section
                className="auth-modal"
                role="dialog"
                aria-modal="true"
                aria-labelledby="onboarding-intro-title"
                onClick={(event) => event.stopPropagation()}
              >
                <header className="auth-modal-header">
                  <div>
                    <h2 id="onboarding-intro-title">הגדרה קצרה (כמה דקות)</h2>
                    <p>כדי שנוכל לנתח את התלושים, לזהות חסרים בביטוחים ולתת המלצות אישיות.</p>
                  </div>
                </header>
                <div style={{ display: "grid", gap: 10, marginTop: 10 }}>
                  <ul style={{ margin: 0, paddingInlineStart: 18, lineHeight: 1.6 }}>
                    <li>נשמור על הפרטים שלך מוצפנים – משמש רק להמלצות.</li>
                    <li>אפשר לדלג על שדות לא חובה ולחזור אליהם מאוחר יותר.</li>
                    <li>בכל שלב ניתן לחזור אחורה ולערוך.</li>
                  </ul>
                  <button className="auth-button" type="button" onClick={() => setIntroOpen(false)}>
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

function SummaryBlock({ label, rows }: { label: string; rows: Array<[string, string | number | null | undefined]> }) {
  const filled = rows.filter(([, v]) => v != null && v !== "");
  if (filled.length === 0) return null;
  return (
    <div className="settings-field onboarding-field" style={{ borderRadius: 12, padding: "12px 14px", background: "rgba(124, 58, 237, 0.06)" }}>
      <strong style={{ display: "block", marginBottom: 8 }}>{label}</strong>
      <div style={{ display: "grid", gap: 4, fontSize: "0.95rem" }}>
        {filled.map(([k, v]) => (
          <div key={k} style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
            <span style={{ opacity: 0.75 }}>{k}</span>
            <span style={{ fontWeight: 500 }}>{String(v)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
