export type DocumentStatus = "pending" | "processing" | "completed" | "failed";

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

const parseJson = async (response: Response) => {
  try {
    return await response.json();
  } catch {
    return null;
  }
};

const getToken = () => localStorage.getItem("token");

const getAuthHeaders = (): Record<string, string> => {
  const headers: Record<string, string> = {};
  const token = getToken();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
};

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

  const response = await fetch("/api/documents", {
    headers: {
      Accept: "application/json",
      ...getAuthHeaders(),
    },
  });

  const payload = await parseJson(response);

  if (!response.ok) {
    return (payload || {
      success: false,
      message: "לא הצלחנו לטעון את המסמכים.",
    }) as ListDocumentsResponse;
  }

  return (payload || {
    success: false,
    message: "תגובה לא תקינה.",
  }) as ListDocumentsResponse;
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

  const response = await fetch("/api/documents/upload", {
    method: "POST",
    headers: {
      ...getAuthHeaders(),
    },
    body: formData,
  });

  const payload = await parseJson(response);

  if (!response.ok) {
    return (payload || {
      success: false,
      message: "שגיאה בהעלאת הקובץ.",
    }) as UploadDocumentResponse;
  }

  return (payload || {
    success: false,
    message: "תגובה לא תקינה.",
  }) as UploadDocumentResponse;
};

export const getDocument = async (id: string) => {
  const token = getToken();
  if (!token) {
    return { success: false, message: "אין הרשאה. נא להתחבר." } as DocumentResponse;
  }

  const response = await fetch(`/api/documents/${id}`, {
    headers: {
      Accept: "application/json",
      ...getAuthHeaders(),
    },
  });

  const payload = await parseJson(response);

  if (!response.ok) {
    return (payload || {
      success: false,
      message: "לא הצלחנו לטעון את המסמך.",
    }) as DocumentResponse;
  }

  return (payload || {
    success: false,
    message: "תגובה לא תקינה.",
  }) as DocumentResponse;
};

export const removeDocument = async (id: string) => {
  const token = getToken();
  if (!token) {
    return { success: false, message: "אין הרשאה. נא להתחבר." } as RemoveDocumentResponse;
  }

  const response = await fetch(`/api/documents/${id}`, {
    method: "DELETE",
    headers: {
      Accept: "application/json",
      ...getAuthHeaders(),
    },
  });

  const payload = await parseJson(response);

  if (!response.ok) {
    return (payload || {
      success: false,
      message: "שגיאה במחיקת המסמך.",
    }) as RemoveDocumentResponse;
  }

  return (payload || {
    success: false,
    message: "תגובה לא תקינה.",
  }) as RemoveDocumentResponse;
};

export const downloadDocument = async (id: string) => {
  const token = getToken();
  if (!token) {
    return { success: false, message: "אין הרשאה. נא להתחבר." } as DownloadDocumentResponse;
  }

  const response = await fetch(`/api/documents/${id}/download`, {
    headers: {
      ...getAuthHeaders(),
    },
  });

  const contentType = response.headers.get("content-type") ?? "";

  if (!response.ok) {
    const payload = contentType.includes("application/json")
      ? await parseJson(response)
      : null;

    return (payload || {
      success: false,
      message: "שגיאה בהורדת המסמך.",
    }) as DownloadDocumentResponse;
  }

  if (contentType.includes("application/json")) {
    const payload = await parseJson(response);
    return (payload || {
      success: false,
      message: "תגובה לא תקינה.",
    }) as DownloadDocumentResponse;
  }

  const blob = await response.blob();
  const filename = getFilenameFromDisposition(response) || "document.pdf";

  return {
    success: true,
    blob,
    filename,
  } as DownloadDocumentResponse;
};
