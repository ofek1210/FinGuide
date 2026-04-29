import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { getDocument } from "../api/documents.api";
import { APP_ROUTES } from "../types/navigation";

type StepStatus = "pending" | "active" | "done";
type ProcessingStatus = "idle" | "pending" | "processing" | "completed" | "failed";

const steps = [
  "קריאת המסמך",
  "זיהוי נתונים במסמך",
  "חילוץ פרטי שכר ומס",
  "הכנת התלוש לתצוגה",
];

const buildStepStatus = (index: number, current: number, isDone: boolean): StepStatus => {
  if (isDone) return "done";
  if (index < current) return "done";
  if (index === current) return "active";
  return "pending";
};

export default function ScanStatusPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const documentId = searchParams.get("documentId")?.trim() ?? "";
  const [status, setStatus] = useState<ProcessingStatus>("idle");
  const [error, setError] = useState("");
  const [documentName, setDocumentName] = useState("");

  const isComplete = status === "completed";

  const loadDocumentStatus = useCallback(async () => {
    if (!documentId) {
      setStatus("idle");
      setError("לא נבחר מסמך לעיבוד.");
      return;
    }

    const response = await getDocument(documentId);
    if (!response.success || !response.data) {
      setStatus("failed");
      setError(response.message || "לא הצלחנו לבדוק את סטטוס המסמך.");
      return;
    }

    setDocumentName(response.data.originalName);
    const nextStatus =
      response.data.status === "uploaded"
        ? "pending"
        : response.data.status || "pending";
    if (nextStatus === "completed") {
      setStatus("completed");
      setError("");
      return;
    }

    if (nextStatus === "failed") {
      setStatus("failed");
      setError("עיבוד המסמך נכשל. אפשר לחזור למסמכים ולנסות שוב.");
      return;
    }

    setStatus(nextStatus);
    setError("");
  }, [documentId]);

  useEffect(() => {
    void loadDocumentStatus();
  }, [loadDocumentStatus]);

  useEffect(() => {
    if (!documentId || isComplete || status === "failed" || status === "idle") {
      return undefined;
    }

    const timer = window.setTimeout(() => {
      void loadDocumentStatus();
    }, 1500);

    return () => window.clearTimeout(timer);
  }, [documentId, isComplete, loadDocumentStatus, status]);

  useEffect(() => {
    if (!isComplete || !documentId) return undefined;
    const timer = window.setTimeout(() => {
      navigate(`${APP_ROUTES.documentsScanComplete}?documentId=${documentId}`);
    }, 700);
    return () => window.clearTimeout(timer);
  }, [documentId, isComplete, navigate]);

  const stepIndex = useMemo(() => {
    if (status === "completed") return steps.length;
    if (status === "processing") return 2;
    if (status === "pending") return 1;
    return 0;
  }, [status]);

  const progress = useMemo(() => {
    if (status === "completed") return 100;
    if (status === "processing") return 75;
    if (status === "pending") return 35;
    return 0;
  }, [status]);

  if (!documentId) {
    return (
      <div className="scan-page" dir="rtl">
        <header className="scan-header">
          <div className="scan-logo">
            <span className="scan-logo-badge" aria-hidden="true">
              ✦
            </span>
            <span>FinGuide</span>
          </div>
          <button className="scan-back" type="button" onClick={() => navigate(APP_ROUTES.documents)}>
            חזרה למסמכים
          </button>
        </header>

        <main className="scan-main">
          <section className="scan-card">
            <h1>לא נבחר מסמך לעיבוד</h1>
            <p>בחרו מסמך ממסך המסמכים כדי לעקוב אחרי סטטוס העיבוד שלו.</p>
          </section>
        </main>
      </div>
    );
  }

  return (
    <div className="scan-page" dir="rtl">
      <header className="scan-header">
        <div className="scan-logo">
          <span className="scan-logo-badge" aria-hidden="true">
            ✦
          </span>
          <span>FinGuide</span>
        </div>
        <button className="scan-back" type="button" onClick={() => navigate(APP_ROUTES.documents)}>
          חזרה למסמכים
        </button>
      </header>

      <main className="scan-main">
        <section className="scan-card">
          <div className="scan-icon" aria-hidden="true">
            <span className={`scan-spinner ${isComplete ? "is-complete" : ""}`} />
          </div>

          <h1>מעבדים את המסמך</h1>
          <p>
            {documentName
              ? `מזהה ומחלץ נתונים מתוך ${documentName}.`
              : "מזהה ומחלץ נתונים מהתלוש."}
          </p>

          <div className="scan-progress">
            <div className="scan-progress-bar">
              <div className="scan-progress-fill" style={{ width: `${progress}%` }} />
            </div>
            <span className="scan-progress-value">{progress}%</span>
          </div>

          <div className="scan-steps">
            {steps.map((label, index) => {
              const status = buildStepStatus(index, stepIndex, isComplete);
              return (
                <div key={label} className={`scan-step is-${status}`}>
                  <span className="scan-step-label">{label}</span>
                  <span className="scan-step-icon" aria-hidden="true">
                    {status === "done" ? "✓" : status === "active" ? "…" : "○"}
                  </span>
                </div>
              );
            })}
          </div>

          {error ? <div className="documents-inline-error">{error}</div> : null}

          <div className="scan-note">
            {status === "pending"
              ? "המסמך נשמר וממתין להתחלת העיבוד."
              : status === "processing"
                ? "המערכת קוראת את המסמך ומחלצת פרטי שכר, מס וניכויים."
                : "בודקים את סטטוס המסמך מול השרת."}
          </div>
        </section>
      </main>
    </div>
  );
}
