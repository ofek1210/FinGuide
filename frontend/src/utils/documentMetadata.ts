import type { DocumentCategory, DocumentMetadata } from "../api/documents.api";

export const DOCUMENT_CATEGORY_LABELS: Record<DocumentCategory, string> = {
  payslip: "תלוש שכר",
  tax_report: "דוח מס",
  pension_report: "דוח פנסיה",
  invoice: "חשבונית",
  other: "מסמך כללי",
};

export const getDocumentCategoryLabel = (
  category?: DocumentCategory | null,
): string => {
  if (!category) return DOCUMENT_CATEGORY_LABELS.other;
  return DOCUMENT_CATEGORY_LABELS[category] || DOCUMENT_CATEGORY_LABELS.other;
};

export const formatDocumentPeriod = (
  metadata?: DocumentMetadata | null,
): string | null => {
  if (!metadata) return null;

  if (metadata.periodMonth && metadata.periodYear) {
    return `${String(metadata.periodMonth).padStart(2, "0")}/${metadata.periodYear}`;
  }

  return null;
};

export const formatDocumentDate = (
  metadata?: DocumentMetadata | null,
): string | null => {
  if (!metadata?.documentDate) return null;

  const parsed = new Date(metadata.documentDate);
  if (Number.isNaN(parsed.getTime())) return null;

  return parsed.toLocaleDateString("he-IL");
};

export const formatDocumentMetadataSummary = (
  metadata?: DocumentMetadata | null,
): string => {
  const parts = [
    getDocumentCategoryLabel(metadata?.category),
    formatDocumentPeriod(metadata),
    formatDocumentDate(metadata),
  ].filter(Boolean);

  return parts.join(" · ");
};
