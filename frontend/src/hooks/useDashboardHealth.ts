import { useCallback, useEffect, useState } from "react";
import { getHealth } from "../api/health.api";

export type HealthStatus = "online" | "offline" | "checking";

export const useDashboardHealth = () => {
  const [status, setStatus] = useState<HealthStatus>("checking");

  const loadHealth = useCallback(async () => {
    const response = await getHealth();
    setStatus(response.success ? "online" : "offline");
  }, []);

  useEffect(() => {
    void loadHealth();
  }, [loadHealth]);

  return {
    status,
    reload: loadHealth,
  };
};
