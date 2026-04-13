import { apiBlob, apiJson } from "./client";
import type { PayslipDetail, PayslipHistoryResponse } from "../types/payslip";

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

export type DocumentMetadata = {
  category: DocumentCategory;
  periodMonth?: number;
  periodYear?: number;
  documentDate?: string;
  source: "manual_upload";
};

export interface DocumentItem {
  id: string;
  originalName: string;
  fileSize: number;
  status?: DocumentStatus;
  uploadedAt?: string;
  processedAt?: string;
  processingError?: string | null;
  mimeType?: string;
  metadata?: DocumentMetadata;
  createdAt?: string;
  updatedAt?: string;
}

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

export type PayslipHistoryApiResponse = {
  success: boolean;
  message?: string;
  data?: PayslipHistoryResponse;
};

export type PayslipDetailApiResponse = {
  success: boolean;
  message?: string;
  data?: PayslipDetail;
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

  return result.data || ({ success: false, message: "תגובה לא תקינה." } as ListDocumentsResponse);
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
  return result.data || ({ success: false, message: "תגובה לא תקינה." } as UploadDocumentResponse);
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

  return result.data || ({ success: false, message: "תגובה לא תקינה." } as DocumentResponse);
};

export const listPayslips = async () => {
  const token = getToken();
  if (!token) {
    return { success: false, message: "אין הרשאה. נא להתחבר." } as PayslipHistoryApiResponse;
  }

  const result = await apiJson<PayslipHistoryApiResponse>("/api/documents/payslips", {
    auth: true,
    fallbackErrorMessage: "לא הצלחנו לטעון את היסטוריית התלושים.",
  });

  if (!result.ok) {
    return {
      success: false,
      message: result.error.message,
    } as PayslipHistoryApiResponse;
  }

  return result.data || ({ success: false, message: "תגובה לא תקינה." } as PayslipHistoryApiResponse);
};

export const getPayslip = async (id: string) => {
  const token = getToken();
  if (!token) {
    return { success: false, message: "אין הרשאה. נא להתחבר." } as PayslipDetailApiResponse;
  }

  const result = await apiJson<PayslipDetailApiResponse>(`/api/documents/payslips/${id}`, {
    auth: true,
    fallbackErrorMessage: "לא הצלחנו לטעון את התלוש.",
  });

  if (!result.ok) {
    return { success: false, message: result.error.message } as PayslipDetailApiResponse;
  }

  return result.data || ({ success: false, message: "תגובה לא תקינה." } as PayslipDetailApiResponse);
};

export const reprocessDocument = async (id: string) => {
  const token = getToken();
  if (!token) {
    return { success: false, message: "אין הרשאה. נא להתחבר." } as DocumentResponse;
  }

  const result = await apiJson<DocumentResponse>(`/api/documents/${id}/reprocess`, {
    method: "POST",
    auth: true,
    fallbackErrorMessage: "לא הצלחנו לשלוח את המסמך לעיבוד מחדש.",
  });

  if (!result.ok) {
    return { success: false, message: result.error.message } as DocumentResponse;
  }

  return result.data || ({ success: false, message: "תגובה לא תקינה." } as DocumentResponse);
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
