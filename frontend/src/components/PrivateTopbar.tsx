import type { ReactNode } from "react";
import { useRef, useState, useEffect, useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ChevronDown } from "lucide-react";
import { useAuth } from "../auth/AuthProvider";
import { getAvatarDisplayUrl } from "../api/profile.api";
import NotificationBell from "./notifications/NotificationBell";
import { APP_ROUTES } from "../types/navigation";
import { logoutWithConfirm } from "../utils/logout";

interface PrivateTopbarProps {
  rightSlot?: ReactNode;
}

type NavSubItem = { label: string; route: string; icon: string; description?: string };
type NavGroup = { label: string; routes: string[]; items: NavSubItem[] };

const NAV_GROUPS: NavGroup[] = [
  {
    label: "תלושים ומסמכים",
    routes: ["/documents", "/findings", "/tax-assistant", "/copilot"],
    items: [
      { icon: "📄", label: "ניהול מסמכים", route: APP_ROUTES.documents, description: "העלה ונהל תלושי שכר" },
      { icon: "📊", label: "היסטוריית תלושים", route: APP_ROUTES.payslipHistory, description: "כל התלושים לפי חודש" },
      { icon: "🔍", label: "ממצאים והתראות", route: APP_ROUTES.findings, description: "בעיות ופערים שזוהו" },
      { icon: "💰", label: "מיסים והחזרים", route: APP_ROUTES.taxAssistant, description: "ניתוח מס והחזרים" },
      { icon: "🤖", label: "סוכן ניתוח תלוש", route: APP_ROUTES.copilot, description: "AI מנתח את השכר שלך" },
    ],
  },
  {
    label: "פנסיה וחיסכון",
    routes: ["/pension", "/financial-health", "/insights"],
    items: [
      { icon: "📈", label: "ניתוח ותחזית פנסיה", route: APP_ROUTES.pension, description: "צבירה, תשואות, המלצות" },
      { icon: "💹", label: "בריאות פיננסית", route: APP_ROUTES.financialHealth, description: "ציון בריאות כולל" },
      { icon: "📉", label: "תובנות וניתוחים", route: APP_ROUTES.insights, description: "מגמות ותובנות חכמות" },
      { icon: "🤖", label: "יועץ פנסיוני AI", route: APP_ROUTES.aiAgents, description: "ייעוץ פנסיוני מבוסס AI" },
    ],
  },
  {
    label: "ביטוח ופוליסות",
    routes: ["/insurance"],
    items: [
      { icon: "🛡️", label: "ניתוח ביטוח", route: APP_ROUTES.insurance, description: "כיסויים, כפילויות, חיסכון" },
      { icon: "🤖", label: "סוכן ביטוח AI", route: APP_ROUTES.aiAgents, description: "ייעוץ ביטוחי מבוסס AI" },
    ],
  },
];

function getInitial(name: string | undefined): string {
  if (!name || !name.trim()) return "?";
  return name.trim().charAt(0).toUpperCase();
}

