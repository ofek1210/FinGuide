import type { ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { APP_ROUTES } from "../types/navigation";
import { logoutWithConfirm } from "../utils/logout";

interface PrivateTopbarProps {
  rightSlot?: ReactNode;
}

const navItems = [
  { label: "לוח בקרה", route: APP_ROUTES.dashboard },
  { label: "מסמכים", route: APP_ROUTES.documents },
  { label: "ממצאים", route: APP_ROUTES.findings },
  { label: "עוזר AI", route: APP_ROUTES.assistant },
  { label: "הגדרות", route: APP_ROUTES.settings },
];

export default function PrivateTopbar({ rightSlot }: PrivateTopbarProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const handleLogout = () => {
    logoutWithConfirm(navigate);
  };

  return (
    <header className="dashboard-topbar">
      <div className="dashboard-brand">
        <span className="dashboard-brand-badge" aria-hidden="true">
          ✦
        </span>
        <span>FinGuide</span>
      </div>

      <nav className="dashboard-nav">
        {navItems.map((item) => (
          <button
            key={item.route}
            className={`dashboard-nav-link ${
              location.pathname === item.route ? "is-active" : ""
            }`}
            type="button"
            onClick={() => navigate(item.route)}
          >
            {item.label}
          </button>
        ))}
      </nav>

      <div className="dashboard-top-actions">
        {rightSlot || (
          <button
            className="dashboard-hero-action"
            type="button"
            onClick={() => navigate(APP_ROUTES.help)}
          >
            עזרה
          </button>
        )}
        <button
          className="dashboard-logout-action"
          type="button"
          onClick={handleLogout}
        >
          התנתקות
        </button>
      </div>
    </header>
  );
}
