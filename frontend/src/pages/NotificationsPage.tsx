import { Bell, CheckCheck, Trash2 } from "lucide-react";
import PrivateTopbar from "../components/PrivateTopbar";
import AppFooter from "../components/AppFooter";
import Loader from "../components/ui/Loader";
import { useNotifications } from "../hooks/useNotifications";
import {
  deleteNotification,
  markAllNotificationsRead,
  markNotificationRead,
} from "../api/notifications.api";
import { formatLongDate } from "../utils/formatters";

export default function NotificationsPage() {
  const { items, isLoading, error, refresh } = useNotifications();

  const handleRead = async (id: string) => {
    await markNotificationRead(id);
    await refresh();
  };

  const handleReadAll = async () => {
    await markAllNotificationsRead();
    await refresh();
  };

  const handleDelete = async (id: string) => {
    await deleteNotification(id);
    await refresh();
  };

  return (
    <div className="dashboard-page" dir="rtl">
      <div className="dashboard-shell">
        <PrivateTopbar />

        <header className="feature-page-header">
          <div>
            <Bell size={28} aria-hidden />
            <h1>התראות</h1>
            <p>עדכונים על תלושים, תובנות והמלצות.</p>
          </div>
          <button type="button" className="dashboard-link-btn" onClick={() => void handleReadAll()}>
            <CheckCheck size={16} />
            סמן הכל כנקרא
          </button>
        </header>

        {isLoading ? <Loader /> : null}
        {error ? <div className="dashboard-inline-error">{error}</div> : null}

        {!isLoading && items.length === 0 ? (
          <section className="dashboard-card">
            <p>אין התראות כרגע.</p>
          </section>
        ) : null}

        <ul className="notifications-list">
          {items.map(n => (
            <li key={n._id} className={`notification-item ${n.read ? "" : "is-unread"}`}>
              <div>
                <strong>{n.title}</strong>
                {n.body ? <p>{n.body}</p> : null}
                <span className="dashboard-muted">{formatLongDate(n.createdAt)}</span>
              </div>
              <div className="notification-item-actions">
                {!n.read ? (
                  <button type="button" className="dashboard-link-btn" onClick={() => void handleRead(n._id)}>
                    נקרא
                  </button>
                ) : null}
                <button type="button" className="dashboard-link-btn" onClick={() => void handleDelete(n._id)}>
                  <Trash2 size={14} />
                </button>
              </div>
            </li>
          ))}
        </ul>

        <AppFooter variant="private" />
      </div>
    </div>
  );
}
