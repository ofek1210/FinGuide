import { useNavigate } from "react-router-dom";
import { Bell, X } from "lucide-react";
import { useNotifications } from "../../hooks/useNotifications";
import { markNotificationRead, deleteNotification } from "../../api/notifications.api";
import { APP_ROUTES } from "../../types/navigation";

export default function NotificationBell() {
  const navigate = useNavigate();
  const { items, unreadCount, refresh } = useNotifications();
  const recent = items.slice(0, 5);

  const handleOpen = async (id: string, link: string | null) => {
    await markNotificationRead(id);
    void refresh();
    if (link) navigate(link);
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    await deleteNotification(id);
    void refresh();
  };

  return (
    <div className="notification-bell-wrap">
      <button
        type="button"
        className="notification-bell-btn"
        aria-label="התראות"
        onClick={() => navigate(APP_ROUTES.notifications)}
      >
        <Bell size={20} />
        {unreadCount > 0 ? <span className="notification-badge">{unreadCount}</span> : null}
      </button>

      {recent.length > 0 ? (
        <div className="notification-dropdown">
          {recent.map(n => (
            <div key={n._id} className={`notification-dropdown-item ${n.read ? "" : "is-unread"}`}>
              <button
                type="button"
                className="notification-dropdown-item-content"
                onClick={() => void handleOpen(n._id, n.link)}
              >
                <strong>{n.title}</strong>
                {n.body ? <span>{n.body}</span> : null}
              </button>
              <button
                type="button"
                className="notification-dropdown-delete"
                aria-label="מחק התראה"
                onClick={(e) => void handleDelete(e, n._id)}
              >
                <X size={12} />
              </button>
            </div>
          ))}
          <button
            type="button"
            className="notification-dropdown-footer"
            onClick={() => navigate(APP_ROUTES.notifications)}
          >
            ראה הכל
          </button>
        </div>
      ) : null}
    </div>
  );
}
