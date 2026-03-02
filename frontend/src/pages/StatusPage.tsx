import { useCallback, useEffect, useState } from "react";
import { getHealth } from "../api/health.api";
import PrivateTopbar from "../components/PrivateTopbar";

type StatusState = "checking" | "online" | "offline";

export default function StatusPage() {
  const [status, setStatus] = useState<StatusState>("checking");
  const [timestamp, setTimestamp] = useState("");
  const [message, setMessage] = useState("");

  const checkStatus = useCallback(async () => {
    setStatus("checking");
    const response = await getHealth();

    if (response.success) {
      setStatus("online");
      setMessage(response.message || "Server is running");
      setTimestamp(response.timestamp || "");
      return;
    }

    setStatus("offline");
    setMessage(response.message || "השרת לא זמין כרגע.");
    setTimestamp("");
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void checkStatus();
  }, [checkStatus]);

  return (
    <div className="feature-page dashboard-page" dir="rtl">
      <div className="dashboard-shell">
        <PrivateTopbar
          rightSlot={(
            <button className="dashboard-hero-action" type="button" onClick={() => void checkStatus()}>
              בדיקה מחדש
            </button>
          )}
        />

        <section className="dashboard-card">
          <h1 className="feature-page-title">מצב מערכת</h1>
          <p className="feature-page-subtitle">בדיקת זמינות שירות ה־API בזמן אמת.</p>
        </section>

        <section className="dashboard-card feature-page-grid">
          <div className={`status-badge is-${status}`}>
            {status === "checking" ? "בודק..." : status === "online" ? "זמין" : "לא זמין"}
          </div>
          <div className="settings-row">
            <span>הודעה</span>
            <strong>{message || "—"}</strong>
          </div>
          <div className="settings-row">
            <span>חותמת זמן</span>
            <strong>
              {timestamp ? new Date(timestamp).toLocaleString("he-IL") : "לא התקבל זמן שרת"}
            </strong>
          </div>
        </section>
      </div>
    </div>
  );
}
