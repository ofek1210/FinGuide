import { useCallback, useEffect, useRef, useState } from "react";
import type { RefObject } from "react";
import { useNavigate } from "react-router-dom";
import Loader from "../components/ui/Loader";
import Toast from "../components/ui/Toast";
import ToastContainer from "../components/ui/ToastContainer";
import AppFooter from "../components/AppFooter";
import PrivateTopbar from "../components/PrivateTopbar";
import {
  listDocuments,
  uploadDocument,
  downloadDocument,
  removeDocument,
  type DocumentItem as ApiDocumentItem,
  type DocumentCategory,
  type DocumentMetadata,
  type UploadDocumentPayload,
} from "../api/documents.api";
import { APP_ROUTES } from "../types/navigation";
import {
  DOCUMENT_CATEGORY_LABELS,
  formatDocumentMetadataSummary,
} from "../utils/documentMetadata";
import { getApiErrorMessage } from "../utils/apiErrorMessages";

type UploadState = "idle" | "uploading" | "uploaded" | "error";

type DocumentStatus =
  | "uploading"
  | "pending"
  | "processing"
  | "completed"
  | "failed";

interface DocumentItem {
  id: string;
  name: string;
  status: DocumentStatus;
  fileSize?: number;
  uploadedAt?: string;
  metadata: DocumentMetadata;
}

type UploadFormState = {
  category: DocumentCategory | "";
  periodMonth: string;
  periodYear: string;
  documentDate: string;
};

const DEFAULT_UPLOAD_FORM: UploadFormState = {
  category: "",
  periodMonth: "",
  periodYear: "",
  documentDate: "",
};

const addUniqueId = (ids: string[], id: string) =>
  ids.includes(id) ? ids : [...ids, id];

const removeId = (ids: string[], id: string) => ids.filter((item) => item !== id);

const mapStatus = (status?: ApiDocumentItem["status"]): DocumentStatus => {
  if (status === "completed") return "completed";
  if (status === "processing") return "processing";
  if (status === "failed") return "failed";
  if (status === "uploaded") return "pending";
  return "pending";
};

const mapApiDocument = (document: ApiDocumentItem): DocumentItem => ({
  id: document._id,
  name: document.originalName,
  status: mapStatus(document.status),
  fileSize: document.fileSize,
  uploadedAt: document.uploadedAt,
  metadata: document.metadata ?? {
    category: "other",
    source: "manual_upload",
  },
});

const statusLabels: Record<DocumentStatus, string> = {
  uploading: "מעלה קובץ...",
  pending: "ממתין לעיבוד",
  processing: "בעיבוד",
  completed: "הושלם",
  failed: "נכשל",
};

interface UploadAreaProps {
  state: UploadState;
  fileName: string | null;
  message: string;
  isUploading: boolean;
  inputRef: RefObject<HTMLInputElement | null>;
  metadata: UploadFormState;
  onBrowse: () => void;
  onPickFile: (file: File | null) => void;
  onMetadataChange: (field: keyof UploadFormState, value: string) => void;
  onUpload: () => void;
}

function UploadArea({
  state,
  fileName,
  message,
  isUploading,
  inputRef,
  metadata,
  onBrowse,
  onPickFile,
  onMetadataChange,
  onUpload,
}: UploadAreaProps) {
  return (
    <div className="documents-card upload-card">
      <div
        className={`upload-dropzone upload-${state}`}
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault();
          const file = event.dataTransfer.files?.[0] ?? null;
          onPickFile(file);
        }}
      >
        <input
          ref={inputRef}
          className="upload-input"
          type="file"
          accept="application/pdf"
          onChange={(event) => onPickFile(event.target.files?.[0] ?? null)}
        />
        <div className="upload-icon" aria-hidden="true">
          ↑
        </div>
        <h3>גררו ושחררו את הקובץ כאן</h3>
        <p>או בחרו קובץ מהמחשב שלכם</p>
        <button
          className="landing-primary"
          type="button"
          onClick={() => (fileName ? onUpload() : onBrowse())}
          disabled={isUploading}
        >
          {isUploading ? <Loader /> : "העלה קובץ"}
        </button>
        <span className="upload-hint">פי-די-אף בלבד • עד 10 מ"ב</span>
      </div>
      <div className="upload-meta">
        <div className="upload-form-grid">
          <label className="upload-field">
            <span>קטגוריה</span>
            <select
              value={metadata.category}
              onChange={(event) => onMetadataChange("category", event.target.value)}
              disabled={isUploading}
            >
              <option value="">בחרו קטגוריה</option>
              {Object.entries(DOCUMENT_CATEGORY_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>

          <label className="upload-field">
            <span>חודש</span>
            <input
              type="number"
              min="1"
              max="12"
              inputMode="numeric"
              value={metadata.periodMonth}
              onChange={(event) => onMetadataChange("periodMonth", event.target.value)}
              disabled={isUploading}
              placeholder="03"
            />
          </label>

          <label className="upload-field">
            <span>שנה</span>
            <input
              type="number"
              min="2000"
              max="2100"
              inputMode="numeric"
              value={metadata.periodYear}
              onChange={(event) => onMetadataChange("periodYear", event.target.value)}
              disabled={isUploading}
              placeholder="2026"
            />
          </label>

          <label className="upload-field">
            <span>תאריך מסמך</span>
            <input
              type="date"
              value={metadata.documentDate}
              onChange={(event) => onMetadataChange("documentDate", event.target.value)}
              disabled={isUploading}
            />
          </label>
        </div>
        {fileName ? (
          <div className="upload-file">נבחר: {fileName}</div>
        ) : (
          <div className="upload-file muted">לא נבחר קובץ</div>
        )}
        {message ? (
          <div className={`upload-message ${state === "error" ? "error" : ""}`}>
            {message}
          </div>
        ) : null}
      </div>
    </div>
  );
}

