import type { AgentId as SmartAgentId } from "../../api/smartOnboarding.api";

export type OnboardingTheme = {
  accent: string;
  soft: string;
  ring: string;
  label: string;
  emoji: string;
};

/** Map smart-onboarding agent id → visual theme (aligned with theme/agents). */
export function getAgentOnboardingTheme(agentId: SmartAgentId): OnboardingTheme {
  switch (agentId) {
    case "payslip":
      return { accent: "var(--lav-600)", soft: "var(--lav-100)", ring: "var(--lav-300)", label: "תלושי שכר", emoji: "📄" };
    case "insurance":
      return { accent: "var(--peach-ink)", soft: "var(--peach-soft)", ring: "rgba(218,111,68,.35)", label: "ביטוח", emoji: "🛡️" };
    case "pension":
      return { accent: "var(--mint-ink)", soft: "var(--mint-soft)", ring: "var(--mint)", label: "פנסיה", emoji: "🌿" };
    case "gemel":
      return { accent: "var(--butter-ink)", soft: "var(--butter-soft)", ring: "rgba(185,139,22,.35)", label: "גמל והשתלמות", emoji: "✨" };
    default:
      return { accent: "var(--lav-600)", soft: "var(--lav-100)", ring: "var(--lav-300)", label: "סוכן", emoji: "✦" };
  }
}
