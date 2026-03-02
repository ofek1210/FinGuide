import { FileText, Upload } from "lucide-react";

interface DashboardQuickActionsProps {
  onUploadClick: () => void;
  onViewDocuments: () => void;
}

export default function DashboardQuickActions({
  onUploadClick,
  onViewDocuments,
}: DashboardQuickActionsProps) {
  return (
    <article className="dashboard-card quick-actions-card">
      <h3>פעולות מהירות</h3>
      <div className="quick-actions">
        <button type="button" onClick={onUploadClick}>
          <Upload aria-hidden="true" />
          העלאת מסמך חדש
        </button>
        <button type="button" onClick={onViewDocuments}>
          <FileText aria-hidden="true" />
          צפייה בכל המסמכים
        </button>
      </div>
    </article>
  );
}
