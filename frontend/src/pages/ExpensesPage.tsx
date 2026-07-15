import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Check,
  ChevronLeft,
  ChevronRight,
  Loader2,
  PiggyBank,
  Sparkles,
  Wallet,
} from "lucide-react";
import PrivateTopbar from "../components/PrivateTopbar";
import AppFooter from "../components/AppFooter";
import { askAgent } from "../api/agents.api";
import {
  getCopilotAnalysis,
  updateCopilotProfile,
  type CopilotAnalysis,
  type MonthlyExpensePeriodEntry,
} from "../api/copilot.api";
import { renderMarkdown } from "../utils/renderMarkdown";
import { formatCurrencyILS } from "../utils/formatters";
import {
  EXPENSE_CATEGORIES,
  breakdownToPayload,
  hasBreakdownData,
  sumBreakdown,
  type ExpenseCategoryKey,
} from "../utils/monthlyExpensesCategories";
import {
  buildPeriodOptions,
  defaultPeriodKey,
  formatPeriodLabel,
  shiftPeriod,
  sortPeriodsDesc,
} from "../utils/expensePeriodUtils";

const AI_PROMPT =
  "נתח את ההוצאות השוטפות שלי לפי חודשים מול תלושי השכר שלי ותן לי המלצות קונקרטיות איך להתנהל טוב יותר פיננסית";

const EMPTY_VALUES = Object.fromEntries(
  EXPENSE_CATEGORIES.map((c) => [c.key, ""]),
) as Record<ExpenseCategoryKey, string>;

function ExpensesDonut({
  size = 150,
  sw = 22,
  segments,
}: {
  size?: number;
  sw?: number;
  segments: { label: string; pct: number; color: string }[];
}) {
  const r = (size - sw) / 2;
  const circ = 2 * Math.PI * r;
  let acc = 0;
  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      style={{ transform: "rotate(-90deg)", display: "block" }}
    >
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="var(--hair)"
        strokeWidth={sw}
      />
      {segments
        .filter((s) => s.pct > 0)
        .map((s, i) => {
          const len = (s.pct / 100) * circ;
          const el = (
            <circle
              key={i}
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              stroke={s.color}
              strokeWidth={sw}
              strokeDasharray={`${len} ${circ}`}
              strokeDashoffset={-acc}
              strokeLinecap="butt"
              style={{ transition: "stroke-dasharray 1.1s var(--ease)" }}
            />
          );
          acc += len;
          return el;
        })}
    </svg>
  );
}

type Toast = { type: "success" | "error"; text: string } | null;

function getPeriodEntry(
  data: CopilotAnalysis,
  period: string,
): MonthlyExpensePeriodEntry | null {
  const byPeriod = data.profile.monthlyExpensesByPeriod || {};
  if (byPeriod[period]) return byPeriod[period];
  if (Object.keys(byPeriod).length === 0) {
    const legacy: MonthlyExpensePeriodEntry = {
      breakdown: data.profile.monthlyExpensesBreakdown,
      monthlyDebts: data.profile.monthlyDebts,
      total: data.profile.monthlyExpenses,
    };
    if (
      hasBreakdownData(legacy.breakdown || undefined)
      || (legacy.total != null && legacy.total > 0)
      || (legacy.monthlyDebts != null && legacy.monthlyDebts > 0)
    ) {
      return legacy;
    }
  }
  return null;
}

function applyEntryToForm(
  entry: MonthlyExpensePeriodEntry | null,
  setValues: React.Dispatch<React.SetStateAction<Record<ExpenseCategoryKey, string>>>,
  setOther: React.Dispatch<React.SetStateAction<string>>,
  setDebts: React.Dispatch<React.SetStateAction<string>>,
) {
  const nextValues = { ...EMPTY_VALUES };
  const breakdown = entry?.breakdown;
  if (hasBreakdownData(breakdown || undefined)) {
    for (const cat of EXPENSE_CATEGORIES) {
      const v = breakdown?.[cat.key];
      if (v != null && v > 0) nextValues[cat.key] = String(v);
    }
    setOther("");
  } else if (entry?.otherEstimate != null && entry.otherEstimate > 0) {
    setOther(String(entry.otherEstimate));
  } else if (entry?.total != null && entry.total > 0) {
    setOther(String(entry.total));
  } else {
    setOther("");
  }
  setValues(nextValues);
  if (entry?.monthlyDebts != null && entry.monthlyDebts > 0) {
    setDebts(String(entry.monthlyDebts));
  } else {
    setDebts("");
  }
}

