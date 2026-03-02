import { useCallback, useEffect, useState } from "react";
import { getMe } from "../api/auth.api";

type DashboardUserState = {
  name: string;
  isLoading: boolean;
  error: string;
};

const DEFAULT_STATE: DashboardUserState = {
  name: "היי",
  isLoading: true,
  error: "",
};

export const useDashboardUser = () => {
  const [state, setState] = useState<DashboardUserState>(DEFAULT_STATE);

  const loadUser = useCallback(async () => {
    setState((prev) => ({ ...prev, isLoading: true }));
    const response = await getMe();
    if (response.success && response.data?.user) {
      setState({ name: response.data.user.name, isLoading: false, error: "" });
      return;
    }

    setState((prev) => ({
      ...prev,
      isLoading: false,
      error: response.message || "לא הצלחנו לטעון את המשתמש.",
    }));
  }, []);

  useEffect(() => {
    void loadUser();
  }, [loadUser]);

  return {
    ...state,
    reload: loadUser,
  };
};
