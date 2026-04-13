import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { getDocument } from "../api/documents.api";
import { APP_ROUTES } from "../types/navigation";

type StepStatus = "pending" | "active" | "done";
type ProcessingStatus = "idle" | "pending" | "processing" | "completed" | "failed";
type ProcessingStage =
  | "queued"
  | "extract_text"
  | "run_ocr"
  | "resolve_fields"
  | "finalize"
  | "completed"
  | "failed";

const steps = [
  "המסמך נכנס לתור",
  "קריאת המסמך",
  "OCR וחילוץ טקסט",
  "פתרון שדות והכנת התלוש",
];

const buildStepStatus = (index: number, current: number, isDone: boolean): StepStatus => {
  if (isDone) return "done";
  if (index < current) return "done";
  if (index === current) return "active";
  return "pending";
};

const getCurrentStageLabel = (status: ProcessingStatus, stage: ProcessingStage | null) => {
  if (status === "completed") return "המסמך הושלם ומוכן לצפייה.";
  if (status === "failed") return "המסמך נכשל בעיבוד.";

  switch (stage) {
    case "queued":
      return "המסמך ממתין בתור לעובד OCR.";
    case "extract_text":
      return "קוראים טקסט ישיר מהקובץ.";
    case "run_ocr":
      return "מריצים OCR על המסמך.";
    case "resolve_fields":
      return "מחלצים ופוסקים שדות תלוש.";
    case "finalize":
      return "מבצעים ולידציה ושומרים את התוצאה.";
    default:
      return "מתחילים לעבד את המסמך.";
  }
};

const getStageNote = (status: ProcessingStatus, stage: ProcessingStage | null) => {
  if (status === "failed") {
    return "העיבוד הופסק. אפשר לחזור למסמכים ולנסות שוב.";
  }

  switch (stage) {
    case "queued":
      return "המסמך נשמר בהצלחה ומחכה לפועל עיבוד זמין.";
    case "extract_text":
      return "המערכת בודקת אם יש טקסט ישיר בקובץ לפני OCR מלא.";
    case "run_ocr":
      return "המערכת מריצה OCR ומזהה טקסט ושדות מתוך המסמך.";
    case "resolve_fields":
      return "המערכת פותרת שדות שכר, מס, ניכויים והפקדות.";
    case "finalize":
      return "התוצאה עוברת ולידציה ונשמרת לתצוגה.";
    default:
      return status === "pending"
        ? "המסמך נשמר וממתין להתחלת העיבוד."
        : "בודקים את סטטוס המסמך מול השרת.";
  }
};

const getProgressFromStage = (status: ProcessingStatus, stage: ProcessingStage | null) => {
  if (status === "completed") return 100;
  if (status === "failed") return 0;

  switch (stage) {
    case "queued":
      return 10;
    case "extract_text":
      return 35;
    case "run_ocr":
      return 65;
    case "resolve_fields":
      return 85;
    case "finalize":
      return 95;
    default:
      return status === "pending" ? 10 : 35;
  }
};

const getStepIndexFromStage = (status: ProcessingStatus, stage: ProcessingStage | null) => {
  if (status === "completed") return steps.length;

  switch (stage) {
    case "queued":
      return 0;
    case "extract_text":
      return 1;
    case "run_ocr":
      return 2;
    case "resolve_fields":
    case "finalize":
      return 3;
    default:
      return status === "pending" ? 0 : 1;
  }
};

export default function ScanStatusPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const documentId = searchParams.get("documentId")?.trim() ?? "";
  const [status, setStatus] = useState<ProcessingStatus>("idle");
  const [processingStage, setProcessingStage] = useState<ProcessingStage | null>(null);
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
    setProcessingStage((response.data.processingStage as ProcessingStage | null) ?? null);
    const nextStatus =
      response.data.status === "uploaded" ? "pending" : response.data.status || "pending";

    if (nextStatus === "completed") {
      setStatus("completed");
      setError("");
      return;
    }

    if (nextStatus === "failed") {
      setStatus("failed");
      setError(
        response.data.processingError ||
          "עיבוד המסמך נכשל. אפשר לחזור למסמכים ולנסות שוב."
      );
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

  const stepIndex = useMemo(
    () => getStepIndexFromStage(status, processingStage),
    [processingStage, status]
  );
  const progress = useMemo(
    () => getProgressFromStage(status, processingStage),
    [processingStage, status]
  );
  const stageLabel = useMemo(
    () => getCurrentStageLabel(status, processingStage),
    [processingStage, status]
  );
  const stageNote = useMemo(
    () => getStageNote(status, processingStage),
    [processingStage, status]
  );

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
          <p>{stageLabel}</p>

          <div className="scan-progress">
            <div className="scan-progress-bar">
              <div className="scan-progress-fill" style={{ width: `${progress}%` }} />
            </div>
            <span className="scan-progress-value">{progress}%</span>
          </div>

          <div className="scan-steps">
            {steps.map((label, index) => {
              const stepStatus = buildStepStatus(index, stepIndex, isComplete);
              return (
                <div key={label} className={`scan-step is-${stepStatus}`}>
                  <span className="scan-step-label">{label}</span>
                  <span className="scan-step-icon" aria-hidden="true">
                    {stepStatus === "done" ? "✓" : stepStatus === "active" ? "…" : "○"}
                  </span>
                </div>
              );
            })}
          </div>

          {error ? <div className="documents-inline-error">{error}</div> : null}

          <div className="scan-note">{stageNote}</div>
        </section>
      </main>
    </div>
  );
}
