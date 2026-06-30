import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, Check, X } from "lucide-react";
import { useNotifications } from "../../hooks/useNotifications";
import { markNotificationRead, markAllNotificationsRead, deleteNotification } from "../../api/notifications.api";
import { APP_ROUTES } from "../../types/navigation";
import { NOTIF_META, relativeTime } from "../../utils/notificationDisplay";

/**
 * Notification bell — design-system style: a clean circular icon button with a
 * brand unread badge and a click-to-open dropdown (header + recent list + footer).
 * Click-outside / Escape close it; no hover popover (fixes the stuck overlay).
 */
export default function NotificationBell() {
  const navigate = useNavigate();
  const { items, unreadCount, refresh } = useNotifications();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const recent = items.slice(0, 6);

  useEffect(() => {
    if (!document.getElementById("nb-anim")) {
      const st = document.createElement("style");
      st.id = "nb-anim";
      st.textContent = "@keyframes nbFade{from{opacity:0;transform:translateY(-6px)}to{opacity:1;transform:none}}";
      document.head.appendChild(st);
    }
    const onClick = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onClick); document.removeEventListener("keydown", onKey); };
  }, []);

  const openItem = async (id: string, link: string | null) => {
    setOpen(false);
    await markNotificationRead(id);
    void refresh();
    if (link) navigate(link);
  };
  const del = async (e: React.MouseEvent, id: string) => { e.stopPropagation(); await deleteNotification(id); void refresh(); };
  const readAll = async () => { await markAllNotificationsRead(); void refresh(); };

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        type="button"
        aria-label="התראות"
        onClick={() => setOpen(o => !o)}
        style={{ position: "relative", width: 40, height: 40, borderRadius: "50%", display: "grid", placeItems: "center", background: open ? "var(--lav-100)" : "var(--card)", border: `1px solid ${open ? "var(--lav-300)" : "var(--border-soft)"}`, color: "var(--text-body)", cursor: "pointer", transition: "all .18s var(--ease)" }}
      >
        <Bell size={19} />
        {unreadCount > 0 && (
          <span style={{ position: "absolute", top: -2, insetInlineEnd: -2, minWidth: 18, height: 18, padding: "0 5px", borderRadius: 999, background: "var(--grad-brand)", color: "#fff", fontSize: 10.5, fontWeight: 800, display: "grid", placeItems: "center", border: "2px solid var(--surface-page)", boxShadow: "var(--shadow-lav)" }}>{unreadCount > 9 ? "9+" : unreadCount}</span>
        )}
      </button>

      {open && (
        <div style={{ position: "absolute", top: "calc(100% + 10px)", insetInlineEnd: 0, width: 360, maxWidth: "calc(100vw - 32px)", background: "var(--surface-card)", backdropFilter: "blur(24px) saturate(180%)", WebkitBackdropFilter: "blur(24px) saturate(180%)", border: "1px solid var(--border-soft)", borderRadius: 18, boxShadow: "var(--shadow-card)", zIndex: 999, overflow: "hidden", direction: "rtl", animation: "nbFade .18s var(--ease) both" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px", borderBottom: "1px solid var(--border-hair)" }}>
            <div style={{ fontSize: 14, fontWeight: 900, color: "var(--text-strong)", display: "flex", alignItems: "center", gap: 7 }}>
              התראות
              {unreadCount > 0 && <span style={{ fontSize: 11, fontWeight: 800, color: "var(--lav-600)", background: "var(--lav-100)", borderRadius: 999, padding: "2px 8px" }}>{unreadCount} חדשות</span>}
            </div>
            {unreadCount > 0 && (
              <button type="button" onClick={readAll} style={{ display: "inline-flex", alignItems: "center", gap: 5, background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", fontSize: 12, fontWeight: 700, color: "var(--text-muted)" }}>
                <Check size={13} /> סמן הכל
              </button>
            )}
          </div>

          {recent.length === 0 ? (
            <div style={{ padding: "34px 16px", textAlign: "center", color: "var(--text-faint)", fontSize: 13, fontWeight: 600 }}>אין התראות חדשות</div>
          ) : (
            <div style={{ maxHeight: 380, overflowY: "auto" }}>
              {recent.map(n => {
                const m = NOTIF_META[n.type] ?? NOTIF_META.system;
                const Icon = m.Icon;
                return (
                  <div key={n._id} onClick={() => void openItem(n._id, n.link)}
                    style={{ display: "flex", gap: 11, padding: "12px 14px", cursor: "pointer", borderBottom: "1px solid var(--border-hair)", background: n.read ? "transparent" : "var(--lav-50)", transition: "background .15s" }}
                    onMouseEnter={e => { e.currentTarget.style.background = n.read ? "var(--surface-sunken)" : "var(--lav-100)"; }}
                    onMouseLeave={e => { e.currentTarget.style.background = n.read ? "transparent" : "var(--lav-50)"; }}>
                    <span style={{ width: 34, height: 34, borderRadius: 10, flex: "none", background: m.bg, color: m.fg, display: "grid", placeItems: "center" }}><Icon size={17} /></span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 800, color: "var(--ink)", display: "flex", alignItems: "center", gap: 6 }}>
                        {!n.read && <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--lav-600)", flex: "none" }} />}{n.title}
                      </div>
                      {n.body && <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2, lineHeight: 1.45, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>{n.body}</div>}
                      <div style={{ fontSize: 11, color: "var(--text-faint)", fontWeight: 600, marginTop: 3 }}>{relativeTime(n.createdAt)}</div>
                    </div>
                    <button type="button" onClick={e => void del(e, n._id)} aria-label="מחק התראה" style={{ width: 24, height: 24, borderRadius: 7, border: "none", background: "transparent", color: "var(--text-faint)", cursor: "pointer", display: "grid", placeItems: "center", flex: "none" }}
                      onMouseEnter={e => { e.currentTarget.style.background = "var(--surface-sunken)"; e.currentTarget.style.color = "var(--danger)"; }}
                      onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--text-faint)"; }}>
                      <X size={13} />
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          <button type="button" onClick={() => { setOpen(false); navigate(APP_ROUTES.notifications); }} style={{ width: "100%", padding: "12px", background: "var(--surface-sunken)", border: "none", borderTop: "1px solid var(--border-hair)", cursor: "pointer", fontFamily: "inherit", fontSize: 13, fontWeight: 800, color: "var(--lav-600)" }}>
            ראה את כל ההתראות
          </button>
        </div>
      )}
    </div>
  );
}
