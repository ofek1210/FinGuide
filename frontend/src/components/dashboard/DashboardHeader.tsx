import { Sparkles, Upload } from "lucide-react";
import type { ChangeEvent, RefObject } from "react";

type HealthStatus = "online" | "offline" | "checking";

interface DashboardHeaderProps {
  healthStatus: HealthStatus;
  isUploading: boolean;
  fileInputRef: RefObject<HTMLInputElement | null>;
  onUploadClick: () => void;
  onFileSelected: (event: ChangeEvent<HTMLInputElement>) => void;
  onNavigateDashboard: () => void;
  onNavigateDocuments: () => void;
  onNavigatePayslipHistory: () => void;
}

export default function DashboardHeader({
  healthStatus,
  isUploading,
  fileInputRef,
  onUploadClick,
  onFileSelected,
  onNavigateDashboard,
  onNavigateDocuments,
  onNavigatePayslipHistory,
}: DashboardHeaderProps) {
  return (
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
          onClick={onNavigateDashboard}
        >
          לוח בקרה
        </button>
        <button
          className="dashboard-nav-link"
          type="button"
          onClick={onNavigateDocuments}
        >
          מסמכים
        </button>
        <button
          className="dashboard-nav-link"
          type="button"
          onClick={onNavigatePayslipHistory}
        >
          היסטוריית תלושים
        </button>
        <button className="dashboard-nav-link" type="button">
          תובנות
        </button>
      </nav>

      <div className="dashboard-top-actions">
        <button
          className="dashboard-upload"
          type="button"
          onClick={onUploadClick}
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
        <input
          ref={fileInputRef}
          className="dashboard-upload-input"
          type="file"
          accept="application/pdf"
          onChange={onFileSelected}
        />
      </div>
    </header>
  );
}
