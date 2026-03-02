import { useAuth } from "../auth/AuthProvider";

/**
 * משתמש ב-AuthProvider בלבד – בלי קריאת getMe() נוספת.
 * מונע כפילות בקשות וחציית rate limit.
 */
export const useDashboardUser = () => {
  const { user, status, error } = useAuth();
  const isLoading = status === "checking";
  const name = user?.name ?? "היי";

  return {
    name,
    isLoading,
    error: error ?? "",
    reload: () => {}, // רענון מתבצע דרך AuthProvider.refresh() אם נדרש
  };
};
