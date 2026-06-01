import { useState } from "react";
import { Shield, RefreshCw } from "lucide-react";
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

  return (
    <div className="dashboard-page" dir="rtl">
      <div className="dashboard-shell">
        <PrivateTopbar />

        <header className="feature-page-header">
          <div>
            <Shield size={28} aria-hidden />
            <h1>המלצות ביטוח</h1>
            <p>המלצות מותאמות אישית לפי פרופיל, נכסים ותלושי שכר.</p>
          </div>
          <button type="button" className="auth-button" disabled={running} onClick={() => void handleRun()}>
            <RefreshCw size={16} />
            {running ? "מחשב..." : "רענן המלצות"}
          </button>
        </header>

        {isLoading ? <Loader /> : null}
        {error ? <div className="dashboard-inline-error">{error}</div> : null}

        {!isLoading && items.length === 0 ? (
          <section className="dashboard-card">
            <p>אין המלצות פעילות. השלם/י onboarding והעלה תלוש לקבלת המלצות.</p>
          </section>
        ) : null}

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

        <AppFooter variant="private" />
      </div>
    </div>
  );
}
