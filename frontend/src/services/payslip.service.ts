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
  computePayslipStats,
} from "../utils/documentToPayslip";

export const fetchPayslipHistory = async (year?: number | "all"): Promise<PayslipHistoryResponse> => {
  const [intelligence, fallbackResponse] = await Promise.all([
    getPayslipHistoryIntelligence(year),
    listDocuments(),
  ]);

  const fromDocs = fallbackResponse.success && Array.isArray(fallbackResponse.data)
    ? getPayslipHistoryFromDocuments(fallbackResponse.data)
    : null;

  if (intelligence.success && intelligence.data) {
    const fromIntelligence = getPayslipHistoryFromIntelligence(intelligence.data);
    const seenIds = new Set(fromIntelligence.items.map((item) => item.id));
    const mergedItems = [
      ...fromIntelligence.items,
      ...(fromDocs?.items.filter((item) => item.id && !seenIds.has(item.id)) ?? []),
    ];

    if (mergedItems.length > 0) {
      const stats = fromIntelligence.items.length > 0
        ? {
            ...fromIntelligence.stats,
            totalPayslips: mergedItems.length,
          }
        : computePayslipStats(mergedItems);

      return {
        ...fromIntelligence,
        items: mergedItems,
        stats,
      };
    }
  }

  if (fromDocs && fromDocs.items.length > 0) {
    return fromDocs;
  }

  if (!fallbackResponse.success) {
    throw new Error(fallbackResponse.message ?? "לא הצלחנו לטעון את המסמכים.");
  }

  return fromDocs ?? {
    stats: computePayslipStats([]),
    items: [],
    years: [],
    selectedYear: null,
    taxAdjustment: null,
    dataQualityWarnings: [],
  };
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