interface DocumentCardProps {
  document: DocumentItem;
  onDownload: (document: DocumentItem) => void;
  onDelete: (document: DocumentItem) => void;
  isDeleting: boolean;
  isDownloading: boolean;
}

function DocumentCard({
  document,
  onDownload,
  onDelete,
  isDeleting,
  isDownloading,
}: DocumentCardProps) {
  const statusClass =
    document.status === "completed"
      ? "uploaded"
      : document.status === "pending" || document.status === "processing"
        ? "uploading"
        : document.status;
  const isTemp = document.id.startsWith("temp-");
  const isUploading = document.status === "uploading";
  const isFailed = document.status === "failed";
  const disableDownload = isTemp || isUploading || isFailed || isDownloading;
  const disableDelete = isTemp || isUploading || isDeleting;
  const statusIcon =
    document.status === "uploading" ||
    document.status === "pending" ||
    document.status === "processing" ? (
      <span className="status-spinner" aria-hidden="true" />
    ) : (
      <span className="status-symbol" aria-hidden="true">
        {document.status === "completed" ? "✓" : "!"}
      </span>
    );

  return (
    <div className="document-row">
      <span className={`status-icon status-${statusClass}`}>{statusIcon}</span>
      <div className="document-info">
        <span className="document-name">{document.name}</span>
        <span className="document-meta">
          {[
            formatDocumentMetadataSummary(document.metadata),
            document.uploadedAt
              ? new Date(document.uploadedAt).toLocaleDateString("he-IL")
              : null,
          ]
            .filter(Boolean)
            .join(" · ")}
        </span>
      </div>
      <span className="document-status">{statusLabels[document.status]}</span>
      <div className="document-actions">
        <button
          className="document-action"
          type="button"
          onClick={() => onDownload(document)}
          disabled={disableDownload}
        >
          {isDownloading ? "מוריד..." : "הורדה"}
        </button>
        <button
          className="document-action danger"
          type="button"
          onClick={() => onDelete(document)}
          disabled={disableDelete}
        >
          {isDeleting ? "מוחק..." : "מחיקה"}
        </button>
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="documents-card empty-state">
      <div className="empty-icon" aria-hidden="true">
        📄
      </div>
      <h3>עדיין לא הועלו מסמכים</h3>
      <p>העלו את הקובץ הראשון כדי להתחיל לנהל את המסמכים שלכם.</p>
    </div>
  );
}

