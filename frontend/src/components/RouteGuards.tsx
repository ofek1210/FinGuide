import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { APP_ROUTES } from "../types/navigation";

interface GuardProps {
  children: ReactNode;
}

export function RequireAuth({ children }: GuardProps) {
  const token = localStorage.getItem("token");

  if (!token) {
    return <Navigate to={APP_ROUTES.login} replace />;
  }

  return <>{children}</>;
}

export function RequireGuest({ children }: GuardProps) {
  const token = localStorage.getItem("token");

  if (token) {
    return <Navigate to={APP_ROUTES.dashboard} replace />;
  }

  return <>{children}</>;
}
