import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getMe } from "../api/auth.api";
import PrivateTopbar from "../components/PrivateTopbar";
import Loader from "../components/ui/Loader";
import { APP_ROUTES } from "../types/navigation";
import { logoutWithConfirm } from "../utils/logout";

export default function SettingsPage() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [createdAt, setCreatedAt] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  const loadUser = useCallback(async () => {
    setIsLoading(true);
    const response = await getMe();

    if (response.success && response.data?.user) {
      setName(response.data.user.name);
      setEmail(response.data.user.email);
      setCreatedAt(response.data.user.createdAt || "");
      setError("");
    } else {
      setError(response.message || "לא הצלחנו לטעון את פרטי החשבון.");
    }

    setIsLoading(false);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadUser();
  }, [loadUser]);

  const handleLogout = () => {
    logoutWithConfirm(navigate);
  };

  return (
    <div className="feature-page dashboard-page" dir="rtl">
      <div className="dashboard-shell">
        <PrivateTopbar
          rightSlot={(
            <button className="dashboard-hero-action" type="button" onClick={() => void loadUser()}>
              רענון פרטים
            </button>
          )}
        />

        <section className="dashboard-card">
          <h1 className="feature-page-title">הגדרות חשבון</h1>
          <p className="feature-page-subtitle">ניהול פרטי משתמש והתנתקות מאובטחת.</p>
        </section>

        {error ? <div className="feature-page-inline-error">{error}</div> : null}

        <section className="dashboard-card feature-page-grid">
          {isLoading ? (
            <div className="findings-placeholder">
              <Loader />
              טוענים פרטי חשבון...
            </div>
          ) : (
            <>
              <div className="settings-row">
                <span>שם מלא</span>
                <strong>{name || "—"}</strong>
              </div>
              <div className="settings-row">
                <span>אימייל</span>
                <strong>{email || "—"}</strong>
              </div>
              <div className="settings-row">
                <span>נוצר בתאריך</span>
                <strong>{createdAt ? new Date(createdAt).toLocaleDateString("he-IL") : "—"}</strong>
              </div>
              <div className="settings-row">
                <span>סטטוס התחברות</span>
                <strong>{localStorage.getItem("token") ? "מחובר" : "לא מחובר"}</strong>
              </div>
            </>
          )}
        </section>

        <section className="dashboard-card feature-page-actions">
          <button
            className="dashboard-hero-action"
            type="button"
            onClick={() => navigate(APP_ROUTES.dashboard)}
          >
            חזרה ללוח הבקרה
          </button>
          <button className="document-action danger" type="button" onClick={handleLogout}>
            התנתקות
          </button>
        </section>
      </div>
    </div>
  );
}
