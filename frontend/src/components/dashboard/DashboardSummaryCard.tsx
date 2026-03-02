import { BarChart3 } from "lucide-react";
import { formatNumber } from "../../utils/formatters";

interface DashboardSummaryCardProps {
  lastUpdated: string;
  totalDocuments: number;
  completedDocuments: number;
  processingDocuments: number;
  failedDocuments: number;
  onViewDocuments: () => void;
}

export default function DashboardSummaryCard({
  lastUpdated,
  totalDocuments,
  completedDocuments,
  processingDocuments,
  failedDocuments,
  onViewDocuments,
}: DashboardSummaryCardProps) {
  return (
    <article className="dashboard-card summary-card">
      <div className="summary-header">
        <div className="summary-icon">
          <BarChart3 aria-hidden="true" />
        </div>
        <div>
          <h3>סקירת מסמכים</h3>
          <p>עדכון אחרון: {lastUpdated}</p>
        </div>
      </div>
      <div className="summary-highlight">
        <span>סה"כ מסמכים</span>
        <strong>{formatNumber(totalDocuments)}</strong>
      </div>
      <div className="summary-stats">
        <div>
          <span>הושלמו</span>
          <strong>{formatNumber(completedDocuments)}</strong>
        </div>
        <div>
          <span>בעיבוד</span>
          <strong>{formatNumber(processingDocuments)}</strong>
        </div>
        <div>
          <span>שגיאות</span>
          <strong>{formatNumber(failedDocuments)}</strong>
        </div>
      </div>
      <button className="summary-action" type="button" onClick={onViewDocuments}>
        מעבר למסמכים
      </button>
    </article>
  );
}
