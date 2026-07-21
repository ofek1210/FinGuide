import type { DocumentItem } from "../api/documents.api";
import type { SmartOnboardingStateDTO } from "../api/smartOnboarding.api";
import type { AgentId as SmartAgentId } from "../api/smartOnboarding.api";
import type { AgentId } from "../theme/agents";
import { APP_ROUTES } from "../types/navigation";

/** Canonical onboarding / analysis lifecycle per agent page. */
export type AgentReadinessPhase =
  | "document_missing"
  | "document_processing"
  | "document_ready_onboarding_incomplete"
  | "document_ready_onboarding_complete"
  | "analysis_ready";

export type DocumentInventoryStatus = "ok" | "missing" | "processing" | "partial";

export type DocumentInventoryItem = {
  id: string;
  label: string;
  status: DocumentInventoryStatus;
  detail: string;
  route: string;
};

export type AgentReadinessItem = {
  agentId: AgentId;
  phase: AgentReadinessPhase;
  label: string;
  detail: string;
  route: string;
};

export const THEME_TO_SMART: Record<AgentId, SmartAgentId> = {
  payslips: "payslip",
  insurance: "insurance",
  pension: "pension",
  gemel: "gemel",
};

const PHASE_LABEL: Record<AgentReadinessPhase, string> = {
  document_missing: "חסר מסמך",
  document_processing: "מעבד מסמך",
  document_ready_onboarding_incomplete: "נדרש אונבורדינג",
  document_ready_onboarding_complete: "מוכן לניתוח",
  analysis_ready: "מוכן",
};

export function phaseLabel(phase: AgentReadinessPhase): string {
  return PHASE_LABEL[phase];
}

export function isOnboardingComplete(state: SmartOnboardingStateDTO | null | undefined): boolean {
  if (!state) return false;
  return Boolean(state.complete || state.skipped);
}

export function needsAgentOnboarding(state: SmartOnboardingStateDTO | null | undefined): boolean {
  if (!state || state.complete || state.skipped) return false;
  return (state.missingQuestions?.length ?? 0) > 0;
}

type DocumentSignals = {
  completedPayslips: number;
  processingPayslips: number;
  pensionFundCount: number;
  insurancePolicyCount: number;
  gemelFundCount: number;
  hasPayslipGemelSignal: boolean;
  hasGemelAnalysis: boolean;
};

export function buildDocumentInventory(signals: DocumentSignals): DocumentInventoryItem[] {
  const items: DocumentInventoryItem[] = [
    {
      id: "pension_report",
      label: "דוח פנסיה / הר הכסף",
      status: signals.pensionFundCount > 0 ? "ok" : "missing",
      detail: signals.pensionFundCount > 0
        ? `${signals.pensionFundCount} קרנות במעקב`
        : "טרם יובא דוח",
      route: `${APP_ROUTES.pension}?flow=import`,
    },
    {
      id: "har_habituach",
      label: "דוח הר הביטוח",
      status: signals.insurancePolicyCount > 0 ? "ok" : "missing",
      detail: signals.insurancePolicyCount > 0
        ? `${signals.insurancePolicyCount} פוליסות במעקב`
        : "טרם יובא דוח",
      route: `${APP_ROUTES.insurance}?flow=import`,
    },
    {
      id: "payslips",
      label: "תלושי שכר",
      status: signals.processingPayslips > 0
        ? "processing"
        : signals.completedPayslips > 0
          ? "ok"
          : "missing",
      detail: signals.processingPayslips > 0
        ? `${signals.processingPayslips} תלושים בעיבוד`
        : signals.completedPayslips > 0
          ? `${signals.completedPayslips} תלושים נותחו`
          : "טרם הועלו תלושים",
      route: APP_ROUTES.documentsUpload,
    },
    {
      id: "gemel",
      label: "קופות גמל / Excel",
      status: signals.gemelFundCount > 0 || signals.hasGemelAnalysis
        ? "ok"
        : signals.hasPayslipGemelSignal
          ? "partial"
          : "missing",
      detail: signals.gemelFundCount > 0
        ? `${signals.gemelFundCount} קופות במעקב`
        : signals.hasPayslipGemelSignal
          ? "זוהו הפקדות מהתלוש — מומלץ להשלים דוח"
          : "טרם חוברו קופות",
      route: APP_ROUTES.gemel,
    },
  ];
  return items;
}

type AgentReadinessInput = {
  agentId: AgentId;
  onboarding: SmartOnboardingStateDTO | null;
  hasDocument: boolean;
  isProcessing?: boolean;
  hasAnalysis?: boolean;
  documentHint?: string;
};

export function computeAgentReadiness({
  agentId,
  onboarding,
  hasDocument,
  isProcessing = false,
  hasAnalysis = false,
  documentHint,
}: AgentReadinessInput): AgentReadinessItem {
  const route = agentId === "payslips" ? APP_ROUTES.documents : (
    agentId === "pension" ? APP_ROUTES.pension
      : agentId === "insurance" ? APP_ROUTES.insurance
        : APP_ROUTES.gemel
  );

  let phase: AgentReadinessPhase;
  let detail: string;

  if (!hasDocument) {
    phase = "document_missing";
    detail = documentHint ?? "העלו או ייבאו מסמך רלוונטי";
  } else if (isProcessing) {
    phase = "document_processing";
    detail = "המסמך בעיבוד";
  } else if (needsAgentOnboarding(onboarding)) {
    phase = "document_ready_onboarding_incomplete";
    detail = "השלימו שאלון מקצועי לפני המלצות";
  } else if (hasAnalysis) {
    phase = "analysis_ready";
    detail = "הניתוח זמין";
  } else if (isOnboardingComplete(onboarding)) {
    phase = "document_ready_onboarding_complete";
    detail = "מוכן להרצת ניתוח";
  } else {
    phase = "document_ready_onboarding_complete";
    detail = "מוכן להרצת ניתוח";
  }

  return {
    agentId,
    phase,
    label: phaseLabel(phase),
    detail,
    route,
  };
}

export function countProcessingDocuments(documents: DocumentItem[]): number {
  return documents.filter(d => d.status === "pending" || d.status === "processing").length;
}
