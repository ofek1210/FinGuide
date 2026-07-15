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
  refresh: () => Promise<boolean>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

const hasToken = () => Boolean(localStorage.getItem("token"));

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>("checking");
  const [user, setUser] = useState<AuthUser | null>(null);
  const [error, setError] = useState("");

  const refresh = useCallback(async (): Promise<boolean> => {
    setError("");

    if (!hasToken()) {
      setUser(null);
      setStatus("guest");
      return false;
    }

    setStatus("checking");
    const response = await getMe();

    if (response.success && response.data?.user) {
      setUser(response.data.user);
      setStatus("authenticated");
      return true;
    }

    clearSession();
    setUser(null);
    setStatus("guest");
    setError(response.message || "פג תוקף ההתחברות. נא להתחבר מחדש.");
    return false;
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

/** Dev/preview shell — bypasses API auth for static UI inspection */
export function PreviewAuthProvider({
  children,
  user = {
    id: "preview-user",
    name: "Shahar",
    email: "preview@finguide.local",
    welcomeShown: false,
    onboardingCompleted: false,
  },
}: {
  children: ReactNode;
  user?: AuthUser;
}) {
  const value = useMemo<AuthContextValue>(
    () => ({
      status: "authenticated",
      user,
      error: "",
      refresh: async () => true,
    }),
    [user],
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

