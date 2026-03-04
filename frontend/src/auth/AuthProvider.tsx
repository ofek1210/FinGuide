import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
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

const hasToken = () => Boolean(localStorage.getItem("token"));

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>("checking");
  const [user, setUser] = useState<AuthUser | null>(null);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    setError("");

    if (!hasToken()) {
      setUser(null);
      setStatus("guest");
      return;
    }

    setStatus("checking");
    const response = await getMe();

    if (response.success && response.data?.user) {
      setUser(response.data.user);
      setStatus("authenticated");
      return;
    }

    clearSession();
    setUser(null);
    setStatus("guest");
    setError(response.message || "פג תוקף ההתחברות. נא להתחבר מחדש.");
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

