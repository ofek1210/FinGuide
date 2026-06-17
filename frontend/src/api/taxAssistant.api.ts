import { apiJson } from "./client";

export type TaxIssueSeverity = "low" | "medium" | "high";

export type TaxAssistantIssue = {
  type: string;
  severity: TaxIssueSeverity;
  title: string;
  message: string;
  months?: number[];
  employers?: string[];
  year?: number;
  averageTax?: number;
  threshold?: number;
};

export type TaxAssistantSummary = {
  totalSalaryDocuments: number;
  totalGrossIncome: number;
  totalNetIncome: number;
  totalIncomeTax: number;
  employers: string[];
  monthsPresent?: number[];
  missingMonths?: number[];
};

export type TaxAssistantPayload = {
  year: number;
  issues: TaxAssistantIssue[];
  summary: TaxAssistantSummary;
  disclaimer: string;
};

type TaxAssistantResponse = {
  success: boolean;
  message?: string;
  data?: TaxAssistantPayload;
};

export const getTaxAssistantSummary = async (year: number) => {
  const result = await apiJson<TaxAssistantResponse>(
    `/api/tax-assistant/summary?year=${year}`,
    {
      auth: true,
      fallbackErrorMessage: "לא הצלחנו לטעון את ניתוח המס.",
    },
  );

  if (!result.ok) {
    return { success: false, message: result.error.message } as TaxAssistantResponse;
  }

  return result.data || ({ success: false, message: "תגובה לא תקינה." } as TaxAssistantResponse);
};
