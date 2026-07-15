import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, ChevronRight, Check, FileText, Sparkles } from "lucide-react";
import Loader from "../components/ui/Loader";
import { APP_ROUTES } from "../types/navigation";
import { useAuth } from "../auth/AuthProvider";
import {
  completeOnboarding,
  getOnboarding,
  updateOnboarding,
  type EmploymentType,
  type MaritalStatus,
  type OnboardingPatch,
  type SalaryRange,
} from "../api/onboarding.api";

/* ============================================================
   Onboarding — KYC / profile builder in the FinGuide design
   language (faithful to ui_kits/onboarding). Centered question
   per step, signature animated progress bar, save&exit / back
   header, option cards, address autocomplete, confetti finish.
   Reuses the real API: getOnboarding / updateOnboarding /
   completeOnboarding. Field keys map to the OnboardingProfile
   contract; a few design-only fields stay client-side.
   ============================================================ */

const CITIES = ["תל אביב-יפו", "ירושלים", "חיפה", "ראשון לציון", "פתח תקווה", "אשדוד", "נתניה", "באר שבע", "דימונה", "ערד", "אופקים", "נתיבות", "שדרות", "בני ברק", "חולון", "רמת גן", "הרצליה", "כפר סבא", "מודיעין", "רעננה"];
const STREETS = ["הרצל", "ויצמן", "ז'בוטינסקי", "בן גוריון", "אלנבי", "דיזנגוף", "רוטשילד", "סוקולוב", "ביאליק", "ארלוזורוב"];

type Section = "personal" | "employment" | "financial" | "assets" | "insurance" | "retirement";

interface FlowData {
  fullName?: string; age?: string; gender?: string; city?: string; street?: string; maritalStatus?: string;
  childrenCount?: string; educationLevel?: string;
  employmentType?: string; expectedMonthlyGross?: string; employmentStartDate?: string;
  salaryRange?: string; monthlyExpensesEstimate?: string; savingsEstimate?: string;
  ownsApartment?: boolean; ownsCar?: boolean; hasMortgage?: boolean;
  insuranceList?: string[];
  hasPension?: boolean; hasStudyFund?: boolean; hasInvestmentFunds?: boolean;
  riskTolerance?: string; plannedRetirementAge?: string;
}
type DataKey = keyof FlowData;

type Step =
  | { kind: "intro" }
  | { kind: "done" }
  | { kind: "field" | "autocomplete"; section: Section | "extra"; title: string; sub?: string; fields: { key: DataKey; label: string; placeholder?: string; type?: string; options?: string[] }[] }
  | { kind: "single"; section: Section | "extra"; title: string; sub?: string; key: DataKey; options: { value: string; label: string; hint?: string; icon?: boolean }[] }
  | { kind: "multi"; section: Section; title: string; sub?: string; key: DataKey; options: { value: string; label: string }[] }
  | { kind: "yesno"; section: Section; title: string; sub?: string; items: { key: DataKey; label: string }[] };

