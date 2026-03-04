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
  TrendingUp,
} from "lucide-react";
import { listFindings, type FindingItem, type FindingSeverity } from "../api/findings.api";
import PrivateTopbar from "../components/PrivateTopbar";
import AppFooter from "../components/AppFooter";
import { getApiErrorMessage } from "../utils/apiErrorMessages";
import Loader from "../components/ui/Loader";
import { APP_ROUTES } from "../types/navigation";

const findingSeverityLabels: Record<FindingSeverity, string> = {
  info: "מידע",
  warning: "אזהרה",
};

const SEVERITY_ORDER: FindingSeverity[] = ["warning", "info"];

/** ערכי דמו בהתאם ל-Figma Pension Insights – יחוברו לבאק בהמשך */
const DEMO_KPIS = [
  { label: "שנים לפרישה", value: "33", icon: Calendar },
  { label: "תחזית בגיל 65", value: "₪2.1M", icon: PiggyBank },
  { label: "צמיחה חודשית", value: "₪2,680", icon: TrendingUp },
  { label: "יתרה נוכחית", value: "₪93,000", icon: BarChart3 },
] as const;

const DEMO_RECOMMENDATIONS = [
  { title: "הגדלת הפקדות", text: "הוספת ₪190/חודש תגדיל את יתרת הפרישה ב-₪324,000" },
  { title: "בדרך הנכונה", text: "את בדרך להשגת יעד הפרישה שלך של ₪1.9 מיליון" },
  { title: "אופטימיזציית מס", text: "ניתן לחסוך עוד ₪1,070/שנה במס על ידי מקסום ההפקדות" },
];

