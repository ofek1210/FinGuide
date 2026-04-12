import { apiBlob, apiJson } from "./client";

/** Matches backend: pending, processing, completed, failed. "uploaded" is frontend-only for just-uploaded row. */
export type DocumentStatus =
  | "uploaded"
  | "pending"
  | "processing"
  | "completed"
  | "failed";

export type DocumentCategory =
  | "payslip"
  | "tax_report"
  | "pension_report"
  | "invoice"
  | "other";

export interface DocumentMetadata {
  category: DocumentCategory;
  periodMonth?: number;
  periodYear?: number;
  documentDate?: string;
  source?: "manual_upload";
}

/** Matches backend payslipOcr buildPayslipSummary output (analysisData.summary). */
export type PayslipSummaryFromBackend = {
  employeeName?: string | null;
  date?: string | null;
  grossSalary?: number | null;
  netSalary?: number | null;
  vacationDays?: number | null;
  sickDays?: number | null;
  pensionEmployee?: number | null;
  pensionEmployer?: number | null;
  trainingFundEmployee?: number | null;
  trainingFundEmployer?: number | null;
  tax?: number | null;
  nationalInsurance?: number | null;
  healthInsurance?: number | null;
  jobPercentage?: number | null;
  workingDays?: number | null;
  workingHours?: number | null;
};

export interface DocumentItem {
  _id: string;
  originalName: string;
  fileSize: number;
  status?: DocumentStatus;
  uploadedAt?: string;
  processedAt?: string;
  mimeType?: string;
  metadata?: { category?: string; periodMonth?: number; periodYear?: number };
  analysisData?: { summary?: PayslipSummaryFromBackend; [k: string]: unknown };
  metadata?: DocumentMetadata;
  createdAt?: string;
  updatedAt?: string;
}

export type DocumentCategory = "payslip" | "tax_report" | "pension_report" | "invoice" | "other";

export type UploadDocumentPayload = {
  category: DocumentCategory;
  periodMonth?: number;
  periodYear?: number;
  documentDate?: string;
};

export type ListDocumentsResponse = {
  success: boolean;
  message?: string;
  status?: number;
  count?: number;
  data?: DocumentItem[];
};

export type UploadDocumentResponse = {
  success: boolean;
  message?: string;
  data?: DocumentItem;
};

export type DocumentResponse = {
  success: boolean;
  message?: string;
  data?: DocumentItem;
};

export type RemoveDocumentResponse = {
  success: boolean;
  message?: string;
};

export type DownloadDocumentResponse = {
  success: boolean;
  message?: string;
  blob?: Blob;
  filename?: string;
};

const getToken = () => localStorage.getItem("token");

const getFilenameFromDisposition = (response: Response) => {
  const disposition = response.headers.get("content-disposition");
  if (!disposition) return null;

  const match = /filename\*?=(?:UTF-8''|")?([^";]+)/i.exec(disposition);
  if (!match || !match[1]) return null;

  try {
    return decodeURIComponent(match[1].replace(/"/g, ""));
  } catch {
    return match[1].replace(/"/g, "");
  }
};

export const listDocuments = async () => {
  const token = getToken();
  if (!token) {
    return { success: false, message: "אין הרשאה. נא להתחבר." } as ListDocumentsResponse;
  }

  const result = await apiJson<ListDocumentsResponse>("/api/documents", {
    auth: true,
    fallbackErrorMessage: "לא הצלחנו לטעון את המסמכים.",
  });

  if (!result.ok) {
    return {
      success: false,
      message: result.error.message,
      status: result.status,
    } as ListDocumentsResponse;
  }

  const payload = result.data || ({ success: false, message: "תגובה לא תקינה." } as ListDocumentsResponse);
  // eslint-disable-next-line no-console
  console.log("[frontend] listDocuments response", payload);
  return payload;
};

export const uploadDocument = async (
  file: File,
  metadata: UploadDocumentPayload = { category: "other" },
) => {
  const token = getToken();
  if (!token) {
    return { success: false, message: "אין הרשאה. נא להתחבר." } as UploadDocumentResponse;
  }

  if (!file) {
    return { success: false, message: "לא נבחר קובץ." } as UploadDocumentResponse;
  }

  const formData = new FormData();
  formData.append("document", file);
  formData.append("category", metadata.category);
  if (metadata.periodMonth !== undefined) {
    formData.append("periodMonth", String(metadata.periodMonth));
  }
  if (metadata.periodYear !== undefined) {
    formData.append("periodYear", String(metadata.periodYear));
  }
  if (metadata.documentDate) {
    formData.append("documentDate", metadata.documentDate);
  }

  const result = await apiJson<UploadDocumentResponse>("/api/documents/upload", {
    method: "POST",
    auth: true,
    body: formData,
    fallbackErrorMessage: "שגיאה בהעלאת הקובץ.",
  });
  if (!result.ok) {
    return { success: false, message: result.error.message } as UploadDocumentResponse;
  }
  const payload = result.data || ({ success: false, message: "תגובה לא תקינה." } as UploadDocumentResponse);
  // eslint-disable-next-line no-console
  console.log("[frontend] uploadDocument response", payload);
  return payload;
};

export const getDocument = async (id: string) => {
  const token = getToken();
  if (!token) {
    return { success: false, message: "אין הרשאה. נא להתחבר." } as DocumentResponse;
  }

  const result = await apiJson<DocumentResponse>(`/api/documents/${id}`, {
    auth: true,
    fallbackErrorMessage: "לא הצלחנו לטעון את המסמך.",
  });

  if (!result.ok) {
    return { success: false, message: result.error.message } as DocumentResponse;
  }

  const payload = result.data || ({ success: false, message: "תגובה לא תקינה." } as DocumentResponse);
  // eslint-disable-next-line no-console
  console.log("[frontend] getDocument response", payload);
  return payload;
};

export const removeDocument = async (id: string) => {
  const token = getToken();
  if (!token) {
    return { success: false, message: "אין הרשאה. נא להתחבר." } as RemoveDocumentResponse;
  }

  const result = await apiJson<RemoveDocumentResponse>(`/api/documents/${id}`, {
    method: "DELETE",
    auth: true,
    fallbackErrorMessage: "שגיאה במחיקת המסמך.",
  });
  if (!result.ok) {
    return { success: false, message: result.error.message } as RemoveDocumentResponse;
  }
  return result.data || ({ success: false, message: "תגובה לא תקינה." } as RemoveDocumentResponse);
};

export const downloadDocument = async (id: string) => {
  const token = getToken();
  if (!token) {
    return { success: false, message: "אין הרשאה. נא להתחבר." } as DownloadDocumentResponse;
  }

  const result = await apiBlob(`/api/documents/${id}/download`, {
    auth: true,
    fallbackErrorMessage: "שגיאה בהורדת המסמך.",
  });
  if (!result.ok) {
    return { success: false, message: result.error.message } as DownloadDocumentResponse;
  }

  const filename = getFilenameFromDisposition(result.response) || "document.pdf";
  return { success: true, blob: result.blob, filename } as DownloadDocumentResponse;
};