const FLOW: Step[] = [
  { kind: "intro" },
  { section: "personal", kind: "field", title: "איך קוראים לך?", sub: "כך נפנה אליך בהמשך הדרך.", fields: [{ key: "fullName", label: "שם מלא", placeholder: "אריה כהן" }] },
  { section: "personal", kind: "field", title: "בן כמה אתה?", fields: [{ key: "age", label: "גיל", placeholder: "37", type: "number" }] },
  { section: "personal", kind: "single", title: "מה המין שלך?", key: "gender", options: [{ value: "male", label: "זכר" }, { value: "female", label: "נקבה" }, { value: "other", label: "אחר / לא רוצה לציין" }] },
  { section: "extra", kind: "autocomplete", title: "מה כתובת המגורים שלך?", fields: [{ key: "city", label: "עיר", placeholder: "שם היישוב או העיר", options: CITIES }, { key: "street", label: "רחוב", placeholder: "בחר רחוב", options: STREETS }] },
  { section: "personal", kind: "single", title: "מה המצב המשפחתי שלך?", key: "maritalStatus", options: [{ value: "single", label: "רווק/ה" }, { value: "married", label: "נשוי/אה" }, { value: "partnered", label: "בזוגיות" }, { value: "divorced", label: "גרוש/ה" }, { value: "widowed", label: "אלמן/ה" }] },
  { section: "personal", kind: "field", title: "כמה ילדים יש לך?", sub: "משפיע על נקודות זיכוי במס הכנסה.", fields: [{ key: "childrenCount", label: "מספר ילדים", placeholder: "0", type: "number" }] },
  { section: "personal", kind: "single", title: "מה רמת ההשכלה שלך?", sub: "תואר ראשון מזכה בנקודת זיכוי במס.", key: "educationLevel", options: [{ value: "none", label: "ללא תואר אקדמי" }, { value: "high_school", label: "תיכון / מקצועי" }, { value: "student", label: "סטודנט/ית לתואר ראשון" }, { value: "first_degree", label: "תואר ראשון" }, { value: "second_degree", label: "תואר שני ומעלה" }, { value: "vocational", label: "הכשרה מקצועית" }] },
  { section: "employment", kind: "single", title: "מה סוג ההעסקה שלך?", key: "employmentType", options: [{ value: "employee", label: "שכיר/ה", hint: "מקבל/ת תלוש שכר", icon: true }, { value: "self_employed", label: "עצמאי/ת", hint: "עוסק מורשה / פטור" }, { value: "freelancer", label: "פרילנסר/ית" }, { value: "business_owner", label: "בעל/ת עסק", hint: "מעסיק/ה עובדים" }] },
  { section: "employment", kind: "field", title: "מה השכר החודשי ברוטו הצפוי?", sub: "נתון זה עוזר לחשב זכויות והפרשות.", fields: [{ key: "expectedMonthlyGross", label: "ברוטו חודשי (₪)", placeholder: "20,750", type: "number" }] },
  { section: "employment", kind: "field", title: "מתי התחלת לעבוד במקום הנוכחי?", sub: "עוזר לחשב ותק וזכויות מצטברות.", fields: [{ key: "employmentStartDate", label: "תאריך תחילת עבודה", type: "date" }] },
  { section: "financial", kind: "single", title: "מהי רמת ההכנסה החודשית שלך?", key: "salaryRange", options: [{ value: "under_5k", label: "עד 5,000 ₪" }, { value: "5k_10k", label: "5,000–10,000 ₪" }, { value: "10k_15k", label: "10,000–15,000 ₪" }, { value: "15k_20k", label: "15,000–20,000 ₪" }, { value: "20k_30k", label: "20,000–30,000 ₪" }, { value: "30k_50k", label: "30,000–50,000 ₪" }, { value: "above_50k", label: "מעל 50,000 ₪" }] },
  { section: "financial", kind: "field", title: "כמה אתה מעריך שאתה מוציא ומחסך בחודש?", fields: [{ key: "monthlyExpensesEstimate", label: "הוצאות (₪)", placeholder: "9,000", type: "number" }, { key: "savingsEstimate", label: "חיסכון (₪)", placeholder: "2,500", type: "number" }] },
  { section: "assets", kind: "yesno", title: "מה מהבאים נכון לגביך?", items: [{ key: "ownsApartment", label: "בבעלותי דירה" }, { key: "ownsCar", label: "בבעלותי רכב" }, { key: "hasMortgage", label: "יש לי משכנתא" }] },
  { section: "insurance", kind: "multi", title: "אילו ביטוחים יש לך כיום?", sub: "אפשר לבחור כמה שרוצים — או לדלג אם אין.", key: "insuranceList", options: [{ value: "life", label: "ביטוח חיים" }, { value: "health", label: "ביטוח בריאות" }, { value: "disability", label: "אובדן כושר עבודה" }, { value: "apartment", label: "ביטוח דירה" }, { value: "car", label: "ביטוח רכב" }] },
  { section: "retirement", kind: "yesno", title: "מה יש לך מבחינת חיסכון פנסיוני?", items: [{ key: "hasPension", label: "קרן פנסיה" }, { key: "hasStudyFund", label: "קרן השתלמות" }, { key: "hasInvestmentFunds", label: "תיק השקעות / קרנות" }] },
  { section: "extra", kind: "single", title: "איך היית מגדיר את יחסך לסיכון?", sub: "כדי להתאים לך מסלול השקעה מדויק.", key: "riskTolerance", options: [{ value: "averse", label: "שונא סיכון", hint: "מעדיף/ה יציבות על פני תשואה" }, { value: "balanced", label: "באמצע", hint: "איזון בין סיכון לתשואה" }, { value: "seeking", label: "אוהב סיכון", hint: "מוכן/ה לתנודתיות לתשואה גבוהה" }] },
  { section: "retirement", kind: "field", title: "באיזה גיל היית רוצה לפרוש?", fields: [{ key: "plannedRetirementAge", label: "גיל פרישה מתוכנן", placeholder: "67", type: "number" }] },
  { kind: "done" },
];

const SECTION_LABEL: Record<Section, string> = { personal: "פרטים אישיים", employment: "תעסוקה", financial: "פיננסי", assets: "נכסים", insurance: "ביטוח", retirement: "פנסיה" };

