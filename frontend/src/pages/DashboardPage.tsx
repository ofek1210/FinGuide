import { BarChart3, FileText, ShieldCheck, Sparkles } from "lucide-react";
import { useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import type { DocumentItem } from "../api/documents.api";
import DashboardAlertCard from "../components/dashboard/DashboardAlertCard";
import DashboardChatPanel from "../components/dashboard/DashboardChatPanel";
import DashboardHeader from "../components/dashboard/DashboardHeader";
import DashboardHero from "../components/dashboard/DashboardHero";
import DashboardMetrics from "../components/dashboard/DashboardMetrics";
import DashboardPayslipHistoryCard from "../components/dashboard/DashboardPayslipHistoryCard";
import DashboardQuickActions from "../components/dashboard/DashboardQuickActions";
import DashboardRecentDocuments from "../components/dashboard/DashboardRecentDocuments";
import DashboardSummaryCard from "../components/dashboard/DashboardSummaryCard";
import { useDashboardDocuments } from "../hooks/useDashboardDocuments";
import { useDashboardHealth } from "../hooks/useDashboardHealth";
import { useDashboardPayslipsPreview } from "../hooks/useDashboardPayslipsPreview";
import { useDashboardUser } from "../hooks/useDashboardUser";
import { formatCurrencyILS, formatFileSize, formatLongDate, formatNumber } from "../utils/formatters";
import type { DashboardMetric } from "../types/dashboard";

const AI_INSIGHT_VALUE_PER_DOC = 850;

export default function DashboardPage() {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const user = useDashboardUser();
  const documents = useDashboardDocuments();
  const health = useDashboardHealth();
  const payslips = useDashboardPayslipsPreview();

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

  const greetingLine = user.isLoading
    ? "טוענים את הנתונים..."
    : `${user.name}, ברוך/ה הבא/ה`;

  const metrics: DashboardMetric[] = [
    {
      label: "מסמכים",
      value: formatNumber(documents.stats.total),
      subtitle: documents.documentsThisMonth
        ? `${documents.documentsThisMonth} הועלו החודש`
        : "אין העלאות החודש",
      icon: FileText,
    },
    {
      label: "סטטוס עיבוד",
      value: `${documents.stats.completed}/${documents.stats.total || 0}`,
      subtitle: "מסמכים שהושלמו",
      icon: BarChart3,
      accentClass: "accent-green",
    },
    {
      label: "נפח מסמכים",
      value: formatFileSize(documents.stats.totalSize),
      subtitle: 'סה"כ אחסון',
      icon: ShieldCheck,
      accentClass: "accent-blue",
    },
    {
      label: "תובנות AI",
      value: formatCurrencyILS(
        Math.max(documents.stats.total * AI_INSIGHT_VALUE_PER_DOC, 0),
      ),
      subtitle: "דוגמה לתובנה פוטנציאלית",
      icon: Sparkles,
      accentClass: "accent-amber",
    },
  ];

  const alertTitle =
    documents.stats.failed > 0
      ? "יש מסמכים שנכשלו"
      : documents.stats.processing > 0
        ? "מסמכים בעיבוד"
        : "הכל נראה מעולה";

  const alertMessage =
    documents.stats.failed > 0
      ? `נמצאו ${documents.stats.failed} מסמכים עם שגיאה. אפשר לחזור למסמכים ולנסות שוב.`
      : documents.stats.processing > 0
        ? `יש ${documents.stats.processing} מסמכים בתהליך עיבוד. נעדכן כשמוכנים.`
        : "כל המסמכים מעודכנים ואין משימות דחופות.";

  return (
    <div className="dashboard-page" dir="rtl">
      <div className="dashboard-shell">
        <DashboardHeader
          healthStatus={health.status}
          isUploading={documents.isUploading}
          fileInputRef={fileInputRef}
          onUploadClick={handleUploadClick}
          onFileSelected={handleFileSelected}
          onNavigateDashboard={() => navigate("/dashboard")}
          onNavigateDocuments={() => navigate("/documents")}
          onNavigatePayslipHistory={() => navigate("/documents/history")}
        />

        <DashboardHero
          greetingLine={greetingLine}
          documentsThisMonth={documents.documentsThisMonth}
          onViewDocuments={() => navigate("/documents")}
        />

        <DashboardMetrics metrics={metrics} />

        {documents.uploadError ? (
          <div className="dashboard-inline-error">{documents.uploadError}</div>
        ) : null}
        {documents.actionError ? (
          <div className="dashboard-inline-error">{documents.actionError}</div>
        ) : null}
        {user.error ? <div className="dashboard-inline-error">{user.error}</div> : null}
        {documents.error ? (
          <div className="dashboard-inline-error">{documents.error}</div>
        ) : null}

        <section className="dashboard-grid">
          <div className="dashboard-column">
            <DashboardSummaryCard
              lastUpdated={formatLongDate(documents.items[0]?.uploadedAt)}
              totalDocuments={documents.stats.total}
              completedDocuments={documents.stats.completed}
              processingDocuments={documents.stats.processing}
              failedDocuments={documents.stats.failed}
              onViewDocuments={() => navigate("/documents")}
            />

            <DashboardChatPanel />

            <DashboardQuickActions
              onUploadClick={handleUploadClick}
              onViewDocuments={() => navigate("/documents")}
            />
          </div>

          <div className="dashboard-column">
            <DashboardAlertCard
              title={alertTitle}
              message={alertMessage}
              onViewDocuments={() => navigate("/documents")}
            />

            <DashboardPayslipHistoryCard
              items={payslips.items}
              isLoading={payslips.isLoading}
              error={payslips.error}
              onRetry={payslips.reload}
              onViewAll={() => navigate("/documents/history")}
            />

            <DashboardRecentDocuments
              documents={documents.recent}
              isLoading={documents.isLoading}
              statusLabels={documents.statusLabels}
              downloadingIds={documents.downloadingIds}
              deletingIds={documents.deletingIds}
              onDownload={handleDownload}
              onDelete={handleDelete}
              onViewAll={() => navigate("/documents")}
            />
          </div>
        </section>
      </div>
    </div>
  );
}
