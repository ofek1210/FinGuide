import { useNavigate } from "react-router-dom";
import PrivateTopbar from "../components/PrivateTopbar";
import AppFooter from "../components/AppFooter";
import { APP_ROUTES } from "../types/navigation";

export default function IntegrationsEmailPage() {
  const navigate = useNavigate();

  return (
    <div className="feature-page dashboard-page" dir="rtl">
      <div className="dashboard-shell">
        <PrivateTopbar />

        <section className="dashboard-card">
          <h1 className="feature-page-title">חיבור לתיבת מייל</h1>
          <p className="feature-page-subtitle">
            המסך מוכן לשילוב. החיבור האוטומטי למייל יופעל לאחר חיבור API ייעודי.
          </p>
        </section>

        <section className="dashboard-card feature-placeholder-card">
          <h2>בפיתוח</h2>
          <p>
            בקרוב תוכלו לחבר תיבת דוא״ל, למשוך קבצים אוטומטית ולנתח מסמכים בלי העלאה ידנית.
          </p>
          <ul className="feature-placeholder-list" dir="rtl">
            <li>חיבור מאובטח לתיבת Gmail או Outlook</li>
            <li>משיכה אוטומטית של תלושי שכר וקבצים מצורפים</li>
            <li>ניתוח ותובנות כמו בהעלאה ידנית</li>
          </ul>
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
            onClick={() => navigate(APP_ROUTES.help)}
          >
            עזרה ותמיכה
          </button>
        </section>

        <AppFooter variant="private" />
      </div>
    </div>
  );
}
