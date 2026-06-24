import { useCallback, useEffect, useMemo, useState } from "react";
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
  listFindings,
  type FindingItem,
  type FindingMeta,
  type FindingSeverity,
} from "../api/findings.api";
import { useSavingsForecast, getNumericStringValue } from "../hooks/useSavingsForecast";
import {
  SVG_BOTTOM,
  SVG_HEIGHT,
  SVG_LABEL_Y,
  SVG_LEFT,
  SVG_RIGHT,
  SVG_TOP,
  SVG_WIDTH,
  buildChartModel,
  formatAxisCurrency,
} from "../utils/savingsForecastChart";
import PrivateTopbar from "../components/PrivateTopbar";
import AppFooter from "../components/AppFooter";
import { getApiErrorMessage } from "../utils/apiErrorMessages";
import Loader from "../components/ui/Loader";
import { APP_ROUTES } from "../types/navigation";
import AnalysisTabBar from "../components/tabs/AnalysisTabBar";
import { formatCurrencyILS, formatNumber } from "../utils/formatters";

const findingSeverityLabels: Record<FindingSeverity, string> = {
  info: "מידע",
  warning: "אזהרה",
};

const CONTRIBUTION_FINDING_IDS = new Set([
  "study_fund_no_deposit",
  "pension_no_deposit",
  "onboarding_study_fund_mismatch",
  "onboarding_pension_mismatch",
  "study_fund_rate_inconsistency",
  "pension_rate_inconsistency",
  "study_fund_rate_below_minimum",
  "pension_rate_below_minimum",
  "pension_deposit_break_on_payslip",
  "pension_deposit_break_missing_payslip",
  "study_fund_deposit_break_on_payslip",
  "study_fund_deposit_break_missing_payslip",
  "pension_rate_data_incomplete",
  "study_fund_rate_data_incomplete",
  "pension_deposit_timeline_uncertain",
  "study_fund_deposit_timeline_uncertain",
]);

const isContributionFinding = (finding: FindingItem) => {
  const kind = finding.meta?.findingKind;
  if (kind === "rate" || kind === "continuity" || kind === "deposit") {
    return true;
  }
  return CONTRIBUTION_FINDING_IDS.has(finding.id);
};

const findingKindLabel = (meta?: FindingMeta): string | null => {
  switch (meta?.findingKind) {
    case "rate":
      return "אחוזי הפרשה";
    case "continuity":
      return "רצף הפקדות";
    case "deposit":
      return "הפקדה";
    case "pension_health_low":
      return "בריאות פנסיונית";
    case "fee_above_market":
      return "דמי ניהול";
    case "risk_wrong_for_age":
      return "מסלול סיכון";
    case "track_underperforming":
      return "ביצועי מסלול";
    case "insurance_health_low":
      return "בריאות ביטוח";
    case "insurance_duplicate":
      return "כפילויות ביטוח";
    case "insurance_missing_coverage":
      return "כיסוי חסר";
    default:
      return null;
  }
};

const PENSION_FINDING_KINDS = new Set([
  "pension_health_low",
  "fee_above_market",
  "risk_wrong_for_age",
  "track_underperforming",
]);

const INSURANCE_FINDING_KINDS = new Set([
  "insurance_health_low",
  "insurance_duplicate",
  "insurance_missing_coverage",
]);

const isPensionBenchmarkFinding = (finding: FindingItem) => {
  const kind = finding.meta?.findingKind;
  if (kind && PENSION_FINDING_KINDS.has(kind)) return true;
  return finding.id.startsWith("pension_health")
    || finding.id.startsWith("fee_above_market")
    || finding.id.startsWith("risk_wrong_for_age");
};

const isInsuranceBenchmarkFinding = (finding: FindingItem) => {
  const kind = finding.meta?.findingKind;
  if (kind && INSURANCE_FINDING_KINDS.has(kind)) return true;
  return finding.id.startsWith("insurance_");
};

const findingFundLabel = (meta?: FindingMeta): string | null => {
  if (meta?.fundType === "pension") return "פנסיה";
  if (meta?.fundType === "study_fund") return "קרן השתלמות";
  return null;
};

const formatHighlightRange = (periods: string[]) => {
  if (!periods.length) {
    return "";
  }
  const sorted = [...periods].sort();
  if (sorted.length === 1) {
    return sorted[0];
  }
  return `${sorted[0]}–${sorted[sorted.length - 1]}`;
};

const SEVERITY_ORDER: FindingSeverity[] = ["warning", "info"];

/** Fallback when GET /api/findings returns no findings. */
const DEMO_RECOMMENDATIONS = [
  { title: "הגדלת הפקדות", text: "הוספת ₪190/חודש תגדיל את יתרת הפרישה ב-₪324,000" },
  { title: "בדרך הנכונה", text: "את בדרך להשגת יעד הפרישה שלך של ₪1.9 מיליון" },
  { title: "אופטימיזציית מס", text: "ניתן לחסוך עוד ₪1,070/שנה במס על ידי מקסום ההפקדות" },
];

