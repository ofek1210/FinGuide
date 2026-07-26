import { APP_ROUTES } from "../types/navigation";

export type InsightAgentKind = "payslip" | "pension" | "gemel" | "insurance";

/** Trim long insight copy to a readable headline or teaser. */
export function summarizeInsightText(text: string, maxLength = 100): string {
  const trimmed = text.trim().replace(/\s+/g, " ");
  if (!trimmed) return "";
  if (trimmed.length <= maxLength) return trimmed;

  const slice = trimmed.slice(0, maxLength);
  const lastSpace = slice.lastIndexOf(" ");
  const cut = lastSpace > maxLength * 0.45 ? slice.slice(0, lastSpace) : slice;
  return `${cut}…`;
}

/** First sentence — used as a one-line teaser under the title. */
export function insightTeaser(text: string, maxLength = 96): string {
  const trimmed = text.trim().replace(/\s+/g, " ");
  if (!trimmed) return "";

  const match = trimmed.match(/^[^.!?…]+[.!?…]?/);
  const first = (match?.[0] ?? trimmed).trim();
  return summarizeInsightText(first, maxLength);
}

export const AGENT_INSIGHT_CTA: Record<
  InsightAgentKind,
  { label: string; href: string }
> = {
  payslip: {
    label: "לפירוט נוסף פנה לסוכן התלושים",
    href: `${APP_ROUTES.hub}?chat=1`,
  },
  pension: {
    label: "לפירוט נוסף פנה לסוכן הפנסיוני",
    href: `${APP_ROUTES.hub}?chat=1`,
  },
  gemel: {
    label: "לפירוט נוסף פנה לסוכן הגמל וההשתלמות",
    href: `${APP_ROUTES.hub}?chat=1`,
  },
  insurance: {
    label: "לפירוט נוסף פנה לסוכן הביטוחים",
    href: `${APP_ROUTES.hub}?chat=1`,
  },
};
