import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import Loader from "./ui/Loader";
import { useAuth } from "../auth/AuthProvider";
import { APP_ROUTES } from "../types/navigation";

interface GuardProps {
  children: ReactNode;
}

export function RequireAuth({ children }: GuardProps) {
  const auth = useAuth();

  if (auth.status === "checking") {
    return (
      <div className="route-guard-loader" dir="rtl">
        <Loader />
      </div>
    );
  }

  if (auth.status !== "authenticated") {
    return <Navigate to={APP_ROUTES.login} replace />;
  }

  return <>{children}</>;
}

export function RequireGuest({ children }: GuardProps) {
  const auth = useAuth();

  if (auth.status === "checking") {
    return (
      <div className="route-guard-loader" dir="rtl">
        <Loader />
      </div>
    );
  }

  if (auth.status === "authenticated") {
    return <Navigate to={APP_ROUTES.dashboard} replace />;
  }

  return <>{children}</>;
}
