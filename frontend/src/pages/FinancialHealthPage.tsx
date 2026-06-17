import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Gauge, Sparkles } from "lucide-react";
import PrivateTopbar from "../components/PrivateTopbar";
import AppFooter from "../components/AppFooter";
import Loader from "../components/ui/Loader";
import ScoreAgentPanel from "../components/ScoreAgentPanel";
import { useFinancialHealthScore } from "../hooks/useFinancialHealthScore";
import type { HealthScoreCategory } from "../api/financialHealth.api";

const statusLabels = {
  good: "טוב",
  warning: "לתשומת לב",
  poor: "דורש שיפור",
};

const buildYearOptions = (center: number) => {
  const years: number[] = [];
  for (let y = center + 1; y >= center - 4; y -= 1) years.push(y);
  return years;
};

function CategoryRow({ category }: { category: HealthScoreCategory }) {
  const ratio = category.maxScore > 0 ? (category.score / category.maxScore) * 100 : 0;
  return (
    <article className={`financial-health-category status-${category.status}`}>
      <div className="financial-health-category-head">
        <h3>{category.name}</h3>
        <span>
          {category.score}/{category.maxScore} · {statusLabels[category.status]}
        </span>
      </div>
      <div className="financial-health-category-bar" aria-hidden="true">
        <div className="financial-health-category-bar-fill" style={{ width: `${ratio}%` }} />
      </div>
      <ul>
        {category.messages.map((msg) => (
          <li key={msg}>{msg}</li>
        ))}
      </ul>
    </article>
  );
}

export default function FinancialHealthPage() {
  const navigate = useNavigate();
  const currentYear = new Date().getFullYear();
  const yearOptions = useMemo(() => buildYearOptions(currentYear), [currentYear]);
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [agentOpen, setAgentOpen] = useState(false);
  const { data, isLoading, error, reload } = useFinancialHealthScore(selectedYear);

  const circumference = 2 * Math.PI * 54;
  const offset = data ? circumference - (data.score / 100) * circumference : circumference;

  return (
    <div className="dashboard-page financial-health-page" dir="rtl">
      <div className="dashboard-shell">
        <PrivateTopbar />

        <header className="ai-page-header financial-health-page-header">
          <div className="ai-page-header-main">
            <div className="ai-page-icon-wrap">
              <Gauge size={32} />
            </div>
            <div>
              <div className="ai-page-badge">
                <Gauge size={12} />
                <span>AI Score</span>
              </div>
              <h1>ציון פיננסי AI</h1>
              <p className="ai-page-subtitle">ניתוח 360° של המצב הפיננסי שלך — שכר, מס, פנסיה וביטוחים — בציון אחד מאוחד.</p>
            </div>
          </div>
          <label className="financial-health-year-select">
            <span>שנה</span>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
            >
              {yearOptions.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </label>
        </header>

        <p className="financial-health-disclaimer" role="note">
          {data?.disclaimer ||
            "הציון מבוסס על המסמכים והמידע שהועלו למערכת ואינו מהווה ייעוץ פיננסי או ייעוץ מס."}
        </p>

        {isLoading ? (
          <section className="dashboard-card financial-health-loading">
            <Loader />
            <span>מחשבים ציון פיננסי...</span>
          </section>
        ) : null}

        {error ? <div className="dashboard-inline-error">{error}</div> : null}

        {data ? (
          <>
            <section className="dashboard-card financial-health-summary-card">
              <div className="financial-health-summary-ring" aria-hidden="true">
                <svg viewBox="0 0 120 120" className="financial-health-ring-svg">
                  <circle cx="60" cy="60" r="54" className="financial-health-ring-bg" />
                  <circle
                    cx="60"
                    cy="60"
                    r="54"
                    className={`financial-health-ring-progress level-${data.level}`}
                    strokeDasharray={circumference}
                    strokeDashoffset={offset}
                  />
                </svg>
                <div className="financial-health-ring-label large">
                  <strong>{data.score}</strong>
                  <span>מתוך 100</span>
                </div>
              </div>
              <div>
                <p className={`financial-health-level level-${data.level}`}>{data.label}</p>
                <p className="dashboard-muted">מבוסס על נתוני {data.year}</p>
                <div className="financial-health-summary-actions">
                  <button
                    type="button"
                    className="dashboard-hero-action score-agent-cta"
                    onClick={() => setAgentOpen(true)}
                  >
                    <Sparkles size={16} /> עזרה עם הסוכן להעלאת הציון
                  </button>
                  <button
                    type="button"
                    className="dashboard-link-btn"
                    onClick={() => void reload()}
                  >
                    חשב מחדש
                  </button>
                </div>
              </div>
            </section>

            <section className="dashboard-card">
              <h2>פירוט לפי קטגוריה</h2>
              <div className="financial-health-categories">
                {data.categories.map((category) => (
                  <CategoryRow key={category.key} category={category} />
                ))}
              </div>
            </section>

            <section className="dashboard-card">
              <h2>פעולות מומלצות</h2>
              {data.topActions.length === 0 ? (
                <p className="dashboard-muted">אין פעולות דחופות — המשך להעלות מסמכים לעדכון הציון.</p>
              ) : (
                <ul className="financial-health-actions-list">
                  {data.topActions.map((action) => (
                    <li key={action.title}>
                      <div>
                        <strong>{action.title}</strong>
                        <p>{action.description}</p>
                      </div>
                      <button
                        type="button"
                        className="dashboard-link-btn"
                        onClick={() => navigate(action.actionUrl)}
                      >
                        המשך
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        ) : null}

        <AppFooter variant="private" />
      </div>

      {agentOpen ? (
        <ScoreAgentPanel
          year={selectedYear}
          onClose={() => {
            setAgentOpen(false);
            void reload();
          }}
        />
      ) : null}
    </div>
  );
}
