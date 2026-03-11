import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { APP_ROUTES } from "../types/navigation";

type StepStatus = "pending" | "active" | "done";

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
  const [stepIndex, setStepIndex] = useState(0);

  const isComplete = stepIndex >= steps.length;

  useEffect(() => {
    if (isComplete) return undefined;
    const timer = window.setTimeout(() => {
      setStepIndex((prev) => prev + 1);
    }, 1600);
    return () => window.clearTimeout(timer);
  }, [isComplete, stepIndex]);

  useEffect(() => {
    if (!isComplete) return undefined;
    const timer = window.setTimeout(() => {
      navigate(APP_ROUTES.documentsScanComplete);
    }, 900);
    return () => window.clearTimeout(timer);
  }, [isComplete, navigate]);

  const progress = useMemo(() => {
    const ratio = Math.min(stepIndex, steps.length) / steps.length;
    return Math.round(ratio * 100);
  }, [stepIndex]);

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
          <p>מזהה ומחלץ נתונים מהתלוש. התהליך עשוי לקחת כמה שניות.</p>

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

          <div className="scan-note">
            המערכת קוראת את המסמך ומחלצת פרטי שכר, מס וניכויים לתצוגה בהיסטוריית התלושים.
          </div>
        </section>
      </main>
    </div>
  );
}
