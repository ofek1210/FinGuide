import type { ReactNode } from "react";
import { useRef, useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import { getAvatarDisplayUrl } from "../api/profile.api";
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

function getInitial(name: string | undefined): string {
  if (!name || !name.trim()) return "?";
  const first = name.trim().charAt(0);
  return first.toUpperCase();
}

export default function PrivateTopbar({ rightSlot }: PrivateTopbarProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const avatarUrl = getAvatarDisplayUrl(user ?? null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, []);

  const handleLogout = () => {
    setDropdownOpen(false);
    logoutWithConfirm(navigate);
  };

  const goToSettings = () => {
    setDropdownOpen(false);
    navigate(APP_ROUTES.settings);
  };

  return (
    <header className="dashboard-topbar" dir="rtl">
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
        {rightSlot}
        <div className="dashboard-user-menu" ref={dropdownRef}>
          <button
            type="button"
            className="dashboard-user-menu-toggle"
            onClick={() => setDropdownOpen((o) => !o)}
            aria-expanded={dropdownOpen}
            aria-haspopup="true"
            title={user?.name ?? "משתמש"}
          >
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt=""
                className="dashboard-avatar-img"
              />
            ) : (
              <span className="dashboard-avatar-initials">
                {getInitial(user?.name)}
              </span>
            )}
          </button>
          {dropdownOpen && (
            <div className="dashboard-user-dropdown">
              <button
                type="button"
                className="dashboard-user-dropdown-item"
                onClick={goToSettings}
              >
                הגדרות פרופיל
              </button>
              <button
                type="button"
                className="dashboard-user-dropdown-item dashboard-user-dropdown-item-danger"
                onClick={handleLogout}
              >
                התנתקות
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
