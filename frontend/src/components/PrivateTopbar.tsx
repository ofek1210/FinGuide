import type { ReactNode } from "react";
import { useRef, useState, useEffect } from "react";
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

/* ── The 3 core assistants ───────────────────────────────────── */
const ASSISTANTS = [
  {
    icon: "📄",
    label: "תלושים ומסמכים",
    sub: "ניתוח שכר ומיסים",
    route: APP_ROUTES.documents,
    color: "#9B7FE8",
    bg: "#F3EEFF",
  },
  {
    icon: "🛡️",
    label: "ביטוחים",
    sub: "ניתוח פוליסות וכיסויים",
    route: APP_ROUTES.insurance,
    color: "#7B5EA7",
    bg: "#EDE8F9",
  },
  {
    icon: "📈",
    label: "עוזר פנסיוני",
    sub: "תחזית פרישה וצבירה",
    route: APP_ROUTES.pension,
    color: "#6B4FA0",
    bg: "#EAE3F7",
  },
];

function getInitial(name: string | undefined): string {
  if (!name?.trim()) return "?";
  return name.trim().charAt(0).toUpperCase();
}

export default function PrivateTopbar({ rightSlot }: PrivateTopbarProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const avatarUrl = getAvatarDisplayUrl(user ?? null);

  const [assistantOpen, setAssistantOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  const assistantRef = useRef<HTMLDivElement>(null);
  const userRef = useRef<HTMLDivElement>(null);

  /* ── Close on outside click ─────────────────────────────────── */
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (assistantRef.current && !assistantRef.current.contains(e.target as Node))
        setAssistantOpen(false);
      if (userRef.current && !userRef.current.contains(e.target as Node))
        setUserMenuOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  /* ── Close on route change ──────────────────────────────────── */
  useEffect(() => { setAssistantOpen(false); }, [location.pathname]);

  const activeAssistant = ASSISTANTS.find(a =>
    location.pathname === a.route || location.pathname.startsWith(a.route + "/")
  );

  const handleLogout = () => { setUserMenuOpen(false); logoutWithConfirm(navigate); };
  const goToSettings = () => { setUserMenuOpen(false); navigate(APP_ROUTES.settings); };

  return (
    <header
      dir="rtl"
      style={{
        position: "sticky", top: 0, zIndex: 100,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "0 28px",
        height: 64,
        background: "rgba(255,255,255,0.88)",
        backdropFilter: "blur(20px) saturate(180%)",
        WebkitBackdropFilter: "blur(20px) saturate(180%)",
        borderBottom: "1px solid rgba(184,157,255,0.20)",
        boxShadow: "0 1px 20px rgba(155,127,232,0.08)",
      }}
    >
      {/* Logo */}
      <div
        onClick={() => navigate(APP_ROUTES.documents)}
        style={{
          fontFamily: "'Fraunces', Georgia, serif",
          fontSize: 22, fontWeight: 700, letterSpacing: "-0.03em",
          background: "linear-gradient(135deg, #9B7FE8 0%, #6B4FA0 100%)",
          WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
          backgroundClip: "text",
          cursor: "pointer", userSelect: "none",
        }}
      >
        FinGuide
      </div>

      {/* Centre nav — single "העוזר הראשי" dropdown */}
      <nav style={{ display: "flex", alignItems: "center", gap: 8, position: "relative" }} ref={assistantRef}>
        {/* Active assistant pill (shown when inside a product) */}
        {activeAssistant && (
          <div style={{
            display: "flex", alignItems: "center", gap: 8,
            padding: "5px 12px 5px 10px",
            borderRadius: 20,
            background: `${activeAssistant.color}12`,
            border: `1px solid ${activeAssistant.color}28`,
            fontSize: 12, fontWeight: 700, color: activeAssistant.color,
          }}>
            <span>{activeAssistant.icon}</span>
            <span>{activeAssistant.label}</span>
          </div>
        )}

        {/* Main dropdown trigger */}
        <button
          type="button"
          onClick={() => setAssistantOpen(o => !o)}
          style={{
            display: "flex", alignItems: "center", gap: 7,
            padding: "9px 18px", borderRadius: 14,
            background: assistantOpen ? "rgba(155,127,232,0.12)" : "rgba(184,157,255,0.08)",
            border: `1px solid ${assistantOpen ? "rgba(184,157,255,0.45)" : "rgba(184,157,255,0.20)"}`,
            color: "#3D3553", fontFamily: "inherit",
            fontWeight: 700, fontSize: 14,
            cursor: "pointer",
            transition: "all 0.18s ease",
          }}
        >
          <span style={{ fontSize: 15 }}>🤖</span>
          העוזר הראשי
          <ChevronDown
            size={14}
            style={{
              transition: "transform 0.2s",
              transform: assistantOpen ? "rotate(180deg)" : "none",
              opacity: 0.6,
            }}
          />
        </button>

        {/* Dropdown panel */}
        {assistantOpen && (
          <div style={{
            position: "absolute",
            top: "calc(100% + 10px)",
            right: "50%",
            transform: "translateX(50%)",
            minWidth: 320,
            background: "rgba(255,255,255,0.97)",
            backdropFilter: "blur(24px) saturate(200%)",
            WebkitBackdropFilter: "blur(24px) saturate(200%)",
            border: "1px solid rgba(184,157,255,0.28)",
            borderRadius: 24,
            boxShadow: "0 16px 56px rgba(155,127,232,0.22), 0 4px 16px rgba(0,0,0,0.06)",
            padding: "10px",
            zIndex: 999,
          }}>
            {/* Header */}
            <div style={{ padding: "8px 14px 12px", borderBottom: "1px solid rgba(184,157,255,0.15)", marginBottom: 8 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#A89CC8", letterSpacing: "0.06em", textTransform: "uppercase" }}>
                בחר סוכן AI
              </div>
            </div>

            {ASSISTANTS.map(a => {
              const isActive = location.pathname.startsWith(a.route);
              return (
                <button
                  key={a.route}
                  type="button"
                  onClick={() => { setAssistantOpen(false); navigate(a.route); }}
                  style={{
                    width: "100%",
                    display: "flex", alignItems: "center", gap: 14,
                    padding: "12px 14px",
                    borderRadius: 16,
                    background: isActive ? `${a.color}10` : "transparent",
                    border: `1px solid ${isActive ? a.color + "28" : "transparent"}`,
                    cursor: "pointer", textAlign: "right",
                    fontFamily: "inherit", transition: "all 0.15s",
                    marginBottom: 4,
                  }}
                  onMouseEnter={e => {
                    if (!isActive) {
                      (e.currentTarget as HTMLButtonElement).style.background = a.bg;
                    }
                  }}
                  onMouseLeave={e => {
                    if (!isActive) {
                      (e.currentTarget as HTMLButtonElement).style.background = "transparent";
                    }
                  }}
                >
                  {/* Icon chip */}
                  <div style={{
                    width: 44, height: 44, borderRadius: 13, flexShrink: 0,
                    background: a.bg,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 20,
                    boxShadow: `0 2px 8px ${a.color}20`,
                  }}>
                    {a.icon}
                  </div>

                  {/* Label */}
                  <div style={{ flex: 1, textAlign: "right" }}>
                    <div style={{ fontWeight: 800, fontSize: 14, color: isActive ? a.color : "#1F1F1F", letterSpacing: "-0.01em" }}>
                      {a.label}
                    </div>
                    <div style={{ fontSize: 11.5, color: "#7C6FA0", marginTop: 2 }}>
                      {a.sub}
                    </div>
                  </div>

                  {/* Active indicator */}
                  {isActive && (
                    <div style={{
                      width: 8, height: 8, borderRadius: "50%",
                      background: a.color, flexShrink: 0,
                      boxShadow: `0 0 0 3px ${a.color}25`,
                    }} />
                  )}
                </button>
              );
            })}

            {/* Quick links footer */}
            <div style={{ borderTop: "1px solid rgba(184,157,255,0.15)", marginTop: 8, padding: "10px 14px 4px", display: "flex", gap: 8, flexWrap: "wrap" }}>
              {[
                { label: "ממצאים", route: APP_ROUTES.findings },
                { label: "מיסים", route: APP_ROUTES.taxAssistant },
                { label: "תובנות", route: APP_ROUTES.insights },
              ].map(link => (
                <button
                  key={link.route}
                  onClick={() => { setAssistantOpen(false); navigate(link.route); }}
                  style={{
                    padding: "5px 12px", borderRadius: 20,
                    background: "rgba(184,157,255,0.10)",
                    border: "1px solid rgba(184,157,255,0.22)",
                    color: "#7C6FA0", fontFamily: "inherit",
                    fontSize: 12, fontWeight: 600,
                    cursor: "pointer", transition: "all 0.15s",
                  }}
                  onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(155,127,232,0.14)"; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(184,157,255,0.10)"; }}
                >
                  {link.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </nav>

      {/* Right: notifications + user menu */}
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        {rightSlot}
        <NotificationBell />

        {/* User menu */}
        <div ref={userRef} style={{ position: "relative" }}>
          <button
            type="button"
            onClick={() => setUserMenuOpen(o => !o)}
            style={{
              width: 38, height: 38, borderRadius: "50%",
              background: "linear-gradient(135deg, #9B7FE8, #6B4FA0)",
              border: "none", cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
              color: "#fff", fontWeight: 700, fontSize: 15,
              boxShadow: "0 2px 10px rgba(155,127,232,0.35)",
              overflow: "hidden",
            }}
            title={user?.name ?? "משתמש"}
          >
            {avatarUrl ? (
              <img src={avatarUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            ) : (
              getInitial(user?.name)
            )}
          </button>

          {userMenuOpen && (
            <div style={{
              position: "absolute", top: "calc(100% + 8px)", left: 0,
              background: "rgba(255,255,255,0.97)",
              backdropFilter: "blur(20px)",
              border: "1px solid rgba(184,157,255,0.28)",
              borderRadius: 16,
              boxShadow: "0 12px 40px rgba(155,127,232,0.18)",
              overflow: "hidden", minWidth: 180, zIndex: 999,
            }}>
              <div style={{ padding: "14px 16px 12px", borderBottom: "1px solid rgba(184,157,255,0.12)" }}>
                <div style={{ fontWeight: 700, fontSize: 14, color: "#1F1F1F" }}>{user?.name ?? "משתמש"}</div>
                <div style={{ fontSize: 12, color: "#7C6FA0", marginTop: 2 }}>{user?.email ?? ""}</div>
              </div>
              <div style={{ padding: "6px" }}>
                <button
                  type="button"
                  onClick={goToSettings}
                  style={{ width: "100%", padding: "9px 12px", borderRadius: 10, background: "none", border: "none", cursor: "pointer", textAlign: "right", fontFamily: "inherit", fontSize: 13.5, color: "#3D3553", fontWeight: 500, transition: "background 0.15s" }}
                  onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(184,157,255,0.10)"; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "none"; }}
                >
                  הגדרות פרופיל
                </button>
                <button
                  type="button"
                  onClick={handleLogout}
                  style={{ width: "100%", padding: "9px 12px", borderRadius: 10, background: "none", border: "none", cursor: "pointer", textAlign: "right", fontFamily: "inherit", fontSize: 13.5, color: "#DC2626", fontWeight: 600, transition: "background 0.15s" }}
                  onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = "#FEF2F2"; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "none"; }}
                >
                  התנתקות
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
