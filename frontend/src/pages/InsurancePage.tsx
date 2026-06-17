import { useState } from "react";
import { Bot, RefreshCw, ShieldCheck, ShieldAlert, Zap, AlertCircle } from "lucide-react";
import PrivateTopbar from "../components/PrivateTopbar";
import AppFooter from "../components/AppFooter";
import Loader from "../components/ui/Loader";
import RecommendationCard from "../components/insurance/RecommendationCard";
import { useRecommendations } from "../hooks/useRecommendations";
import {
  dismissRecommendation,
  markRecommendationPurchased,
  runRecommendations,
} from "../api/recommendations.api";

const AI_DISCLAIMER = "ניתוח זה נוצר על ידי מודל AI על בסיס הנתונים שהזנת. אינו מהווה ייעוץ פיננסי או ביטוחי מקצועי. לפני כל החלטה, פנה/י לסוכן ביטוח מורשה.";

export default function InsurancePage() {
  const { items, isLoading, error, refresh } = useRecommendations();
  const [running, setRunning] = useState(false);

  const handleRun = async () => {
    setRunning(true);
    await runRecommendations();
    await refresh();
    setRunning(false);
  };

  const handleDismiss = async (id: string) => {
    await dismissRecommendation(id);
    await refresh();
  };

  const handlePurchased = async (id: string) => {
    await markRecommendationPurchased(id);
    await refresh();
  };

  const criticalCount = items.filter(r => r.importance === "critical").length;
  const highCount = items.filter(r => r.importance === "high").length;

  return (
    <div className="dashboard-page ai-insurance-page" dir="rtl">
      <div className="dashboard-shell">
        <PrivateTopbar />

        <header className="ai-page-header">
          <div className="ai-page-header-main">
            <div className="ai-page-icon-wrap">
              <ShieldCheck size={36} />
            </div>
            <div>
              <div className="ai-page-badge">
                <Bot size={13} />
                <span>AI Shield</span>
              </div>
              <h1>ניתוח ביטוחי חכם</h1>
              <p className="ai-page-subtitle">
                המנוע שלנו סורק את הפרופיל, הנכסים ותלושי השכר שלך — ומזהה פערי כיסוי, כפילויות ועלויות מיותרות.
              </p>
            </div>
          </div>

          <div className="ai-page-header-actions">
            {items.length > 0 && (
              <div className="ai-scan-stats">
                {criticalCount > 0 && (
                  <span className="ai-stat-badge critical">
                    <ShieldAlert size={13} />
                    {criticalCount} קריטי
                  </span>
                )}
                {highCount > 0 && (
                  <span className="ai-stat-badge high">
                    <AlertCircle size={13} />
                    {highCount} חשוב
                  </span>
                )}
              </div>
            )}
            <button
              type="button"
              className="ai-run-btn"
              disabled={running}
              onClick={() => void handleRun()}
            >
              {running ? (
                <><span className="ai-run-spinner" /> סורק עם AI...</>
              ) : (
                <><Zap size={15} /> הפעל ניתוח AI</>
              )}
            </button>
          </div>
        </header>

        {isLoading ? (
          <div className="ai-loading-state">
            <div className="ai-scan-animation">
              <span className="ai-scan-line" />
            </div>
            <p>AI סורק את הפרופיל שלך...</p>
          </div>
        ) : null}

        {error ? <div className="dashboard-inline-error">{error}</div> : null}

        {!isLoading && items.length === 0 ? (
          <section className="ai-empty-state">
            <Bot size={48} className="ai-empty-icon" />
            <h3>המנוע מוכן לניתוח</h3>
            <p>השלם/י את הפרופיל האישי והעלה תלוש שכר — ה-AI יזהה אילו ביטוחים חסרים לך וכמה כדאי לשלם.</p>
            <button type="button" className="ai-run-btn" disabled={running} onClick={() => void handleRun()}>
              <Zap size={15} /> הפעל ניתוח AI עכשיו
            </button>
          </section>
        ) : null}

        {items.length > 0 && (
          <div className="ai-recommendations-wrap">
            <div className="ai-recommendations-header">
              <span className="ai-recommendations-label">
                <Bot size={14} /> ממצאי AI — {items.length} המלצות
              </span>
            </div>
            <div className="recommendations-grid">
              {items.map(rec => (
                <RecommendationCard
                  key={rec._id}
                  recommendation={rec}
                  onDismiss={id => void handleDismiss(id)}
                  onPurchased={id => void handlePurchased(id)}
                />
              ))}
            </div>
          </div>
        )}

        <div className="ai-disclaimer-bar">
          <AlertCircle size={14} />
          <span>{AI_DISCLAIMER}</span>
        </div>

        <AppFooter variant="private" />
      </div>
    </div>
  );
}