const formatCompactCurrency = (value: number) =>
  new Intl.NumberFormat("he-IL", {
    style: "currency",
    currency: "ILS",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);

export default function FindingsPage() {
  const navigate = useNavigate();
  const [findings, setFindings] = useState<FindingItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [contributionFilter, setContributionFilter] = useState<"all" | "contributions">("all");
  const {
    forecastForm,
    showManualContributionInput,
    forecast,
    forecastError,
    isForecastLoading,
    forecastDelta,
    forecastWarnings,
    handleForecastFieldChange,
    handleForecastSubmit,
    refreshForecast,
  } = useSavingsForecast();

  const filteredAndGrouped = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    let base =
      contributionFilter === "contributions"
        ? findings.filter((f) => isContributionFinding(f))
        : findings;
    const filtered = q
      ? base.filter((f) => {
          const kind = findingKindLabel(f.meta)?.toLowerCase() ?? "";
          const fund = findingFundLabel(f.meta)?.toLowerCase() ?? "";
          return (
            f.title.toLowerCase().includes(q) ||
            f.details.toLowerCase().includes(q) ||
            kind.includes(q) ||
            fund.includes(q)
          );
        })
      : base;
    const bySeverity: Record<FindingSeverity, FindingItem[]> = { warning: [], info: [] };
    for (const f of filtered) {
      bySeverity[f.severity].push(f);
    }
    return SEVERITY_ORDER.flatMap((sev) => bySeverity[sev]);
  }, [findings, searchQuery, contributionFilter]);

  const contributionFindingsInView = useMemo(
    () => filteredAndGrouped.filter((f) => isContributionFinding(f)),
    [filteredAndGrouped],
  );

  const otherFindingsInView = useMemo(
    () => filteredAndGrouped.filter((f) => !isContributionFinding(f)),
    [filteredAndGrouped],
  );

  const navigateToPayslipHistory = useCallback(
    (finding: FindingItem) => {
      const periods = finding.meta?.periods?.filter(Boolean) ?? [];
      if (periods.length > 0) {
        navigate(`${APP_ROUTES.payslipHistory}?highlight=${encodeURIComponent(periods.join(","))}`);
        return;
      }
      navigate(APP_ROUTES.payslipHistory);
    },
    [navigate],
  );

  const recommendations = useMemo(() => {
    if (findings.length === 0) return DEMO_RECOMMENDATIONS;
    if (filteredAndGrouped.length === 0) return [];
    return filteredAndGrouped.slice(0, 5).map((f) => ({
      title: f.title,
      text: f.details,
    }));
  }, [filteredAndGrouped, findings.length]);

  const chartModel = useMemo(() => buildChartModel(forecast), [forecast]);
  const currentBalanceValue = getNumericStringValue(forecastForm.currentBalance);

  const kpis = useMemo(
    () => [
      {
        label: "שנים לפרישה",
        value: forecast ? formatNumber(forecast.summary.yearsToRetirement) : "—",
        icon: Calendar,
      },
      {
        label: "תחזית בגיל פרישה",
        value: forecast
          ? formatCompactCurrency(forecast.summary.adjustedProjectedBalance)
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

  const handleRefresh = useCallback(async () => {
    await loadFindings();
    await refreshForecast();
  }, [loadFindings, refreshForecast]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadFindings();
  }, [loadFindings]);

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
        <AnalysisTabBar />

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
              {forecastWarnings.length > 0 ? (
                <ul className="pension-form-warnings" role="status">
                  {forecastWarnings.map((warning) => (
                    <li key={warning}>{warning}</li>
                  ))}
                </ul>
              ) : null}
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
                            <stop offset="0%" stopColor="var(--lav-600)" stopOpacity="0.18" />
                            <stop offset="100%" stopColor="var(--lav-600)" stopOpacity="0.02" />
                          </linearGradient>
                          <linearGradient id="pensionFillAdjusted" x1="0" y1="1" x2="0" y2="0">
                            <stop offset="0%" stopColor="var(--mint-ink)" stopOpacity="0.14" />
                            <stop offset="100%" stopColor="var(--mint-ink)" stopOpacity="0" />
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
                              stroke="var(--border-hair)"
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
                              stroke="var(--border-hair)"
                              strokeWidth="1"
                            />
                          ))}
                        </g>
                        <path fill="url(#pensionFillCurrent)" d={chartModel.currentAreaPath} />
                        <path fill="url(#pensionFillAdjusted)" d={chartModel.adjustedAreaPath} />
                        <path
                          fill="none"
                          stroke="var(--lav-600)"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d={chartModel.currentLinePath}
                        />
                        <path
                          fill="none"
                          stroke="var(--mint-ink)"
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
                            fill="var(--surface-card)"
                            stroke="var(--lav-600)"
                            strokeWidth="2"
                          />
                        ))}
                        {chartModel.adjustedPoints.map((point) => (
                          <circle
                            key={`adjusted-${point.age}`}
                            cx={point.x}
                            cy={point.y}
                            r="4"
                            fill="var(--surface-card)"
                            stroke="var(--mint-ink)"
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

        {findings.length > 0 ? (
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
              <div className="insights-filter-chips" role="group" aria-label="סינון ממצאים">
                <button
                  type="button"
                  className={`insights-chip ${contributionFilter === "all" ? "is-active" : ""}`}
                  onClick={() => setContributionFilter("all")}
                >
                  הכל
                </button>
                <button
                  type="button"
                  className={`insights-chip ${contributionFilter === "contributions" ? "is-active" : ""}`}
                  onClick={() => setContributionFilter("contributions")}
                >
                  הפקדות ואחוזים
                </button>
              </div>
              <span className="insights-count">{filteredAndGrouped.length} ממצאים</span>
            </div>
            {filteredAndGrouped.length === 0 ? (
              <p className="insights-no-results">אין ממצאים התואמים לסינון הנוכחי.</p>
            ) : null}
            {contributionFindingsInView.length > 0 ? (
              <>
                <h2 className="insights-section-title">הפקדות ואחוזים</h2>
                <ul className="insights-list">
                  {contributionFindingsInView.map((finding) => {
                    const kind = findingKindLabel(finding.meta);
                    const fund = findingFundLabel(finding.meta);
                    const periods = finding.meta?.periods ?? [];
                    return (
                      <li
                        key={finding.id}
                        className={`insight-card insight-card--${finding.severity}`}
                      >
                        <span className="insight-card-icon" aria-hidden="true">
                          {finding.severity === "warning" ? <AlertTriangle /> : <Info />}
                        </span>
                        <div className="insight-card-body">
                          <h3 className="insight-card-title">{finding.title}</h3>
                          {kind || fund ? (
                            <span className="insight-card-kind" title="סוג ממצא">
                              {[kind, fund].filter(Boolean).join(" • ")}
                            </span>
                          ) : null}
                          <p className="insight-card-details">{finding.details}</p>
                          <span className={`insight-card-badge severity-${finding.severity}`}>
                            {findingSeverityLabels[finding.severity]}
                          </span>
                          <button
                            type="button"
                            className="dashboard-hero-action insight-card-action"
                            onClick={() => navigateToPayslipHistory(finding)}
                          >
                            {periods.length > 0
                              ? `צפייה בחודשים ${formatHighlightRange(periods)}`
                              : "לצפייה בתלושים"}
                          </button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </>
            ) : null}
            {otherFindingsInView.length > 0 ? (
              <>
                {contributionFindingsInView.length > 0 ? (
                  <h2 className="insights-section-title">ממצאים נוספים</h2>
                ) : null}
                <ul className="insights-list">
                  {otherFindingsInView.map((finding) => {
                    const kind = findingKindLabel(finding.meta);
                    const isPension = isPensionBenchmarkFinding(finding);
                    const isInsurance = isInsuranceBenchmarkFinding(finding);
                    return (
                    <li
                      key={finding.id}
                      className={`insight-card insight-card--${finding.severity}`}
                    >
                      <span className="insight-card-icon" aria-hidden="true">
                        {finding.severity === "warning" ? <AlertTriangle /> : <Info />}
                      </span>
                      <div className="insight-card-body">
                        <h3 className="insight-card-title">{finding.title}</h3>
                        {kind ? (
                          <span className="insight-card-kind" title="סוג ממצא">{kind}</span>
                        ) : null}
                        <p className="insight-card-details">{finding.details}</p>
                        <span className={`insight-card-badge severity-${finding.severity}`}>
                          {findingSeverityLabels[finding.severity]}
                        </span>
                        {isPension ? (
                          <button
                            type="button"
                            className="dashboard-hero-action insight-card-action"
                            onClick={() => navigate(APP_ROUTES.pension)}
                          >
                            לניתוח פנסיה
                          </button>
                        ) : null}
                        {isInsurance ? (
                          <button
                            type="button"
                            className="dashboard-hero-action insight-card-action"
                            onClick={() => navigate(APP_ROUTES.insurance)}
                          >
                            לניתוח ביטוח
                          </button>
                        ) : null}
                      </div>
                    </li>
                    );
                  })}
                </ul>
              </>
            ) : null}
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
            onClick={() => navigate(APP_ROUTES.documents)}
          >
            חזרה ללוח הבקרה
          </button>
        </section>

        <AppFooter variant="private" />
      </div>
    </div>
  );
}
