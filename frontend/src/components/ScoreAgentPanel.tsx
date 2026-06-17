import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bot, CheckCircle2, FileText, Sparkles, TrendingUp, Upload, X } from "lucide-react";
import Loader from "./ui/Loader";
import { useScoreGaps } from "../hooks/useScoreGaps";
import { useDocumentPreview } from "../hooks/useDocumentPreview";
import type { ScoreGap } from "../api/scoreAgent.api";

type Props = {
  year: number;
  onClose: () => void;
  onScoreChange?: (score: number) => void;
};

export default function ScoreAgentPanel({ year, onClose, onScoreChange }: Props) {
  const navigate = useNavigate();
  const { data, isLoading, isSaving, error, submit } = useScoreGaps(year, true);

  const [skipped, setSkipped] = useState<Set<string>>(new Set());
  const [value, setValue] = useState("");
  const [feedback, setFeedback] = useState<{ delta: number; label: string } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const fillableGaps = useMemo(
    () => (data?.gaps || []).filter((g) => g.kind === "payslip_field"),
    [data],
  );
  const missingDocs = useMemo(
    () => (data?.gaps || []).filter((g) => g.kind === "missing_document"),
    [data],
  );
  const activeGaps = useMemo(
    () => fillableGaps.filter((g) => !skipped.has(g.id)),
    [fillableGaps, skipped],
  );
  const currentGap: ScoreGap | undefined = activeGaps[0];
  const preview = useDocumentPreview(currentGap?.documentId);

  const totalFillable = data?.fillableCount ?? 0;
  const answeredCount = Math.max(0, totalFillable - fillableGaps.length);

  useEffect(() => {
    setValue("");
    setFeedback(null);
    if (currentGap) inputRef.current?.focus();
  }, [currentGap?.id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentGap || !currentGap.documentId) return;
    const amount = Number(value);
    if (!Number.isFinite(amount) || amount < 0) return;

    const prevScore = data?.score ?? 0;
    const result = await submit(currentGap.id, currentGap.documentId, amount);
    if (result.ok) {
      const delta = result.data.score - prevScore;
      onScoreChange?.(result.data.score);
      if (delta > 0) {
        setFeedback({ delta, label: currentGap.improves.label });
      }
    }
  };

  const handleSkip = () => {
    if (!currentGap) return;
    setSkipped((prev) => new Set(prev).add(currentGap.id));
  };

  return (
    <div className="score-agent-overlay" role="dialog" aria-modal="true" aria-label="סוכן השלמת ציון">
      <div className="score-agent-panel" dir="rtl">
        <header className="score-agent-head">
          <div className="score-agent-head-main">
            <span className="score-agent-avatar">
              <Bot size={20} />
            </span>
            <div>
              <h2>סוכן השלמת ציון</h2>
              <p>אשאל אותך כמה שאלות קצרות כדי להשלים נתונים חסרים ולשפר את הציון.</p>
            </div>
          </div>
          <button type="button" className="score-agent-close" onClick={onClose} aria-label="סגירה">
            <X size={20} />
          </button>
        </header>

        {isLoading ? (
          <div className="score-agent-loading">
            <Loader />
            <span>בודק אילו נתונים חסרים...</span>
          </div>
        ) : null}

        {error ? <div className="dashboard-inline-error">{error}</div> : null}

        {data && !isLoading ? (
          <div className="score-agent-body">
            <div className="score-agent-progress">
              <div className="score-agent-progress-meta">
                <span>
                  <TrendingUp size={14} /> ציון נוכחי: <strong>{data.score}</strong>/100
                </span>
                {activeGaps.length > 0 ? (
                  <span>
                    שאלה {answeredCount + 1} מתוך {totalFillable}
                  </span>
                ) : null}
              </div>
              {totalFillable > 0 ? (
                <div className="score-agent-progress-bar" aria-hidden="true">
                  <div
                    className="score-agent-progress-fill"
                    style={{ width: `${(answeredCount / totalFillable) * 100}%` }}
                  />
                </div>
              ) : null}
            </div>

            {feedback ? (
              <div className="score-agent-feedback" role="status">
                <Sparkles size={16} /> נשמר! {feedback.label} עודכן והציון עלה ב-{feedback.delta} נקודות.
              </div>
            ) : null}

            {currentGap ? (
              <div className="score-agent-question-layout">
                <div className="score-agent-preview" aria-label={`תצוגת תלוש ${currentGap.periodLabel}`}>
                  <div className="score-agent-preview-head">
                    <FileText size={14} /> <span>תלוש {currentGap.periodLabel}</span>
                  </div>
                  {preview.isLoading ? (
                    <div className="score-agent-preview-state">
                      <Loader />
                      <span>טוען תצוגת תלוש...</span>
                    </div>
                  ) : preview.url ? (
                    <iframe
                      className="score-agent-preview-frame"
                      src={`${preview.url}#toolbar=0&navpanes=0&view=FitH`}
                      title={`תצוגת תלוש ${currentGap.periodLabel}`}
                    />
                  ) : (
                    <div className="score-agent-preview-state">
                      <span>{preview.error || "תצוגת התלוש לא זמינה."}</span>
                    </div>
                  )}
                </div>

                <form className="score-agent-question" onSubmit={handleSubmit}>
                  <p className="score-agent-question-period">{currentGap.periodLabel}</p>
                  <p className="score-agent-question-text">{currentGap.question}</p>
                  <p className="score-agent-question-hint">
                    הסתכל בתלוש שמוצג ליד והזן את הסכום המתאים.
                  </p>
                  <div className="score-agent-input-row">
                    <span className="score-agent-currency">₪</span>
                    <input
                      ref={inputRef}
                      type="number"
                      min="0"
                      step="1"
                      inputMode="decimal"
                      placeholder="הזן סכום"
                      value={value}
                      onChange={(e) => setValue(e.target.value)}
                      disabled={isSaving}
                    />
                  </div>
                  <div className="score-agent-actions">
                    <button type="submit" className="dashboard-hero-action" disabled={isSaving || value === ""}>
                      {isSaving ? "שומר..." : "שמור והמשך"}
                    </button>
                    <button type="button" className="dashboard-link-btn" onClick={handleSkip} disabled={isSaving}>
                      לא יודע — דלג
                    </button>
                  </div>
                </form>
              </div>
            ) : (
              <div className="score-agent-done">
                <CheckCircle2 size={32} />
                <h3>סיימנו עם השדות שניתן להשלים</h3>
                <p>
                  {answeredCount > 0
                    ? `השלמת ${answeredCount} נתונים. הציון עודכן בהתאם.`
                    : "אין כרגע שדות חסרים בתלושים שהעלית."}
                </p>
              </div>
            )}

            {missingDocs.length > 0 ? (
              <div className="score-agent-missing">
                <h4>תלושים חסרים</h4>
                <p className="dashboard-muted">העלאת התלושים הבאים תשלים את הציון:</p>
                <ul>
                  {missingDocs.slice(0, 4).map((gap) => (
                    <li key={gap.id}>
                      <span>{gap.periodLabel}</span>
                      <button
                        type="button"
                        className="dashboard-link-btn"
                        onClick={() => navigate(gap.actionUrl || "/documents")}
                      >
                        <Upload size={14} /> העלאה
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