function toNum(raw?: string): number | null {
  if (raw == null) return null;
  const t = String(raw).replace(/,/g, "").trim();
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

/** Map a backend error field path (e.g. "personal.age") to the FLOW step that
    collects it + the data key to highlight. Returns null for derived/unmapped
    fields (e.g. employment.salaryType, which the flow never asks). */
function locateField(path: string): { index: number; key: string } | null {
  const dot = path.indexOf(".");
  const section = dot >= 0 ? path.slice(0, dot) : path;
  const field = dot >= 0 ? path.slice(dot + 1) : "";
  for (let idx = 0; idx < FLOW.length; idx++) {
    const s = FLOW[idx];
    if (!("section" in s) || s.section !== section) continue;
    if (s.kind === "single" && s.key === field) return { index: idx, key: s.key };
    if (s.kind === "multi" && s.key === field) return { index: idx, key: s.key };
    if (s.kind === "field" || s.kind === "autocomplete") {
      const f = s.fields.find(ff => ff.key === field);
      if (f) return { index: idx, key: f.key as string };
    }
    if (s.kind === "yesno") {
      const it = s.items.find(ii => ii.key === field);
      if (it) return { index: idx, key: it.key as string };
    }
  }
  return null;
}

function buildSectionPatch(section: Section, d: FlowData): OnboardingPatch {
  switch (section) {
    case "personal":
      return {
        personal: {
          fullName: d.fullName?.trim() || null,
          age: toNum(d.age),
          gender: (d.gender as "male" | "female" | "other") ?? null,
          maritalStatus: (d.maritalStatus as MaritalStatus) ?? null,
          childrenCount: toNum(d.childrenCount),
          residenceCity: d.city?.trim() || null,
          educationLevel: (d.educationLevel as "none" | "high_school" | "first_degree" | "second_degree" | "vocational" | "student") ?? null,
        },
      };
    case "employment":
      return { employment: { employmentType: (d.employmentType as EmploymentType) ?? null, expectedMonthlyGross: toNum(d.expectedMonthlyGross), employmentStartDate: d.employmentStartDate || null } };
    case "financial":
      return { financial: { salaryRange: (d.salaryRange as SalaryRange) ?? null, monthlyExpensesEstimate: toNum(d.monthlyExpensesEstimate), savingsEstimate: toNum(d.savingsEstimate) } };
    case "assets":
      return { assets: { ownsApartment: d.ownsApartment ?? null, ownsCar: d.ownsCar ?? null, hasMortgage: d.hasMortgage ?? null } };
    case "insurance": {
      const l = d.insuranceList ?? [];
      return { insurance: { hasLifeInsurance: l.includes("life"), hasHealthInsurance: l.includes("health"), hasDisabilityInsurance: l.includes("disability"), hasApartmentInsurance: l.includes("apartment"), hasCarInsurance: l.includes("car") } };
    }
    case "retirement":
      return { retirement: { hasPension: d.hasPension ?? null, hasStudyFund: d.hasStudyFund ?? null, hasInvestmentFunds: d.hasInvestmentFunds ?? null, plannedRetirementAge: toNum(d.plannedRetirementAge) } };
    default:
      return {};
  }
}

export default function OnboardingPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const editMode = searchParams.get("edit") === "1";
  const { refresh } = useAuth();

  const [i, setI] = useState(0);
  const [data, setData] = useState<FlowData>({ insuranceList: [] });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [missing, setMissing] = useState<Set<string>>(new Set());

  const dataRef = useRef(data);
  useEffect(() => { dataRef.current = data; }, [data]);

  // inject the progress bar's signature keyframes once
  useEffect(() => {
    if (document.getElementById("ob-progress-anim")) return;
    const st = document.createElement("style");
    st.id = "ob-progress-anim";
    st.textContent = "@keyframes obSheen{0%{transform:translateX(-160%) skewX(-18deg)}60%,100%{transform:translateX(260%) skewX(-18deg)}}@keyframes obHalo{0%{transform:scale(1);opacity:.7}70%,100%{transform:scale(2.7);opacity:0}}";
    document.head.appendChild(st);
  }, []);

  // hydrate from the saved profile; redirect if already completed
  useEffect(() => {
    let alive = true;
    (async () => {
      const res = await getOnboarding();
      if (!alive) return;
      setLoading(false);
      if (!res.success) { setError(res.message ?? "לא הצלחנו לטעון."); return; }
      // first-time flow redirects completed users out; edit mode stays to update.
      if (res.data?.completed && !editMode) { await refresh(); navigate(APP_ROUTES.hub, { replace: true }); return; }
      const p = res.data?.data;
      if (p) {
        const ins: string[] = [];
        if (p.insurance?.hasLifeInsurance) ins.push("life");
        if (p.insurance?.hasHealthInsurance) ins.push("health");
        if (p.insurance?.hasDisabilityInsurance) ins.push("disability");
        if (p.insurance?.hasApartmentInsurance) ins.push("apartment");
        if (p.insurance?.hasCarInsurance) ins.push("car");
        setData({
          fullName: p.personal?.fullName ?? undefined,
          age: p.personal?.age != null ? String(p.personal.age) : undefined,
          gender: p.personal?.gender ?? undefined,
          city: p.personal?.residenceCity ?? undefined,
          maritalStatus: p.personal?.maritalStatus ?? undefined,
          childrenCount: p.personal?.childrenCount != null ? String(p.personal.childrenCount) : undefined,
          educationLevel: p.personal?.educationLevel ?? undefined,
          employmentType: p.employment?.employmentType ?? undefined,
          expectedMonthlyGross: p.employment?.expectedMonthlyGross != null ? String(p.employment.expectedMonthlyGross) : undefined,
          employmentStartDate: p.employment?.employmentStartDate ?? undefined,
          salaryRange: p.financial?.salaryRange ?? undefined,
          monthlyExpensesEstimate: p.financial?.monthlyExpensesEstimate != null ? String(p.financial.monthlyExpensesEstimate) : undefined,
          savingsEstimate: p.financial?.savingsEstimate != null ? String(p.financial.savingsEstimate) : undefined,
          ownsApartment: p.assets?.ownsApartment ?? undefined,
          ownsCar: p.assets?.ownsCar ?? undefined,
          hasMortgage: p.assets?.hasMortgage ?? undefined,
          insuranceList: ins,
          hasPension: p.retirement?.hasPension ?? undefined,
          hasStudyFund: p.retirement?.hasStudyFund ?? undefined,
          hasInvestmentFunds: p.retirement?.hasInvestmentFunds ?? undefined,
          plannedRetirementAge: p.retirement?.plannedRetirementAge != null ? String(p.retirement.plannedRetirementAge) : undefined,
        });
      }
    })();
    return () => { alive = false; };
  }, [navigate, refresh, editMode]);

  const set = useCallback((patch: Partial<FlowData>) => {
    setData(d => ({ ...d, ...patch }));
    setMissing(m => {
      if (!m.size) return m;
      const n = new Set(m);
      Object.keys(patch).forEach(k => n.delete(k));
      return n;
    });
  }, []);

  const saveSection = useCallback(async (section: Section) => {
    const patch = buildSectionPatch(section, dataRef.current);
    await updateOnboarding(patch, [`section-${section}`]);
  }, []);

  const goNext = useCallback(async () => {
    const cur = FLOW[i];
    if ((cur.kind === "field" || cur.kind === "autocomplete" || cur.kind === "single" || cur.kind === "multi" || cur.kind === "yesno") && cur.section !== "extra") {
      void saveSection(cur.section);
    }
    setI(x => Math.min(x + 1, FLOW.length - 1));
  }, [i, saveSection]);

  const goBack = useCallback(() => { setError(null); setI(x => Math.max(x - 1, 0)); }, []);

  const handleFinish = useCallback(async () => {
    if (busy) return;
    setBusy(true); setError(null);
    // derive the employment fields the backend requires but the flow doesn't ask
    await updateOnboarding({ employment: { salaryType: "global", jobPercentage: 100, isPrimaryJob: true, hasMultipleEmployers: false } });
    const res = await completeOnboarding();
    setBusy(false);
    if (!res.success || !res.data?.completed) {
      const fields = (res.errors ?? []).map(e => e.field).filter(Boolean) as string[];
      const located = fields.map(locateField).filter(Boolean) as { index: number; key: string }[];
      if (located.length) {
        // jump back to the earliest step with a missing field and mark them all
        setMissing(new Set(located.map(l => l.key)));
        setI(Math.min(...located.map(l => l.index)));
        setError("חסרים פרטים כדי לסיים — סימנו לך בדיוק איפה.");
      } else {
        setError(res.message ?? "לא הצלחנו להשלים. ודא שכל הפרטים מולאו.");
      }
      return;
    }
    await refresh();
    navigate(editMode ? APP_ROUTES.settings : APP_ROUTES.hub, { replace: true });
  }, [busy, navigate, refresh, editMode]);

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "var(--surface-page)" }}>
        <Loader />
      </div>
    );
  }

  const step = FLOW[i];
  const isIntro = step.kind === "intro";
  const isDone = step.kind === "done";
  const answerable = FLOW.filter(f => f.kind !== "intro" && f.kind !== "done");
  const overall = isIntro ? 0 : isDone ? 1 : (answerable.indexOf(step) + 1) / answerable.length;
  const curSection = !isIntro && !isDone && "section" in step && step.section !== "extra" ? step.section : null;

  return (
    <div style={{ minHeight: "100vh", direction: "rtl", fontFamily: "var(--font-body)", background: "var(--surface-page)", display: "flex", flexDirection: "column", position: "relative" }}>
      {/* dot-grid wash */}
      <div style={{ position: "fixed", inset: 0, backgroundImage: "radial-gradient(rgba(123,95,214,.06) 1px,transparent 1px)", backgroundSize: "22px 22px", pointerEvents: "none" }} />

      {/* header */}
      <header style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "20px 28px", gap: 16 }}>
        <button type="button" onClick={() => navigate(editMode ? APP_ROUTES.settings : APP_ROUTES.hub)} style={{ padding: "9px 18px", borderRadius: "var(--r-btn)", border: "1.5px solid var(--border-soft)", background: "var(--card)", cursor: "pointer", fontFamily: "inherit", fontWeight: 700, fontSize: 14, color: "var(--text-body)", whiteSpace: "nowrap" }}>שמירה ויציאה</button>

        {!isIntro && !isDone && curSection && <ProgressBar value={overall} label={SECTION_LABEL[curSection]} />}

        {!isIntro && !isDone ? (
          <button type="button" onClick={goBack} style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", fontWeight: 700, fontSize: 15, color: "var(--text-body)", whiteSpace: "nowrap" }}>
            <ChevronRight size={16} strokeWidth={2.6} /> חזרה
          </button>
        ) : <span style={{ width: 110 }} />}
      </header>

      {/* body */}
      <main style={{ position: "relative", flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", padding: "20px 28px 48px" }}>
        <div style={{ width: "100%", maxWidth: 600, margin: "0 auto" }}>
          {isIntro && <Intro onStart={goNext} />}
          {isDone && <Done busy={busy} error={error} onFinish={handleFinish} />}
          {!isIntro && !isDone && (
            <>
              <QHead title={step.title} sub={step.sub} />

              {step.kind === "single" && (
                <SingleSelect options={step.options} value={data[step.key] as string | undefined}
                  onChange={v => { set({ [step.key]: v } as Partial<FlowData>); window.setTimeout(() => void goNext(), 260); }} />
              )}
              {step.kind === "multi" && (
                <MultiSelect options={step.options} value={(data[step.key] as string[]) ?? []}
                  onChange={v => set({ [step.key]: v } as Partial<FlowData>)} />
              )}
              {step.kind === "yesno" && (
                <YesNoGroup items={step.items} value={data} missing={missing} onChange={patch => set(patch)} />
              )}
              {step.kind === "field" && (
                <FieldStep fields={step.fields} value={data} missing={missing} onChange={patch => set(patch)} />
              )}
              {step.kind === "autocomplete" && (
                <Autocomplete fields={step.fields} value={data} onChange={patch => set(patch)} />
              )}

              {step.kind !== "single" && (
                <div style={{ maxWidth: 600, margin: "34px auto 0" }}>
                  <PrimaryButton onClick={() => void goNext()}>המשך</PrimaryButton>
                  {step.kind === "multi" && (
                    <div style={{ textAlign: "center", marginTop: 14 }}>
                      <button type="button" onClick={() => void goNext()} style={{ background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", fontWeight: 700, fontSize: 14, color: "var(--text-muted)" }}>אין לי ביטוחים כרגע · דלג</button>
                    </div>
                  )}
                </div>
              )}
              {step.kind === "single" && (
                <div style={{ textAlign: "center", marginTop: 22, fontSize: 13.5, color: "var(--text-faint)", fontWeight: 600 }}>בחר/י אפשרות כדי להמשיך</div>
              )}
              {error && (
                <div style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "center", maxWidth: 600, margin: "18px auto 0", padding: "11px 16px", borderRadius: "var(--r-btn)", background: "#FEF2F2", border: "1px solid rgba(220,38,38,.25)", color: "var(--danger)", fontWeight: 700, fontSize: 13.5 }}>
                  {error}
                </div>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
}

/* ── progress bar ───────────────────────────────────────────── */
function ProgressBar({ value, label }: { value: number; label: string }) {
  const target = Math.round(value * 100);
  const glide = "0.9s cubic-bezier(.4,0,.15,1)";
  return (
    <div style={{ flex: 1, maxWidth: 540, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 9 }}>
        <span style={{ fontSize: 11.5, fontWeight: 800, letterSpacing: ".07em", color: "var(--lav-600)" }}>{label}</span>
        <span style={{ fontSize: 13, fontWeight: 900, color: "var(--ink)", fontVariantNumeric: "tabular-nums", letterSpacing: "-.02em" }}>{target}%</span>
      </div>
      <div style={{ position: "relative", height: 10 }}>
        <div style={{ position: "absolute", inset: 0, borderRadius: 999, background: "var(--hair)", boxShadow: "inset 0 1px 2px rgba(70,40,130,.08)" }} />
        <div style={{ position: "absolute", inset: 0, borderRadius: 999, overflow: "hidden" }}>
          <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to left, var(--lav-500) 0%, var(--lav-600) 22%, var(--peach-ink) 60%, var(--mint-ink) 100%)" }} />
          <div style={{ position: "absolute", insetBlock: -2, insetInlineStart: 0, width: "32%", background: "linear-gradient(90deg, transparent, rgba(255,255,255,.7), transparent)", animation: "obSheen 2.8s cubic-bezier(.5,0,.3,1) infinite" }} />
          <div style={{ position: "absolute", insetBlock: 0, insetInlineEnd: 0, width: (100 - target) + "%", background: "var(--hair)", transition: "width " + glide, willChange: "width" }} />
        </div>
        <div style={{ position: "absolute", top: "50%", insetInlineStart: "calc(" + target + "% - 8px)", width: 16, height: 16, borderRadius: "50%", transform: "translateY(-50%)", background: "#fff", boxShadow: "0 0 0 3px var(--lav-500), 0 0 16px 3px rgba(155,127,232,.55)", opacity: target > 1 && target < 100 ? 1 : 0, transition: "inset-inline-start " + glide + ", opacity .3s", willChange: "inset-inline-start" }}>
          <span style={{ position: "absolute", inset: 0, borderRadius: "50%", border: "2px solid var(--lav-500)", animation: "obHalo 2s ease-out infinite" }} />
        </div>
      </div>
    </div>
  );
}

/* ── shared pieces ──────────────────────────────────────────── */
function QHead({ title, sub }: { title: string; sub?: string }) {
  return (
    <div style={{ textAlign: "center", marginBottom: 36 }}>
      <h1 style={{ fontSize: "clamp(26px,3.4vw,38px)", fontWeight: 900, letterSpacing: "-.03em", lineHeight: 1.12, margin: 0, color: "var(--ink)", textWrap: "balance" }}>{title}</h1>
      {sub && <p style={{ fontSize: 16, color: "var(--text-muted)", margin: "12px auto 0", maxWidth: 460, lineHeight: 1.6, fontWeight: 500 }}>{sub}</p>}
    </div>
  );
}

function PrimaryButton({ children, disabled, onClick }: { children: React.ReactNode; disabled?: boolean; onClick: () => void }) {
  return (
    <button type="button" disabled={disabled} onClick={onClick}
      style={{
        width: "100%", padding: "15px 24px", borderRadius: "var(--r-btn)", border: "none",
        cursor: disabled ? "not-allowed" : "pointer", fontFamily: "inherit", fontWeight: 800, fontSize: 16,
        color: "#fff", background: disabled ? "var(--lav-300)" : "var(--ink)",
        opacity: disabled ? 0.7 : 1, boxShadow: disabled ? "none" : "var(--shadow-ink)",
        transition: "opacity var(--dur-fast) var(--ease)",
      }}>
      {children}
    </button>
  );
}

const check = (s = 14) => <Check size={s} strokeWidth={3} />;

function OptionRow({ label, hint, icon, selected, multi, onClick }: { label: string; hint?: string; icon?: boolean; selected: boolean; multi?: boolean; onClick: () => void }) {
  const [hover, setHover] = useState(false);
  return (
    <button type="button" onClick={onClick} onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{
        display: "flex", alignItems: "center", gap: 14, width: "100%", textAlign: "start",
        padding: "17px 18px", borderRadius: "var(--r-btn)", cursor: "pointer", fontFamily: "inherit",
        background: selected ? "var(--accent-soft)" : "var(--card)",
        border: "1.5px solid " + (selected ? "var(--lav-500)" : hover ? "var(--lav-300)" : "var(--border-soft)"),
        boxShadow: selected ? "0 0 0 4px rgba(155,127,232,.12)" : hover ? "var(--shadow-soft)" : "none",
        transition: "all .16s var(--ease)", transform: hover && !selected ? "translateY(-1px)" : "none",
      }}>
      {icon && <span style={{ width: 38, height: 38, borderRadius: 9, flex: "none", display: "grid", placeItems: "center", background: selected ? "#fff" : "var(--surface-sunken)", color: "var(--lav-600)" }}><FileText size={20} strokeWidth={1.85} /></span>}
      <span style={{ flex: 1 }}>
        <span style={{ display: "block", fontSize: 15.5, fontWeight: 700, color: "var(--ink)" }}>{label}</span>
        {hint && <span style={{ display: "block", fontSize: 12.5, color: "var(--text-muted)", marginTop: 2 }}>{hint}</span>}
      </span>
      <span style={{ width: 24, height: 24, flex: "none", borderRadius: multi ? 7 : "50%", border: "2px solid " + (selected ? "var(--lav-600)" : "var(--border-soft)"), background: selected ? "var(--lav-600)" : "transparent", color: "#fff", display: "grid", placeItems: "center", transition: "all .16s var(--ease)" }}>{selected && check(14)}</span>
    </button>
  );
}

function SingleSelect({ options, value, onChange }: { options: { value: string; label: string; hint?: string; icon?: boolean }[]; value?: string; onChange: (v: string) => void }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {options.map(o => <OptionRow key={o.value} label={o.label} hint={o.hint} icon={o.icon} selected={value === o.value} onClick={() => onChange(o.value)} />)}
    </div>
  );
}

function MultiSelect({ options, value, onChange }: { options: { value: string; label: string }[]; value: string[]; onChange: (v: string[]) => void }) {
  const toggle = (v: string) => onChange(value.includes(v) ? value.filter(x => x !== v) : value.concat(v));
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {options.map(o => <OptionRow key={o.value} label={o.label} multi selected={value.includes(o.value)} onClick={() => toggle(o.value)} />)}
    </div>
  );
}

function YesNoGroup({ items, value, missing, onChange }: { items: { key: DataKey; label: string }[]; value: FlowData; missing?: Set<string>; onChange: (patch: Partial<FlowData>) => void }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {items.map(it => {
        const v = value[it.key];
        const invalid = missing?.has(it.key as string);
        return (
          <div key={it.key} style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 18px", borderRadius: "var(--r-btn)", background: "var(--card)", border: "1.5px solid " + (invalid ? "var(--danger)" : "var(--border-soft)"), boxShadow: invalid ? "0 0 0 4px rgba(220,38,38,.1)" : "none" }}>
            <span style={{ flex: 1, fontSize: 15, fontWeight: 700, color: "var(--ink)" }}>{it.label}</span>
            <div style={{ display: "flex", gap: 8, flex: "none" }}>
              {([["כן", true], ["לא", false]] as const).map(([lab, bool]) => (
                <button key={lab} type="button" onClick={() => onChange({ [it.key]: bool } as Partial<FlowData>)}
                  style={{
                    padding: "8px 20px", borderRadius: "var(--r-sm)", cursor: "pointer", fontFamily: "inherit", fontWeight: 800, fontSize: 14,
                    border: "1.5px solid " + (v === bool ? (bool ? "var(--mint-ink)" : "var(--ink)") : "var(--border-soft)"),
                    background: v === bool ? (bool ? "var(--mint-soft)" : "var(--ink)") : "transparent",
                    color: v === bool ? (bool ? "var(--mint-ink)" : "#fff") : "var(--text-muted)",
                    transition: "all .14s var(--ease)",
                  }}>{lab}</button>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function FieldStep({ fields, value, missing, onChange }: { fields: { key: DataKey; label: string; placeholder?: string; type?: string }[]; value: FlowData; missing?: Set<string>; onChange: (patch: Partial<FlowData>) => void }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: fields.length > 1 ? "1fr 1fr" : "1fr", gap: 18, maxWidth: fields.length > 1 ? 560 : 380, margin: "0 auto" }}>
      {fields.map(f => (
        <TextField key={f.key} label={f.label} placeholder={f.placeholder} type={f.type || "text"} invalid={missing?.has(f.key as string)}
          value={(value[f.key] as string) || ""} onChange={v => onChange({ [f.key]: v } as Partial<FlowData>)} />
      ))}
    </div>
  );
}

function TextField({ label, placeholder, type = "text", value, invalid, onChange }: { label: string; placeholder?: string; type?: string; value: string; invalid?: boolean; onChange: (v: string) => void }) {
  const [focus, setFocus] = useState(false);
  const borderColor = invalid ? "var(--danger)" : focus ? "var(--lav-500)" : "var(--border-soft)";
  const ring = invalid ? "0 0 0 4px rgba(220,38,38,.12)" : focus ? "0 0 0 4px rgba(155,127,232,.14)" : "none";
  return (
    <label style={{ display: "block" }}>
      <span style={{ display: "block", fontSize: 13.5, fontWeight: 700, color: invalid ? "var(--danger)" : "var(--text-body)", marginBottom: 8 }}>{label}{invalid && " *"}</span>
      <input value={value} placeholder={placeholder} type={type} inputMode={type === "number" ? "numeric" : undefined}
        onFocus={() => setFocus(true)} onBlur={() => setFocus(false)}
        onChange={e => onChange(e.target.value)}
        style={{
          width: "100%", height: 52, padding: "0 15px", borderRadius: "var(--r-btn)", boxSizing: "border-box",
          border: "1.5px solid " + borderColor,
          boxShadow: ring,
          outline: "none", fontFamily: "inherit", fontSize: 15, fontWeight: 600, color: "var(--ink)", background: "var(--card)",
          transition: "all .16s var(--ease)",
        }} />
      {invalid && <span style={{ display: "block", fontSize: 12.5, fontWeight: 600, color: "var(--danger)", marginTop: 6 }}>שדה חובה — נא למלא</span>}
    </label>
  );
}

function Autocomplete({ fields, value, onChange }: { fields: { key: DataKey; label: string; placeholder?: string; options?: string[] }[]; value: FlowData; onChange: (patch: Partial<FlowData>) => void }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: fields.length > 1 ? "1fr 1fr" : "1fr", gap: 18, maxWidth: 560, margin: "0 auto" }}>
      {fields.map(f => <AutoField key={f.key} field={f} value={(value[f.key] as string) || ""} onChange={v => onChange({ [f.key]: v } as Partial<FlowData>)} />)}
    </div>
  );
}

function AutoField({ field, value, onChange }: { field: { label: string; placeholder?: string; options?: string[] }; value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const [focus, setFocus] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);
  const matches = (field.options || []).filter(o => !value || o.includes(value)).slice(0, 7);
  return (
    <div ref={ref} style={{ position: "relative" }}>
      <span style={{ display: "block", fontSize: 13.5, fontWeight: 700, color: "var(--text-body)", marginBottom: 8 }}>{field.label}</span>
      <input value={value} placeholder={field.placeholder}
        onFocus={() => { setFocus(true); setOpen(true); }} onBlur={() => setFocus(false)}
        onChange={e => { onChange(e.target.value); setOpen(true); }}
        style={{
          width: "100%", height: 52, padding: "0 15px", borderRadius: "var(--r-btn)", boxSizing: "border-box",
          border: "1.5px solid " + (focus ? "var(--lav-500)" : "var(--border-soft)"),
          boxShadow: focus ? "0 0 0 4px rgba(155,127,232,.14)" : "none",
          outline: "none", fontFamily: "inherit", fontSize: 15, fontWeight: 600, color: "var(--ink)", background: "var(--card)",
          transition: "all .16s var(--ease)",
        }} />
      {open && matches.length > 0 && (
        <div style={{ position: "absolute", top: "calc(100% + 6px)", insetInline: 0, zIndex: 20, background: "var(--card)", border: "1px solid var(--border-soft)", borderRadius: "var(--r-md)", boxShadow: "var(--shadow-card)", padding: 6, maxHeight: 260, overflowY: "auto" }}>
          {matches.map(o => (
            <button key={o} type="button" onClick={() => { onChange(o); setOpen(false); }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = "var(--surface-sunken)"}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = "transparent"}
              style={{ display: "block", width: "100%", textAlign: "start", padding: "11px 13px", borderRadius: "var(--r-sm)", border: "none", background: "transparent", cursor: "pointer", fontFamily: "inherit", fontSize: 14.5, fontWeight: 600, color: "var(--ink)" }}>{o}</button>
          ))}
        </div>
      )}
    </div>
  );
}

function Intro({ onStart }: { onStart: () => void }) {
  return (
    <div style={{ textAlign: "center", maxWidth: 520, margin: "0 auto" }}>
      <span style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "var(--lav-100)", border: "1px solid var(--border-soft)", borderRadius: 999, padding: "6px 15px", marginBottom: 24, fontSize: 13, fontWeight: 700, color: "var(--lav-600)" }}>
        <Sparkles size={15} /> 3 דקות · נשמר אוטומטית
      </span>
      <h1 style={{ fontSize: "clamp(30px,4vw,46px)", fontWeight: 900, letterSpacing: "-.035em", lineHeight: 1.08, margin: "0 0 18px", color: "var(--ink)" }}>בוא נכיר אותך.<br />ואת הכסף שלך.</h1>
      <p style={{ fontSize: 18, color: "var(--text-muted)", lineHeight: 1.6, fontWeight: 500, margin: "0 0 34px" }}>כמה שאלות קצרות שיעזרו ל‑AI לבנות לך תמונה פיננסית מדויקת — תלוש, פנסיה, ביטוח וזכויות. אפשר לעצור ולחזור בכל רגע.</p>
      <button type="button" onClick={onStart} style={{ display: "inline-flex", alignItems: "center", gap: 9, padding: "15px 30px", borderRadius: "var(--r-btn)", border: "none", cursor: "pointer", fontFamily: "inherit", fontWeight: 800, fontSize: 16, color: "#fff", background: "var(--ink)", boxShadow: "var(--shadow-ink)" }}>
        בוא נתחיל <ArrowLeft size={18} strokeWidth={2.4} />
      </button>
    </div>
  );
}

