import {
  ArrowUpRight,
  BarChart3,
  FileText,
  MessageSquare,
  ShieldCheck,
  Sparkles,
  Trash2,
  Upload,
  Download,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { chatWithAI } from "../api/ai.api";
import { getMe } from "../api/auth.api";
import {
  downloadDocument,
  listDocuments,
  removeDocument,
  uploadDocument,
  type DocumentItem,
  type DocumentStatus,
} from "../api/documents.api";
import { listFindings, type FindingItem, type FindingSeverity } from "../api/findings.api";
import { getHealth } from "../api/health.api";
import Loader from "../components/ui/Loader";
import { APP_ROUTES } from "../types/navigation";
import { logoutWithConfirm } from "../utils/logout";

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  model?: string;
};

const formatNumber = new Intl.NumberFormat("he-IL");
const formatCurrency = new Intl.NumberFormat("he-IL", {
  style: "currency",
  currency: "ILS",
  maximumFractionDigits: 0,
});

const formatDate = (value?: string) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("he-IL", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
};

const formatFileSize = (bytes?: number) => {
  if (!bytes && bytes !== 0) return "—";
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
};

const statusLabels: Record<DocumentStatus, string> = {
  pending: "ממתין לעיבוד",
  processing: "בעיבוד",
  completed: "מוכן",
  failed: "שגיאה",
};

const findingSeverityLabels: Record<FindingSeverity, string> = {
  info: "מידע",
  warning: "אזהרה",
};

const addUniqueId = (ids: string[], id: string) =>
  ids.includes(id) ? ids : [...ids, id];

const removeId = (ids: string[], id: string) => ids.filter((item) => item !== id);

const promptSuggestions = [
  "כמה מסמכים הועלו החודש?",
  "תסכם לי את מצב המסמכים שלי",
  "איזו פעולה הכי חשובה כרגע?",
];

