import { listDocuments } from "../api/documents.api";
import { getDocument } from "../api/documents.api";
import {
  documentsToPayslipHistoryResponse,
  documentToPayslipDetail,
} from "../utils/payslipMappers";
import type { PayslipDetail, PayslipHistoryResponse } from "../types/payslip";

/** Base URL for API (empty = same origin, proxy handles /api) */
const getApiBaseUrl = (): string => {
  try {
    return (import.meta.env?.VITE_API_URL as string) ?? "";
  } catch {
    return "";
  }
};

export const fetchPayslipHistory = async (): Promise<PayslipHistoryResponse> => {
  const response = await listDocuments();
  if (!response.success) {
    throw new Error(response.message ?? "לא הצלחנו לטעון את המסמכים.");
  }
  const list = response.data;
  if (!Array.isArray(list)) {
    if (import.meta.env?.DEV) {
      console.warn("[payslip] listDocuments: response.data is not an array", response);
    }
    return {
      stats: { averageNet: 0, averageGross: 0, totalPayslips: 0 },
      items: [],
    };
  }
  const result = documentsToPayslipHistoryResponse(list, {
    apiBaseUrl: getApiBaseUrl(),
  });
  if (import.meta.env?.DEV) {
    const completed = list.filter((d) => d.status === "completed");
    console.log(
      "[payslip] documents:",
      list.length,
      "completed:",
      completed.length,
      "payslips shown:",
      result.items.length
    );
  }
  return result;
};

export const fetchPayslipDetail = async (
  id: string
): Promise<PayslipDetail | null> => {
  const response = await getDocument(id);
  if (!response.success || !response.data) return null;
  const doc = response.data;
  if (doc.status !== "completed" || !doc.analysisData) return null;
  return documentToPayslipDetail(doc, { apiBaseUrl: getApiBaseUrl() });
};
