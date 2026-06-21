import {
  getDocument,
  getPayslipHistoryIntelligence,
  listDocuments,
  reprocessDocument,
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
    const fromIntelligence = getPayslipHistoryFromIntelligence(intelligence.data);
    if (fromIntelligence.items.length > 0) {
      return fromIntelligence;
    }
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

/**
 * Re-run extraction on a payslip's existing PDF. Returns the refreshed
 * PayslipDetail with the new pipeline's values (e.g. corrected net_payable,
 * employee_id recovered from Malam Plus layout).
 */
export const reprocessPayslip = async (id: string): Promise<PayslipDetail | null> => {
  const response = await reprocessDocument(id);
  if (!response.success) {
    throw new Error(response.message ?? "החילוץ מחדש נכשל.");
  }
  const doc = response.data;
  if (!doc) return null;
  return documentToPayslipDetail(doc);
};
