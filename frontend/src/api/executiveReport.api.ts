import { apiBlob, apiJson } from "./client";

export type MonetaryImpact = {
  hasImpact: boolean;
  summary: string | null;
  annualAmount?: number | null;
  assumptions: string[];
  disclaimer: string | null;
};

export type DecisionCard = {
  id: string;
  title: string;
  sourceAgents: string[];
  sourceReports: string[];
  originalRecommendationIds: string[];
  dataDate: string | null;
  confidence: number | null;
  classification: string;
  currentState: string;
  finding: string;
  whyItMatters: string;
  monetaryImpact: MonetaryImpact;
  recommendedAction: string;
  steps: string[];
  questionsForProvider: string[];
  immaterialReason?: string | null;
  conflictNote?: string | null;
  evidenceDeadline?: string | null;
};

export type ActionPlanItem = {
  title: string;
  explanation: string;
  whoToContact: string;
  whatToRequest: string;
  whatToCompare: string;
  documentToAttach: string | null;
  returnToFinGuide: string | null;
  sourceAgents: string[];
};

export type ManagementFeeProduct = {
  product: string;
  productType: string;
  balance: number | null;
  currentFee: number | null;
  comparisonValue: number | null;
  estimatedAnnualExcess: number | null;
  conclusion: string | null;
  sourceAgent: string;
  material: boolean;
};

export type ClassifiedRecommendation = {
  id: string;
  title: string;
  explanation: string;
  classification: "mainDecision" | "additionalFinding" | "monitoringItem" | "missingData" | "notMaterial";
  decisionBucket: string;
  sourceAgents: string[];
  sourceReports: string[];
  originalRecommendationIds: string[];
  dataDate: string | null;
  confidence: number | null;
  possibleSavings: number | null;
  immaterialReason: string | null;
  monetaryImpact: MonetaryImpact;
};

export type PersonalOverview = {
  analyzedDomains: string[];
  availableReports: string[];
  completedAgents: string[];
  findingCount: number;
  materialOpportunityCount: number;
  missingSources: { agentId: string; label: string; message: string }[];
  missingDataCount: number;
  healthScore?: {
    score: number;
    label: string | null;
    howCalculated: string;
    categories: { name: string; score: number; maxScore: number; messages: string[] }[];
    missingData: string[];
    pointsLost: string[];
    confidence: string;
    disclaimer: string | null;
  };
};

export type ExecutiveReportSection = {
  executiveSummary: string;
  personalOverview: PersonalOverview;
  currentPosition: { items: { label: string; value: number; formatted: string; sourceAgent: string }[]; disclaimer: string };
  mainDecisions: DecisionCard[];
  managementFees: {
    products: ManagementFeeProduct[];
    totalEstimatedAnnualExcess: number | null;
    largestExcessProduct: string | null;
    worthNegotiating: string[];
    immaterialProducts: { product: string; reason: string }[];
    disclaimer: string;
  };
  insuranceSummary: {
    pensionEmbedded: { title: string; detail: string }[];
    privatePolicies: { title: string; detail: string }[];
    crossDomainNotes: string[];
    sources: string[];
  };
  payslipFindings: { hasData: boolean; findings: { title: string; explanation: string; severity?: string }[] };
  productAlternatives: {
    productOrTrack: string;
    managementFees: number | null;
    riskLevel: string | null;
    comparisonPerformance: number | null;
    fitNotes: string | null;
    tradeoffs: string;
    sourceAgent: string;
    verificationRequired: string[];
  }[];
  actionPlan: {
    doNow: ActionPlanItem[];
    beforeChange: ActionPlanItem[];
    checkLater: ActionPlanItem[];
    missingData: ActionPlanItem[];
  };
  allRecommendations: ClassifiedRecommendation[];
  financialStrengths: { title: string; explanation: string }[];
  risks: { title: string; explanation: string; severity?: string }[];
  opportunities: { title: string; explanation: string; possibleSavings?: number | null }[];
  conflicts: { title: string; explanation: string; tradeOff: string; recommendation: string }[];
  thingsToReviewRegularly: string[];
};

export type ExecutiveReport = {
  meta: {
    userId: string;
    generatedAt: string;
    reportVersion: string;
    agentCount: number;
    globalHealthScore: number | null;
    stats?: {
      rawRecommendationCount: number;
      mergedCount: number;
      conflictCount: number;
      preservedCount?: number;
      totalRecommendations?: number;
      mainDecisionCount?: number;
      missingDataCount?: number;
      notMaterialCount?: number;
    };
  };
  sections: ExecutiveReportSection;
  disclaimer: string;
};

type ExecutiveReportResponse = {
  success: boolean;
  data?: {
    runId: string;
    report: ExecutiveReport;
    meta?: Record<string, unknown>;
  };
};

export const generateExecutiveReport = async (options?: { skipLLM?: boolean }) => {
  const qs = options?.skipLLM ? "?skipLLM=true" : "";
  const result = await apiJson<ExecutiveReportResponse>(`/api/executive/report${qs}`, {
    method: "POST",
    auth: true,
    body: {},
    fallbackErrorMessage: "לא הצלחנו ליצור את הדוח הפיננסי.",
  });

  if (!result.ok) {
    return { success: false, message: result.error.message } as const;
  }

  const payload = result.data;
  if (!payload?.data?.report) {
    return { success: false, message: "תגובה לא תקינה מהשרת." } as const;
  }

  return { success: true, ...payload.data } as const;
};

type LatestExecutiveReportResponse = {
  success: boolean;
  data?: {
    runId: string;
    report: ExecutiveReport;
    savedAt: string;
  } | null;
};

/** The user's most recent saved report (kept 7 days server-side), if any. */
export const getLatestExecutiveReport = async () => {
  const result = await apiJson<LatestExecutiveReportResponse>("/api/executive/report/latest", {
    auth: true,
    fallbackErrorMessage: "לא הצלחנו לטעון את הדוח האחרון.",
  });

  if (!result.ok) {
    return { success: false, message: result.error.message } as const;
  }
  const latest = result.data?.data;
  if (!latest?.report) {
    return { success: true, found: false } as const;
  }
  return { success: true, found: true, ...latest } as const;
};

export const downloadExecutiveReportPdf = async (options?: { runId: string; mode?: "user" | "professional" }) => {
  if (!options?.runId) {
    return { success: false, message: "חסר מזהה דוח. יש ליצור דוח לפני ההורדה." } as const;
  }
  const params = new URLSearchParams({ runId: options.runId });
  if (options.mode) params.set("mode", options.mode);
  const qs = `?${params.toString()}`;
  const result = await apiBlob(`/api/executive/report/pdf${qs}`, {
    auth: true,
    fallbackErrorMessage: "לא הצלחנו להוריד את הדוח.",
  });

  if (!result.ok) {
    return { success: false, message: result.error.message } as const;
  }

  const disposition = result.response.headers.get("Content-Disposition") || "";
  const match = disposition.match(/filename="([^"]+)"/);
  const filename = match?.[1] || `FinGuide-Personal-Report-${new Date().toISOString().slice(0, 10)}.pdf`;

  return { success: true, blob: result.blob, filename } as const;
};
