import { useNavigate } from "react-router-dom";
import { Bell } from "lucide-react";
import { useNotifications } from "../../hooks/useNotifications";
import { markNotificationRead } from "../../api/notifications.api";
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
            <button
              key={n._id}
              type="button"
              className={`notification-dropdown-item ${n.read ? "" : "is-unread"}`}
              onClick={() => void handleOpen(n._id, n.link)}
            >
              <strong>{n.title}</strong>
              {n.body ? <span>{n.body}</span> : null}
            </button>
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
