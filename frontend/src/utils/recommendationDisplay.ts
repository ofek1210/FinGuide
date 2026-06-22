export const URGENCY_LABELS: Record<string, string> = {
  high: "דחוף",
  medium: "מומלץ",
  low: "לידיעה",
};

export type UrgencyLevel = "high" | "medium" | "low";

export function getUrgencyLabel(urgency?: string): string {
  return URGENCY_LABELS[urgency ?? ""] ?? "לידיעה";
}

export function urgencyToBadgeVariant(
  urgency?: string,
): "high" | "medium" | "low" | "neutral" {
  if (urgency === "high" || urgency === "medium" || urgency === "low") return urgency;
  return "neutral";
}

export function urgencyBadgeStyle(u: string): { bg: string; color: string; label: string } {
  const map: Record<string, { bg: string; color: string; label: string }> = {
    high: { bg: "rgba(239,68,68,0.15)", color: "#FCA5A5", label: URGENCY_LABELS.high },
    medium: { bg: "rgba(234,179,8,0.15)", color: "#FDE68A", label: URGENCY_LABELS.medium },
    low: { bg: "rgba(16,185,129,0.12)", color: "#6EE7B7", label: URGENCY_LABELS.low },
  };
  return map[u] ?? map.low;
}
