import type { NavigateFunction } from "react-router-dom";
import { APP_ROUTES } from "../types/navigation";
import { emitAuthChanged } from "../auth/authEvents";

const LOGOUT_CONFIRM_MESSAGE = "האם להתנתק מהחשבון?";

export const clearSession = () => {
  localStorage.removeItem("token");
  localStorage.removeItem("auth_user");
  // שיחות ה-Hub נשמרות פר-משתמש — מוחקים את כולן ביציאה כדי שלא
  // יישארו נתונים פיננסיים בדפדפן משותף
  try {
    Object.keys(localStorage)
      .filter(key => key.startsWith("fg_hub_agent_chat"))
      .forEach(key => localStorage.removeItem(key));
  } catch { /* non-fatal */ }
  emitAuthChanged();
};

export const logoutWithConfirm = (navigate: NavigateFunction) => {
  const shouldLogout = window.confirm(LOGOUT_CONFIRM_MESSAGE);
  if (!shouldLogout) {
    return false;
  }

  clearSession();
  navigate(APP_ROUTES.login, { replace: true });
  return true;
};
