import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  BarChart3,
  Calendar,
  Info,
  Lightbulb,
  PiggyBank,
  Search,
  Sparkles,
} from "lucide-react";
import {
  getSavingsForecast,
  listFindings,
  type FindingItem,
  type FindingSeverity,
  type SavingsForecastData,
  type SavingsForecastRequest,
  type SavingsTimelinePoint,
} from "../api/findings.api";
import PrivateTopbar from "../components/PrivateTopbar";
import AppFooter from "../components/AppFooter";
import { getApiErrorMessage } from "../utils/apiErrorMessages";
import Loader from "../components/ui/Loader";
import { APP_ROUTES } from "../types/navigation";
import { formatCurrencyILS, formatNumber } from "../utils/formatters";

const findingSeverityLabels: Record<FindingSeverity, string> = {
  info: "מידע",
  warning: "אזהרה",
};

const SEVERITY_ORDER: FindingSeverity[] = ["warning", "info"];

const FORECAST_STORAGE_KEY = "finguide_savings_forecast_inputs";

type ForecastFormState = {
  currentBalance: string;
  currentAge: string;
  retirementAge: string;
  adjustedMonthlyContribution: string;
  currentMonthlyContribution: string;
};

const DEFAULT_FORECAST_FORM: ForecastFormState = {
  currentBalance: "",
  currentAge: "",
  retirementAge: "",
  adjustedMonthlyContribution: "",
  currentMonthlyContribution: "",
};

/** Fallback when GET /api/findings returns no findings. */
const DEMO_RECOMMENDATIONS = [
  { title: "הגדלת הפקדות", text: "הוספת ₪190/חודש תגדיל את יתרת הפרישה ב-₪324,000" },
  { title: "בדרך הנכונה", text: "את בדרך להשגת יעד הפרישה שלך של ₪1.9 מיליון" },
  { title: "אופטימיזציית מס", text: "ניתן לחסוך עוד ₪1,070/שנה במס על ידי מקסום ההפקדות" },
];

const SVG_LEFT = 64;
const SVG_TOP = 8;
const SVG_RIGHT = 640;
const SVG_BOTTOM = 220;
const SVG_LABEL_Y = 252;
const SVG_HEIGHT = 280;
const SVG_WIDTH = 680;
const CHART_TICKS = 5;
const X_AXIS_TICKS = 6;

const readStoredForecastForm = (): ForecastFormState => {
  if (typeof window === "undefined") {
    return DEFAULT_FORECAST_FORM;
  }

  try {
    const raw = window.sessionStorage.getItem(FORECAST_STORAGE_KEY);
    if (!raw) {
      return DEFAULT_FORECAST_FORM;
    }

    const parsed = JSON.parse(raw) as Partial<ForecastFormState>;
    return {
      currentBalance: typeof parsed.currentBalance === "string" ? parsed.currentBalance : "",
      currentAge: typeof parsed.currentAge === "string" ? parsed.currentAge : "",
      retirementAge: typeof parsed.retirementAge === "string" ? parsed.retirementAge : "",
      adjustedMonthlyContribution:
        typeof parsed.adjustedMonthlyContribution === "string"
          ? parsed.adjustedMonthlyContribution
          : "",
      currentMonthlyContribution:
        typeof parsed.currentMonthlyContribution === "string"
          ? parsed.currentMonthlyContribution
          : "",
    };
  } catch {
    return DEFAULT_FORECAST_FORM;
  }
};

