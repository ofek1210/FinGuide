import type { ReactNode } from "react";
import { useRef, useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ChevronDown, Sparkles } from "lucide-react";
import { useAuth } from "../auth/AuthProvider";
import { getAvatarDisplayUrl } from "../api/profile.api";
import NotificationBell from "./notifications/NotificationBell";
import { APP_ROUTES } from "../types/navigation";
import { logoutWithConfirm } from "../utils/logout";
import { AGENTS, agentForPath } from "../theme/agents";

interface PrivateTopbarProps {
  rightSlot?: ReactNode;
}

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

  useEffect(() => { setAssistantOpen(false); }, [location.pathname]);

  const activeAgent = agentForPath(location.pathname);

  // Wayfinding: tint the whole app to the current agent. Any element using
  // var(--agent*) re-resolves automatically. Cleared on non-agent pages.
  useEffect(() => {
    const root = document.documentElement;
    if (activeAgent) root.setAttribute("data-agent", activeAgent.id);
    else root.removeAttribute("data-agent");
    return () => root.removeAttribute("data-agent");
  }, [activeAgent]);

  const handleLogout = () => { setUserMenuOpen(false); logoutWithConfirm(navigate); };
  const goToSettings = () => { setUserMenuOpen(false); navigate(APP_ROUTES.settings); };
  const goToHelp = () => { setUserMenuOpen(false); navigate(APP_ROUTES.help); };

  return (
    <header
      dir="rtl"
      style={{
        position: "sticky", top: 0, zIndex: 100,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "0 var(--gutter)",
        height: 62,
        background: "rgba(251,251,252,.92)",
        backdropFilter: "blur(var(--blur-glass)) saturate(180%)",
        WebkitBackdropFilter: "blur(var(--blur-glass)) saturate(180%)",
        borderBottom: "1px solid var(--border-soft)",
        boxShadow: "0 1px 0 var(--border-hair)",
      }}
    >
      {/* Logo */}
      <div
        onClick={() => navigate(APP_ROUTES.hub)}
        style={{
          fontFamily: "var(--font-display)",
          fontSize: 21, fontWeight: 900, letterSpacing: "-0.04em",
          background: "var(--grad-brand)",
          WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
          backgroundClip: "text",
          cursor: "pointer", userSelect: "none",
        }}
      >
        FinGuide
      </div>

      {/* Centre — assistant dropdown */}
      <nav style={{ display: "flex", alignItems: "center", gap: 8, position: "relative" }} ref={assistantRef}>
        {activeAgent && (
          <div style={{
            display: "flex", alignItems: "center", gap: 7,
            padding: "5px 13px 5px 11px",
            borderRadius: "var(--r-pill)",
            background: "var(--agent-soft)",
            border: "1px solid var(--agent-ring)",
            fontSize: 12, fontWeight: 700, color: "var(--agent)",
          }}>
            <activeAgent.Icon size={14} strokeWidth={2} />
            <span>{activeAgent.label}</span>
          </div>
        )}

        <button
          type="button"
          onClick={() => setAssistantOpen(o => !o)}
          style={{
            display: "flex", alignItems: "center", gap: 7,
            padding: "8px 16px", borderRadius: "var(--r-btn)",
            background: assistantOpen ? "var(--agent-soft)" : "var(--surface-card)",
            border: `1px solid ${assistantOpen ? "var(--agent-ring)" : "var(--border-soft)"}`,
            color: "var(--agent)", fontFamily: "inherit",
            fontWeight: 700, fontSize: 13.5,
            cursor: "pointer",
            transition: "all var(--dur-fast) var(--ease)",
          }}
        >
          <Sparkles size={14} strokeWidth={2} />
          העוזר הראשי
          <ChevronDown
            size={13}
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
            minWidth: 310,
            background: "var(--surface-card)",
            backdropFilter: "blur(24px) saturate(200%)",
            WebkitBackdropFilter: "blur(24px) saturate(200%)",
            border: "1px solid var(--border-soft)",
            borderRadius: 20,
            boxShadow: "var(--shadow-card)",
            padding: 10,
            zIndex: 999,
          }}>
            <div style={{ padding: "8px 14px 12px", borderBottom: "1px solid var(--border-hair)", marginBottom: 8 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-faint)", letterSpacing: "0.08em", textTransform: "uppercase" }}>
                בחר סוכן AI
              </div>
            </div>

            {AGENTS.map(a => {
              const isActive = a.routes.some(r => location.pathname === r || location.pathname.startsWith(r + "/"));
              const Icon = a.Icon;
              return (
                <button
                  key={a.route}
                  type="button"
                  onClick={() => { setAssistantOpen(false); navigate(a.route); }}
                  style={{
                    width: "100%",
                    display: "flex", alignItems: "center", gap: 13,
                    padding: "11px 14px",
                    borderRadius: 14,
                    background: isActive ? a.tone.soft : "transparent",
                    border: `1px solid ${isActive ? a.tone.ring : "transparent"}`,
                    cursor: "pointer", textAlign: "right",
                    fontFamily: "inherit", transition: "background var(--dur-fast) var(--ease)",
                    marginBottom: 3,
                  }}
                  onMouseEnter={e => {
                    if (!isActive) (e.currentTarget as HTMLElement).style.background = a.tone.soft;
                  }}
                  onMouseLeave={e => {
                    if (!isActive) (e.currentTarget as HTMLElement).style.background = "transparent";
                  }}
                >
                  <div style={{
                    width: 42, height: 42, borderRadius: 12, flexShrink: 0,
                    background: a.tone.soft,
                    display: "grid", placeItems: "center",
                    border: `1px solid ${a.tone.ring}`,
                  }}>
                    <Icon size={20} strokeWidth={1.75} color={a.tone.accent} />
                  </div>
                  <div style={{ flex: 1, textAlign: "right" }}>
                    <div style={{ fontWeight: 800, fontSize: 13.5, color: isActive ? a.tone.accent : "var(--text-strong)", letterSpacing: "-0.01em" }}>
                      {a.label}
                    </div>
                    <div style={{ fontSize: 11.5, color: "var(--text-muted)", marginTop: 2 }}>
                      {a.sub}
                    </div>
                  </div>
                  {isActive && (
                    <div style={{
                      width: 7, height: 7, borderRadius: "50%",
                      background: a.tone.accent, flexShrink: 0,
                    }} />
                  )}
                </button>
              );
            })}
          </div>
        )}
      </nav>

      {/* Right: notifications + user menu */}
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        {rightSlot}
        <NotificationBell />

        <div ref={userRef} style={{ position: "relative" }}>
          <button
            type="button"
            onClick={() => setUserMenuOpen(o => !o)}
            style={{
              width: 36, height: 36, borderRadius: "50%",
              background: "var(--grad-brand)",
              border: "none", cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
              color: "#fff", fontWeight: 700, fontSize: 14,
              boxShadow: "var(--shadow-lav)",
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
              background: "var(--surface-card)",
              backdropFilter: "blur(20px)",
              border: "1px solid var(--border-soft)",
              borderRadius: 14,
              boxShadow: "var(--shadow-card)",
              overflow: "hidden", minWidth: 180, zIndex: 999,
            }}>
              <div style={{ padding: "13px 16px 11px", borderBottom: "1px solid var(--border-hair)" }}>
                <div style={{ fontWeight: 700, fontSize: 13.5, color: "var(--text-strong)" }}>{user?.name ?? "משתמש"}</div>
                <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>{user?.email ?? ""}</div>
              </div>
              <div style={{ padding: "6px" }}>
                <button
                  type="button"
                  onClick={goToSettings}
                  style={{ width: "100%", padding: "9px 12px", borderRadius: 10, background: "none", border: "none", cursor: "pointer", textAlign: "right", fontFamily: "inherit", fontSize: 13.5, color: "var(--text-body)", fontWeight: 500, transition: "background var(--dur-fast) var(--ease)" }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "var(--accent-soft)"; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "none"; }}
                >
                  הגדרות פרופיל
                </button>
                <button
                  type="button"
                  onClick={goToHelp}
                  style={{ width: "100%", padding: "9px 12px", borderRadius: 10, background: "none", border: "none", cursor: "pointer", textAlign: "right", fontFamily: "inherit", fontSize: 13.5, color: "var(--text-body)", fontWeight: 500, transition: "background var(--dur-fast) var(--ease)" }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "var(--accent-soft)"; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "none"; }}
                >
                  עזרה ותמיכה
                </button>
                <button
                  type="button"
                  onClick={handleLogout}
                  style={{ width: "100%", padding: "9px 12px", borderRadius: 10, background: "none", border: "none", cursor: "pointer", textAlign: "right", fontFamily: "inherit", fontSize: 13.5, color: "var(--danger)", fontWeight: 600, transition: "background var(--dur-fast) var(--ease)" }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "#FEF2F2"; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "none"; }}
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
