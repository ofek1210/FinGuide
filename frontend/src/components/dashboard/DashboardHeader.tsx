import { Sparkles, Upload } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { ChangeEvent, RefObject } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../auth/AuthProvider";
import { getAvatarDisplayUrl } from "../../api/profile.api";
import { APP_ROUTES } from "../../types/navigation";
import { logoutWithConfirm } from "../../utils/logout";

type HealthStatus = "online" | "offline" | "checking";

interface DashboardHeaderProps {
  healthStatus: HealthStatus;
  isUploading: boolean;
  fileInputRef: RefObject<HTMLInputElement | null>;
  onUploadClick: () => void;
  onFileSelected: (event: ChangeEvent<HTMLInputElement>) => void;
  onNavigateDashboard: () => void;
  onNavigateDocuments: () => void;
  onNavigatePayslipHistory: () => void;
}

function getInitial(name: string | undefined): string {
  if (!name || !name.trim()) return "?";
  return name.trim().charAt(0).toUpperCase();
}

export default function DashboardHeader({
  healthStatus,
  isUploading,
  fileInputRef,
  onUploadClick,
  onFileSelected,
  onNavigateDashboard,
  onNavigateDocuments,
  onNavigatePayslipHistory,
}: DashboardHeaderProps) {
  const navigate = useNavigate();
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
        <span className="dashboard-brand-badge">
          <Sparkles aria-hidden="true" />
        </span>
        <span>FinGuide</span>
      </div>

      <nav className="dashboard-nav">
        <button
          className="dashboard-nav-link is-active"
          type="button"
          onClick={onNavigateDashboard}
        >
          לוח בקרה
        </button>
        <button
          className="dashboard-nav-link"
          type="button"
          onClick={onNavigateDocuments}
        >
          מסמכים
        </button>
        <button
          className="dashboard-nav-link"
          type="button"
          onClick={onNavigatePayslipHistory}
        >
          היסטוריית תלושים
        </button>
        <button className="dashboard-nav-link" type="button">
          תובנות
        </button>
      </nav>

      <div className="dashboard-top-actions">
        <button
          className="dashboard-upload"
          type="button"
          onClick={onUploadClick}
          disabled={isUploading}
        >
          <Upload aria-hidden="true" />
          {isUploading ? "מעלה..." : "העלאת מסמך"}
        </button>
        <span className={`dashboard-health is-${healthStatus}`}>
          {healthStatus === "checking"
            ? "בודק שרת..."
            : healthStatus === "online"
              ? "השרת זמין"
              : "השרת לא זמין"}
        </span>
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
        <input
          ref={fileInputRef}
          className="dashboard-upload-input"
          type="file"
          accept="application/pdf"
          onChange={onFileSelected}
        />
      </div>
    </header>
  );
}
