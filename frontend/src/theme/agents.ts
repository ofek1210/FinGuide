import { FileText, PiggyBank, ShieldCheck, TrendingUp } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { APP_ROUTES } from "../types/navigation";

/* ============================================================
   AGENT WAYFINDING — single source of truth
   ------------------------------------------------------------
   FinGuide is organised around four AI agents. Each agent
   owns ONE accent colour so the user always knows which domain
   they're in:
     • payslips  → lavender (brand primary)
     • insurance → peach / orange
     • pension   → mint / green
     • gemel     → butter / gold

   Every domain page should:
     1. belong to an agent via its route (see `routes` below), and
     2. style its accent elements with the `--agent*` CSS tokens
        (defined in finguide.css). The Topbar sets `data-agent`
        on <html> automatically, so `var(--agent)` always
        resolves to the current agent's colour.
   ============================================================ */

export type AgentId = "payslips" | "insurance" | "pension" | "gemel";

export interface AgentTone {
  /** Primary accent (text / icon / line). */
  accent: string;
  /** Stronger accent for hover / emphasis. */
  strong: string;
  /** Soft tinted surface (icon tiles, pills). */
  soft: string;
  /** Hairline / ring colour. */
  ring: string;
  /** Faint page-level wash. */
  bg: string;
}

export interface AgentDef {
  id: AgentId;
  label: string;
  /** Short title shown on Hub agent cards */
  hubTitle: string;
  sub: string;
  Icon: LucideIcon;
  /** Landing route for the agent. */
  route: string;
  /** All routes that belong to this agent (used for wayfinding). */
  routes: string[];
  tone: AgentTone;
}

export const AGENTS: AgentDef[] = [
  {
    id: "payslips",
    label: "תלושים ומסמכים",
    hubTitle: "סוכן תלושי שכר",
    sub: "ניתוח שכר ומס",
    Icon: FileText,
    route: APP_ROUTES.documents,
    routes: [
      APP_ROUTES.documents,
      APP_ROUTES.payslipHistory,
      APP_ROUTES.taxAssistant,
      APP_ROUTES.documentsScan,
      APP_ROUTES.documentsScanComplete,
    ],
    tone: {
      accent: "var(--lav-600)",
      strong: "var(--lav-700)",
      soft: "var(--lav-100)",
      ring: "var(--lav-200)",
      bg: "var(--lav-50)",
    },
  },
  {
    id: "insurance",
    label: "ביטוחים",
    hubTitle: "סוכן ביטוחים ופוליסות",
    sub: "פוליסות וכיסויים",
    Icon: ShieldCheck,
    route: APP_ROUTES.insurance,
    routes: [APP_ROUTES.insurance],
    tone: {
      accent: "var(--peach-ink)",
      strong: "#C25A30",
      soft: "var(--peach-soft)",
      ring: "var(--peach)",
      bg: "#FFF8F4",
    },
  },
  {
    id: "pension",
    label: "עוזר פנסיוני",
    hubTitle: "סוכן פנסיוני",
    sub: "תחזית פרישה וצבירה",
    Icon: TrendingUp,
    route: APP_ROUTES.pension,
    routes: [APP_ROUTES.pension],
    tone: {
      accent: "var(--mint-ink)",
      strong: "#247A4C",
      soft: "var(--mint-soft)",
      ring: "var(--mint)",
      bg: "#F2FBF6",
    },
  },
  {
    id: "gemel",
    label: "קופות גמל והשתלמות",
    hubTitle: "סוכן קופות גמל והשתלמות",
    sub: "השוואת קופות ודמי ניהול",
    Icon: PiggyBank,
    route: APP_ROUTES.gemel,
    routes: [APP_ROUTES.gemel],
    tone: {
      accent: "var(--butter-ink)",
      strong: "#96700F",
      soft: "var(--butter-soft)",
      ring: "var(--butter)",
      bg: "#FFFCF2",
    },
  },
];

/** Resolve which agent a pathname belongs to (null = no specific agent). */
export function agentForPath(pathname: string): AgentDef | null {
  return (
    AGENTS.find((a) =>
      a.routes.some((r) => pathname === r || pathname.startsWith(r + "/"))
    ) ?? null
  );
}

export function agentById(id: AgentId): AgentDef {
  return AGENTS.find((a) => a.id === id) as AgentDef;
}