export default function DocumentsPage() {
  const navigate = useNavigate();
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [uploadState, setUploadState] = useState<UploadState>("idle");
  const [uploadMessage, setUploadMessage] = useState("");
  const [listError, setListError] = useState("");
  const [isLoadingList, setIsLoadingList] = useState(true);
  const [actionError, setActionError] = useState("");
  const [deletingIds, setDeletingIds] = useState<string[]>([]);
  const [downloadingIds, setDownloadingIds] = useState<string[]>([]);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadForm, setUploadForm] = useState<UploadFormState>(DEFAULT_UPLOAD_FORM);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const timersRef = useRef<number[]>([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const loadDocuments = useCallback(async () => {
    setIsLoadingList(true);
    const response = await listDocuments();

    if (response.success && Array.isArray(response.data)) {
      setDocuments(response.data.map(mapApiDocument));
      setListError("");
    } else {
      setDocuments([]);
      setListError(
        getApiErrorMessage(
          response.message || "לא הצלחנו לטעון את המסמכים.",
          response.status,
        ),
      );
    }

    setIsLoadingList(false);
  }, []);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await loadDocuments();
    setIsRefreshing(false);
  }, [loadDocuments]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadDocuments();
  }, [loadDocuments]);

  useEffect(() => {
    return () => {
      timersRef.current.forEach((timer) => window.clearTimeout(timer));
      timersRef.current = [];
    };
  }, []);

  const clearTimers = () => {
    timersRef.current.forEach((timer) => window.clearTimeout(timer));
    timersRef.current = [];
  };

  const handleMetadataChange = (field: keyof UploadFormState, value: string) => {
    setUploadForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const buildUploadPayload = (): UploadDocumentPayload | null => {
    if (!uploadForm.category) {
      setUploadState("error");
      setUploadMessage("נא לבחור קטגוריית מסמך לפני ההעלאה.");
      return null;
    }

    const hasPeriodMonth = uploadForm.periodMonth.trim().length > 0;
    const hasPeriodYear = uploadForm.periodYear.trim().length > 0;

    if (hasPeriodMonth !== hasPeriodYear) {
      setUploadState("error");
      setUploadMessage("אם מזינים חודש, חייבים להזין גם שנה ולהפך.");
      return null;
    }

    const periodMonth = hasPeriodMonth ? Number(uploadForm.periodMonth) : undefined;
    const periodYear = hasPeriodYear ? Number(uploadForm.periodYear) : undefined;

    if (periodMonth !== undefined && (!Number.isInteger(periodMonth) || periodMonth < 1 || periodMonth > 12)) {
      setUploadState("error");
      setUploadMessage("חודש חייב להיות מספר בין 1 ל-12.");
      return null;
    }

    if (periodYear !== undefined && (!Number.isInteger(periodYear) || periodYear < 2000 || periodYear > 2100)) {
      setUploadState("error");
      setUploadMessage("שנה חייבת להיות מספר בין 2000 ל-2100.");
      return null;
    }

    if (uploadForm.documentDate) {
      const parsedDate = new Date(uploadForm.documentDate);
      if (Number.isNaN(parsedDate.getTime())) {
        setUploadState("error");
        setUploadMessage("תאריך המסמך אינו תקין.");
        return null;
      }
    }

    return {
      category: uploadForm.category,
      ...(periodMonth !== undefined && { periodMonth }),
      ...(periodYear !== undefined && { periodYear }),
      ...(uploadForm.documentDate && { documentDate: uploadForm.documentDate }),
    };
  };

  const handlePickFile = (file: File | null) => {
    clearTimers();
    setUploadMessage("");

    if (!file) {
      setSelectedFile(null);
      setUploadState("idle");
      return;
    }

    const isPdf =
      file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
    const maxSize = 10 * 1024 * 1024;

    if (!isPdf) {
      setSelectedFile(null);
      setUploadState("error");
      setUploadMessage("ניתן להעלות רק קובצי PDF.");
      return;
    }

    if (file.size > maxSize) {
      setSelectedFile(null);
      setUploadState("error");
      setUploadMessage("הקובץ גדול מדי. מקסימום 10MB.");
      return;
    }

    setSelectedFile(file);
    setUploadState("idle");
  };

  const handleUpload = async () => {
    clearTimers();

    if (!selectedFile) {
      setUploadState("error");
      setUploadMessage("נא לבחור קובץ פי-די-אף לפני ההעלאה.");
      return;
    }

    const file = selectedFile;
    const metadataPayload = buildUploadPayload();

    if (!metadataPayload) {
      return;
    }

    const tempId = `temp-${Date.now()}`;
    const tempDoc: DocumentItem = {
      id: tempId,
      name: file.name,
      status: "uploading",
      fileSize: file.size,
      uploadedAt: new Date().toISOString(),
      metadata: {
        category: metadataPayload.category,
        ...(metadataPayload.periodMonth !== undefined && {
          periodMonth: metadataPayload.periodMonth,
        }),
        ...(metadataPayload.periodYear !== undefined && {
          periodYear: metadataPayload.periodYear,
        }),
        ...(metadataPayload.documentDate && {
          documentDate: metadataPayload.documentDate,
        }),
        source: "manual_upload",
      },
    };

    setDocuments((prev) => [tempDoc, ...prev]);
    setUploadState("uploading");
    setUploadMessage("מעלה קובץ...");
    setSelectedFile(null);

    const response = await uploadDocument(file, metadataPayload);

    if (!response.success || !response.data) {
      setUploadState("error");
      setUploadMessage(response.message || "שגיאה בהעלאת הקובץ.");
      setDocuments((prev) =>
        prev.map((doc) =>
          doc.id === tempId ? { ...doc, status: "failed" } : doc,
        ),
      );
      return;
    }

    const uploadedDoc = response.data;
    setUploadState("uploaded");
    setUploadMessage("המסמך נשמר וממתין לעיבוד.");
    setDocuments((prev) =>
      prev.map((doc) => (doc.id === tempId ? mapApiDocument(uploadedDoc) : doc)),
    );
    setToastMessage("המסמך נשמר וממתין לעיבוד.");
    setUploadForm(DEFAULT_UPLOAD_FORM);
    const toastTimer = window.setTimeout(() => setToastMessage(null), 5000);
    timersRef.current.push(toastTimer);

    const finalizeTimer = window.setTimeout(() => {
      setUploadMessage("");
      setUploadState("idle");
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }, 400);

    timersRef.current.push(finalizeTimer);
  };

  const handleDelete = async (doc: DocumentItem) => {
    if (doc.id.startsWith("temp-")) return;
    if (!window.confirm(`למחוק את המסמך "${doc.name}"?`)) return;

    setActionError("");
    setDeletingIds((prev) => addUniqueId(prev, doc.id));

    const response = await removeDocument(doc.id);
    if (!response.success) {
      setActionError(response.message || "שגיאה במחיקת המסמך.");
      setDeletingIds((prev) => removeId(prev, doc.id));
      return;
    }

    setDocuments((prev) => prev.filter((item) => item.id !== doc.id));
    setDeletingIds((prev) => removeId(prev, doc.id));
  };

  const handleDownload = async (doc: DocumentItem) => {
    if (doc.id.startsWith("temp-")) return;

    setActionError("");
    setDownloadingIds((prev) => addUniqueId(prev, doc.id));

    const response = await downloadDocument(doc.id);
    if (!response.success || !response.blob) {
      setActionError(response.message || "שגיאה בהורדת המסמך.");
      setDownloadingIds((prev) => removeId(prev, doc.id));
      return;
    }

    const url = window.URL.createObjectURL(response.blob);
    const link = window.document.createElement("a");
    link.href = url;
    link.download = response.filename || doc.name || "document.pdf";
    window.document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
    setDownloadingIds((prev) => removeId(prev, doc.id));
  };

  const handleBrowse = () => {
    fileInputRef.current?.click();
  };

  const hasUploadedDocuments = documents.some((doc) => doc.status !== "failed");

  return (
    <div className="documents-page" dir="rtl">
      <PrivateTopbar />

      <main className="documents-main landing-container">
        <section className="documents-header">
          <h1>מסמכים</h1>
          <p>
            העלו מסמכי פי-די-אף כדי לעקוב אחר תלושי שכר, דוחות מס ותיעוד פיננסי.
            הקובץ נשמר מיד, והעיבוד ממשיך ברקע.
          </p>
        </section>

        <UploadArea
          state={uploadState}
          fileName={selectedFile?.name ?? null}
          message={uploadMessage}
          isUploading={uploadState === "uploading"}
          inputRef={fileInputRef}
          metadata={uploadForm}
          onBrowse={handleBrowse}
          onPickFile={handlePickFile}
          onMetadataChange={handleMetadataChange}
          onUpload={handleUpload}
        />

        <section className="documents-list">
          <div className="documents-list-header">
            <h2>המסמכים שלכם</h2>
            <div className="documents-list-header-actions">
              <span>{documents.length} קבצים</span>
              <button
                type="button"
                className="dashboard-hero-action"
                onClick={() => void handleRefresh()}
                disabled={isRefreshing}
              >
                {isRefreshing ? <Loader /> : "רענן"}
              </button>
            </div>
          </div>
          {actionError ? (
            <div className="documents-inline-error">{actionError}</div>
          ) : null}

          {listError ? (
            <div className="documents-card empty-state">
              <h3>לא הצלחנו לטעון מסמכים</h3>
              <p>{listError}</p>
            </div>
          ) : isLoadingList ? (
            <div className="documents-card empty-state">
              <h3>טוענים מסמכים...</h3>
              <p>עוד רגע ונציג את הרשימה.</p>
            </div>
          ) : documents.length === 0 ? (
            <EmptyState />
          ) : (
            <div className="documents-list-rows">
              {documents.map((doc) => (
                <DocumentCard
                  key={doc.id}
                  document={doc}
                  onDelete={handleDelete}
                  onDownload={handleDownload}
                  isDeleting={deletingIds.includes(doc.id)}
                  isDownloading={downloadingIds.includes(doc.id)}
                />
              ))}
            </div>
          )}
        </section>

        <section className="documents-actions">
          <button
            className="landing-primary"
            type="button"
            disabled={!hasUploadedDocuments}
            onClick={() => navigate(APP_ROUTES.documentsScan)}
          >
            סריקת הקבצים שהועלו (דמו)
          </button>
          <span className="documents-note">
            עיבוד המסמכים פועל ברקע. מסך הסריקה עצמו נשאר דמו בלבד.
          </span>
        </section>
      </main>

      <AppFooter variant="private" />

      <ToastContainer>
        {toastMessage ? (
          <Toast message={toastMessage} onDismiss={() => setToastMessage(null)} />
        ) : null}
      </ToastContainer>
    </div>
  );
}