export default function FindingsPage() {
  const navigate = useNavigate();
  const [findings, setFindings] = useState<FindingItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

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

  useEffect(() => {
    void loadFindings();
  }, [loadFindings]);

  return (
    <div className="pension-insights-page dashboard-page" dir="rtl">
      <div className="dashboard-shell">
        <PrivateTopbar
          rightSlot={(
            <button className="dashboard-hero-action" type="button" onClick={() => void loadFindings()}>
              רענון
            </button>
          )}
        />

        <header className="pension-insights-hero">
          <h1 className="pension-insights-title">תחזית ותובנות פנסיה</h1>
          <p className="pension-insights-subtitle">
            תכננו את הפרישה שלכם עם תחזיות מבוססות AI
          </p>
        </header>

        {error ? <div className="feature-page-inline-error">{error}</div> : null}

        <section className="pension-kpi-row" aria-label="מדדי מפתח">
          {DEMO_KPIS.map((item) => {
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
                התאימו את ההפקדות וגיל הפרישה לראות כיצד זה משפיע על התחזית.
              </p>
              <div className="pension-simulator-row">
                <label className="pension-simulator-label">הפקדה חודשית</label>
                <span className="pension-simulator-value">₪1,070</span>
              </div>
              <div className="pension-simulator-slider-wrap">
                <div className="pension-simulator-track" />
                <div className="pension-simulator-fill" style={{ width: "35%" }} />
              </div>
              <div className="pension-simulator-range">
                <span>₪400</span>
                <span>₪4,000</span>
              </div>
              <div className="pension-simulator-row">
                <label className="pension-simulator-label">גיל פרישה</label>
                <span className="pension-simulator-value">65</span>
              </div>
              <div className="pension-simulator-slider-wrap">
                <div className="pension-simulator-track" />
                <div className="pension-simulator-fill" style={{ width: "66%" }} />
              </div>
              <div className="pension-simulator-range">
                <span>55</span>
                <span>70</span>
              </div>
              <div className="pension-simulator-result">
                <span className="pension-simulator-result-label">ערך פנסיה צפוי</span>
                <span className="pension-simulator-result-value">₪2,100,000</span>
                <span className="pension-simulator-result-note">בגיל 65</span>
              </div>
            </section>

            <section className="pension-card pension-recommendations-card">
              <div className="pension-card-head">
                <Lightbulb className="pension-card-head-icon" aria-hidden="true" />
                <h2 className="pension-card-title">המלצות AI</h2>
              </div>
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
                  <h2 className="pension-card-title">תחזית צמיחת פנסיה</h2>
                  <p className="pension-chart-subtitle">יתרה צפויה לאורך זמן</p>
                </div>
                <div className="pension-chart-legend">
                  <span className="pension-legend-dot pension-legend-current" />
                  <span>מסלול נוכחי</span>
                  <span className="pension-legend-dot pension-legend-adjusted" />
                  <span>מותאם</span>
                </div>
              </div>
              <div className="pension-chart-placeholder">
                <div className="pension-chart-svg-wrap">
                  <svg viewBox="0 0 597 260" className="pension-chart-svg" aria-hidden="true">
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
                      {[0, 65, 130, 195, 260].map((y) => (
                        <line key={`h-${y}`} x1={65} y1={y} x2={662} y2={y} stroke="#e5e7eb" strokeWidth="1" />
                      ))}
                      {[65, 139.625, 214.25, 288.875, 363.5, 438.125, 512.75, 587.375, 662].map((x) => (
                        <line key={`v-${x}`} x1={x} y1={5} x2={x} y2={265} stroke="#e5e7eb" strokeWidth="1" />
                      ))}
                    </g>
                    <path
                      fill="url(#pensionFillCurrent)"
                      d="M65 265 L65 200 L139.6 175 L214.2 150 L288.9 120 L363.5 88 L438.1 62 L512.75 42 L587.4 28 L662 20 L662 265 Z"
                    />
                    <path
                      fill="url(#pensionFillAdjusted)"
                      d="M65 200 L139.6 175 L214.2 150 L288.9 120 L363.5 88 L438.1 62 L512.75 42 L587.4 28 L662 20 L662 5 L587.4 6 L512.75 8 L438.1 12 L363.5 18 L288.9 28 L214.2 38 L139.6 48 L65 55 Z"
                    />
                    <path
                      fill="none"
                      stroke="#0052ff"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M65 200 L139.6 175 L214.2 150 L288.9 120 L363.5 88 L438.1 62 L512.75 42 L587.4 28 L662 20"
                    />
                    <path
                      fill="none"
                      stroke="#00d9ff"
                      strokeWidth="2"
                      strokeDasharray="6 4"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M65 55 L139.6 48 L214.2 38 L288.9 28 L363.5 18 L438.1 12 L512.75 8 L587.4 6 L662 5"
                    />
                    <text x="50" y="265" className="pension-chart-axis" textAnchor="end">2025</text>
                    <text x="124.6" y="265" className="pension-chart-axis" textAnchor="end">2030</text>
                    <text x="199.2" y="265" className="pension-chart-axis" textAnchor="end">2035</text>
                    <text x="273.9" y="265" className="pension-chart-axis" textAnchor="end">2040</text>
                    <text x="348.5" y="265" className="pension-chart-axis" textAnchor="end">2045</text>
                    <text x="423.1" y="265" className="pension-chart-axis" textAnchor="end">2050</text>
                    <text x="497.75" y="265" className="pension-chart-axis" textAnchor="end">2055</text>
                    <text x="572.4" y="265" className="pension-chart-axis" textAnchor="end">2060</text>
                    <text x="647" y="265" className="pension-chart-axis" textAnchor="end">2065</text>
                    <text x="59" y="265" className="pension-chart-axis" textAnchor="end">0</text>
                    <text x="59" y="200" className="pension-chart-axis" textAnchor="end">650000</text>
                    <text x="59" y="135" className="pension-chart-axis" textAnchor="end">1300000</text>
                    <text x="59" y="70" className="pension-chart-axis" textAnchor="end">1950000</text>
                    <text x="59" y="5" className="pension-chart-axis" textAnchor="end">2600000</text>
                  </svg>
                </div>
                <p className="pension-chart-note">גרף תחזית – יחובר לנתונים כשהבאק יהיה מוכן</p>
              </div>
            </section>

            <section className="pension-card pension-chart-card">
              <div className="pension-chart-header">
                <div>
                  <h2 className="pension-card-title">השפעת הפקדות חודשיות</h2>
                  <p className="pension-chart-subtitle">
                    כיצד רמות הפקדה שונות משפיעות על יתרת הפרישה שלכם
                  </p>
                </div>
              </div>
              <div className="pension-chart-placeholder pension-chart-placeholder-sm">
                <div className="pension-chart-svg-wrap">
                  <svg viewBox="0 0 597 260" className="pension-chart-svg" aria-hidden="true">
                    <defs>
                      <linearGradient id="depositsLineGrad" x1="0" y1="1" x2="0" y2="0">
                        <stop offset="0%" stopColor="#a855f7" stopOpacity="0.25" />
                        <stop offset="100%" stopColor="#a855f7" stopOpacity="0" />
                      </linearGradient>
                    </defs>
                    <g className="pension-chart-grid">
                      {[0, 65, 130, 195, 260].map((y) => (
                        <line key={`dh-${y}`} x1={65} y1={y} x2={662} y2={y} stroke="#e5e7eb" strokeWidth="1" />
                      ))}
                      {[65, 184.4, 303.8, 423.2, 542.6, 662].map((x) => (
                        <line key={`dv-${x}`} x1={x} y1={5} x2={x} y2={265} stroke="#e5e7eb" strokeWidth="1" />
                      ))}
                    </g>
                    <path
                      fill="url(#depositsLineGrad)"
                      d="M65 75 L184.4 68 L303.8 52 L423.2 35 L542.6 18 L662 5 L662 265 L65 265 Z"
                    />
                    <path
                      fill="none"
                      stroke="#a855f7"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M65 75 L184.4 68 L303.8 52 L423.2 35 L542.6 18 L662 5"
                    />
                    {[
                      [65, 75],
                      [184.4, 68],
                      [303.8, 52],
                      [423.2, 35],
                      [542.6, 18],
                      [662, 5],
                    ].map(([cx, cy], i) => (
                      <circle key={i} cx={cx} cy={cy} r="5" fill="#fff" stroke="#a855f7" strokeWidth="2" />
                    ))}
                    <text x="65" y="265" className="pension-chart-axis" textAnchor="middle">800</text>
                    <text x="184.4" y="265" className="pension-chart-axis" textAnchor="middle">950</text>
                    <text x="303.8" y="265" className="pension-chart-axis" textAnchor="middle">1070</text>
                    <text x="423.2" y="265" className="pension-chart-axis" textAnchor="middle">1350</text>
                    <text x="542.6" y="265" className="pension-chart-axis" textAnchor="middle">1500</text>
                    <text x="662" y="265" className="pension-chart-axis" textAnchor="middle">1900</text>
                    <text x="59" y="265" className="pension-chart-axis" textAnchor="end">₪0.0M</text>
                    <text x="59" y="200" className="pension-chart-axis" textAnchor="end">₪0.8M</text>
                    <text x="59" y="135" className="pension-chart-axis" textAnchor="end">₪1.7M</text>
                    <text x="59" y="70" className="pension-chart-axis" textAnchor="end">₪2.5M</text>
                    <text x="59" y="5" className="pension-chart-axis" textAnchor="end">₪3.4M</text>
                  </svg>
                </div>
                <p className="pension-chart-note">הפקדה חודשית (₪) – יחובר לנתונים כשהבאק יהיה מוכן</p>
              </div>
            </section>

            <div className="pension-mini-cards">
              <div className="pension-mini-card">
                <div className="pension-mini-card-head">
                  <TrendingUp className="pension-mini-card-icon" aria-hidden="true" />
                  <h3 className="pension-mini-card-title">שיעור צמיחה</h3>
                </div>
                <p className="pension-mini-card-value">7.2% בשנה</p>
                <p className="pension-mini-card-note">
                  מבוסס על תמהיל ההשקעות הנוכחי והביצועים ההיסטוריים
                </p>
              </div>
              <div className="pension-mini-card">
                <div className="pension-mini-card-head">
                  <BarChart3 className="pension-mini-card-icon" aria-hidden="true" />
                  <h3 className="pension-mini-card-title">הטבות מס</h3>
                </div>
                <p className="pension-mini-card-value">₪2,568/שנה</p>
                <p className="pension-mini-card-note">
                  הטבת מס על הפקדות הפנסיה הנוכחיות שלכם
                </p>
              </div>
            </div>
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
