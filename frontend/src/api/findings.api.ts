import { apiJson, type ApiErrorPayload } from "./client";

export type FindingSeverity = "info" | "warning";

export type FindingFundType = "pension" | "study_fund";

export type FindingKind =
  | "rate"
  | "continuity"
  | "deposit"
  | "pension_health_low"
  | "fee_above_market"
  | "risk_wrong_for_age"
  | "track_underperforming"
  | "insurance_health_low"
  | "insurance_duplicate"
  | "insurance_missing_coverage";

export type FindingMeta = {
  fundType?: FindingFundType;
  periods?: string[];
  documentIds?: string[];
  findingKind?: FindingKind | string;
  score?: number;
  fundId?: string;
  fundName?: string;
  currentAge?: number | null;
};

export type FindingItem = {
  id: string;
  title: string;
  severity: FindingSeverity;
  details: string;
  meta?: FindingMeta;
};

export type ListFindingsResponse = {
  success: boolean;
  message?: string;
  status?: number;
  count?: number;
  data?: FindingItem[];
};

export type SavingsForecastRequest = {
  currentBalance: number;
  currentAge: number;
  retirementAge: number;
  adjustedMonthlyContribution: number;
  currentMonthlyContribution?: number;
};

export type SavingsTimelinePoint = {
  yearIndex: number;
  age: number;
  calendarYear: number;
  monthsFromNow: number;
  projectedBalance: number;
};

export type SavingsScenario = {
  monthlyContribution: number;
  monthsToRetirement: number;
  projectedBalance: number;
  timeline: SavingsTimelinePoint[];
};

export type SavingsForecastSummary = {
  yearsToRetirement: number;
  monthsToRetirement: number;
  currentProjectedBalance: number;
  adjustedProjectedBalance: number;
  differenceAtRetirement: number;
};

export type SavingsForecastData = {
  currentScenario: SavingsScenario;
  adjustedScenario: SavingsScenario;
  summary: SavingsForecastSummary;
  meta: {
    contributionSource: "document" | "manual";
    sourceDocumentId?: string;
    warnings: string[];
  };
};

export type SavingsForecastResponse = {
  success: boolean;
  message?: string;
  status?: number;
  errors?: unknown[];
  data?: SavingsForecastData;
};

const getToken = () => localStorage.getItem("token");

export const listFindings = async () => {
  const token = getToken();
  if (!token) {
    return { success: false, message: "אין הרשאה. נא להתחבר." } as ListFindingsResponse;
  }

  const result = await apiJson<ListFindingsResponse>("/api/findings", {
    auth: true,
    fallbackErrorMessage: "לא הצלחנו לטעון את הממצאים.",
  });

  if (!result.ok) {
    return {
      success: false,
      message: result.error.message,
      status: result.status,
    } as ListFindingsResponse;
  }

  return result.data || ({ success: false, message: "תגובה לא תקינה." } as ListFindingsResponse);
};

export const getSavingsForecast = async (body: SavingsForecastRequest) => {
  const token = getToken();
  if (!token) {
    return { success: false, message: "אין הרשאה. נא להתחבר." } as SavingsForecastResponse;
  }

  const result = await apiJson<SavingsForecastResponse>("/api/findings/savings-forecast", {
    method: "POST",
    body,
    auth: true,
    fallbackErrorMessage: "לא הצלחנו לחשב תחזית חיסכון.",
  });

  if (!result.ok) {
    const payload = result.error.payload as ApiErrorPayload | null;
    return {
      success: false,
      message: result.error.message,
      status: result.status,
      ...(payload?.errors && { errors: payload.errors }),
    } as SavingsForecastResponse;
  }

  return result.data || ({ success: false, message: "תגובה לא תקינה." } as SavingsForecastResponse);
};
