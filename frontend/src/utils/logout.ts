import type { NavigateFunction } from "react-router-dom";
import { APP_ROUTES } from "../types/navigation";
import { emitAuthChanged } from "../auth/authEvents";
import { logout } from "../api/auth.api";

const LOGOUT_CONFIRM_MESSAGE = "האם להתנתק מהחשבון?";

export const clearSession = ({ notify = true }: { notify?: boolean } = {}) => {
  localStorage.removeItem("token");
  localStorage.removeItem("auth_user");
  if (notify) {
    emitAuthChanged();
  }
};

export const logoutWithConfirm = async (navigate: NavigateFunction) => {
  const shouldLogout = window.confirm(LOGOUT_CONFIRM_MESSAGE);
  if (!shouldLogout) {
    return false;
  }

  await logout().catch(() => ({ success: false }));
  clearSession();
  navigate(APP_ROUTES.login, { replace: true });
  return true;
};
