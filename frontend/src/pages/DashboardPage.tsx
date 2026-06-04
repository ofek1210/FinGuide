import { FileText, Sparkles, Upload } from "lucide-react";
import { useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import AppFooter from "../components/AppFooter";
import type { DocumentItem } from "../api/documents.api";
import DashboardChatPanel from "../components/dashboard/DashboardChatPanel";
import DashboardHeader from "../components/dashboard/DashboardHeader";
import DashboardCharts from "../components/dashboard/DashboardCharts";
import DashboardInsightsCard from "../components/dashboard/DashboardInsightsCard";
import DashboardRecommendationsCard from "../components/dashboard/DashboardRecommendationsCard";
import DashboardRecentDocuments from "../components/dashboard/DashboardRecentDocuments";
import DashboardFinancialHealthCard from "../components/dashboard/DashboardFinancialHealthCard";
import { useDashboardDocuments } from "../hooks/useDashboardDocuments";
import { useDashboardUser } from "../hooks/useDashboardUser";
import { APP_ROUTES } from "../types/navigation";

export default function DashboardPage() {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const user = useDashboardUser();
  const documents = useDashboardDocuments();

  const handleUploadClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileSelected = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0] ?? null;
      event.target.value = "";
      if (!file) return;
      void documents.actions.uploadFile(file);
    },
    [documents.actions],
  );

  const handleDelete = useCallback(
    (doc: DocumentItem) => {
      if (!window.confirm(`למחוק את המסמך "${doc.originalName}"?`)) return;
      void documents.actions.deleteDocument(doc);
    },
    [documents.actions],
  );

  const handleDownload = useCallback(
    (doc: DocumentItem) => {
      void documents.actions.downloadFile(doc);
    },
    [documents.actions],
  );

  const hasDocuments = documents.stats.total > 0;

  return (
    <div className="dashboard-page" dir="rtl">
      <div className="dashboard-shell">
        <DashboardHeader
          isUploading={documents.isUploading}
          fileInputRef={fileInputRef}
          onUploadClick={handleUploadClick}
          onFileSelected={handleFileSelected}
          onNavigateDashboard={() => navigate(APP_ROUTES.dashboard)}
          onNavigateDocuments={() => navigate(APP_ROUTES.documents)}
          onNavigatePayslipHistory={() => navigate(APP_ROUTES.payslipHistory)}
          onNavigateFindings={() => navigate(APP_ROUTES.findings)}
        />

        {/* Error banners */}
        {(documents.uploadError || documents.actionError || user.error || documents.error) ? (
          <div className="dashboard-errors">
            {[documents.uploadError, documents.actionError, user.error, documents.error]
              .filter(Boolean)
              .map((err, i) => (
                <div key={i} className="dashboard-inline-error">{err}</div>
              ))}
          </div>
        ) : null}

        {/* Upload prompt — shown when no documents yet */}
        {!hasDocuments && !documents.isLoading ? (
          <section className="dashboard-upload-hero">
            <div className="dashboard-upload-hero-inner">
              <div className="dashboard-upload-hero-icon">
                <Sparkles aria-hidden="true" />
              </div>
              <h2>ברוכים הבאים ל-FinGuide</h2>
              <p>העלו את תלוש השכר הראשון שלכם — הבינה המלאכותית תנתח אותו ותספק תובנות מיידיות</p>
              <button
                type="button"
                className="dashboard-upload-hero-btn"
                onClick={handleUploadClick}
                disabled={documents.isUploading}
              >
                <Upload aria-hidden="true" />
                {documents.isUploading ? "מעלה..." : "העלאת תלוש שכר"}
              </button>
              <p className="dashboard-upload-hero-hint">
                <FileText aria-hidden="true" />
                קבצי PDF · מוצפן ומאובטח
              </p>
            </div>
          </section>
        ) : (
          <>
            {/* AI Chat — the main feature, top of page */}
            <section className="dashboard-ai-hero">
              <div className="dashboard-ai-hero-label">
                <Sparkles aria-hidden="true" />
                עוזר AI פיננסי
              </div>
              <DashboardChatPanel />
            </section>

            {/* Secondary row: health score + insights */}
            <div className="dashboard-secondary-grid">
              <DashboardFinancialHealthCard />
              <DashboardInsightsCard />
              <DashboardRecommendationsCard />
            </div>

            {/* Charts */}
            <DashboardCharts />

            {/* Recent documents */}
            <DashboardRecentDocuments
              documents={documents.recent}
              isLoading={documents.isLoading}
              statusLabels={documents.statusLabels}
              downloadingIds={documents.downloadingIds}
              deletingIds={documents.deletingIds}
              onDownload={handleDownload}
              onDelete={handleDelete}
              onViewAll={() => navigate(APP_ROUTES.documents)}
            />
          </>
        )}

        <AppFooter variant="private" />
      </div>
    </div>
  );
}
