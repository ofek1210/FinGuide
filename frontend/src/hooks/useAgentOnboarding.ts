import { useCallback, useEffect, useState } from "react";
import {
  completeAgentOnboarding,
  getAgentOnboardingState,
  skipAgentOnboarding,
  type AgentId,
  type SmartOnboardingStateDTO,
  type SmartQuestionDTO,
} from "../api/smartOnboarding.api";

export function useAgentOnboarding(agentId: AgentId) {
  const [state, setState] = useState<SmartOnboardingStateDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    const res = await getAgentOnboardingState(agentId);
    if (res.ok && res.data?.data) {
      setState(res.data.data);
      setShowModal(Boolean(res.data.data.shouldShowModal));
    }
    setLoading(false);
  }, [agentId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const skip = useCallback(async () => {
    const res = await skipAgentOnboarding(agentId);
    if (res.ok && res.data?.data) {
      setState(res.data.data);
      setShowModal(false);
      return true;
    }
    setShowModal(false);
    return false;
  }, [agentId]);

  const dismiss = () => {
    void skip();
  };

  const submit = async (answers: Record<string, unknown>) => {
    const res = await completeAgentOnboarding(agentId, answers);
    if (res.ok && res.data?.data) {
      setState(res.data.data);
      setShowModal(false);
      return true;
    }
    return false;
  };

  const needsQuestions = Boolean(
    !loading
    && state
    && !state.complete
    && !state.skipped
    && (state.missingQuestions?.length ?? 0) > 0,
  );

  return {
    state,
    loading,
    showModal,
    needsQuestions,
    dismiss,
    skip,
    submit,
    refresh,
  };
}

export type { SmartQuestionDTO };
