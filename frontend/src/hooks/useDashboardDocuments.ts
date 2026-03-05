import { useCallback, useEffect, useMemo, useState } from "react";
import {
  downloadDocument,
  listDocuments,
  removeDocument,
  uploadDocument,
  DOCUMENT_STATUS_LABELS,
  type DocumentItem,
} from "../api/documents.api";

const MAX_UPLOAD_SIZE_MB = 10;
const BYTES_IN_MB = 1024 * 1024;
const RECENT_DOCUMENTS_COUNT = 4;

const addUniqueId = (ids: string[], id: string) =>
  ids.includes(id) ? ids : [...ids, id];

const removeId = (ids: string[], id: string) => ids.filter((item) => item !== id);

const isPdfFile = (file: File) =>
  file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");

export const useDashboardDocuments = () => {
  const [items, setItems] = useState<DocumentItem[]>([]);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [uploadError, setUploadError] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [deletingIds, setDeletingIds] = useState<string[]>([]);
  const [downloadingIds, setDownloadingIds] = useState<string[]>([]);
  const [actionError, setActionError] = useState("");

  const loadDocuments = useCallback(async () => {
    setIsLoading(true);
    const response = await listDocuments();
    if (response.success && Array.isArray(response.data)) {
      setItems(response.data);
      setError("");
    } else {
      setItems([]);
      setError(response.message || "לא הצלחנו לטעון את המסמכים.");
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    void loadDocuments();
  }, [loadDocuments]);

  const uploadFile = useCallback(
    async (file: File) => {
      const maxSizeBytes = MAX_UPLOAD_SIZE_MB * BYTES_IN_MB;

      if (!isPdfFile(file)) {
        setUploadError("ניתן להעלות רק קבצי PDF.");
        return;
      }

      if (file.size > maxSizeBytes) {
        setUploadError(`הקובץ גדול מדי. מקסימום ${MAX_UPLOAD_SIZE_MB}MB.`);
        return;
      }

      setUploadError("");
      setActionError("");
      setIsUploading(true);

      const response = await uploadDocument(file);
      if (!response.success) {
        setUploadError(response.message || "שגיאה בהעלאת הקובץ.");
        setIsUploading(false);
        return;
      }

      await loadDocuments();
      setIsUploading(false);
    },
    [loadDocuments],
  );

  const deleteDocument = useCallback(async (doc: DocumentItem) => {
    setActionError("");
    setDeletingIds((prev) => addUniqueId(prev, doc._id));
    const response = await removeDocument(doc._id);
    if (!response.success) {
      setActionError(response.message || "שגיאה במחיקת המסמך.");
      setDeletingIds((prev) => removeId(prev, doc._id));
      return;
    }

    setItems((prev) => prev.filter((item) => item._id !== doc._id));
    setDeletingIds((prev) => removeId(prev, doc._id));
  }, []);

  const downloadFile = useCallback(async (doc: DocumentItem) => {
    setActionError("");
    setDownloadingIds((prev) => addUniqueId(prev, doc._id));
    const response = await downloadDocument(doc._id);
    if (!response.success || !response.blob) {
      setActionError(response.message || "שגיאה בהורדת המסמך.");
      setDownloadingIds((prev) => removeId(prev, doc._id));
      return;
    }

    const url = window.URL.createObjectURL(response.blob);
    const link = window.document.createElement("a");
    link.href = url;
    link.download = response.filename || doc.originalName || "document.pdf";
    window.document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
    setDownloadingIds((prev) => removeId(prev, doc._id));
  }, []);

  const documentsThisMonth = useMemo(() => {
    const now = new Date();
    const month = now.getMonth();
    const year = now.getFullYear();
    return items.filter((doc) => {
      if (!doc.uploadedAt) return false;
      const date = new Date(doc.uploadedAt);
      return date.getMonth() === month && date.getFullYear() === year;
    }).length;
  }, [items]);

  const stats = useMemo(() => {
    const total = items.length;
    const completed = items.filter((doc) => doc.status === "completed").length;
    const failed = items.filter((doc) => doc.status === "failed").length;
    const processing = items.filter(
      (doc) => doc.status === "processing" || doc.status === "pending",
    ).length;
    const uploaded = items.filter((doc) => doc.status === "uploaded").length;
    const totalSize = items.reduce((sum, doc) => sum + (doc.fileSize || 0), 0);
    return {
      total,
      completed,
      failed,
      processing: processing + uploaded,
      totalSize,
    };
  }, [items]);

  return {
    items,
    recent: items.slice(0, RECENT_DOCUMENTS_COUNT),
    isLoading,
    error,
    uploadError,
    isUploading,
    deletingIds,
    downloadingIds,
    actionError,
    statusLabels: DOCUMENT_STATUS_LABELS,
    documentsThisMonth,
    stats,
    actions: {
      uploadFile,
      deleteDocument,
      downloadFile,
      reload: loadDocuments,
    },
  };
};
