import { useCallback, useEffect, useRef, useState } from "react";
import type { RefObject } from "react";
import { useNavigate } from "react-router-dom";
import { Mail } from "lucide-react";
import Loader from "../components/ui/Loader";
import Toast from "../components/ui/Toast";
import ToastContainer from "../components/ui/ToastContainer";
import AppFooter from "../components/AppFooter";
import PrivateTopbar from "../components/PrivateTopbar";
import {
  listDocuments,
  uploadDocument,
  unlockDocument,
  downloadDocument,
  removeDocument,
  type DocumentItem as ApiDocumentItem,
  type DocumentCategory,
  type DocumentMetadata,
  type UploadDocumentPayload,
} from "../api/documents.api";
import { APP_ROUTES } from "../types/navigation";
import DocsTabBar from "../components/tabs/DocsTabBar";
import {
  DOCUMENT_CATEGORY_LABELS,
  formatDocumentMetadataSummary,
} from "../utils/documentMetadata";
import { getDocumentImportSourceLabel } from "../utils/documentSource";
import { getApiErrorMessage } from "../utils/apiErrorMessages";
import { detectPayslipMetadataFromFilename } from "../utils/detectPayslipMetadataFromFilename";

type UploadState = "idle" | "uploading" | "uploaded" | "error";

type DocumentStatus =
  | "uploading"
  | "pending"
  | "processing"
  | "completed"
  | "needs_password"
  | "failed";

interface DocumentItem {
  id: string;
  name: string;
  status: DocumentStatus;
  fileSize?: number;
  uploadedAt?: string;
  metadata: DocumentMetadata;
  source?: ApiDocumentItem["source"];
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
  if (status === "needs_password") return "needs_password";
  if (status === "failed") return "failed";
  if (status === "uploaded") return "pending";
  return "pending";
};

const mapApiDocument = (document: ApiDocumentItem): DocumentItem => ({
  id: document.id ?? document._id,
  name: document.originalName,
  status: mapStatus(document.status),
  fileSize: document.fileSize,
  uploadedAt: document.uploadedAt,
  source: document.source,
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
  needs_password: "נדרשת סיסמה",
  failed: "נכשל",
};

const GMAIL_READONLY_SCOPE = "https://www.googleapis.com/auth/gmail.readonly";

interface UploadAreaProps {
  state: UploadState;
  fileName: string | null;
  message: string;
  isUploading: boolean;
  inputRef: RefObject<HTMLInputElement | null>;
  bulkInputRef: RefObject<HTMLInputElement | null>;
  metadata: UploadFormState;
  onBrowse: () => void;
  onBulkBrowse: () => void;
  onBulkFilesSelected: (files: FileList) => void;
  onPickFile: (file: File | null) => void;
  onMetadataChange: (field: keyof UploadFormState, value: string) => void;
  onUpload: () => void;
  bulkUploadCount: number;
}

function UploadArea({
  state,
  fileName,
  message,
  isUploading,
  inputRef,
  bulkInputRef,
  metadata,
  onBrowse,
  onBulkBrowse,
  onBulkFilesSelected,
  onPickFile,
  onMetadataChange,
  onUpload,
  bulkUploadCount,
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
          accept="application/pdf,.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          onChange={(event) => onPickFile(event.target.files?.[0] ?? null)}
        />
        <input
          ref={bulkInputRef}
          className="upload-input"
          type="file"
          multiple
          accept="application/pdf,.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          onChange={(event) => {
            const files = event.target.files;
            if (files && files.length > 0) onBulkFilesSelected(files);
          }}
        />
        <div className="upload-icon" aria-hidden="true">
          ↑
        </div>
        <h3>גררו ושחררו את הקובץ כאן</h3>
        <p>או בחרו קובץ מהמחשב שלכם</p>
        <div className="upload-buttons-row">
          <button
            className="landing-primary"
            type="button"
            onClick={() => (fileName ? onUpload() : onBrowse())}
            disabled={isUploading}
          >
            {isUploading ? <Loader /> : "העלה קובץ"}
          </button>
          <button
            className="upload-bulk-btn"
            type="button"
            onClick={onBulkBrowse}
            disabled={isUploading || bulkUploadCount > 0}
            title="בחרו מספר קבצים להעלאה בו-זמנית"
          >
            {bulkUploadCount > 0 ? `מעלה ${bulkUploadCount} קבצים...` : "העלאת מסמכים מרובה"}
          </button>
        </div>
        <span className="upload-hint">PDF או XLSX (הר הביטוח) • עד 10 מ"ב</span>
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
        {fileName && (
          <button
            className="upload-submit-btn"
            type="button"
            onClick={onUpload}
            disabled={isUploading}
          >
            {isUploading ? "מעלה..." : "⬆ שמור והעלה"}
          </button>
        )}
      </div>
    </div>
  );
}

