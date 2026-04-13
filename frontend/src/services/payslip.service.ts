import { getPayslip, listPayslips } from "../api/documents.api";
import type { PayslipDetail, PayslipHistoryResponse } from "../types/payslip";

export const fetchPayslipHistory = async (): Promise<PayslipHistoryResponse> => {
  const response = await listPayslips();
  if (!response.success) {
    throw new Error(response.message ?? "לא הצלחנו לטעון את היסטוריית התלושים.");
  }
  return response.data ?? { stats: { averageNet: 0, averageGross: 0, totalPayslips: 0 }, items: [] };
};

export const fetchPayslipDetail = async (id: string): Promise<PayslipDetail | null> => {
  const response = await getPayslip(id);
  if (!response.success) {
    throw new Error(response.message ?? "לא הצלחנו לטעון את התלוש.");
  }
  return response.data ?? null;
};
