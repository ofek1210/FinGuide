import {
  Sparkles, Lightbulb, FileText, TrendingDown, AlertTriangle, Bell,
  type LucideIcon,
} from "lucide-react";
import type { NotificationType } from "../api/notifications.api";

/** Per-type icon + tone for notification rows (design-system tokens). */
export const NOTIF_META: Record<NotificationType, { Icon: LucideIcon; bg: string; fg: string }> = {
  insight_created: { Icon: Sparkles, bg: "var(--lav-100)", fg: "var(--lav-600)" },
  recommendation_new: { Icon: Lightbulb, bg: "var(--mint-soft)", fg: "var(--mint-ink)" },
  document_processed: { Icon: FileText, bg: "var(--lav-100)", fg: "var(--lav-600)" },
  salary_drop: { Icon: TrendingDown, bg: "var(--peach-soft)", fg: "var(--peach-ink)" },
  missing_payslip: { Icon: AlertTriangle, bg: "var(--butter-soft)", fg: "var(--butter-ink)" },
  system: { Icon: Bell, bg: "var(--surface-sunken)", fg: "var(--text-muted)" },
};

/** Short Hebrew relative time, e.g. "לפני 5 דק׳". Falls back to a date. */
export function relativeTime(iso: string): string {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "";
  const m = Math.round((Date.now() - t) / 60000);
  if (m < 1) return "הרגע";
  if (m < 60) return `לפני ${m} דק׳`;
  const h = Math.round(m / 60);
  if (h < 24) return `לפני ${h} שע׳`;
  const d = Math.round(h / 24);
  if (d < 7) return `לפני ${d} ימים`;
  return new Date(iso).toLocaleDateString("he-IL");
}
