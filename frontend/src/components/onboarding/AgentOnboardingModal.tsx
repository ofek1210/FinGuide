import AgentOnboardingFlow from "./AgentOnboardingFlow";
import type { SmartQuestionDTO } from "../../api/smartOnboarding.api";

type Props = {
  open: boolean;
  agentLabel: string;
  estimatedMinutes?: number;
  questions: SmartQuestionDTO[];
  onClose: () => void;
  onSubmit: (answers: Record<string, unknown>) => Promise<boolean>;
};

export default function AgentOnboardingModal({
  open,
  agentLabel,
  estimatedMinutes = 1,
  questions,
  onClose,
  onSubmit,
}: Props) {
  if (!open || !questions.length) return null;

  return (
    <AgentOnboardingFlow
      variant="modal"
      agentLabel={agentLabel}
      estimatedMinutes={estimatedMinutes}
      questions={questions}
      onSkip={onClose}
      onSubmit={onSubmit}
    />
  );
}