function Done({ busy, error, onFinish }: { busy: boolean; error: string | null; onFinish: () => void }) {
  return (
    <div style={{ textAlign: "center", maxWidth: 520, margin: "0 auto" }}>
      <Confetti />
      <div style={{ width: 92, height: 92, borderRadius: "50%", margin: "0 auto 28px", display: "grid", placeItems: "center", background: "var(--grad-prism)", color: "var(--ink)", boxShadow: "var(--shadow-card)" }}><Check size={44} strokeWidth={3} /></div>
      <h1 style={{ fontSize: "clamp(28px,3.6vw,42px)", fontWeight: 900, letterSpacing: "-.03em", lineHeight: 1.1, margin: "0 0 16px", color: "var(--ink)" }}>הכל מוכן.</h1>
      <p style={{ fontSize: 18, color: "var(--text-muted)", lineHeight: 1.6, fontWeight: 500, margin: "0 0 34px" }}>בנינו את הפרופיל הפיננסי שלך. עכשיו ה‑AI מנתח ומחפש בדיוק איפה מגיע לך יותר.</p>
      <button type="button" onClick={onFinish} disabled={busy} style={{ display: "inline-flex", alignItems: "center", gap: 9, padding: "15px 30px", borderRadius: "var(--r-btn)", border: "none", cursor: busy ? "wait" : "pointer", fontFamily: "inherit", fontWeight: 800, fontSize: 16, color: "#fff", background: "var(--ink)", boxShadow: "var(--shadow-ink)", opacity: busy ? 0.75 : 1 }}>
        {busy ? "רגע..." : "לתפריט העוזר האישי"} {!busy && <ArrowLeft size={18} strokeWidth={2.4} />}
      </button>
      {error && <div style={{ marginTop: 18, color: "var(--danger)", fontWeight: 600, fontSize: 14 }}>{error}</div>}
    </div>
  );
}

