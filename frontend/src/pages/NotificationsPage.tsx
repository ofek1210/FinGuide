import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, Check, Loader2, Trash2 } from "lucide-react";
import PrivateTopbar from "../components/PrivateTopbar";
import AppFooter from "../components/AppFooter";
import { useNotifications } from "../hooks/useNotifications";
import { deleteNotification, markAllNotificationsRead, markNotificationRead } from "../api/notifications.api";
import { NOTIF_META, relativeTime } from "../utils/notificationDisplay";

/**
 * NotificationsPage — design-system language: header with icon chip + filter
 * pills, themed notification cards (per-type icon, unread accent), and inline
 * actions. Wired to the real notifications API (read / read-all / delete).
 */
export default function NotificationsPage() {
  const navigate = useNavigate();
  const { items, unreadCount, isLoading, error, refresh } = useNotifications();
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const [busy, setBusy] = useState<string | null>(null);

  const shown = useMemo(() => (filter === "unread" ? items.filter(n => !n.read) : items), [items, filter]);

  const handleRead = async (id: string) => { setBusy(id); await markNotificationRead(id); await refresh(); setBusy(null); };
  const handleDelete = async (id: string) => { setBusy(id); await deleteNotification(id); await refresh(); setBusy(null); };
  const handleReadAll = async () => { setBusy("all"); await markAllNotificationsRead(); await refresh(); setBusy(null); };

  return (
    <div style={{ minHeight: "100vh", background: "var(--surface-page)", color: "var(--text-body)", fontFamily: "var(--font-body)", direction: "rtl" }}>
      <PrivateTopbar />
      <main style={{ maxWidth: 760, margin: "0 auto", padding: "40px 24px 84px" }}>
        {/* header */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, flexWrap: "wrap", marginBottom: 22 }}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
            <span style={{ width: 46, height: 46, borderRadius: 13, flex: "none", background: "var(--lav-100)", color: "var(--lav-600)", display: "grid", placeItems: "center" }}><Bell size={22} /></span>
            <div>
              <h1 style={{ margin: 0, fontSize: "clamp(24px,3vw,34px)", fontWeight: 900, letterSpacing: "-.03em", color: "var(--text-strong)" }}>התראות</h1>
              <p style={{ margin: "6px 0 0", fontSize: 15, color: "var(--text-muted)", fontWeight: 500 }}>
                עדכונים על תלושים, תובנות והמלצות{unreadCount > 0 ? ` · ${unreadCount} שלא נקראו` : ""}
              </p>
            </div>
          </div>
          {unreadCount > 0 && (
            <button type="button" onClick={() => void handleReadAll()} disabled={busy === "all"}
              style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "10px 18px", borderRadius: "var(--r-pill)", border: "1px solid var(--border-soft)", background: "var(--card)", color: "var(--ink)", cursor: "pointer", fontFamily: "inherit", fontWeight: 800, fontSize: 13.5, boxShadow: "var(--shadow-soft)" }}>
              {busy === "all" ? <Loader2 size={15} style={{ animation: "spin .8s linear infinite" }} /> : <Check size={15} />} סמן הכל כנקרא
            </button>
          )}
        </div>

        {/* filter pills */}
        <div style={{ display: "flex", gap: 8, marginBottom: 18 }}>
          {([["all", "הכל"], ["unread", "שלא נקראו"]] as const).map(([key, label]) => {
            const on = filter === key;
            return (
              <button key={key} onClick={() => setFilter(key)} style={{ padding: "7px 16px", borderRadius: "var(--r-pill)", border: `1px solid ${on ? "var(--lav-300)" : "var(--border-soft)"}`, background: on ? "var(--lav-100)" : "var(--card)", color: on ? "var(--lav-600)" : "var(--text-muted)", cursor: "pointer", fontFamily: "inherit", fontWeight: 800, fontSize: 13, transition: "all .15s var(--ease)" }}>
                {label}{key === "unread" && unreadCount > 0 ? ` (${unreadCount})` : ""}
              </button>
            );
          })}
        </div>

        {/* states */}
        {isLoading ? (
          <div style={{ display: "grid", placeItems: "center", padding: "60px 0", color: "var(--lav-600)" }}><Loader2 size={26} style={{ animation: "spin .8s linear infinite" }} /></div>
        ) : error ? (
          <div style={{ padding: "16px 18px", borderRadius: "var(--radius)", background: "rgba(214,69,69,.06)", border: "1px solid rgba(214,69,69,.22)", color: "var(--danger)", fontWeight: 700, fontSize: 14 }}>{error}</div>
        ) : shown.length === 0 ? (
          <div style={{ display: "grid", placeItems: "center", textAlign: "center", padding: "56px 24px", background: "var(--card)", border: "1px solid var(--border-hair)", borderRadius: "var(--radius)", boxShadow: "var(--shadow-soft)" }}>
            <div>
              <span style={{ width: 58, height: 58, borderRadius: 16, background: "var(--surface-sunken)", color: "var(--text-faint)", display: "grid", placeItems: "center", margin: "0 auto 16px" }}><Bell size={28} /></span>
              <div style={{ fontSize: 16, fontWeight: 800, color: "var(--text-muted)" }}>{filter === "unread" ? "אין התראות שלא נקראו" : "אין התראות כרגע"}</div>
              <div style={{ fontSize: 13, color: "var(--text-faint)", marginTop: 5 }}>נעדכן אותך כאן כשתהיה פעילות חדשה.</div>
            </div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {shown.map(n => {
              const m = NOTIF_META[n.type] ?? NOTIF_META.system;
              const Icon = m.Icon;
              const clickable = Boolean(n.link);
              return (
                <div key={n._id}
                  onClick={clickable ? () => { void handleRead(n._id); navigate(n.link as string); } : undefined}
                  style={{ position: "relative", display: "flex", alignItems: "flex-start", gap: 14, padding: "16px 18px", background: "var(--card)", border: `1px solid ${n.read ? "var(--border-hair)" : "var(--lav-200)"}`, borderRadius: "var(--radius)", boxShadow: "var(--shadow-soft)", cursor: clickable ? "pointer" : "default", overflow: "hidden", transition: "border-color .2s var(--ease)" }}>
                  {!n.read && <span style={{ position: "absolute", insetInlineStart: 0, top: 0, bottom: 0, width: 3, background: "var(--grad-brand)" }} />}
                  <span style={{ width: 40, height: 40, borderRadius: 11, flex: "none", background: m.bg, color: m.fg, display: "grid", placeItems: "center" }}><Icon size={19} /></span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                      {!n.read && <span style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--lav-600)", flex: "none" }} />}
                      <span style={{ fontSize: 14.5, fontWeight: 800, color: "var(--text-strong)" }}>{n.title}</span>
                    </div>
                    {n.body && <p style={{ margin: "5px 0 0", fontSize: 13.5, color: "var(--text-muted)", lineHeight: 1.55 }}>{n.body}</p>}
                    <div style={{ fontSize: 12, color: "var(--text-faint)", fontWeight: 600, marginTop: 7 }}>{relativeTime(n.createdAt)}</div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 4, flex: "none" }} onClick={e => e.stopPropagation()}>
                    {!n.read && (
                      <button type="button" onClick={() => void handleRead(n._id)} disabled={busy === n._id} aria-label="סמן כנקרא"
                        title="סמן כנקרא"
                        style={{ width: 32, height: 32, borderRadius: 9, border: "1px solid var(--border-soft)", background: "var(--card)", color: "var(--mint-ink)", cursor: "pointer", display: "grid", placeItems: "center" }}>
                        <Check size={15} />
                      </button>
                    )}
                    <button type="button" onClick={() => void handleDelete(n._id)} disabled={busy === n._id} aria-label="מחק התראה"
                      title="מחק"
                      style={{ width: 32, height: 32, borderRadius: 9, border: "1px solid var(--border-soft)", background: "var(--card)", color: "var(--text-faint)", cursor: "pointer", display: "grid", placeItems: "center" }}
                      onMouseEnter={e => { e.currentTarget.style.color = "var(--danger)"; e.currentTarget.style.borderColor = "rgba(214,69,69,.35)"; }}
                      onMouseLeave={e => { e.currentTarget.style.color = "var(--text-faint)"; e.currentTarget.style.borderColor = "var(--border-soft)"; }}>
                      {busy === n._id ? <Loader2 size={14} style={{ animation: "spin .8s linear infinite" }} /> : <Trash2 size={14} />}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
      <AppFooter variant="private" />
    </div>
  );
}
