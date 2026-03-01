import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { listFindings, type FindingItem, type FindingSeverity } from "../api/findings.api";
import PrivateTopbar from "../components/PrivateTopbar";
import Loader from "../components/ui/Loader";
import { APP_ROUTES } from "../types/navigation";

const findingSeverityLabels: Record<FindingSeverity, string> = {
  info: "מידע",
  warning: "אזהרה",
};

export default function FindingsPage() {
  const navigate = useNavigate();
  const [findings, setFindings] = useState<FindingItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  const loadFindings = useCallback(async () => {
    setIsLoading(true);
    const response = await listFindings();

    if (response.success && Array.isArray(response.data)) {
      setFindings(response.data);
      setError("");
    } else {
      setFindings([]);
      setError(response.message || "לא הצלחנו לטעון את הממצאים.");
    }

    setIsLoading(false);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadFindings();
  }, [loadFindings]);

  return (
    <div className="feature-page dashboard-page" dir="rtl">
      <div className="dashboard-shell">
        <PrivateTopbar
          rightSlot={(
            <button className="dashboard-hero-action" type="button" onClick={() => void loadFindings()}>
              רענון
            </button>
          )}
        />

        <section className="dashboard-card">
          <h1 className="feature-page-title">ממצאים והתראות</h1>
          <p className="feature-page-subtitle">
            ריכוז התובנות שחושבו על בסיס המסמכים שלך.
          </p>
        </section>

        {error ? <div className="feature-page-inline-error">{error}</div> : null}

        <section className="dashboard-card findings-card">
          {isLoading ? (
            <div className="findings-placeholder">
              <Loader />
              טוענים ממצאים...
            </div>
          ) : findings.length === 0 ? (
            <div className="findings-placeholder">
              אין ממצאים כרגע. העלו מסמכים כדי לקבל תובנות.
            </div>
          ) : (
            <ul className="findings-list">
              {findings.map((finding) => (
                <li
                  key={finding.id}
                  className={`finding-item severity-${finding.severity}`}
                >
                  <div className="finding-text">
                    <span className="finding-title">{finding.title}</span>
                    <span className="finding-details">{finding.details}</span>
                  </div>
                  <span className={`finding-badge severity-${finding.severity}`}>
                    {findingSeverityLabels[finding.severity]}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

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
      </div>
    </div>
  );
}