/* ── confetti burst (brand colors) ──────────────────────────── */
function Confetti() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const resize = () => { canvas.width = canvas.offsetWidth * dpr; canvas.height = canvas.offsetHeight * dpr; };
    resize();
    const reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const COLORS = ["#9B7FE8", "#7C5FD6", "#CDB6FF", "#F8D2BE", "#DA6F44", "#C9ECD6", "#2F9C62", "#F6E4A8"];
    const W = () => canvas.width, H = () => canvas.height;
    const N = reduce ? 0 : 150;
    const parts: { x: number; y: number; vx: number; vy: number; g: number; w: number; h: number; rot: number; vr: number; color: string }[] = [];
    for (let k = 0; k < N; k++) {
      const fromLeft = k % 2 === 0;
      parts.push({ x: fromLeft ? W() * 0.12 : W() * 0.88, y: H() * 0.42, vx: (fromLeft ? 1 : -1) * (3 + Math.random() * 7) * dpr, vy: (-9 - Math.random() * 7) * dpr, g: (0.22 + Math.random() * 0.12) * dpr, w: (6 + Math.random() * 7) * dpr, h: (8 + Math.random() * 8) * dpr, rot: Math.random() * Math.PI, vr: (Math.random() - 0.5) * 0.4, color: COLORS[(Math.random() * COLORS.length) | 0] });
    }
    let raf = 0, t0 = 0;
    const draw = (t: number) => {
      if (!t0) t0 = t;
      const elapsed = t - t0;
      ctx.clearRect(0, 0, W(), H());
      let alive = false;
      for (const p of parts) {
        p.vy += p.g; p.x += p.vx; p.y += p.vy; p.vx *= 0.992; p.rot += p.vr;
        const fade = Math.max(0, 1 - Math.max(0, elapsed - 1600) / 1400);
        if (p.y < H() + 40 && fade > 0) alive = true;
        ctx.save(); ctx.globalAlpha = fade; ctx.translate(p.x, p.y); ctx.rotate(p.rot);
        ctx.fillStyle = p.color; ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h); ctx.restore();
      }
      if (alive && elapsed < 3200) raf = requestAnimationFrame(draw);
      else ctx.clearRect(0, 0, W(), H());
    };
    raf = requestAnimationFrame(draw);
    window.addEventListener("resize", resize);
    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", resize); };
  }, []);
  return <canvas ref={ref} style={{ position: "fixed", inset: 0, width: "100%", height: "100%", pointerEvents: "none", zIndex: 60 }} />;
}
