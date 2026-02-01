import { useEffect, useRef, useState } from "react";
import type { RefObject } from "react";
import { useNavigate } from "react-router-dom";
import Loader from "../components/ui/Loader";

type UploadState = "idle" | "uploading" | "uploaded" | "error";

type DocumentStatus = "uploaded" | "uploading" | "failed";

interface DocumentItem {
  id: string;
  name: string;
  status: DocumentStatus;
}

const mockDocuments: DocumentItem[] = [];
const STORAGE_KEY = "documents_uploads";

const statusLabels: Record<DocumentStatus, string> = {
  uploaded: "הקובץ עלה בהצלחה",
  uploading: "מעלה קובץ...",
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

function DocumentCard({ document }: { document: DocumentItem }) {
  const statusIcon =
    document.status === "uploading" ? (
      <span className="status-spinner" aria-hidden="true" />
    ) : (
      <span className="status-symbol" aria-hidden="true">
        {document.status === "uploaded" ? "✓" : "!"}
      </span>
    );

  return (
    <div className="document-row">
      <span className={`status-icon status-${document.status}`}>{statusIcon}</span>
      <span className="document-name">{document.name}</span>
      <span className="document-status">{statusLabels[document.status]}</span>
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
  const [documents, setDocuments] = useState<DocumentItem[]>(() => {
    // TODO: Replace localStorage persistence with backend data once available.
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        return mockDocuments;
      }
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) {
        return mockDocuments;
      }
      return parsed.filter((item) => {
        if (!item || typeof item !== "object") {
          return false;
        }
        const status = (item as DocumentItem).status;
        return (
          typeof (item as DocumentItem).id === "string" &&
          typeof (item as DocumentItem).name === "string" &&
          (status === "uploaded" || status === "uploading" || status === "failed")
        );
      }) as DocumentItem[];
    } catch {
      return mockDocuments;
    }
  });
  const [uploadState, setUploadState] = useState<UploadState>("idle");
  const [uploadMessage, setUploadMessage] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const timersRef = useRef<number[]>([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    // TODO: Replace localStorage persistence with backend data once available.
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(documents));
    } catch {
      // Ignore storage errors to keep UX stable.
    }
  }, [documents]);

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

    if (!isPdf) {
      setSelectedFile(null);
      setUploadState("error");
      setUploadMessage("ניתן להעלות רק קובצי פי-די-אף.");
      return;
    }

    setSelectedFile(file);
    setUploadState("idle");
  };

  const handleUpload = () => {
    clearTimers();

    if (!selectedFile) {
      setUploadState("error");
      setUploadMessage("נא לבחור קובץ פי-די-אף לפני ההעלאה.");
      return;
    }

    const file = selectedFile;
    const newDoc: DocumentItem = {
      id: `doc-${Date.now()}`,
      name: file.name,
      status: "uploading",
    };

    setDocuments((prev) => [newDoc, ...prev]);
    setUploadState("uploading");
    setUploadMessage("מעלה קובץ...");
    setSelectedFile(null);

    const uploadTimer = window.setTimeout(() => {
      setUploadState("uploaded");
      setUploadMessage("הקובץ עלה בהצלחה");

      setDocuments((prev) =>
        prev.map((doc) =>
          doc.id === newDoc.id ? { ...doc, status: "uploaded" } : doc,
        ),
      );

      const finalizeTimer = window.setTimeout(() => {
        setUploadMessage("");
        setUploadState("idle");
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
      }, 400);

      timersRef.current.push(finalizeTimer);
    }, 900);

    timersRef.current.push(uploadTimer);
  };

  const handleBrowse = () => {
    fileInputRef.current?.click();
  };

  const hasUploadedDocuments = documents.some((doc) => doc.status === "uploaded");

  return (
    <div className="documents-page" dir="rtl">
      <header className="documents-nav landing-container">
        <div className="landing-logo">
          <span className="landing-logo-badge" aria-hidden="true">
            ✦
          </span>
          <span>FinGuide</span>
        </div>
        <button className="landing-secondary" type="button" onClick={() => navigate("/dashboard")}>
          חזרה ללוח הבקרה
        </button>
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

          {documents.length === 0 ? (
            <EmptyState />
          ) : (
            <div className="documents-list-rows">
              {documents.map((doc) => (
                <DocumentCard key={doc.id} document={doc} />
              ))}
            </div>
          )}
        </section>

        <section className="documents-actions">
          <button
            className="landing-primary"
            type="button"
            disabled={!hasUploadedDocuments}
            onClick={() => navigate("/scan")}
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
