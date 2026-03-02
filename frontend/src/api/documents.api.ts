import { apiBlob, apiJson } from "./client";

export type DocumentStatus =
  | "uploaded"
  | "pending"
  | "processing"
  | "completed"
  | "failed";

export interface DocumentItem {
  _id: string;
  originalName: string;
  fileSize: number;
  status?: DocumentStatus;
  uploadedAt?: string;
  processedAt?: string;
  mimeType?: string;
  analysisData?: Record<string, unknown>;
  createdAt?: string;
  updatedAt?: string;
}

export type ListDocumentsResponse = {
  success: boolean;
  message?: string;
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
    return { success: false, message: result.error.message } as ListDocumentsResponse;
  }

  return result.data || ({ success: false, message: "תגובה לא תקינה." } as ListDocumentsResponse);
};

export const uploadDocument = async (file: File) => {
  const token = getToken();
  if (!token) {
    return { success: false, message: "אין הרשאה. נא להתחבר." } as UploadDocumentResponse;
  }

  if (!file) {
    return { success: false, message: "לא נבחר קובץ." } as UploadDocumentResponse;
  }

  const formData = new FormData();
  formData.append("document", file);

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