const formatCompactCurrency = (value: number) =>
  new Intl.NumberFormat("he-IL", {
    style: "currency",
    currency: "ILS",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);

const formatAxisCurrency = (value: number) => {
  if (value >= 1_000_000) {
    return `₪${(value / 1_000_000).toFixed(1)}M`;
  }

  if (value >= 1_000) {
    return `₪${Math.round(value / 1_000)}K`;
  }

  return formatCurrencyILS(value);
};

const getNumericStringValue = (value: string) => {
  if (!value.trim()) return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  return parsed;
};

const hasCoreForecastInputs = (form: ForecastFormState) =>
  Boolean(
    form.currentBalance.trim() &&
      form.currentAge.trim() &&
      form.retirementAge.trim() &&
      form.adjustedMonthlyContribution.trim()
  );

const buildAreaPath = (points: Array<{ x: number; y: number }>) => {
  if (points.length === 0) return "";
  const first = points[0];
  const last = points[points.length - 1];
  const line = points.map((point) => `${point.x} ${point.y}`).join(" L ");
  return `M ${first.x} ${SVG_BOTTOM} L ${line} L ${last.x} ${SVG_BOTTOM} Z`;
};

const buildLinePath = (points: Array<{ x: number; y: number }>) => {
  if (points.length === 0) return "";
  return `M ${points.map((point) => `${point.x} ${point.y}`).join(" L ")}`;
};

const pickTickIndexes = (length: number, maxTicks: number) => {
  if (length <= maxTicks) {
    return Array.from({ length }, (_, index) => index);
  }

  const lastIndex = length - 1;
  const indexes = new Set<number>([0, lastIndex]);

  for (let i = 1; i < maxTicks - 1; i += 1) {
    indexes.add(Math.round((i / (maxTicks - 1)) * lastIndex));
  }

  return Array.from(indexes).sort((a, b) => a - b);
};

const buildChartModel = (forecast: SavingsForecastData | null) => {
  if (!forecast) {
    return null;
  }

  const currentTimeline = forecast.currentScenario.timeline;
  const adjustedTimeline = forecast.adjustedScenario.timeline;
  const maxProjectedBalance = Math.max(
    ...currentTimeline.map((point) => point.projectedBalance),
    ...adjustedTimeline.map((point) => point.projectedBalance),
    1
  );

  const mapPoint = (point: SavingsTimelinePoint, index: number, totalPoints: number) => {
    const usableWidth = SVG_RIGHT - SVG_LEFT;
    const usableHeight = SVG_BOTTOM - SVG_TOP;
    const x =
      totalPoints === 1
        ? SVG_LEFT
        : SVG_LEFT + (index / (totalPoints - 1)) * usableWidth;
    const y =
      SVG_BOTTOM - (point.projectedBalance / maxProjectedBalance) * usableHeight;
    return {
      x,
      y,
      ...point,
    };
  };

  const currentPoints = currentTimeline.map((point, index) =>
    mapPoint(point, index, currentTimeline.length)
  );
  const adjustedPoints = adjustedTimeline.map((point, index) =>
    mapPoint(point, index, adjustedTimeline.length)
  );

  const yTickValues = Array.from({ length: CHART_TICKS }, (_, index) => {
    const ratio = (CHART_TICKS - 1 - index) / (CHART_TICKS - 1);
    return normalizeForAxis(maxProjectedBalance * ratio);
  });

  const xTickIndexes = pickTickIndexes(adjustedTimeline.length, X_AXIS_TICKS);

  return {
    maxProjectedBalance,
    currentPoints,
    adjustedPoints,
    currentAreaPath: buildAreaPath(currentPoints),
    adjustedAreaPath: buildAreaPath(adjustedPoints),
    currentLinePath: buildLinePath(currentPoints),
    adjustedLinePath: buildLinePath(adjustedPoints),
    yTicks: yTickValues.map((value) => ({
      value,
      y:
        SVG_BOTTOM -
        (maxProjectedBalance === 0
          ? 0
          : (value / maxProjectedBalance) * (SVG_BOTTOM - SVG_TOP)),
    })),
    xTicks: xTickIndexes.map((index) => ({
      x: adjustedPoints[index].x,
      age: adjustedPoints[index].age,
      calendarYear: adjustedPoints[index].calendarYear,
    })),
  };
};

function normalizeForAxis(value: number) {
  if (value <= 0) return 0;
  if (value < 10_000) return Math.round(value / 100) * 100;
  if (value < 100_000) return Math.round(value / 1_000) * 1_000;
  return Math.round(value / 10_000) * 10_000;
}

export default function FindingsPage() {
  const navigate = useNavigate();
  const [findings, setFindings] = useState<FindingItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [forecastForm, setForecastForm] = useState<ForecastFormState>(
    () => readStoredForecastForm()
  );
  const [showManualContributionInput, setShowManualContributionInput] = useState(
    () => Boolean(readStoredForecastForm().currentMonthlyContribution)
  );
  const [forecast, setForecast] = useState<SavingsForecastData | null>(null);
  const [forecastError, setForecastError] = useState("");
  const [isForecastLoading, setIsForecastLoading] = useState(false);
  const didAttemptInitialForecastRef = useRef(false);

  const filteredAndGrouped = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const filtered = q
      ? findings.filter(
          (f) =>
            f.title.toLowerCase().includes(q) || f.details.toLowerCase().includes(q),
        )
      : findings;
    const bySeverity: Record<FindingSeverity, FindingItem[]> = { warning: [], info: [] };
    for (const f of filtered) {
      bySeverity[f.severity].push(f);
    }
    return SEVERITY_ORDER.flatMap((sev) => bySeverity[sev]);
  }, [findings, searchQuery]);

  const recommendations = useMemo(() => {
    if (filteredAndGrouped.length === 0) return DEMO_RECOMMENDATIONS;
    return filteredAndGrouped.slice(0, 5).map((f) => ({
      title: f.title,
      text: f.details,
    }));
  }, [filteredAndGrouped]);

  const chartModel = useMemo(() => buildChartModel(forecast), [forecast]);
  const currentBalanceValue = getNumericStringValue(forecastForm.currentBalance);

  const kpis = useMemo(
    () => [
      {
        label: "שנים לפרישה",
        value: forecast
          ? formatNumber(Math.round(forecast.currentScenario.monthsToRetirement / 12))
          : "—",
        icon: Calendar,
      },
      {
        label: "תחזית בגיל פרישה",
        value: forecast
          ? formatCompactCurrency(forecast.adjustedScenario.projectedBalance)
          : "—",
        icon: PiggyBank,
      },
      {
        label: "הפקדה חודשית",
        value: forecast
          ? formatCurrencyILS(forecast.currentScenario.monthlyContribution)
          : "—",
        icon: Sparkles,
      },
      {
        label: "יתרה נוכחית",
        value: currentBalanceValue !== null
          ? formatCurrencyILS(currentBalanceValue)
          : "—",
        icon: BarChart3,
      },
    ],
    [currentBalanceValue, forecast]
  );

  const forecastDelta = useMemo(() => {
    if (!forecast) return null;
    return forecast.adjustedScenario.projectedBalance - forecast.currentScenario.projectedBalance;
  }, [forecast]);

  const loadFindings = useCallback(async () => {
    setIsLoading(true);
    const response = await listFindings();
    if (response.success && Array.isArray(response.data)) {
      setFindings(response.data);
      setError("");
    } else {
      setFindings([]);
      setError(
        getApiErrorMessage(
          response.message || "לא הצלחנו לטעון את הממצאים.",
          response.status,
        ),
      );
    }
    setIsLoading(false);
  }, []);

  const buildForecastPayload = useCallback(
    (
      form: ForecastFormState,
      { manualContributionRequired = false }: { manualContributionRequired?: boolean } = {}
    ): SavingsForecastRequest | null => {
      if (!hasCoreForecastInputs(form)) {
        return null;
      }

      const currentBalance = getNumericStringValue(form.currentBalance);
      const currentAge = getNumericStringValue(form.currentAge);
      const retirementAge = getNumericStringValue(form.retirementAge);
      const adjustedMonthlyContribution = getNumericStringValue(
        form.adjustedMonthlyContribution
      );
      const currentMonthlyContribution = getNumericStringValue(
        form.currentMonthlyContribution
      );

      if (
        currentBalance === null ||
        currentAge === null ||
        retirementAge === null ||
        adjustedMonthlyContribution === null
      ) {
        setForecastError("נא להזין מספרים תקינים לכל שדות החובה.");
        return null;
      }

      if (
        currentBalance < 0 ||
        currentAge < 0 ||
        retirementAge < 0 ||
        adjustedMonthlyContribution < 0
      ) {
        setForecastError("כל הערכים חייבים להיות גדולים או שווים ל-0.");
        return null;
      }

      if (!Number.isInteger(currentAge) || !Number.isInteger(retirementAge)) {
        setForecastError("גיל נוכחי וגיל פרישה חייבים להיות מספרים שלמים.");
        return null;
      }

      if (retirementAge <= currentAge) {
        setForecastError("גיל הפרישה חייב להיות גדול מהגיל הנוכחי.");
        return null;
      }

      if (manualContributionRequired) {
        if (currentMonthlyContribution === null) {
          setForecastError("לא נמצאה הפקדה במסמכים. הזינו הפקדה חודשית נוכחית ידנית.");
          return null;
        }

        if (currentMonthlyContribution < 0) {
          setForecastError("הפקדה חודשית נוכחית חייבת להיות גדולה או שווה ל-0.");
          return null;
        }
      }

      return {
        currentBalance,
        currentAge,
        retirementAge,
        adjustedMonthlyContribution,
        ...(currentMonthlyContribution !== null && { currentMonthlyContribution }),
      };
    },
    []
  );

  const loadForecast = useCallback(
    async (
      form: ForecastFormState,
      { manualContributionRequired = false }: { manualContributionRequired?: boolean } = {}
    ) => {
      const payload = buildForecastPayload(form, { manualContributionRequired });
      if (!payload) {
        return false;
      }

      setIsForecastLoading(true);
      setForecastError("");

      const response = await getSavingsForecast(payload);
      setIsForecastLoading(false);

      if (!response.success || !response.data) {
        const resolvedMessage = getApiErrorMessage(
          response.message || "לא הצלחנו לחשב תחזית חיסכון.",
          response.status
        );

        const requiresManualContribution = Array.isArray(response.errors)
          ? response.errors.some((item) => {
              if (!item || typeof item !== "object") {
                return false;
              }
              const field = (item as { field?: string }).field;
              return field === "currentMonthlyContribution";
            })
          : false;

        if (requiresManualContribution) {
          setShowManualContributionInput(true);
          setForecastError(
            "לא נמצאה הפקדה חודשית תקינה במסמכים. הזינו הפקדה נוכחית ידנית כדי להמשיך."
          );
        } else {
          setForecastError(resolvedMessage);
        }

        return false;
      }

      setForecast(response.data);
      setShowManualContributionInput(response.data.meta.contributionSource === "manual");
      return true;
    },
    [buildForecastPayload]
  );

  const handleRefresh = useCallback(async () => {
    await loadFindings();
    if (hasCoreForecastInputs(forecastForm)) {
      await loadForecast(forecastForm, {
        manualContributionRequired: showManualContributionInput,
      });
    }
  }, [forecastForm, loadFindings, loadForecast, showManualContributionInput]);

  const handleForecastFieldChange = (
    field: keyof ForecastFormState,
    value: string
  ) => {
    setForecastForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleForecastSubmit = async () => {
    await loadForecast(forecastForm, {
      manualContributionRequired: showManualContributionInput,
    });
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadFindings();
  }, [loadFindings]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    window.sessionStorage.setItem(
      FORECAST_STORAGE_KEY,
      JSON.stringify(forecastForm)
    );
  }, [forecastForm]);

  useEffect(() => {
    if (didAttemptInitialForecastRef.current) {
      return;
    }

    didAttemptInitialForecastRef.current = true;

    if (!hasCoreForecastInputs(forecastForm)) {
      return;
    }

    const timer = window.setTimeout(() => {
      void loadForecast(forecastForm, {
        manualContributionRequired: Boolean(
          forecastForm.currentMonthlyContribution.trim()
        ),
      });
    }, 0);

    return () => window.clearTimeout(timer);
  }, [forecastForm, loadForecast]);

  return (
    <div className="pension-insights-page dashboard-page" dir="rtl">
      <div className="dashboard-shell">
        <PrivateTopbar
          rightSlot={(
            <button className="dashboard-hero-action" type="button" onClick={() => void handleRefresh()}>
              רענון
            </button>
          )}
        />

        <header className="pension-insights-hero">
          <h1 className="pension-insights-title">תחזית חיסכון לינארית</h1>
          <p className="pension-insights-subtitle">
            חישוב פנסיוני פשוט ללא תשואה: יתרה נוכחית ועוד הפקדה חודשית קבועה עד גיל הפרישה.
          </p>
        </header>

        {error ? <div className="feature-page-inline-error">{error}</div> : null}
        {forecastError ? (
          <div className="feature-page-inline-error">{forecastError}</div>
        ) : null}

        <section className="pension-kpi-row" aria-label="מדדי מפתח">
          {kpis.map((item) => {
            const Icon = item.icon;
            return (
              <div key={item.label} className="pension-kpi-card">
                <span className="pension-kpi-icon" aria-hidden="true">
                  <Icon />
                </span>
                <span className="pension-kpi-label">{item.label}</span>
                <span className="pension-kpi-value">{item.value}</span>
              </div>
            );
          })}
        </section>

        <div className="pension-columns">
          <aside className="pension-left-col">
            <section className="pension-card pension-simulator-card">
              <div className="pension-card-head">
                <Sparkles className="pension-card-head-icon" aria-hidden="true" />
                <h2 className="pension-card-title">סימולטור פרישה</h2>
              </div>
              <p className="pension-card-desc">
                הזינו יתרה, גיל והפקדה מותאמת. אם קיימת הפקדה במסמכים, נשתמש בה אוטומטית כתרחיש הנוכחי.
              </p>
              <div className="pension-form-grid">
                <label className="pension-form-field">
                  <span>יתרה נוכחית</span>
                  <input
                    type="number"
                    min="0"
                    inputMode="numeric"
                    value={forecastForm.currentBalance}
                    onChange={(event) =>
                      handleForecastFieldChange("currentBalance", event.target.value)
                    }
                    placeholder="100000"
                  />
                </label>
                <label className="pension-form-field">
                  <span>גיל נוכחי</span>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    inputMode="numeric"
                    value={forecastForm.currentAge}
                    onChange={(event) =>
                      handleForecastFieldChange("currentAge", event.target.value)
                    }
                    placeholder="32"
                  />
                </label>
                <label className="pension-form-field">
                  <span>גיל פרישה</span>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    inputMode="numeric"
                    value={forecastForm.retirementAge}
                    onChange={(event) =>
                      handleForecastFieldChange("retirementAge", event.target.value)
                    }
                    placeholder="65"
                  />
                </label>
                <label className="pension-form-field">
                  <span>הפקדה חודשית מותאמת</span>
                  <input
                    type="number"
                    min="0"
                    inputMode="numeric"
                    value={forecastForm.adjustedMonthlyContribution}
                    onChange={(event) =>
                      handleForecastFieldChange(
                        "adjustedMonthlyContribution",
                        event.target.value
                      )
                    }
                    placeholder="2500"
                  />
                </label>
                {showManualContributionInput ? (
                  <label className="pension-form-field pension-form-field-full">
                    <span>הפקדה חודשית נוכחית</span>
                    <input
                      type="number"
                      min="0"
                      inputMode="numeric"
                      value={forecastForm.currentMonthlyContribution}
                      onChange={(event) =>
                        handleForecastFieldChange(
                          "currentMonthlyContribution",
                          event.target.value
                        )
                      }
                      placeholder="1800"
                    />
                  </label>
                ) : (
                  <div className="pension-form-inline-note">
                    ננסה למשוך את ההפקדה הנוכחית אוטומטית מהמסמך האחרון עם נתוני פנסיה.
                  </div>
                )}
              </div>
              <div className="pension-simulator-actions">
                <button
                  className="dashboard-hero-action"
                  type="button"
                  onClick={() => void handleForecastSubmit()}
                  disabled={isForecastLoading}
                >
                  {isForecastLoading ? <Loader /> : "חשב תחזית"}
                </button>
              </div>
              <div className="pension-simulator-result">
                <span className="pension-simulator-result-label">ערך צפוי בתרחיש המותאם</span>
                <span className="pension-simulator-result-value">
                  {forecast
                    ? formatCurrencyILS(forecast.adjustedScenario.projectedBalance)
                    : "—"}
                </span>
                <span className="pension-simulator-result-note">
                  {forecast
                    ? `בגיל ${
                        forecastForm.retirementAge ||
                        forecast.adjustedScenario.timeline[
                          forecast.adjustedScenario.timeline.length - 1
                        ]?.age
                      }`
                    : "הזינו נתונים והפעילו חישוב"}
                </span>
                {forecastDelta !== null ? (
                  <span className="pension-simulator-result-note">
                    פער מול המסלול הנוכחי: {formatCurrencyILS(forecastDelta)}
                  </span>
                ) : null}
              </div>
            </section>

            <section className="pension-card pension-recommendations-card" aria-label="ממצאים מהבקאנד">
              <div className="pension-card-head">
                <Lightbulb className="pension-card-head-icon" aria-hidden="true" />
                <h2 className="pension-card-title">המלצות AI</h2>
              </div>
              <p className="pension-card-desc" style={{ marginTop: "0.25rem", marginBottom: "0.5rem" }}>
                ממצאים מ-GET /api/findings (אזהרות ומידע). ללא ממצאים – מוצגות המלצות דמו.
              </p>
              {isLoading ? (
                <div className="pension-recommendations-loading">
                  <Loader />
                  <span>טוענים תובנות...</span>
                </div>
              ) : (
                <ul className="pension-recommendations-list">
                  {recommendations.map((rec, i) => (
                    <li key={i} className="pension-recommendation-item">
                      <h3 className="pension-recommendation-title">{rec.title}</h3>
                      <p className="pension-recommendation-text">{rec.text}</p>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </aside>

          <main className="pension-right-col">
            <section className="pension-card pension-chart-card">
              <div className="pension-chart-header">
                <div>
                  <h2 className="pension-card-title">תחזית חיסכון לינארית</h2>
                  <p className="pension-chart-subtitle">השוואה בין המסלול הנוכחי למסלול המותאם</p>
                </div>
                <div className="pension-chart-legend">
                  <span className="pension-legend-dot pension-legend-current" />
                  <span>מסלול נוכחי</span>
                  <span className="pension-legend-dot pension-legend-adjusted" />
                  <span>מותאם</span>
                </div>
              </div>
              <div className="pension-chart-placeholder">
                {chartModel ? (
                  <>
                    <div className="pension-chart-svg-wrap">
                      <svg
                        viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`}
                        className="pension-chart-svg"
                        aria-hidden="true"
                      >
                        <defs>
                          <linearGradient id="pensionFillCurrent" x1="0" y1="1" x2="0" y2="0">
                            <stop offset="0%" stopColor="#0052ff" stopOpacity="0.18" />
                            <stop offset="100%" stopColor="#0052ff" stopOpacity="0.02" />
                          </linearGradient>
                          <linearGradient id="pensionFillAdjusted" x1="0" y1="1" x2="0" y2="0">
                            <stop offset="0%" stopColor="#00d9ff" stopOpacity="0.12" />
                            <stop offset="100%" stopColor="#00d9ff" stopOpacity="0" />
                          </linearGradient>
                        </defs>
                        <g className="pension-chart-grid">
                          {chartModel.yTicks.map((tick) => (
                            <line
                              key={`h-${tick.value}`}
                              x1={SVG_LEFT}
                              y1={tick.y}
                              x2={SVG_RIGHT}
                              y2={tick.y}
                              stroke="#e5e7eb"
                              strokeWidth="1"
                            />
                          ))}
                          {chartModel.xTicks.map((tick) => (
                            <line
                              key={`v-${tick.age}`}
                              x1={tick.x}
                              y1={SVG_TOP}
                              x2={tick.x}
                              y2={SVG_BOTTOM}
                              stroke="#e5e7eb"
                              strokeWidth="1"
                            />
                          ))}
                        </g>
                        <path fill="url(#pensionFillCurrent)" d={chartModel.currentAreaPath} />
                        <path fill="url(#pensionFillAdjusted)" d={chartModel.adjustedAreaPath} />
                        <path
                          fill="none"
                          stroke="#0052ff"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d={chartModel.currentLinePath}
                        />
                        <path
                          fill="none"
                          stroke="#00d9ff"
                          strokeWidth="2"
                          strokeDasharray="6 4"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d={chartModel.adjustedLinePath}
                        />
                        {chartModel.currentPoints.map((point) => (
                          <circle
                            key={`current-${point.age}`}
                            cx={point.x}
                            cy={point.y}
                            r="4"
                            fill="#ffffff"
                            stroke="#0052ff"
                            strokeWidth="2"
                          />
                        ))}
                        {chartModel.adjustedPoints.map((point) => (
                          <circle
                            key={`adjusted-${point.age}`}
                            cx={point.x}
                            cy={point.y}
                            r="4"
                            fill="#ffffff"
                            stroke="#00d9ff"
                            strokeWidth="2"
                          />
                        ))}
                        {chartModel.xTicks.map((tick) => (
                          <text
                            key={`x-label-${tick.age}`}
                            x={tick.x}
                            y={SVG_LABEL_Y}
                            className="pension-chart-axis"
                            textAnchor="middle"
                          >
                            גיל {tick.age}
                          </text>
                        ))}
                        {chartModel.yTicks.map((tick) => (
                          <text
                            key={`y-label-${tick.value}`}
                            x={SVG_LEFT - 8}
                            y={tick.y + 4}
                            className="pension-chart-axis"
                            textAnchor="end"
                          >
                            {formatAxisCurrency(tick.value)}
                          </text>
                        ))}
                      </svg>
                    </div>
                    <p className="pension-chart-note">
                      מקור ההפקדה הנוכחית:{" "}
                      {forecast?.meta.contributionSource === "document"
                        ? "מסמך אחרון עם נתוני פנסיה"
                        : "קלט ידני"}
                    </p>
                  </>
                ) : (
                  <div className="pension-chart-empty">
                    <p className="pension-chart-placeholder-label">
                      הזינו יתרה, גיל והפקדה מותאמת כדי לחשב תחזית חיסכון אמיתית.
                    </p>
                  </div>
                )}
              </div>
            </section>

            <div className="pension-mini-cards">
              <div className="pension-mini-card">
                <div className="pension-mini-card-head">
                  <Sparkles className="pension-mini-card-icon" aria-hidden="true" />
                  <h3 className="pension-mini-card-title">מודל חישוב</h3>
                </div>
                <p className="pension-mini-card-value">לינארי ללא תשואה</p>
                <p className="pension-mini-card-note">
                  אין ריבית, אינפלציה או דמי ניהול. רק יתרה נוכחית ועוד הפקדה חודשית קבועה.
                </p>
              </div>
              <div className="pension-mini-card">
                <div className="pension-mini-card-head">
                  <BarChart3 className="pension-mini-card-icon" aria-hidden="true" />
                  <h3 className="pension-mini-card-title">פער בין תרחישים</h3>
                </div>
                <p className="pension-mini-card-value">
                  {forecastDelta !== null ? formatCurrencyILS(forecastDelta) : "—"}
                </p>
                <p className="pension-mini-card-note">
                  {forecast
                    ? "הפער בין התחזית המותאמת למסלול הנוכחי בגיל הפרישה."
                    : "יופיע לאחר חישוב תחזית."}
                </p>
              </div>
            </div>
            {forecast?.meta.warnings?.length ? (
              <section className="pension-card pension-chart-card">
                <div className="pension-card-head">
                  <AlertTriangle className="pension-card-head-icon" aria-hidden="true" />
                  <h2 className="pension-card-title">הערות לחישוב</h2>
                </div>
                <ul className="pension-warnings-list">
                  {forecast.meta.warnings.map((warning) => (
                    <li key={warning} className="pension-warning-item">
                      {warning}
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
          </main>
        </div>

        {filteredAndGrouped.length > 0 ? (
          <section className="pension-findings-section dashboard-card">
            <div className="insights-toolbar">
              <div className="insights-search-wrap">
                <Search className="insights-search-icon" aria-hidden="true" />
                <input
                  type="search"
                  placeholder="חיפוש בממצאים..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="insights-search-input"
                  dir="rtl"
                  aria-label="חיפוש בממצאים"
                />
              </div>
              <span className="insights-count">{filteredAndGrouped.length} ממצאים</span>
            </div>
            <ul className="insights-list">
              {filteredAndGrouped.map((finding) => (
                <li key={finding.id} className={`insight-card insight-card--${finding.severity}`}>
                  <span className="insight-card-icon" aria-hidden="true">
                    {finding.severity === "warning" ? <AlertTriangle /> : <Info />}
                  </span>
                  <div className="insight-card-body">
                    <h3 className="insight-card-title">{finding.title}</h3>
                    <p className="insight-card-details">{finding.details}</p>
                    <span className={`insight-card-badge severity-${finding.severity}`}>
                      {findingSeverityLabels[finding.severity]}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <section className="dashboard-card feature-page-actions">
          <button
            className="dashboard-hero-action"
            type="button"
            onClick={() => navigate(APP_ROUTES.documents)}
          >
            מעבר למסמכים
          </button>
          <button
            className="dashboard-hero-action"
            type="button"
            onClick={() => navigate(APP_ROUTES.dashboard)}
          >
            חזרה ללוח הבקרה
          </button>
        </section>

        <AppFooter variant="private" />
      </div>
    </div>
  );
}
