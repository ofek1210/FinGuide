export const HEALTH_STATUS_ICON: Record<string, string> = {
  good: "✓",
  warning: "⚠",
  poor: "✗",
};

export type HealthCategory = {
  id: string;
  label: string;
  score: number;
  maxScore?: number;
  status: string;
  detail?: string;
};

export type HealthCheckData = {
  score: number;
  level: { label: string; code?: string };
  categories: HealthCategory[];
};
