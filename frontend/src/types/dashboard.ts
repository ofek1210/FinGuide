import type { LucideIcon } from "lucide-react";

export type DashboardMetric = {
  label: string;
  value: string;
  subtitle: string;
  icon: LucideIcon;
  accentClass?: string;
};
