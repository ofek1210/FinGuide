import type { NavigateFunction } from "react-router-dom";
import { APP_ROUTES } from "../types/navigation";
import { emitAuthChanged } from "../auth/authEvents";

const LOGOUT_CONFIRM_MESSAGE = "האם להתנתק מהחשבון?";

export const clearSession = () => {
  localStorage.removeItem("token");
  localStorage.removeItem("auth_user");
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