export default function DashboardPage() {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const chatEndRef = useRef<HTMLDivElement | null>(null);

  const [userName, setUserName] = useState("היי");
  const [userError, setUserError] = useState("");
  const [isUserLoading, setIsUserLoading] = useState(true);

  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [documentsError, setDocumentsError] = useState("");
  const [isDocumentsLoading, setIsDocumentsLoading] = useState(true);

  const [findings, setFindings] = useState<FindingItem[]>([]);
  const [findingsError, setFindingsError] = useState("");
  const [isFindingsLoading, setIsFindingsLoading] = useState(true);

  const [healthStatus, setHealthStatus] = useState<"online" | "offline" | "checking">(
    "checking",
  );

  const [uploadError, setUploadError] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [deletingIds, setDeletingIds] = useState<string[]>([]);
  const [downloadingIds, setDownloadingIds] = useState<string[]>([]);
  const [actionError, setActionError] = useState("");

  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      content: "שלום! איך אפשר לעזור לכם היום?",
    },
  ]);
  const [chatInput, setChatInput] = useState("");
  const [chatError, setChatError] = useState("");
  const [isChatting, setIsChatting] = useState(false);

  const loadUser = useCallback(async () => {
    setIsUserLoading(true);
    const response = await getMe();
    if (response.success && response.data?.user) {
      setUserName(response.data.user.name);
      setUserError("");
    } else {
      setUserError(response.message || "לא הצלחנו לטעון את המשתמש.");
    }
    setIsUserLoading(false);
  }, []);

  const loadDocuments = useCallback(async () => {
    setIsDocumentsLoading(true);
    const response = await listDocuments();
    if (response.success && Array.isArray(response.data)) {
      setDocuments(response.data);
      setDocumentsError("");
    } else {
      setDocuments([]);
      setDocumentsError(response.message || "לא הצלחנו לטעון את המסמכים.");
    }
    setIsDocumentsLoading(false);
  }, []);

  const loadFindings = useCallback(async () => {
    setIsFindingsLoading(true);
    const response = await listFindings();
    if (response.success && Array.isArray(response.data)) {
      setFindings(response.data);
      setFindingsError("");
    } else {
      setFindings([]);
      setFindingsError(response.message || "לא הצלחנו לטעון את הממצאים.");
    }
    setIsFindingsLoading(false);
  }, []);

  const loadHealth = useCallback(async () => {
    const response = await getHealth();
    if (response.success) {
      setHealthStatus("online");
    } else {
      setHealthStatus("offline");
    }
  }, []);

  const loadDashboard = useCallback(async () => {
    await Promise.all([loadUser(), loadDocuments(), loadFindings(), loadHealth()]);
  }, [loadDocuments, loadFindings, loadHealth, loadUser]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadDashboard();
  }, [loadDashboard]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [chatMessages, isChatting]);

  const totalDocuments = documents.length;
  const totalSize = useMemo(
    () => documents.reduce((sum, doc) => sum + (doc.fileSize || 0), 0),
    [documents],
  );
  const completedDocuments = useMemo(
    () => documents.filter((doc) => doc.status === "completed").length,
    [documents],
  );
  const failedDocuments = useMemo(
    () => documents.filter((doc) => doc.status === "failed").length,
    [documents],
  );
  const processingDocuments = useMemo(
    () =>
      documents.filter(
        (doc) => doc.status === "processing" || doc.status === "pending",
      ).length,
    [documents],
  );
  const documentsThisMonth = useMemo(() => {
    const now = new Date();
    const month = now.getMonth();
    const year = now.getFullYear();
    return documents.filter((doc) => {
      if (!doc.uploadedAt) return false;
      const date = new Date(doc.uploadedAt);
      return date.getMonth() === month && date.getFullYear() === year;
    }).length;
  }, [documents]);
  const recentDocuments = documents.slice(0, 4);

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileSelected = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    event.target.value = "";
    if (!file) return;

    const isPdf =
      file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
    const maxSize = 10 * 1024 * 1024;

    if (!isPdf) {
      setUploadError("ניתן להעלות רק קבצי PDF.");
      return;
    }

    if (file.size > maxSize) {
      setUploadError("הקובץ גדול מדי. מקסימום 10MB.");
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
  };

  const handleDelete = async (doc: DocumentItem) => {
    if (!window.confirm(`למחוק את המסמך "${doc.originalName}"?`)) return;

    setActionError("");
    setDeletingIds((prev) => addUniqueId(prev, doc._id));
    const response = await removeDocument(doc._id);
    if (!response.success) {
      setActionError(response.message || "שגיאה במחיקת המסמך.");
      setDeletingIds((prev) => removeId(prev, doc._id));
      return;
    }

    setDocuments((prev) => prev.filter((item) => item._id !== doc._id));
    setDeletingIds((prev) => removeId(prev, doc._id));
  };

  const handleDownload = async (doc: DocumentItem) => {
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
  };

  const handleSendChat = async () => {
    const trimmed = chatInput.trim();
    if (!trimmed || isChatting) return;

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: trimmed,
    };

    setChatMessages((prev) => [...prev, userMessage]);
    setChatInput("");
    setChatError("");
    setIsChatting(true);

    const response = await chatWithAI(trimmed);
    if (!response.success || !response.answer) {
      setChatError(response.message || "לא הצלחנו לקבל תשובה מהבוט.");
      setIsChatting(false);
      return;
    }

    const assistantMessage: ChatMessage = {
      id: `assistant-${Date.now()}`,
      role: "assistant",
      content: response.answer,
      model: response.model,
    };

    setChatMessages((prev) => [...prev, assistantMessage]);
    setIsChatting(false);
  };

  const greetingLine = isUserLoading
    ? "טוענים את הנתונים..."
    : `${userName}, ברוך/ה הבא/ה`;

  const alertTitle =
    failedDocuments > 0
      ? "יש מסמכים שנכשלו"
      : processingDocuments > 0
        ? "מסמכים בעיבוד"
        : "הכל נראה מעולה";

  const alertMessage =
    failedDocuments > 0
      ? `נמצאו ${failedDocuments} מסמכים עם שגיאה. אפשר לחזור למסמכים ולנסות שוב.`
      : processingDocuments > 0
        ? `יש ${processingDocuments} מסמכים בתהליך עיבוד. נעדכן כשמוכנים.`
        : "כל המסמכים מעודכנים ואין משימות דחופות.";

  return (
    <div className="dashboard-page" dir="rtl">
      <div className="dashboard-shell">
        <header className="dashboard-topbar">
          <div className="dashboard-brand">
            <span className="dashboard-brand-badge">
              <Sparkles aria-hidden="true" />
            </span>
            <span>FinGuide</span>
          </div>

          <nav className="dashboard-nav">
            <button
              className="dashboard-nav-link is-active"
              type="button"
              onClick={() => navigate(APP_ROUTES.dashboard)}
            >
              לוח בקרה
            </button>
            <button
              className="dashboard-nav-link"
              type="button"
              onClick={() => navigate(APP_ROUTES.documents)}
            >
              מסמכים
            </button>
            <button
              className="dashboard-nav-link"
              type="button"
              onClick={() => navigate(APP_ROUTES.findings)}
            >
              ממצאים
            </button>
            <button
              className="dashboard-nav-link"
              type="button"
              onClick={() => navigate(APP_ROUTES.assistant)}
            >
              עוזר AI
            </button>
            <button
              className="dashboard-nav-link"
              type="button"
              onClick={() => navigate(APP_ROUTES.settings)}
            >
              הגדרות
            </button>
          </nav>

          <div className="dashboard-top-actions">
            <button
              className="dashboard-upload"
              type="button"
              onClick={handleUploadClick}
              disabled={isUploading}
            >
              <Upload aria-hidden="true" />
              {isUploading ? "מעלה..." : "העלאת מסמך"}
            </button>
            <span className={`dashboard-health is-${healthStatus}`}>
              {healthStatus === "checking"
                ? "בודק שרת..."
                : healthStatus === "online"
                  ? "השרת זמין"
                  : "השרת לא זמין"}
            </span>
            <button
              className="dashboard-logout-action"
              type="button"
              onClick={() => logoutWithConfirm(navigate)}
            >
              התנתקות
            </button>
            <input
              ref={fileInputRef}
              className="dashboard-upload-input"
              type="file"
              accept="application/pdf"
              onChange={handleFileSelected}
            />
          </div>
        </header>

        <section className="dashboard-hero">
          <div>
            <h1>{greetingLine}</h1>
            <p>
              הנה סקירה מהירה של מצב המסמכים שלך
              {documentsThisMonth ? ` החודש` : ""}.
            </p>
          </div>
          <button
            className="dashboard-hero-action"
            type="button"
            onClick={() => navigate(APP_ROUTES.documents)}
          >
            צפייה במסמכים
            <ArrowUpRight aria-hidden="true" />
          </button>
        </section>

        <section className="dashboard-metrics">
          <article className="dashboard-metric-card">
            <div className="metric-icon">
              <FileText aria-hidden="true" />
            </div>
            <div className="metric-label">מסמכים</div>
            <div className="metric-value">{formatNumber.format(totalDocuments)}</div>
            <div className="metric-subtitle">
              {documentsThisMonth
                ? `${documentsThisMonth} הועלו החודש`
                : "אין העלאות החודש"}
            </div>
          </article>
          <article className="dashboard-metric-card">
            <div className="metric-icon accent-green">
              <BarChart3 aria-hidden="true" />
            </div>
            <div className="metric-label">סטטוס עיבוד</div>
            <div className="metric-value">
              {completedDocuments}/{totalDocuments || 0}
            </div>
            <div className="metric-subtitle">מסמכים שהושלמו</div>
          </article>
          <article className="dashboard-metric-card">
            <div className="metric-icon accent-blue">
              <ShieldCheck aria-hidden="true" />
            </div>
            <div className="metric-label">נפח מסמכים</div>
            <div className="metric-value">{formatFileSize(totalSize)}</div>
            <div className="metric-subtitle">סה"כ אחסון</div>
          </article>
          <article className="dashboard-metric-card">
            <div className="metric-icon accent-amber">
              <Sparkles aria-hidden="true" />
            </div>
            <div className="metric-label">תובנות AI</div>
            <div className="metric-value">
              {formatCurrency.format(Math.max(totalDocuments * 850, 0))}
            </div>
            <div className="metric-subtitle">דוגמה לתובנה פוטנציאלית</div>
          </article>
        </section>

        {uploadError ? <div className="dashboard-inline-error">{uploadError}</div> : null}
        {actionError ? <div className="dashboard-inline-error">{actionError}</div> : null}
        {userError ? <div className="dashboard-inline-error">{userError}</div> : null}
        {documentsError ? <div className="dashboard-inline-error">{documentsError}</div> : null}
        {findingsError ? <div className="dashboard-inline-error">{findingsError}</div> : null}

        <section className="dashboard-grid">
          <div className="dashboard-column">
            <article className="dashboard-card summary-card">
              <div className="summary-header">
                <div className="summary-icon">
                  <BarChart3 aria-hidden="true" />
                </div>
                <div>
                  <h3>סקירת מסמכים</h3>
                  <p>עדכון אחרון: {formatDate(documents[0]?.uploadedAt)}</p>
                </div>
              </div>
              <div className="summary-highlight">
                <span>סה"כ מסמכים</span>
                <strong>{formatNumber.format(totalDocuments)}</strong>
              </div>
              <div className="summary-stats">
                <div>
                  <span>הושלמו</span>
                  <strong>{formatNumber.format(completedDocuments)}</strong>
                </div>
                <div>
                  <span>בעיבוד</span>
                  <strong>{formatNumber.format(processingDocuments)}</strong>
                </div>
                <div>
                  <span>שגיאות</span>
                  <strong>{formatNumber.format(failedDocuments)}</strong>
                </div>
              </div>
              <button
                className="summary-action"
                type="button"
                onClick={() => navigate(APP_ROUTES.documents)}
              >
                מעבר למסמכים
              </button>
            </article>

            <article className="dashboard-card ai-card">
              <div className="ai-header">
                <div className="ai-icon">
                  <MessageSquare aria-hidden="true" />
                </div>
                <div>
                  <h3>צ׳אט AI פיננסי</h3>
                  <p>שאלו כל שאלה על המסמכים שלכם</p>
                </div>
              </div>

              <div className="ai-chat">
                <div className="ai-chat-messages">
                  {chatMessages.map((message) => (
                    <div
                      key={message.id}
                      className={`ai-message ${message.role}`}
                    >
                      <span>{message.content}</span>
                      {message.model ? (
                        <em className="ai-model">{message.model}</em>
                      ) : null}
                    </div>
                  ))}
                  {isChatting ? (
                    <div className="ai-message assistant is-loading">
                      <Loader />
                    </div>
                  ) : null}
                  <div ref={chatEndRef} />
                </div>

                <div className="ai-suggestions">
                  {promptSuggestions.map((prompt) => (
                    <button
                      key={prompt}
                      className="ai-suggestion"
                      type="button"
                      onClick={() => setChatInput(prompt)}
                    >
                      {prompt}
                    </button>
                  ))}
                </div>

                <div className="ai-input">
                  <input
                    type="text"
                    placeholder="כתבו שאלה..."
                    value={chatInput}
                    onChange={(event) => setChatInput(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        void handleSendChat();
                      }
                    }}
                    disabled={isChatting}
                  />
                  <button
                    className="ai-send"
                    type="button"
                    onClick={handleSendChat}
                    disabled={isChatting || !chatInput.trim()}
                  >
                    שליחה
                  </button>
                </div>
                {chatError ? <span className="ai-error">{chatError}</span> : null}
              </div>
            </article>

            <article className="dashboard-card quick-actions-card">
              <h3>פעולות מהירות</h3>
              <div className="quick-actions">
                <button type="button" onClick={handleUploadClick}>
                  <Upload aria-hidden="true" />
                  העלאת מסמך חדש
                </button>
                <button type="button" onClick={() => navigate(APP_ROUTES.documents)}>
                  <FileText aria-hidden="true" />
                  צפייה בכל המסמכים
                </button>
                <button type="button" onClick={() => navigate(APP_ROUTES.findings)}>
                  <ShieldCheck aria-hidden="true" />
                  מעבר לממצאים
                </button>
                <button type="button" onClick={() => navigate(APP_ROUTES.assistant)}>
                  <MessageSquare aria-hidden="true" />
                  צ׳אט במסך מלא
                </button>
              </div>
            </article>
          </div>

          <div className="dashboard-column">
            <article className="dashboard-card alert-card">
              <div className="alert-icon">
                <ShieldCheck aria-hidden="true" />
              </div>
              <div>
                <h3>{alertTitle}</h3>
                <p>{alertMessage}</p>
              </div>
              <button
                className="alert-action"
                type="button"
                onClick={() => navigate(APP_ROUTES.documents)}
              >
                מעבר למסמכים
              </button>
            </article>

            <article className="dashboard-card findings-card">
              <div className="findings-header">
                <div>
                  <h3>ממצאים</h3>
                  <p>תובנות לוגיות קצרות על המסמכים שלך.</p>
                </div>
                <span className="findings-count">{findings.length}</span>
              </div>
              {isFindingsLoading ? (
                <div className="findings-placeholder">
                  <Loader />
                  טוענים ממצאים...
                </div>
              ) : findings.length === 0 ? (
                <div className="findings-placeholder">אין ממצאים כרגע.</div>
              ) : (
                <ul className="findings-list">
                  {findings.map((finding) => (
                    <li
                      key={finding.id}
                      className={`finding-item severity-${finding.severity}`}
                    >
                      <div className="finding-text">
                        <span className="finding-title">{finding.title}</span>
                        <span className="finding-details">{finding.details}</span>
                      </div>
                      <span
                        className={`finding-badge severity-${finding.severity}`}
                      >
                        {findingSeverityLabels[finding.severity]}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </article>

            <article className="dashboard-card dashboard-documents-card">
              <div className="dashboard-documents-header">
                <h3>מסמכים אחרונים</h3>
                <button
                  className="dashboard-documents-link"
                  type="button"
                  onClick={() => navigate(APP_ROUTES.documents)}
                >
                  צפייה בהכל
                </button>
              </div>
              {isDocumentsLoading ? (
                <div className="dashboard-documents-placeholder">
                  <Loader />
                  טוענים מסמכים...
                </div>
              ) : recentDocuments.length === 0 ? (
                <div className="dashboard-documents-placeholder">
                  אין עדיין מסמכים. התחילו בהעלאה ראשונה.
                </div>
              ) : (
                <div className="dashboard-documents-list">
                  {recentDocuments.map((doc) => (
                    <div key={doc._id} className="dashboard-documents-row">
                      <div className="dashboard-documents-icon">
                        <FileText aria-hidden="true" />
                      </div>
                      <div className="dashboard-documents-info">
                        <span>{doc.originalName}</span>
                        <span className="dashboard-documents-meta">
                          {formatDate(doc.uploadedAt)} ·{" "}
                          {formatFileSize(doc.fileSize)}
                        </span>
                      </div>
                      <div
                        className={`dashboard-documents-chip status-${doc.status}`}
                      >
                        {statusLabels[doc.status || "pending"]}
                      </div>
                      <div className="dashboard-documents-actions">
                        <button
                          type="button"
                          onClick={() => handleDownload(doc)}
                          disabled={downloadingIds.includes(doc._id)}
                          aria-label={`הורדת ${doc.originalName}`}
                        >
                          <Download aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(doc)}
                          disabled={deletingIds.includes(doc._id)}
                          aria-label={`מחיקת ${doc.originalName}`}
                        >
                          <Trash2 aria-hidden="true" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </article>
          </div>
        </section>
      </div>
    </div>
  );
}
