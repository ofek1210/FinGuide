import {
  getDocument,
  getPayslipHistoryIntelligence,
  listDocuments,
} from "../api/documents.api";
import type { PayslipDetail, PayslipHistoryResponse } from "../types/payslip";
import {
  documentToPayslipDetail,
  getPayslipHistoryFromIntelligence,
  getPayslipHistoryFromDocuments,
} from "../utils/documentToPayslip";

export const fetchPayslipHistory = async (year?: number): Promise<PayslipHistoryResponse> => {
  const intelligence = await getPayslipHistoryIntelligence(year);
  if (intelligence.success && intelligence.data) {
    return getPayslipHistoryFromIntelligence(intelligence.data);
  }

  const fallbackResponse = await listDocuments();
  if (!fallbackResponse.success) {
    throw new Error(fallbackResponse.message ?? "לא הצלחנו לטעון את המסמכים.");
  }
  const docs = fallbackResponse.data ?? [];
  return getPayslipHistoryFromDocuments(docs);
};

export const fetchPayslipDetail = async (id: string): Promise<PayslipDetail | null> => {
  const response = await getDocument(id);
  if (!response.success) {
    throw new Error(response.message ?? "לא הצלחנו לטעון את המסמך.");
  }
  const doc = response.data;
  if (!doc) return null;
  return documentToPayslipDetail(doc);
};
