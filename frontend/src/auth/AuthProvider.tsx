import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { getMe, type AuthUser } from "../api/auth.api";
import { onAuthChanged } from "./authEvents";
import { clearSession } from "../utils/logout";

type AuthStatus = "checking" | "authenticated" | "guest";

type AuthContextValue = {
  status: AuthStatus;
  user: AuthUser | null;
  error: string;
  refresh: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>("checking");
  const [user, setUser] = useState<AuthUser | null>(null);
  const [error, setError] = useState("");
  const refreshInFlightRef = useRef(false);

  const refresh = useCallback(async () => {
    if (refreshInFlightRef.current) {
      return;
    }

    refreshInFlightRef.current = true;
    setError("");
    try {
      setStatus("checking");
      const response = await getMe();

      if (response.success && response.data?.user) {
        setUser(response.data.user);
        setStatus("authenticated");
        return;
      }

      clearSession({ notify: false });
      setUser(null);
      setStatus("guest");
      setError(response.message || "פג תוקף ההתחברות. נא להתחבר מחדש.");
    } finally {
      refreshInFlightRef.current = false;
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => onAuthChanged(() => void refresh()), [refresh]);

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      user,
      error,
      refresh,
    }),
    [error, refresh, status, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
};