export default function ExpensesPage() {
  const [analysis, setAnalysis] = useState<CopilotAnalysis | null>(null);
  const [selectedPeriod, setSelectedPeriod] = useState("");
  const [periodOptions, setPeriodOptions] = useState<string[]>([]);
  const [values, setValues] = useState(EMPTY_VALUES);
  const [other, setOther] = useState("");
  const [debts, setDebts] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiAnswer, setAiAnswer] = useState<string | null>(null);
  const [aiAgent, setAiAgent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<Toast>(null);

  const load = useCallback(async (keepPeriod?: string) => {
    setError(null);
    const res = await getCopilotAnalysis();
    if (!res.ok || !res.data.success || !res.data.data) {
      setError("לא הצלחנו לטעון את נתוני ההוצאות.");
      return;
    }
    const data = res.data.data;
    setAnalysis(data);

    const options = buildPeriodOptions(
      data.profile.monthlyExpensesByPeriod,
      data.payslipsByPeriod,
    );
    setPeriodOptions(options);

    const period = keepPeriod && options.includes(keepPeriod)
      ? keepPeriod
      : defaultPeriodKey(data.payslipsByPeriod, data.profile.monthlyExpensesByPeriod);
    setSelectedPeriod(period);
  }, []);

  useEffect(() => {
    setLoading(true);
    void load().finally(() => setLoading(false));
  }, [load]);

  useEffect(() => {
    if (!analysis || !selectedPeriod) return;
    applyEntryToForm(
      getPeriodEntry(analysis, selectedPeriod),
      setValues,
      setOther,
      setDebts,
    );
  }, [selectedPeriod, analysis]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3600);
    return () => clearTimeout(t);
  }, [toast]);

  const changePeriod = (next: string) => {
    setSelectedPeriod(next);
    setPeriodOptions((prev) =>
      prev.includes(next) ? prev : sortPeriodsDesc([...prev, next]),
    );
  };

  const hasCategories = useMemo(
    () => EXPENSE_CATEGORIES.some((c) => Number(values[c.key]) > 0),
    [values],
  );

  const categoryTotal = useMemo(() => {
    if (hasCategories) return sumBreakdown(values, "");
    const otherN = Number(other);
    return Number.isFinite(otherN) && otherN > 0 ? otherN : 0;
  }, [values, other, hasCategories]);
  const debtsNum = debts.trim() === "" ? 0 : Number(debts);
  const netSalary = analysis?.payslipsByPeriod?.[selectedPeriod]?.netSalary ?? null;
  const disposable =
    netSalary != null && categoryTotal > 0
      ? netSalary - categoryTotal - (Number.isFinite(debtsNum) ? debtsNum : 0)
      : null;

  const donutSegments = useMemo(() => {
    if (categoryTotal <= 0) return [];
    const items: { label: string; pct: number; color: string; amount: number }[] = [];
    for (const cat of EXPENSE_CATEGORIES) {
      const n = Number(values[cat.key]);
      if (Number.isFinite(n) && n > 0) {
        items.push({
          label: cat.label,
          pct: (n / categoryTotal) * 100,
          color: cat.color,
          amount: n,
        });
      }
    }
    if (!hasCategories) {
      const otherN = Number(other);
      if (Number.isFinite(otherN) && otherN > 0) {
        items.push({
          label: "אחר / לא מפורט",
          pct: 100,
          color: "var(--text-faint)",
          amount: otherN,
        });
      }
    }
    return items;
  }, [values, other, categoryTotal, hasCategories]);

  const handleSave = async () => {
    const breakdownPayload = breakdownToPayload(values);
    const hasCategories = hasBreakdownData(breakdownPayload);
    const otherN = other.trim() === "" ? 0 : Number(other);

    if (!hasCategories && !(Number.isFinite(otherN) && otherN > 0)) {
      setToast({ type: "error", text: "הזן לפחות קטגוריית הוצאה אחת." });
      return;
    }
    if (debts.trim() !== "" && Number.isNaN(Number(debts))) {
      setToast({ type: "error", text: "יש להזין מספרים בלבד בשדה החובות." });
      return;
    }

    const monthlyExpenses = hasCategories
      ? sumBreakdown(values, "")
      : otherN;

    setSaving(true);
    const res = await updateCopilotProfile({
      expensePeriod: selectedPeriod,
      monthlyExpenses,
      ...(debts.trim() !== ""
        ? { monthlyDebts: Number(debts) || 0 }
        : {}),
      ...(hasCategories
        ? { monthlyExpensesBreakdown: breakdownPayload }
        : { otherEstimate: otherN }),
    });
    setSaving(false);

    if (res.ok && res.data.success) {
      setToast({
        type: "success",
        text: `ההוצאות ל${formatPeriodLabel(selectedPeriod)} נשמרו`,
      });
      void load(selectedPeriod);
    } else {
      setToast({ type: "error", text: "שמירת ההוצאות נכשלה. נסה שוב." });
    }
  };

  const handleAiRecommendation = async () => {
    if (aiLoading) return;
    setAiLoading(true);
    setAiAnswer(null);
    setAiAgent(null);
    try {
      const result = await askAgent(AI_PROMPT, []);
      if (result.ok && result.data.data) {
        setAiAnswer(result.data.data.answer);
        setAiAgent(result.data.data.agent);
      } else {
        setAiAnswer("שגיאה בתקשורת עם מערכת הסוכנים. נסה שנית.");
      }
    } catch {
      setAiAnswer("שגיאה בלתי צפויה. נסה שנית.");
    } finally {
      setAiLoading(false);
    }
  };

  const shell = (children: React.ReactNode) => (
    <div
      data-agent="expenses"
      style={{
        minHeight: "100vh",
        background: "var(--surface-page)",
        backgroundImage: "radial-gradient(rgba(185,139,22,.06) 1px,transparent 1px)",
        backgroundSize: "22px 22px",
        color: "var(--text-body)",
        fontFamily: "var(--font-body)",
        direction: "rtl",
      }}
    >
      <PrivateTopbar />
      {children}
      <AppFooter variant="private" />
      {toast && (
        <div
          style={{
            position: "fixed",
            insetInlineStart: "50%",
            transform: "translateX(-50%)",
            bottom: 26,
            zIndex: 1200,
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "13px 20px",
            borderRadius: "var(--r-pill)",
            background: toast.type === "success" ? "var(--mint-ink)" : "var(--danger)",
            color: "#fff",
            boxShadow: "var(--shadow-xl)",
            fontWeight: 800,
            fontSize: 14,
          }}
        >
          {toast.type === "success" ? (
            <Check size={17} strokeWidth={2.8} />
          ) : (
            <AlertTriangle size={17} />
          )}
          {toast.text}
        </div>
      )}
    </div>
  );

  const cardStyle: React.CSSProperties = {
    background: "var(--surface-card)",
    border: "1px solid var(--border-soft)",
    borderRadius: 20,
    boxShadow: "var(--shadow-card)",
    padding: 24,
  };

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "11px 14px 11px 36px",
    borderRadius: 12,
    border: "1px solid var(--border-soft)",
    background: "var(--surface-page)",
    fontFamily: "inherit",
    fontSize: 14,
    fontWeight: 600,
    color: "var(--text-strong)",
    outline: "none",
  };

  if (loading) {
    return shell(
      <main style={{ minHeight: "55vh", display: "grid", placeItems: "center" }}>
        <div style={{ textAlign: "center", color: "var(--butter-ink)" }}>
          <Loader2
            size={28}
            style={{ animation: "spin .8s linear infinite", marginBottom: 12 }}
          />
          <div style={{ fontSize: 14, color: "var(--text-muted)" }}>
            טוען את ההוצאות השוטפות…
          </div>
        </div>
      </main>,
    );
  }

  if (error) {
    return shell(
      <main
        style={{ maxWidth: 600, margin: "0 auto", padding: "60px 24px", textAlign: "center" }}
      >
        <div style={{ color: "var(--danger)", fontWeight: 700, marginBottom: 14 }}>
          {error}
        </div>
        <button
          type="button"
          onClick={() => {
            setLoading(true);
            void load().finally(() => setLoading(false));
          }}
          style={{
            padding: "10px 22px",
            borderRadius: "var(--r-pill)",
            border: "none",
            background: "var(--agent)",
            color: "#fff",
            fontWeight: 800,
            cursor: "pointer",
            fontFamily: "inherit",
          }}
        >
          נסה שוב
        </button>
      </main>,
    );
  }

  return shell(
    <main style={{ maxWidth: 1080, margin: "0 auto", padding: "40px 24px 84px" }}>
      {/* Header + summary */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          gap: 28,
          flexWrap: "wrap",
          marginBottom: 28,
        }}
      >
        <div style={{ flex: 1, minWidth: 240 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
            <span
              style={{
                width: 44,
                height: 44,
                borderRadius: 13,
                background: "var(--agent-soft)",
                color: "var(--agent)",
                display: "grid",
                placeItems: "center",
                border: "1px solid var(--agent-ring)",
              }}
            >
              <Wallet size={22} strokeWidth={1.75} />
            </span>
            <div>
              <h1
                style={{
                  margin: 0,
                  fontSize: 26,
                  fontWeight: 900,
                  letterSpacing: "-.03em",
                  color: "var(--text-strong)",
                }}
              >
                הוצאות שוטפות
              </h1>
              <p style={{ margin: "4px 0 0", fontSize: 13.5, color: "var(--text-muted)" }}>
                פירוט חודשי מול השכר מתלושים — לתכנון והמלצות AI
              </p>
            </div>
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              flexWrap: "wrap",
              marginBottom: 16,
            }}
          >
            <button
              type="button"
              aria-label="חודש קודם"
              onClick={() => changePeriod(shiftPeriod(selectedPeriod, -1))}
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                border: "1px solid var(--border-soft)",
                background: "var(--surface-card)",
                cursor: "pointer",
                display: "grid",
                placeItems: "center",
                color: "var(--text-muted)",
              }}
            >
              <ChevronRight size={18} />
            </button>

            <select
              value={selectedPeriod}
              onChange={(e) => changePeriod(e.target.value)}
              style={{
                padding: "10px 14px",
                borderRadius: 12,
                border: "1px solid var(--agent-ring)",
                background: "var(--agent-soft)",
                color: "var(--agent-strong)",
                fontWeight: 800,
                fontSize: 14,
                fontFamily: "inherit",
                minWidth: 180,
              }}
            >
              {periodOptions.map((p) => (
                <option key={p} value={p}>
                  {formatPeriodLabel(p)}
                  {analysis?.payslipsByPeriod?.[p]?.netSalary != null ? " · יש תלוש" : ""}
                  {analysis?.profile.monthlyExpensesByPeriod?.[p] ? " · נשמר" : ""}
                </option>
              ))}
            </select>

            <button
              type="button"
              aria-label="חודש הבא"
              onClick={() => changePeriod(shiftPeriod(selectedPeriod, 1))}
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                border: "1px solid var(--border-soft)",
                background: "var(--surface-card)",
                cursor: "pointer",
                display: "grid",
                placeItems: "center",
                color: "var(--text-muted)",
              }}
            >
              <ChevronLeft size={18} />
            </button>

            <span style={{ fontSize: 12.5, color: "var(--text-faint)", fontWeight: 600 }}>
              כל חודש נשמר בנפרד
            </span>
          </div>

          <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginTop: 4 }}>
            <div style={{ ...cardStyle, padding: "18px 22px", minWidth: 160 }}>
              <div style={{ fontSize: 12, color: "var(--text-faint)", fontWeight: 700 }}>
                סה״כ הוצאות — {formatPeriodLabel(selectedPeriod)}
              </div>
              <div
                style={{
                  fontSize: 28,
                  fontWeight: 900,
                  color: "var(--agent)",
                  letterSpacing: "-.03em",
                  marginTop: 4,
                }}
              >
                {categoryTotal > 0 ? formatCurrencyILS(categoryTotal) : "—"}
              </div>
            </div>
            {netSalary != null && (
              <div style={{ ...cardStyle, padding: "18px 22px", minWidth: 160 }}>
                <div style={{ fontSize: 12, color: "var(--text-faint)", fontWeight: 700 }}>
                  שכר נטו (מתלוש)
                </div>
                <div
                  style={{
                    fontSize: 28,
                    fontWeight: 900,
                    color: "var(--lav-600)",
                    letterSpacing: "-.03em",
                    marginTop: 4,
                  }}
                >
                  {formatCurrencyILS(netSalary)}
                </div>
              </div>
            )}
            {disposable != null && (
              <div style={{ ...cardStyle, padding: "18px 22px", minWidth: 160 }}>
                <div style={{ fontSize: 12, color: "var(--text-faint)", fontWeight: 700 }}>
                  הכנסה פנויה משוערת
                </div>
                <div
                  style={{
                    fontSize: 28,
                    fontWeight: 900,
                    color: disposable >= 0 ? "var(--mint-ink)" : "var(--danger)",
                    letterSpacing: "-.03em",
                    marginTop: 4,
                  }}
                >
                  {formatCurrencyILS(disposable)}
                </div>
              </div>
            )}
          </div>
        </div>

        {donutSegments.length > 0 && (
          <div style={{ ...cardStyle, display: "flex", alignItems: "center", gap: 20 }}>
            <div style={{ position: "relative", width: 150, height: 150, flex: "none" }}>
              <ExpensesDonut segments={donutSegments} />
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  display: "grid",
                  placeItems: "center",
                  textAlign: "center",
                  pointerEvents: "none",
                }}
              >
                <div style={{ fontSize: 11, color: "var(--text-faint)", fontWeight: 700 }}>
                  חודשי
                </div>
                <div style={{ fontSize: 15, fontWeight: 900, color: "var(--text-strong)" }}>
                  {formatCurrencyILS(categoryTotal)}
                </div>
              </div>
            </div>
            <div style={{ flex: 1, minWidth: 140 }}>
              {donutSegments.map((s) => (
                <div
                  key={s.label}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    marginBottom: 8,
                    fontSize: 12.5,
                  }}
                >
                  <span
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: 3,
                      background: s.color,
                      flex: "none",
                    }}
                  />
                  <span style={{ flex: 1, color: "var(--text-muted)" }}>{s.label}</span>
                  <span style={{ fontWeight: 800, color: "var(--text-strong)" }}>
                    {formatCurrencyILS(s.amount)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Form */}
      <div style={{ ...cardStyle, marginBottom: 24 }}>
        <h2
          style={{
            margin: "0 0 18px",
            fontSize: 17,
            fontWeight: 900,
            color: "var(--text-strong)",
          }}
        >
          פירוט הוצאות — {formatPeriodLabel(selectedPeriod)}
        </h2>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
            gap: 14,
          }}
        >
          {EXPENSE_CATEGORIES.map((cat) => (
            <label key={cat.key} style={{ display: "block" }}>
              <span
                style={{
                  display: "block",
                  fontSize: 12.5,
                  fontWeight: 700,
                  color: "var(--text-muted)",
                  marginBottom: 6,
                }}
              >
                {cat.label}
              </span>
              <div style={{ position: "relative" }}>
                <span
                  style={{
                    position: "absolute",
                    right: 12,
                    top: "50%",
                    transform: "translateY(-50%)",
                    fontSize: 13,
                    color: "var(--text-faint)",
                    fontWeight: 700,
                    pointerEvents: "none",
                  }}
                >
                  ₪
                </span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={values[cat.key]}
                  onChange={(e) =>
                    setValues((prev) => ({ ...prev, [cat.key]: e.target.value }))
                  }
                  placeholder="0"
                  style={inputStyle}
                />
              </div>
            </label>
          ))}

          <label style={{ display: "block" }}>
            <span
              style={{
                display: "block",
                fontSize: 12.5,
                fontWeight: 700,
                color: "var(--text-muted)",
                marginBottom: 6,
              }}
            >
              אחר / לא מפורט
            </span>
            <div style={{ position: "relative" }}>
              <span
                style={{
                  position: "absolute",
                  right: 12,
                  top: "50%",
                  transform: "translateY(-50%)",
                  fontSize: 13,
                  color: "var(--text-faint)",
                  fontWeight: 700,
                  pointerEvents: "none",
                }}
              >
                ₪
              </span>
              <input
                type="text"
                inputMode="decimal"
                value={other}
                onChange={(e) => setOther(e.target.value)}
                placeholder="0"
                style={inputStyle}
              />
            </div>
          </label>

          <label style={{ display: "block" }}>
            <span
              style={{
                display: "block",
                fontSize: 12.5,
                fontWeight: 700,
                color: "var(--text-muted)",
                marginBottom: 6,
              }}
            >
              החזרי חובות / הלוואות
            </span>
            <div style={{ position: "relative" }}>
              <span
                style={{
                  position: "absolute",
                  right: 12,
                  top: "50%",
                  transform: "translateY(-50%)",
                  fontSize: 13,
                  color: "var(--text-faint)",
                  fontWeight: 700,
                  pointerEvents: "none",
                }}
              >
                ₪
              </span>
              <input
                type="text"
                inputMode="decimal"
                value={debts}
                onChange={(e) => setDebts(e.target.value)}
                placeholder="0"
                style={inputStyle}
              />
            </div>
          </label>
        </div>

        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 22 }}>
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={saving}
            style={{
              padding: "12px 28px",
              borderRadius: "var(--r-pill)",
              border: "none",
              background: "var(--agent)",
              color: "#fff",
              fontWeight: 800,
              fontSize: 14,
              cursor: saving ? "wait" : "pointer",
              opacity: saving ? 0.7 : 1,
              fontFamily: "inherit",
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            {saving ? <Loader2 size={16} style={{ animation: "spin .8s linear infinite" }} /> : <PiggyBank size={16} />}
            שמור הוצאות
          </button>

          <button
            type="button"
            onClick={() => void handleAiRecommendation()}
            disabled={aiLoading || categoryTotal <= 0}
            style={{
              padding: "12px 28px",
              borderRadius: "var(--r-pill)",
              border: "1px solid var(--agent-ring)",
              background: "var(--agent-soft)",
              color: "var(--agent-strong)",
              fontWeight: 800,
              fontSize: 14,
              cursor: aiLoading || categoryTotal <= 0 ? "not-allowed" : "pointer",
              opacity: aiLoading || categoryTotal <= 0 ? 0.6 : 1,
              fontFamily: "inherit",
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            {aiLoading ? (
              <Loader2 size={16} style={{ animation: "spin .8s linear infinite" }} />
            ) : (
              <Sparkles size={16} />
            )}
            קבל המלצה מה-AI
          </button>
        </div>
      </div>

      {/* AI response */}
      {(aiLoading || aiAnswer) && (
        <div style={cardStyle}>
          <h2
            style={{
              margin: "0 0 14px",
              fontSize: 17,
              fontWeight: 900,
              color: "var(--text-strong)",
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <Sparkles size={18} color="var(--agent)" />
            המלצות AI
            {aiAgent && (
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  padding: "3px 10px",
                  borderRadius: "var(--r-pill)",
                  background: "var(--agent-soft)",
                  color: "var(--agent)",
                }}
              >
                {aiAgent}
              </span>
            )}
          </h2>
          {aiLoading ? (
            <div style={{ display: "flex", alignItems: "center", gap: 10, color: "var(--text-muted)" }}>
              <Loader2 size={20} style={{ animation: "spin .8s linear infinite" }} />
              מנתח את ההוצאות מול התלושים…
            </div>
          ) : (
            <div
              className="agent-markdown"
              style={{ fontSize: 14.5, lineHeight: 1.65, color: "var(--text-body)" }}
              dangerouslySetInnerHTML={{ __html: renderMarkdown(aiAnswer ?? "") }}
            />
          )}
        </div>
      )}
    </main>,
  );
}
