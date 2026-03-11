import { getDocument, listDocuments } from "../api/documents.api";
import type { PayslipDetail, PayslipHistoryResponse } from "../types/payslip";
import {
  documentToPayslipDetail,
  getPayslipHistoryFromDocuments,
} from "../utils/documentToPayslip";

export const fetchPayslipHistory = async (): Promise<PayslipHistoryResponse> => {
  const response = await listDocuments();
  if (!response.success) {
    throw new Error(response.message ?? "לא הצלחנו לטעון את המסמכים.");
  }
  const docs = response.data ?? [];
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