export default function PrivateTopbar({ rightSlot }: PrivateTopbarProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const avatarUrl = getAvatarDisplayUrl(user ?? null);

  const [openGroup, setOpenGroup] = useState<string | null>(null);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  const navRef = useRef<HTMLDivElement>(null);
  const userRef = useRef<HTMLDivElement>(null);

  // Close all menus on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (navRef.current && !navRef.current.contains(e.target as Node)) setOpenGroup(null);
      if (userRef.current && !userRef.current.contains(e.target as Node)) setUserMenuOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Close dropdown on route change
  useEffect(() => { setOpenGroup(null); }, [location.pathname]);

  const isGroupActive = useCallback((group: NavGroup) =>
    group.routes.some(r => location.pathname.startsWith(r)), [location.pathname]);

  const handleLogout = () => { setUserMenuOpen(false); logoutWithConfirm(navigate); };
  const goToSettings = () => { setUserMenuOpen(false); navigate(APP_ROUTES.settings); };

  return (
    <header className="dashboard-topbar" dir="rtl">
      <div className="dashboard-brand">
        <span>FinGuide</span>
      </div>

      <nav className="dashboard-nav" ref={navRef}>
        {/* Dashboard — single link */}
        <button
          type="button"
          className={`dashboard-nav-link ${location.pathname === APP_ROUTES.dashboard ? "is-active" : ""}`}
          onClick={() => navigate(APP_ROUTES.dashboard)}
        >
          לוח בקרה
        </button>

        {/* 3 product groups with dropdowns */}
        {NAV_GROUPS.map((group) => {
          const active = isGroupActive(group);
          const open = openGroup === group.label;
          return (
            <div key={group.label} style={{ position: "relative" }}>
              <button
                type="button"
                className={`dashboard-nav-link ${active ? "is-active" : ""}`}
                style={{ display: "flex", alignItems: "center", gap: 4 }}
                onClick={() => setOpenGroup(open ? null : group.label)}
              >
                {group.label}
                <ChevronDown
                  size={13}
                  style={{
                    transition: "transform 0.2s",
                    transform: open ? "rotate(180deg)" : "rotate(0deg)",
                    opacity: 0.7,
                  }}
                />
              </button>

              {open && (
                <div style={{
                  position: "absolute",
                  top: "calc(100% + 8px)",
                  right: 0,
                  minWidth: 240,
                  background: "var(--rapyd-card, #1a1a2e)",
                  border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: 12,
                  boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
                  zIndex: 999,
                  overflow: "hidden",
                  padding: "6px 0",
                }}>
                  {group.items.map((item) => {
                    const itemActive = location.pathname === item.route ||
                      (item.route !== APP_ROUTES.aiAgents && location.pathname.startsWith(item.route));
                    return (
                      <button
                        key={item.label}
                        type="button"
                        onClick={() => navigate(item.route)}
                        style={{
                          width: "100%",
                          display: "flex",
                          alignItems: "flex-start",
                          gap: 12,
                          padding: "10px 16px",
                          background: itemActive ? "rgba(91,79,245,0.15)" : "transparent",
                          border: "none",
                          cursor: "pointer",
                          textAlign: "right",
                          fontFamily: "inherit",
                          transition: "background 0.15s",
                          borderRight: itemActive ? "3px solid #5B4FF5" : "3px solid transparent",
                        }}
                        onMouseEnter={e => {
                          if (!itemActive) (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.05)";
                        }}
                        onMouseLeave={e => {
                          if (!itemActive) (e.currentTarget as HTMLButtonElement).style.background = "transparent";
                        }}
                      >
                        <span style={{ fontSize: 16, lineHeight: 1.3 }}>{item.icon}</span>
                        <div style={{ flex: 1 }}>
                          <div style={{
                            fontSize: 13,
                            fontWeight: itemActive ? 700 : 500,
                            color: itemActive ? "#818CF8" : "var(--rapyd-text, #e2e8f0)",
                            marginBottom: 2,
                          }}>
                            {item.label}
                          </div>
                          {item.description && (
                            <div style={{ fontSize: 11, color: "var(--rapyd-text-muted, #94a3b8)", lineHeight: 1.3 }}>
                              {item.description}
                            </div>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      <div className="dashboard-top-actions">
        {rightSlot}
        <NotificationBell />
        <div className="dashboard-user-menu" ref={userRef}>
          <button
            type="button"
            className="dashboard-user-menu-toggle"
            onClick={() => setUserMenuOpen(o => !o)}
            aria-expanded={userMenuOpen}
            aria-haspopup="true"
            title={user?.name ?? "משתמש"}
          >
            {avatarUrl ? (
              <img src={avatarUrl} alt="" className="dashboard-avatar-img" />
            ) : (
              <span className="dashboard-avatar-initials">{getInitial(user?.name)}</span>
            )}
          </button>
          {userMenuOpen && (
            <div className="dashboard-user-dropdown">
              <button type="button" className="dashboard-user-dropdown-item" onClick={goToSettings}>
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
