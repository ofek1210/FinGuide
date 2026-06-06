import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import Loader from "./ui/Loader";
import { useAuth } from "../auth/AuthProvider";
import { APP_ROUTES } from "../types/navigation";
import { isWelcomeBackPending } from "../utils/welcomeBackSession";

interface GuardProps {
  children: ReactNode;
}

export function RequireAuth({ children }: GuardProps) {
  const auth = useAuth();
  const location = useLocation();

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

  const welcomeShown = auth.user?.welcomeShown;
  const isWelcomeRoute = location.pathname === APP_ROUTES.welcome;
  if (welcomeShown === false && !isWelcomeRoute) {
    return <Navigate to={APP_ROUTES.welcome} replace />;
  }

  const onboardingCompleted = auth.user?.onboardingCompleted;
  const isOnboardingRoute = location.pathname === APP_ROUTES.onboarding;
  if (onboardingCompleted === false && !isOnboardingRoute && !isWelcomeRoute) {
    return <Navigate to={APP_ROUTES.onboarding} replace />;
  }

  // Returning users only — never for the new-user welcome / onboarding flows
  // (those guards above run first and short-circuit before we get here).
  const isWelcomeBackRoute = location.pathname === APP_ROUTES.welcomeBack;
  if (isWelcomeBackPending() && !isWelcomeBackRoute) {
    return <Navigate to={APP_ROUTES.welcomeBack} replace />;
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