interface DocumentCardProps {
  document: DocumentItem;
  onDownload: (document: DocumentItem) => void;
  onDelete: (document: DocumentItem) => void;
  onViewDetails: (document: DocumentItem) => void;
  onUnlockPassword: (document: DocumentItem, password: string) => Promise<void>;
  isDeleting: boolean;
  isDownloading: boolean;
  isUnlocking: boolean;
}

function DocumentCard({
  document,
  onDownload,
  onDelete,
  onViewDetails,
  onUnlockPassword,
  isDeleting,
  isDownloading,
  isUnlocking,
}: DocumentCardProps) {
  const [pdfPassword, setPdfPassword] = useState("");
  const statusClass =
    document.status === "completed"
      ? "uploaded"
      : document.status === "pending" || document.status === "processing"
        ? "uploading"
        : document.status;
  const isTemp = document.id.startsWith("temp-");
  const isUploading = document.status === "uploading";
  const isFailed = document.status === "failed";
  const needsPassword = document.status === "needs_password";
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
            getDocumentImportSourceLabel(document),
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
      {needsPassword ? (
        <div className="document-password-panel">
          <p>קובץ ה-PDF מוגן בסיסמה. הסיסמה משמשת רק לפתיחה ועיבוד — לא נשמרת במערכת.</p>
          <label className="document-password-field">
            <span>סיסמת PDF</span>
            <input
              type="password"
              value={pdfPassword}
              onChange={(event) => setPdfPassword(event.target.value)}
              autoComplete="off"
              disabled={isUnlocking}
            />
          </label>
          <label className="document-password-remember">
            <input type="checkbox" disabled />
            <span>שמור סיסמה מוצפנת עבור תלושים עתידיים מאותו מעסיק (בקרוב)</span>
          </label>
          <button
            type="button"
            className="document-action"
            disabled={isUnlocking || !pdfPassword.trim()}
            onClick={() => void onUnlockPassword(document, pdfPassword.trim())}
          >
            {isUnlocking ? "פותח..." : "פתח והמשך עיבוד"}
          </button>
        </div>
      ) : null}
      <div className="document-actions">
        <button
          className="document-action"
          type="button"
          onClick={() => onViewDetails(document)}
          disabled={isTemp || isUploading}
        >
          פרטי תלוש
        </button>
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
  const [unlockingIds, setUnlockingIds] = useState<string[]>([]);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadForm, setUploadForm] = useState<UploadFormState>(DEFAULT_UPLOAD_FORM);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [bulkUploadCount, setBulkUploadCount] = useState(0);
  const timersRef = useRef<number[]>([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const bulkFileInputRef = useRef<HTMLInputElement | null>(null);

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
    setUploadForm((prev) => {
      const next = { ...prev, [field]: value };
      // Auto-derive periodMonth / periodYear from documentDate
      if (field === "documentDate" && value) {
        const d = new Date(value);
        if (!Number.isNaN(d.getTime())) {
          if (!next.periodMonth) next.periodMonth = String(d.getMonth() + 1);
          if (!next.periodYear)  next.periodYear  = String(d.getFullYear());
        }
      }
      return next;
    });
  };

  const buildUploadPayload = (): UploadDocumentPayload | null => {
    if (!uploadForm.category) {
      setUploadState("error");
      setUploadMessage("נא לבחור קטגוריית מסמך לפני ההעלאה.");
      return null;
    }

    // Derive missing month/year from documentDate before validation
    let { periodMonth, periodYear, documentDate, category } = uploadForm;
    if (documentDate && (!periodYear || !periodMonth)) {
      const d = new Date(documentDate);
      if (!Number.isNaN(d.getTime())) {
        if (!periodMonth) periodMonth = String(d.getMonth() + 1);
        if (!periodYear)  periodYear  = String(d.getFullYear());
      }
    }

    const hasPeriodMonth = periodMonth.trim().length > 0;
    const hasPeriodYear = periodYear.trim().length > 0;

    if (hasPeriodMonth !== hasPeriodYear) {
      setUploadState("error");
      setUploadMessage("אם מזינים חודש, חייבים להזין גם שנה ולהפך.");
      return null;
    }

    const parsedMonth = hasPeriodMonth ? Number(periodMonth) : undefined;
    const parsedYear = hasPeriodYear ? Number(periodYear) : undefined;

    if (parsedMonth !== undefined && (!Number.isInteger(parsedMonth) || parsedMonth < 1 || parsedMonth > 12)) {
      setUploadState("error");
      setUploadMessage("חודש חייב להיות מספר בין 1 ל-12.");
      return null;
    }

    if (parsedYear !== undefined && (!Number.isInteger(parsedYear) || parsedYear < 2000 || parsedYear > 2100)) {
      setUploadState("error");
      setUploadMessage("שנה חייבת להיות מספר בין 2000 ל-2100.");
      return null;
    }

    if (documentDate) {
      const parsedDate = new Date(documentDate);
      if (Number.isNaN(parsedDate.getTime())) {
        setUploadState("error");
        setUploadMessage("תאריך המסמך אינו תקין.");
        return null;
      }
    }

    return {
      category,
      ...(parsedMonth !== undefined && { periodMonth: parsedMonth }),
      ...(parsedYear  !== undefined && { periodYear:  parsedYear }),
      ...(documentDate && { documentDate }),
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
    const isXlsx =
      file.name.toLowerCase().endsWith(".xlsx") || file.name.toLowerCase().endsWith(".xls") ||
      file.type === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    const maxSize = 10 * 1024 * 1024;

    if (!isPdf && !isXlsx) {
      setSelectedFile(null);
      setUploadState("error");
      setUploadMessage("ניתן להעלות קובצי PDF או XLSX (הר הביטוח).");
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

    // Auto-set category for known file types
    setUploadForm((prev) => {
      if (prev.category) return prev;
      if (isXlsx) return { ...prev, category: "other" as DocumentCategory };
      return prev;
    });

    // Auto-fill year/month from filename (e.g. PaySlip2026-05.pdf or 2026_05_payslip.pdf)
    setUploadForm((prev) => {
      if (prev.periodYear && prev.periodMonth) return prev; // already filled
      const name = file.name;
      // Match patterns like 2026-05, 2026_05, 202605, 05-2026, 05_2026
      const patterns = [
        /(?:^|[\D])(20\d{2})[\-_\.](\d{1,2})(?:[\D]|$)/, // 2026-05
        /(?:^|[\D])(\d{1,2})[\-_\.](20\d{2})(?:[\D]|$)/, // 05-2026
        /(20\d{2})(\d{2})(?:[\D]|$)/,                     // 202605
      ];
      for (const pat of patterns) {
        const m = pat.exec(name);
        if (m) {
          const a = parseInt(m[1]), b = parseInt(m[2]);
          const [year, month] = a > 100 ? [a, b] : [b, a];
          if (year >= 2000 && year <= 2100 && month >= 1 && month <= 12) {
            return {
              ...prev,
              periodYear:  prev.periodYear  || String(year),
              periodMonth: prev.periodMonth || String(month),
            };
          }
        }
      }
      return prev;
    });
  };

  const handleUpload = async () => {
    clearTimers();

    if (!selectedFile) {
      setUploadState("error");
      setUploadMessage("נא לבחור קובץ PDF לפני ההעלאה.");
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
          source: "manual_upload",
          ...(metadataPayload.periodMonth !== undefined && {
            periodMonth: metadataPayload.periodMonth,
          }),
          ...(metadataPayload.periodYear !== undefined && {
            periodYear: metadataPayload.periodYear,
          }),
          ...(metadataPayload.documentDate && {
            documentDate: metadataPayload.documentDate,
          }),
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
    const toastTimer = window.setTimeout(() => setToastMessage(null), 5000);
    timersRef.current.push(toastTimer);

    // רענון הרשימה מהשרת כדי לוודא שהמסמכים מסונכרנים
    loadDocuments();

    navigate(`${APP_ROUTES.documentsScan}?documentId=${uploadedDoc._id}`);

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

  const handleViewDetails = (doc: DocumentItem) => {
    if (doc.id.startsWith("temp-")) return;
    navigate(`/documents/${doc.id}`);
  };

  const handleUnlockPassword = async (doc: DocumentItem, password: string) => {
    if (doc.id.startsWith("temp-")) return;

    setActionError("");
    setUnlockingIds((prev) => addUniqueId(prev, doc.id));

    const response = await unlockDocument(doc.id, password);
    if (response.data) {
      setDocuments((prev) =>
        prev.map((item) => (item.id === doc.id ? mapApiDocument(response.data!) : item)),
      );
    }
    if (!response.success || !response.data) {
      setActionError(response.message || "פתיחת הקובץ נכשלה.");
      setUnlockingIds((prev) => removeId(prev, doc.id));
      return;
    }
    setUnlockingIds((prev) => removeId(prev, doc.id));
    setToastMessage(
      response.data.status === "completed"
        ? "המסמך נפתח ועובד בהצלחה."
        : "המסמך נפתח — ייתכן שיידרשו השלמות נוספות.",
    );
    window.setTimeout(() => setToastMessage(null), 5000);
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

  const handleBulkBrowse = () => {
    bulkFileInputRef.current?.click();
  };

  const handleBulkUpload = async (files: FileList) => {
    const validFiles: File[] = [];
    const maxSize = 10 * 1024 * 1024;

    for (const file of Array.from(files)) {
      const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
      const isXlsx =
        file.name.toLowerCase().endsWith(".xlsx") ||
        file.name.toLowerCase().endsWith(".xls") ||
        file.type === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

      if ((!isPdf && !isXlsx) || file.size > maxSize) continue;
      validFiles.push(file);
    }

    if (validFiles.length === 0) {
      setToastMessage("לא נמצאו קבצים תקינים להעלאה.");
      return;
    }

    setBulkUploadCount(validFiles.length);

    const tempDocs: DocumentItem[] = validFiles.map((file) => {
      const meta = detectPayslipMetadataFromFilename(file);
      return {
        id: `temp-bulk-${Date.now()}-${Math.random()}`,
        name: file.name,
        status: "uploading" as DocumentStatus,
        fileSize: file.size,
        uploadedAt: new Date().toISOString(),
        metadata: {
          category: meta.category,
          source: "manual_upload",
          ...(meta.periodMonth !== undefined && { periodMonth: meta.periodMonth }),
          ...(meta.periodYear !== undefined && { periodYear: meta.periodYear }),
        },
      };
    });

    setDocuments((prev) => [...tempDocs, ...prev]);

    const results = await Promise.allSettled(
      validFiles.map(async (file, idx) => {
        const payload = detectPayslipMetadataFromFilename(file);
        const response = await uploadDocument(file, payload);
        return { file, tempId: tempDocs[idx].id, response };
      }),
    );

    let successCount = 0;
    let failCount = 0;

    for (const result of results) {
      if (result.status === "fulfilled") {
        const { tempId, response } = result.value;
        if (response.success && response.data) {
          successCount++;
          setDocuments((prev) =>
            prev.map((doc) => (doc.id === tempId ? mapApiDocument(response.data!) : doc)),
          );
        } else {
          failCount++;
          setDocuments((prev) =>
            prev.map((doc) => (doc.id === tempId ? { ...doc, status: "failed" as DocumentStatus } : doc)),
          );
        }
      } else {
        failCount++;
      }
    }

    setBulkUploadCount(0);
    if (bulkFileInputRef.current) bulkFileInputRef.current.value = "";

    const parts: string[] = [];
    if (successCount > 0) parts.push(`${successCount} קבצים הועלו בהצלחה`);
    if (failCount > 0) parts.push(`${failCount} נכשלו`);
    setToastMessage(parts.join(" · "));
    const t = window.setTimeout(() => setToastMessage(null), 6000);
    timersRef.current.push(t);

    void loadDocuments();
  };

  const hasUploadedDocuments = documents.some((doc) => doc.status !== "failed");
  const latestProcessableDocument =
    documents.find(
      (doc) => !doc.id.startsWith("temp-") && doc.status !== "failed",
    ) ?? null;

  return (
    <div className="documents-page" dir="rtl">
      <PrivateTopbar />
      <DocsTabBar />

      <main className="documents-main landing-container">
        <section className="documents-header">
          <h1>העלאת מסמכים</h1>
          <p>
            העלו מסמכי PDF כדי לעקוב אחר תלושי שכר, דוחות מס ותיעוד פיננסי.
            הקובץ נשמר מיד, והעיבוד ממשיך ברקע.
          </p>
        </section>

        <UploadArea
          state={uploadState}
          fileName={selectedFile?.name ?? null}
          message={uploadMessage}
          isUploading={uploadState === "uploading"}
          inputRef={fileInputRef}
          bulkInputRef={bulkFileInputRef}
          metadata={uploadForm}
          onBrowse={handleBrowse}
          onBulkBrowse={handleBulkBrowse}
          onBulkFilesSelected={handleBulkUpload}
          onPickFile={handlePickFile}
          onMetadataChange={handleMetadataChange}
          onUpload={handleUpload}
          bulkUploadCount={bulkUploadCount}
        />

        <section className="documents-card documents-gmail-import">
          <div className="documents-gmail-import-head">
            <Mail size={22} aria-hidden="true" />
            <div>
              <h2>ייבוא תלושים מהמייל</h2>
              <p>חברו Gmail וייבאו תלושי שכר מצורפי PDF — גישה לקריאה בלבד.</p>
            </div>
          </div>
          <ul className="documents-gmail-permissions">
            <li>גישת Gmail לקריאה בלבד ({GMAIL_READONLY_SCOPE})</li>
            <li>חיפוש רק במיילים הקשורים לתלושי שכר</li>
            <li>ייבוא מצורפי PDF בלבד</li>
            <li>לא נשלח, לא נמחק ולא ישתנה שום דבר בתיבת המייל</li>
          </ul>
          <button
            type="button"
            className="landing-primary documents-gmail-import-btn"
            onClick={() =>
              navigate(`${APP_ROUTES.integrationsEmail}?from=documents`)
            }
          >
            ייבוא תלושים מהמייל
          </button>
        </section>

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
                  onViewDetails={handleViewDetails}
                  onUnlockPassword={handleUnlockPassword}
                  isDeleting={deletingIds.includes(doc.id)}
                  isDownloading={downloadingIds.includes(doc.id)}
                  isUnlocking={unlockingIds.includes(doc.id)}
                />
              ))}
            </div>
          )}
        </section>

        <section className="documents-actions">
          <button
            className="landing-primary"
            type="button"
            disabled={!hasUploadedDocuments || !latestProcessableDocument}
            onClick={() =>
              latestProcessableDocument
                ? navigate(
                    `${APP_ROUTES.documentsScan}?documentId=${latestProcessableDocument.id}`,
                  )
                : undefined
            }
          >
            מעבר לעיבוד וניתוח המסמכים
          </button>
          <span className="documents-note">
            עיבוד המסמכים פועל ברקע. מסך הסריקה הוא להדגמה בלבד.
          </span>
        </section>
      </main>

      <AppFooter variant="private" />

      <ToastContainer>
        {toastMessage ? (
          <Toast
            message={toastMessage}
            variant="success"
            onDismiss={() => setToastMessage(null)}
          />
        ) : null}
      </ToastContainer>
    </div>
  );
}
