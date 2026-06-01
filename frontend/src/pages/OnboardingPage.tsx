import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Loader from "../components/ui/Loader";
import { APP_ROUTES } from "../types/navigation";
import { useAuth } from "../auth/AuthProvider";
import {
  EMPTY_PROFILE,
  completeOnboarding,
  getOnboarding,
  updateOnboarding,
  type Gender,
  type InvestmentType,
  type MaritalStatus,
  type OnboardingPatch,
  type OnboardingProfile,
  type SalaryType,
} from "../api/onboarding.api";

const TOTAL_STEPS = 5;
type StepNumber = 1 | 2 | 3 | 4 | 5;

const STEPS: Array<{ num: StepNumber; title: string; sub: string }> = [
  { num: 1, title: "פרטים אישיים",   sub: "זהות, גיל וסטטוס משפחתי" },
  { num: 2, title: "תעסוקה ושכר",    sub: "פרטי העסקה ותנאים" },
  { num: 3, title: "פנסיה וחיסכון",  sub: "קרנות, אחוזים והשקעות" },
  { num: 4, title: "נכסים וביטוחים", sub: "רכוש קיים וכיסוי ביטוחי" },
  { num: 5, title: "סיכום",           sub: "סקירה ואישור" },
];

const GENDER_OPTIONS: Array<{ id: Gender; label: string }> = [
  { id: "male",   label: "זכר" },
  { id: "female", label: "נקבה" },
  { id: "other",  label: "אחר" },
];

const MARITAL_OPTIONS: Array<{ id: MaritalStatus; label: string }> = [
  { id: "single",    label: "רווק/ה" },
  { id: "married",   label: "נשוי/ה" },
  { id: "partnered", label: "ידוע/ה בציבור" },
  { id: "divorced",  label: "גרוש/ה" },
  { id: "widowed",   label: "אלמן/ה" },
];

const INVESTMENT_OPTIONS: Array<{ id: InvestmentType; label: string }> = [
  { id: "stocks",      label: "מניות" },
  { id: "bonds",       label: 'אג"ח' },
  { id: "real_estate", label: 'נדל"ן' },
  { id: "crypto",      label: "קריפטו" },
  { id: "other",       label: "אחר" },
];

type FieldErrors = Record<string, string>;

