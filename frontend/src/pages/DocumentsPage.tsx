import { useCallback, useEffect, useRef, useState } from "react";
import type { RefObject } from "react";
import { useNavigate } from "react-router-dom";
import Loader from "../components/ui/Loader";
import {
  listDocuments,
  uploadDocument,
  downloadDocument,
  removeDocument,
  type DocumentItem as ApiDocumentItem,
} from "../api/documents.api";
import { APP_ROUTES } from "../types/navigation";
import { logoutWithConfirm } from "../utils/logout";

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
}

const addUniqueId = (ids: string[], id: string) =>
  ids.includes(id) ? ids : [...ids, id];

const removeId = (ids: string[], id: string) => ids.filter((item) => item !== id);

const mapStatus = (status?: ApiDocumentItem["status"]): DocumentStatus => {
  if (status === "completed") return "completed";
  if (status === "processing") return "processing";
  if (status === "failed") return "failed";
  return "pending";
};

const mapApiDocument = (document: ApiDocumentItem): DocumentItem => ({
  id: document._id,
  name: document.originalName,
  status: mapStatus(document.status),
  fileSize: document.fileSize,
  uploadedAt: document.uploadedAt,
});

const statusLabels: Record<DocumentStatus, string> = {
  uploading: "מעלה קובץ...",
  pending: "הקובץ הועלה - ממתין לעיבוד",
  processing: "המסמך בעיבוד",
  completed: "העיבוד הושלם",
  failed: "העלאת הקובץ נכשלה",
};

interface UploadAreaProps {
  state: UploadState;
  fileName: string | null;
  message: string;
  isUploading: boolean;
  inputRef: RefObject<HTMLInputElement | null>;
  onBrowse: () => void;
  onPickFile: (file: File | null) => void;
  onUpload: () => void;
}

function UploadArea({
  state,
  fileName,
  message,
  isUploading,
  inputRef,
  onBrowse,
  onPickFile,
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
      <span className="document-name">{document.name}</span>
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
  const timersRef = useRef<number[]>([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const loadDocuments = useCallback(async () => {
    const response = await listDocuments();

    if (response.success && Array.isArray(response.data)) {
      setDocuments(response.data.map(mapApiDocument));
      setListError("");
    } else {
      setDocuments([]);
      setListError(response.message || "לא הצלחנו לטעון את המסמכים.");
    }

    setIsLoadingList(false);
  }, []);

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
    const tempId = `temp-${Date.now()}`;
    const tempDoc: DocumentItem = {
      id: tempId,
      name: file.name,
      status: "uploading",
      fileSize: file.size,
      uploadedAt: new Date().toISOString(),
    };

    setDocuments((prev) => [tempDoc, ...prev]);
    setUploadState("uploading");
    setUploadMessage("מעלה קובץ...");
    setSelectedFile(null);

    const response = await uploadDocument(file);

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
    setUploadMessage("הקובץ עלה בהצלחה");
    setDocuments((prev) =>
      prev.map((doc) => (doc.id === tempId ? mapApiDocument(uploadedDoc) : doc)),
    );

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
      <header className="documents-nav landing-container">
        <div className="landing-logo">
          <span className="landing-logo-badge" aria-hidden="true">
            ✦
          </span>
          <span>FinGuide</span>
        </div>
        <div className="documents-nav-actions">
          <button
            className="landing-secondary"
            type="button"
            onClick={() => navigate(APP_ROUTES.dashboard)}
          >
            חזרה ללוח הבקרה
          </button>
          <button
            className="landing-secondary documents-logout-action"
            type="button"
            onClick={() => logoutWithConfirm(navigate)}
          >
            התנתקות
          </button>
        </div>
      </header>

      <main className="documents-main landing-container">
        <section className="documents-header">
          <h1>מסמכים</h1>
          <p>
            העלו מסמכי פי-די-אף כדי לעקוב אחר תלושי שכר, דוחות מס ותיעוד פיננסי.
            שלב הסריקה יתווסף בהמשך.
          </p>
        </section>

        <UploadArea
          state={uploadState}
          fileName={selectedFile?.name ?? null}
          message={uploadMessage}
          isUploading={uploadState === "uploading"}
          inputRef={fileInputRef}
          onBrowse={handleBrowse}
          onPickFile={handlePickFile}
          onUpload={handleUpload}
        />

        <section className="documents-list">
          <div className="documents-list-header">
            <h2>המסמכים שלכם</h2>
            <span>{documents.length} קבצים</span>
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
            onClick={() => {
              // שלב הסריקה טרם הוטמע – נשמור על כפתור זמין ונתעדכן בהמשך.
            }}
          >
            סריקת הקבצים שהועלו
          </button>
          <span className="documents-note">
            {/* TODO: Wire scanning step once OCR backend is available. */}
            שלב הסריקה יופעל לאחר חיבור מנוע זיהוי התווים.
          </span>
        </section>
      </main>
    </div>
  );
}
