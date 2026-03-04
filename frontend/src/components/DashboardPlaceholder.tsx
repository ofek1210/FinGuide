import { useNavigate } from "react-router-dom";
import { APP_ROUTES } from "../types/navigation";

export default function DashboardPlaceholder() {
  const navigate = useNavigate();

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("auth_user");
    navigate(APP_ROUTES.login);
  };

  return (
    <div className="dashboard-page" dir="rtl">
      <div className="dashboard-card">
        <div className="dashboard-card-header">
          <h1>הדאשבורד שלכם</h1>
          <p>כאן יופיעו הנתונים הפיננסיים שלכם. זמנית יש כפתור התנתקות.</p>
        </div>
        <button className="dashboard-logout" type="button" onClick={handleLogout}>
          התנתקות
        </button>
      </div>
    </div>
  );
}