function toNum(raw: string): number | null {
  const t = raw.trim();
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

function deepMerge(base: OnboardingProfile, patch: Partial<OnboardingProfile>): OnboardingProfile {
  return {
    personal: {
      ...base.personal,
      ...(patch.personal ?? {}),
      childrenAges: patch.personal?.childrenAges ?? base.personal.childrenAges,
    },
    financial:  { ...base.financial,  ...(patch.financial  ?? {}) },
    assets:     { ...base.assets,     ...(patch.assets     ?? {}) },
    insurance:  { ...base.insurance,  ...(patch.insurance  ?? {}) },
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

  const [step, setStep]         = useState<StepNumber>(1);
  const [introOpen, setIntroOpen] = useState(true);
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [error, setError]       = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [profile, setProfile]   = useState<OnboardingProfile>(EMPTY_PROFILE);

  const progressPct = useMemo(() => (step / 3) * 100, [step]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const res = await getOnboarding();
    setLoading(false);
    if (!res.success) { setError(res.message ?? "לא הצלחנו לטעון."); return; }
    if (res.data?.data) setProfile((prev) => deepMerge(prev, res.data!.data));
    if (res.data?.completed) { await refresh(); navigate(APP_ROUTES.dashboard, { replace: true }); }
  }, [navigate, refresh]);

  useEffect(() => {
    const id = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(id);
  }, [load]);

  const applyErrors = (errs?: Array<{ field?: string; message?: string }>) => {
    if (!errs?.length) return;
    const next: FieldErrors = {};
    for (const e of errs) { if (e.field) next[e.field] = e.message ?? "שדה לא תקין"; }
    setFieldErrors(next);
  };

  const buildPatch = useCallback((s: StepNumber): OnboardingPatch => {
    switch (s) {
      case 1: return { personal: profile.personal };
      case 2: return { employment: profile.employment };
      case 3: return {
        retirement: profile.retirement,
        financial:  profile.financial,
        employment: {
          pensionEmployeeRate:   profile.employment.pensionEmployeeRate,
          pensionEmployerRate:   profile.employment.pensionEmployerRate,
          studyFundEmployeeRate: profile.employment.studyFundEmployeeRate,
          studyFundEmployerRate: profile.employment.studyFundEmployerRate,
        },
      };
      case 4: return { assets: profile.assets, insurance: profile.insurance };
      default: return {};
    }
  }, [profile]);

  const saveStep = useCallback(async (s: StepNumber) => {
    const patch = buildPatch(s);
    if (!Object.keys(patch).length) return true;
    setSaving(true); setError(null); setFieldErrors({});
    const res = await updateOnboarding(patch, [`step-${s}`]);
    setSaving(false);
    if (!res.success) { setError(res.message ?? "לא הצלחנו לשמור."); applyErrors(res.errors); return false; }
    if (res.data?.data) setProfile((prev) => deepMerge(prev, res.data!.data));
    return true;
  }, [buildPatch]);

  const handleNext = useCallback(async () => {
    if (saving || finishing) return;
    const ok = await saveStep(step);
    if (ok) setStep((s) => (s < TOTAL_STEPS ? (s + 1) as StepNumber : s));
  }, [finishing, saveStep, saving, step]);

  const handleBack = useCallback(() => {
    if (saving || finishing) return;
    setError(null); setFieldErrors({});
    setStep((s) => (s > 1 ? (s - 1) as StepNumber : s));
  }, [finishing, saving]);

  const handleFinish = useCallback(async () => {
    if (saving || finishing) return;
    setFinishing(true); setError(null); setFieldErrors({});
    const ok = await saveStep(step);
    if (!ok) { setFinishing(false); return; }
    const res = await completeOnboarding();
    setFinishing(false);
    if (!res.success || !res.data?.completed) {
      setError(res.errors?.length ? "חסרים עוד כמה פרטים." : (res.message ?? "לא הצלחנו להשלים."));
      applyErrors(res.errors);
      return;
    }
    await refresh();
    navigate(APP_ROUTES.dashboard, { replace: true });
  }, [finishing, navigate, refresh, saveStep, saving, step]);

  const updP = (p: Partial<OnboardingProfile["personal"]>)   => setProfile((x) => ({ ...x, personal:   { ...x.personal,   ...p } }));
  const updE = (p: Partial<OnboardingProfile["employment"]>) => setProfile((x) => ({ ...x, employment: { ...x.employment, ...p } }));
  const updA = (p: Partial<OnboardingProfile["assets"]>)     => setProfile((x) => ({ ...x, assets:     { ...x.assets,     ...p } }));
  const updI = (p: Partial<OnboardingProfile["insurance"]>)  => setProfile((x) => ({ ...x, insurance:  { ...x.insurance,  ...p } }));
  const updR = (p: Partial<OnboardingProfile["retirement"]>) => setProfile((x) => ({ ...x, retirement: { ...x.retirement, ...p } }));
  const updF = (p: Partial<OnboardingProfile["financial"]>)  => setProfile((x) => ({ ...x, financial:  { ...x.financial,  ...p } }));

  const onChildCount = (count: number | null) => {
    const ages = count != null && count > 0
      ? Array.from({ length: count }, (_, i) => profile.personal.childrenAges[i] ?? 0)
      : [];
    updP({ childrenCount: count, childrenAges: ages });
  };

  const toggleInvType = (type: InvestmentType) =>
    setProfile((x) => {
      const has = x.retirement.investmentTypes.includes(type);
      return { ...x, retirement: { ...x.retirement, investmentTypes: has ? x.retirement.investmentTypes.filter((t) => t !== type) : [...x.retirement.investmentTypes, type] } };
    });

  const err = (path: string) =>
    fieldErrors[path] ? <span className="ob2-field-error">{fieldErrors[path]}</span> : null;

  const dis = saving || finishing;
  const isGlobal  = profile.employment.salaryType === "global";
  const isHourly  = profile.employment.salaryType === "hourly";
  const hasSpouse = ["married", "partnered"].includes(profile.personal.maritalStatus ?? "");

  if (loading) {
    return (
      <div className="ob2-page">
        <div style={{ color: "rgba(232,239,255,0.5)", display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
          <Loader />
          <span style={{ fontSize: "0.9rem" }}>טוענים...</span>
        </div>
      </div>
    );
  }

  const meta = STEPS[step - 1];

  return (
    <div className="ob2-page">
      <div className="ob2-card">

        {/* ── Sidebar ── */}
        <aside className="ob2-sidebar">
          <div className="ob2-brand">
            <div className="ob2-brand-dot">FG</div>
            <span>FinGuide</span>
          </div>
          <ol className="ob2-steps-list">
            {STEPS.map((s) => (
              <li
                key={s.num}
                className={`ob2-step-item${s.num === step ? " is-active" : ""}${s.num < step ? " is-complete" : ""}`}
              >
                <div className="ob2-step-dot">{s.num < step ? "✓" : s.num}</div>
                <div className="ob2-step-meta">
                  <span className="ob2-step-name">{s.title}</span>
                  <span className="ob2-step-sub-text">{s.sub}</span>
                </div>
              </li>
            ))}
          </ol>
        </aside>

        {/* ── Form panel ── */}
        <main className="ob2-main">
          <header className="ob2-step-header">
            <span className="ob2-step-num">שלב {step} / {TOTAL_STEPS}</span>
            <h1 className="ob2-step-title">{meta.title}</h1>
            <p className="ob2-step-desc">{meta.sub}</p>
          </header>

          {error ? <div className="ob2-error-bar">{error}</div> : null}

          <div style={{ marginTop: "0.75rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.95rem" }}>
              <span>שלב {step} מתוך 3</span>
              <span style={{ opacity: 0.8 }}>{Math.round(progressPct)}%</span>
            </div>
            <div className="onboarding-progress-track">
              <div
                className="onboarding-progress-fill"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>

          <div className="ob2-fields" key={`step-${step}`} style={{ animation: "ob2-step-in 0.22s ease-out" }}>

            {/* Step 1 — Personal */}
            {step === 1 && <>
              <div className="ob2-field">
                <label className="ob2-label">שם מלא <span className="ob2-label-hint">(אופציונלי)</span></label>
                <input type="text" className="ob2-input"
                  value={profile.personal.fullName ?? ""}
                  onChange={(e) => updP({ fullName: e.target.value || null })}
                  placeholder="לדוגמה: דנה כהן"
                />
                {err("personal.fullName")}
              </div>

              <div className="ob2-field">
                <label className="ob2-label">מגדר</label>
                <div className="ob2-choice-grid-3">
                  {GENDER_OPTIONS.map((o) => (
                    <button key={o.id} type="button" disabled={dis}
                      className={`ob2-choice${profile.personal.gender === o.id ? " is-selected" : ""}`}
                      onClick={() => updP({ gender: o.id })}
                    >{o.label}</button>
                  ))}
                </div>
                {err("personal.gender")}
              </div>

              <div className="ob2-field">
                <label className="ob2-label">גיל</label>
                <input type="number" inputMode="numeric" className="ob2-input"
                  value={profile.personal.age ?? ""} min={16} max={120} placeholder="34"
                  onChange={(e) => updP({ age: toNum(e.target.value) })}
                />
                {err("personal.age")}
              </div>

              <div className="ob2-field">
                <label className="ob2-label">עיסוק / תפקיד <span className="ob2-label-hint">(אופציונלי)</span></label>
                <input type="text" className="ob2-input"
                  value={profile.personal.occupation ?? ""}
                  onChange={(e) => updP({ occupation: e.target.value || null })}
                  placeholder="לדוגמה: מהנדסת תוכנה"
                />
                {err("personal.occupation")}
              </div>

              <div className="ob2-field">
                <label className="ob2-label">מצב משפחתי</label>
                <div className="ob2-choice-grid-2">
                  {MARITAL_OPTIONS.map((o) => (
                    <button key={o.id} type="button" disabled={dis}
                      className={`ob2-choice${profile.personal.maritalStatus === o.id ? " is-selected" : ""}`}
                      onClick={() => updP({ maritalStatus: o.id })}
                    >{o.label}</button>
                  ))}
                </div>
                {err("personal.maritalStatus")}
              </div>

              {hasSpouse && (
                <div className="ob2-field">
                  <label className="ob2-label">בן / בת הזוג עובדים?</label>
                  <div className="ob2-choice-row">
                    <button type="button" disabled={dis}
                      className={`ob2-choice${profile.personal.spouseWorks === true ? " is-selected" : ""}`}
                      onClick={() => updP({ spouseWorks: true })}>כן</button>
                    <button type="button" disabled={dis}
                      className={`ob2-choice${profile.personal.spouseWorks === false ? " is-selected" : ""}`}
                      onClick={() => updP({ spouseWorks: false })}>לא</button>
                  </div>
                  {err("personal.spouseWorks")}
                </div>
              )}

              <div className="ob2-field">
                <label className="ob2-label">מספר ילדים</label>
                <input type="number" inputMode="numeric" className="ob2-input"
                  value={profile.personal.childrenCount ?? ""} min={0} max={20} placeholder="0"
                  onChange={(e) => onChildCount(toNum(e.target.value))}
                />
                {err("personal.childrenCount")}
              </div>

              {(profile.personal.childrenCount ?? 0) > 0 && (
                <div className="ob2-field">
                  <label className="ob2-label">
                    גיל הילדים <span className="ob2-label-hint">(משפיע על נקודות זיכוי)</span>
                  </label>
                  <div className="ob2-ages-grid">
                    {Array.from({ length: profile.personal.childrenCount! }).map((_, i) => (
                      <input key={i} type="number" inputMode="numeric" className="ob2-input"
                        value={profile.personal.childrenAges[i] ?? ""}
                        min={0} max={25} placeholder={`ילד ${i + 1}`}
                        onChange={(e) => {
                          const ages = [...profile.personal.childrenAges];
                          ages[i] = toNum(e.target.value) ?? 0;
                          updP({ childrenAges: ages });
                        }}
                      />
                    ))}
                  </div>
                  {err("personal.childrenAges")}
                </div>
              )}
            </>}

            {/* Step 2 — Employment */}
            {step === 2 && <>
              <div className="ob2-field">
                <label className="ob2-label">סוג שכר</label>
                <div className="ob2-choice-row">
                  {([{ id: "global", label: "גלובלי (חודשי)" }, { id: "hourly", label: "שעתי" }] as Array<{ id: SalaryType; label: string }>).map((o) => (
                    <button key={o.id} type="button" disabled={dis}
                      className={`ob2-choice${profile.employment.salaryType === o.id ? " is-selected" : ""}`}
                      onClick={() => updE({ salaryType: o.id })}
                    >{o.label}</button>
                  ))}
                </div>
                {err("employment.salaryType")}
              </div>

              {isGlobal && (
                <div className="ob2-field">
                  <label className="ob2-label">ברוטו חודשי צפוי</label>
                  <div className="ob2-input-row">
                    <input type="number" inputMode="decimal" className="ob2-input"
                      value={profile.employment.expectedMonthlyGross ?? ""} placeholder="12,000"
                      onChange={(e) => updE({ expectedMonthlyGross: toNum(e.target.value) })}
                    />
                    <span className="ob2-input-suffix">₪</span>
                  </div>
                  {err("employment.expectedMonthlyGross")}
                </div>
              )}

              {isHourly && <>
                <div className="ob2-field">
                  <label className="ob2-label">שכר שעתי</label>
                  <div className="ob2-input-row">
                    <input type="number" inputMode="decimal" className="ob2-input"
                      value={profile.employment.hourlyRate ?? ""} placeholder="70"
                      onChange={(e) => updE({ hourlyRate: toNum(e.target.value) })}
                    />
                    <span className="ob2-input-suffix">₪ / שעה</span>
                  </div>
                  {err("employment.hourlyRate")}
                </div>
                <div className="ob2-field">
                  <label className="ob2-label">שעות חודשיות צפויות</label>
                  <input type="number" inputMode="numeric" className="ob2-input"
                    value={profile.employment.expectedMonthlyHours ?? ""} placeholder="182"
                    onChange={(e) => updE({ expectedMonthlyHours: toNum(e.target.value) })}
                  />
                  {err("employment.expectedMonthlyHours")}
                </div>
              </>}

              <div className="ob2-field">
                <label className="ob2-label">אחוז משרה</label>
                <div className="ob2-input-row">
                  <input type="number" inputMode="numeric" className="ob2-input"
                    value={profile.employment.jobPercentage ?? ""} placeholder="100"
                    onChange={(e) => updE({ jobPercentage: toNum(e.target.value) })}
                  />
                  <span className="ob2-input-suffix">%</span>
                </div>
                {err("employment.jobPercentage")}
              </div>

              <div className="ob2-field">
                <label className="ob2-label">זו העבודה העיקרית שלי?</label>
                <div className="ob2-choice-row">
                  <button type="button" disabled={dis} className={`ob2-choice${profile.employment.isPrimaryJob === true ? " is-selected" : ""}`} onClick={() => updE({ isPrimaryJob: true })}>כן</button>
                  <button type="button" disabled={dis} className={`ob2-choice${profile.employment.isPrimaryJob === false ? " is-selected" : ""}`} onClick={() => updE({ isPrimaryJob: false })}>לא</button>
                </div>
                {err("employment.isPrimaryJob")}
              </div>

              <div className="ob2-field">
                <label className="ob2-label">יש לי יותר ממעסיק אחד?</label>
                <div className="ob2-choice-row">
                  <button type="button" disabled={dis} className={`ob2-choice${profile.employment.hasMultipleEmployers === true ? " is-selected" : ""}`} onClick={() => updE({ hasMultipleEmployers: true })}>כן</button>
                  <button type="button" disabled={dis} className={`ob2-choice${profile.employment.hasMultipleEmployers === false ? " is-selected" : ""}`} onClick={() => updE({ hasMultipleEmployers: false })}>לא</button>
                </div>
                {err("employment.hasMultipleEmployers")}
              </div>

              <div className="ob2-field">
                <label className="ob2-label">תאריך תחילת עבודה</label>
                <input type="date" className="ob2-input" dir="ltr" style={{ textAlign: "left" }}
                  value={profile.employment.employmentStartDate ?? ""}
                  onChange={(e) => updE({ employmentStartDate: e.target.value || null })}
                />
                {err("employment.employmentStartDate")}
              </div>

              <div className="ob2-field">
                <label className="ob2-label">
                  יש לי תיאום מס? <span className="ob2-label-hint">(טופס 101)</span>
                </label>
                <div className="ob2-choice-row">
                  <button type="button" disabled={dis} className={`ob2-choice${profile.employment.hasTaxCoordination === true ? " is-selected" : ""}`} onClick={() => updE({ hasTaxCoordination: true })}>יש</button>
                  <button type="button" disabled={dis} className={`ob2-choice${profile.employment.hasTaxCoordination === false ? " is-selected" : ""}`} onClick={() => updE({ hasTaxCoordination: false })}>אין</button>
                </div>
                {err("employment.hasTaxCoordination")}
              </div>
            </>}

            {/* Step 3 — Pension & Savings */}
            {step === 3 && <>
              <div className="ob2-field">
                <label className="ob2-label">יש לי פנסיה פעילה?</label>
                <div className="ob2-choice-row">
                  <button type="button" disabled={dis} className={`ob2-choice${profile.retirement.hasPension === true ? " is-selected" : ""}`} onClick={() => updR({ hasPension: true })}>כן</button>
                  <button type="button" disabled={dis} className={`ob2-choice${profile.retirement.hasPension === false ? " is-selected" : ""}`} onClick={() => updR({ hasPension: false })}>לא</button>
                </div>
                {err("retirement.hasPension")}
              </div>

              {profile.retirement.hasPension === true && (
                <div className="ob2-field">
                  <label className="ob2-label">אחוזי ניכוי פנסיה</label>
                  <div className="ob2-rate-pair">
                    <div>
                      <div className="ob2-label" style={{ fontSize: "0.73rem", marginBottom: 5 }}>עובד</div>
                      <div className="ob2-input-row">
                        <input type="number" inputMode="decimal" className="ob2-input" placeholder="6"
                          value={profile.employment.pensionEmployeeRate ?? ""}
                          onChange={(e) => updE({ pensionEmployeeRate: toNum(e.target.value) })}
                        />
                        <span className="ob2-input-suffix">%</span>
                      </div>
                    </div>
                    <div>
                      <div className="ob2-label" style={{ fontSize: "0.73rem", marginBottom: 5 }}>מעסיק</div>
                      <div className="ob2-input-row">
                        <input type="number" inputMode="decimal" className="ob2-input" placeholder="6.5"
                          value={profile.employment.pensionEmployerRate ?? ""}
                          onChange={(e) => updE({ pensionEmployerRate: toNum(e.target.value) })}
                        />
                        <span className="ob2-input-suffix">%</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div className="ob2-field">
                <label className="ob2-label">יש לי קרן השתלמות?</label>
                <div className="ob2-choice-row">
                  <button type="button" disabled={dis} className={`ob2-choice${profile.retirement.hasStudyFund === true ? " is-selected" : ""}`} onClick={() => updR({ hasStudyFund: true })}>כן</button>
                  <button type="button" disabled={dis} className={`ob2-choice${profile.retirement.hasStudyFund === false ? " is-selected" : ""}`} onClick={() => updR({ hasStudyFund: false })}>לא</button>
                </div>
                {err("retirement.hasStudyFund")}
              </div>

              {profile.retirement.hasStudyFund === true && (
                <div className="ob2-field">
                  <label className="ob2-label">אחוזי הפרשה לקרן השתלמות</label>
                  <div className="ob2-rate-pair">
                    <div>
                      <div className="ob2-label" style={{ fontSize: "0.73rem", marginBottom: 5 }}>עובד</div>
                      <div className="ob2-input-row">
                        <input type="number" inputMode="decimal" className="ob2-input" placeholder="2.5"
                          value={profile.employment.studyFundEmployeeRate ?? ""}
                          onChange={(e) => updE({ studyFundEmployeeRate: toNum(e.target.value) })}
                        />
                        <span className="ob2-input-suffix">%</span>
                      </div>
                    </div>
                    <div>
                      <div className="ob2-label" style={{ fontSize: "0.73rem", marginBottom: 5 }}>מעסיק</div>
                      <div className="ob2-input-row">
                        <input type="number" inputMode="decimal" className="ob2-input" placeholder="7.5"
                          value={profile.employment.studyFundEmployerRate ?? ""}
                          onChange={(e) => updE({ studyFundEmployerRate: toNum(e.target.value) })}
                        />
                        <span className="ob2-input-suffix">%</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div className="ob2-field">
                <label className="ob2-label">יש לי השקעות פיננסיות נוספות?</label>
                <div className="ob2-choice-row">
                  <button type="button" disabled={dis} className={`ob2-choice${profile.retirement.hasInvestmentFunds === true ? " is-selected" : ""}`} onClick={() => updR({ hasInvestmentFunds: true })}>כן</button>
                  <button type="button" disabled={dis} className={`ob2-choice${profile.retirement.hasInvestmentFunds === false ? " is-selected" : ""}`} onClick={() => updR({ hasInvestmentFunds: false, investmentTypes: [] })}>לא</button>
                </div>
              </div>

              {profile.retirement.hasInvestmentFunds === true && (
                <div className="ob2-field">
                  <label className="ob2-label">סוגי השקעה <span className="ob2-label-hint">(ניתן לבחור כמה)</span></label>
                  <div className="ob2-choice-grid-2">
                    {INVESTMENT_OPTIONS.map((o) => (
                      <button key={o.id} type="button" disabled={dis}
                        className={`ob2-choice${profile.retirement.investmentTypes.includes(o.id) ? " is-selected" : ""}`}
                        onClick={() => toggleInvType(o.id)}
                      >{o.label}</button>
                    ))}
                  </div>
                </div>
              )}

              <div className="ob2-field">
                <label className="ob2-label">הוצאות חודשיות משוערות <span className="ob2-label-hint">(אופציונלי)</span></label>
                <div className="ob2-input-row">
                  <input type="number" inputMode="decimal" className="ob2-input" placeholder="7,000"
                    value={profile.financial.monthlyExpensesEstimate ?? ""}
                    onChange={(e) => updF({ monthlyExpensesEstimate: toNum(e.target.value) })}
                  />
                  <span className="ob2-input-suffix">₪</span>
                </div>
                {err("financial.monthlyExpensesEstimate")}
              </div>
            </>}

            {/* Step 4 — Assets & Insurance */}
            {step === 4 && <>
              <div className="ob2-field">
                <label className="ob2-label">בבעלותי דירה?</label>
                <div className="ob2-choice-row">
                  <button type="button" disabled={dis} className={`ob2-choice${profile.assets.ownsApartment === true ? " is-selected" : ""}`} onClick={() => updA({ ownsApartment: true })}>כן</button>
                  <button type="button" disabled={dis} className={`ob2-choice${profile.assets.ownsApartment === false ? " is-selected" : ""}`} onClick={() => updA({ ownsApartment: false })}>לא</button>
                </div>
              </div>

              <div className="ob2-field">
                <label className="ob2-label">בבעלותי רכב?</label>
                <div className="ob2-choice-row">
                  <button type="button" disabled={dis} className={`ob2-choice${profile.assets.ownsCar === true ? " is-selected" : ""}`} onClick={() => updA({ ownsCar: true })}>כן</button>
                  <button type="button" disabled={dis} className={`ob2-choice${profile.assets.ownsCar === false ? " is-selected" : ""}`} onClick={() => updA({ ownsCar: false })}>לא</button>
                </div>
              </div>

              <div className="ob2-field">
                <label className="ob2-label">יש לי משכנתא?</label>
                <div className="ob2-choice-row">
                  <button type="button" disabled={dis} className={`ob2-choice${profile.assets.hasMortgage === true ? " is-selected" : ""}`} onClick={() => updA({ hasMortgage: true })}>כן</button>
                  <button type="button" disabled={dis} className={`ob2-choice${profile.assets.hasMortgage === false ? " is-selected" : ""}`} onClick={() => updA({ hasMortgage: false, mortgageMonthlyPayment: null })}>לא</button>
                </div>
              </div>

              {profile.assets.hasMortgage === true && (
                <div className="ob2-field">
                  <label className="ob2-label">תשלום משכנתא חודשי <span className="ob2-label-hint">(אופציונלי)</span></label>
                  <div className="ob2-input-row">
                    <input type="number" inputMode="decimal" className="ob2-input" placeholder="5,000"
                      value={profile.assets.mortgageMonthlyPayment ?? ""}
                      onChange={(e) => updA({ mortgageMonthlyPayment: toNum(e.target.value) })}
                    />
                    <span className="ob2-input-suffix">₪</span>
                  </div>
                </div>
              )}

              <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: 14 }}>
                <div className="ob2-label" style={{ marginBottom: 12, fontSize: "0.85rem", color: "rgba(232,239,255,0.5)" }}>ביטוחים קיימים</div>
                {([
                  ["hasLifeInsurance",       "ביטוח חיים"],
                  ["hasHealthInsurance",      "ביטוח בריאות פרטי"],
                  ["hasDisabilityInsurance",  "אובדן כושר עבודה"],
                  ["hasApartmentInsurance",   "ביטוח דירה / תכולה"],
                  ["hasCarInsurance",         "ביטוח רכב"],
                ] as Array<[keyof OnboardingProfile["insurance"], string]>).map(([key, label]) => (
                  <div key={key} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 10 }}>
                    <span style={{ fontSize: "0.87rem", color: "rgba(232,239,255,0.62)" }}>{label}</span>
                    <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                      <button type="button" disabled={dis}
                        className={`ob2-choice${profile.insurance[key] === true ? " is-selected" : ""}`}
                        style={{ padding: "6px 14px", fontSize: "0.78rem" }}
                        onClick={() => updI({ [key]: true } as Partial<OnboardingProfile["insurance"]>)}
                      >יש</button>
                      <button type="button" disabled={dis}
                        className={`ob2-choice${profile.insurance[key] === false ? " is-selected" : ""}`}
                        style={{ padding: "6px 14px", fontSize: "0.78rem" }}
                        onClick={() => updI({ [key]: false } as Partial<OnboardingProfile["insurance"]>)}
                      >אין</button>
                    </div>
                  </div>
                ))}
              </div>
            </>}

            {/* Step 5 — Summary */}
            {step === 5 && (
              <div className="ob2-summary">
                <Ob2Group title="פרטים אישיים" rows={[
                  ["שם",           profile.personal.fullName],
                  ["מגדר",         GENDER_OPTIONS.find((g) => g.id === profile.personal.gender)?.label ?? null],
                  ["גיל",          profile.personal.age != null ? String(profile.personal.age) : null],
                  ["עיסוק",        profile.personal.occupation],
                  ["מצב משפחתי",  MARITAL_OPTIONS.find((m) => m.id === profile.personal.maritalStatus)?.label ?? null],
                  ["ילדים",        profile.personal.childrenCount != null ? String(profile.personal.childrenCount) : null],
                  ["בן/בת זוג עובדים", profile.personal.spouseWorks != null ? (profile.personal.spouseWorks ? "כן" : "לא") : null],
                ]} />
                <Ob2Group title="תעסוקה" rows={[
                  ["סוג שכר",       profile.employment.salaryType === "global" ? "גלובלי" : profile.employment.salaryType === "hourly" ? "שעתי" : null],
                  ["ברוטו חודשי",  profile.employment.expectedMonthlyGross != null ? `₪${profile.employment.expectedMonthlyGross.toLocaleString()}` : null],
                  ["אחוז משרה",    profile.employment.jobPercentage != null ? `${profile.employment.jobPercentage}%` : null],
                  ["עבודה עיקרית", profile.employment.isPrimaryJob != null ? (profile.employment.isPrimaryJob ? "כן" : "לא") : null],
                  ["תיאום מס",     profile.employment.hasTaxCoordination != null ? (profile.employment.hasTaxCoordination ? "יש" : "אין") : null],
                ]} />
                <Ob2Group title="פנסיה וחיסכון" rows={[
                  ["פנסיה",          profile.retirement.hasPension != null ? (profile.retirement.hasPension ? "פעיל" : "אין") : null],
                  ["ניכוי עובד",    profile.employment.pensionEmployeeRate != null ? `${profile.employment.pensionEmployeeRate}%` : null],
                  ["הפרשת מעסיק",  profile.employment.pensionEmployerRate != null ? `${profile.employment.pensionEmployerRate}%` : null],
                  ["קרן השתלמות",  profile.retirement.hasStudyFund != null ? (profile.retirement.hasStudyFund ? "פעיל" : "אין") : null],
                ]} />
                <Ob2Group title="נכסים" rows={[
                  ["דירה",     profile.assets.ownsApartment != null ? (profile.assets.ownsApartment ? "כן" : "לא") : null],
                  ["רכב",      profile.assets.ownsCar != null ? (profile.assets.ownsCar ? "כן" : "לא") : null],
                  ["משכנתא",  profile.assets.hasMortgage != null ? (profile.assets.hasMortgage ? "כן" : "לא") : null],
                ]} />
                <p style={{ fontSize: "0.8rem", color: "rgba(232,239,255,0.3)", margin: 0, lineHeight: 1.5 }}>
                  ניתן לחזור אחורה ולערוך בכל שלב. הנתונים ישמרו גם לאחר הסיום דרך הגדרות החשבון.
                </p>
              </div>
            )}
          </div>

          {/* Nav buttons */}
          <div className="ob2-nav">
            {step > 1 && (
              <button className="ob2-btn-back" type="button" onClick={handleBack} disabled={dis}>
                ← חזרה
              </button>
            )}
            {step < TOTAL_STEPS ? (
              <button className="ob2-btn-primary" type="button" onClick={handleNext} disabled={dis}>
                {saving ? "שומר..." : "המשך →"}
              </button>
            ) : (
              <button className="ob2-btn-primary" type="button" onClick={handleFinish} disabled={dis}>
                {finishing ? "מסיים..." : "סיום ✓"}
              </button>
            )}
          </div>
        </main>
      </div>

      {/* Intro modal */}
      {introOpen && (
        <div className="ob2-intro-overlay" role="presentation">
          <section className="ob2-intro-card" dir="rtl" role="dialog" aria-modal="true" aria-labelledby="ob2-intro-title">
            <div className="ob2-intro-logo">
              <div className="ob2-brand-dot" style={{ width: 32, height: 32, fontSize: "0.78rem" }}>FG</div>
              <span>FinGuide</span>
            </div>
            <h2 id="ob2-intro-title" className="ob2-intro-title">הגדרה ראשונית</h2>
            <p className="ob2-intro-desc">
              נאסוף כמה פרטים כדי לנתח את תלושי המשכורת שלך ולהציע המלצות פיננסיות מותאמות.
              זה ייקח כ-3 דקות.
            </p>
            <ul className="ob2-intro-list">
              <li>מידע על ילדים ומגדר משפיע ישירות על חישוב נקודות הזיכוי שלך.</li>
              <li>אחוזי פנסיה וקרן השתלמות מאפשרים זיהוי חריגות בתלוש.</li>
              <li>הנתונים שמורים אצלך בלבד — מוצפנים ולא נמכרים.</li>
            </ul>
            <button className="ob2-btn-primary" type="button" onClick={() => setIntroOpen(false)}>
              בואו נתחיל →
            </button>
          </section>
        </div>
      )}
    </div>
  );
}

function Ob2Group({ title, rows }: { title: string; rows: Array<[string, string | null | undefined]> }) {
  const filled = rows.filter(([, v]) => v != null && v !== "");
  if (!filled.length) return null;
  return (
    <div className="ob2-summary-group">
      <div className="ob2-summary-group-title">{title}</div>
      {filled.map(([k, v]) => (
        <div key={k} className="ob2-summary-row">
          <span className="ob2-summary-key">{k}</span>
          <span className="ob2-summary-val">{v}</span>
        </div>
      ))}
    </div>
  );
}
