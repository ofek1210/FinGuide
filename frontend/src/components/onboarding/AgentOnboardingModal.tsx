/**
 * @deprecated Use AgentOnboardingStep for full-page in-flow onboarding.
 * Kept for backwards compatibility — delegates to inline step layout.
 */
import AgentOnboardingStep from "./AgentOnboardingStep";
import type { SmartQuestionDTO } from "../../api/smartOnboarding.api";
import type { AgentId } from "../../api/smartOnboarding.api";

type Props = {
  open: boolean;
  agentId?: AgentId;
  agentLabel: string;
  estimatedMinutes?: number;
  questions: SmartQuestionDTO[];
  onClose: () => void;
  onSubmit: (answers: Record<string, unknown>) => Promise<boolean>;
};

export default function AgentOnboardingModal({
  open,
  agentId = "pension",
  agentLabel,
  estimatedMinutes = 1,
  questions,
  onClose,
  onSubmit,
}: Props) {
  if (!open || !questions.length) return null;

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 200, background: "var(--surface-page)", overflowY: "auto" }}>
      <AgentOnboardingStep
        agentId={agentId}
        agentLabel={agentLabel}
        estimatedMinutes={estimatedMinutes}
        questions={questions}
        onSkip={onClose}
        onSubmit={onSubmit}
      />
    </div>
  );
}
