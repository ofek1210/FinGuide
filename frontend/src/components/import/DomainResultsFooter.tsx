import { DomainInsightsSection } from "./DomainInsightsSection";
import { DomainCopilotCTA } from "./DomainCopilotCTA";
import type { AppRoute } from "../../types/navigation";

type DomainResultsFooterProps = {
  agent: "pension" | "insurance";
  insightsTrigger: number;
  insightsTitle: string;
  insightsSubtitle: string;
  copilot: {
    title: string;
    description: string;
    buttonLabel: string;
    gradientFrom: string;
    gradientTo: string;
  };
  disclaimer: string;
  onNavigate: (route: AppRoute) => void;
};

export function DomainResultsFooter({
  agent,
  insightsTrigger,
  insightsTitle,
  insightsSubtitle,
  copilot,
  disclaimer,
  onNavigate,
}: DomainResultsFooterProps) {
  return (
    <>
      <DomainInsightsSection
        title={insightsTitle}
        subtitle={insightsSubtitle}
        agent={agent}
        trigger={insightsTrigger}
      />

      <DomainCopilotCTA
        title={copilot.title}
        description={copilot.description}
        buttonLabel={copilot.buttonLabel}
        gradientFrom={copilot.gradientFrom}
        gradientTo={copilot.gradientTo}
        onNavigate={onNavigate}
      />

      <p style={{ fontSize: 11.5, color: "#A89CC8", textAlign: "center", margin: "24px 0 0", lineHeight: 1.6 }}>
        {disclaimer}
      </p>
    </>
  );
}
