import { FileText, Sparkles, Upload } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import GlassCard from "../components/ui/GlassCard";

import type { DocumentItem } from "../api/documents.api";
import DashboardChatPanel from "../components/dashboard/DashboardChatPanel";
import DashboardHeader from "../components/dashboard/DashboardHeader";
import DashboardCharts from "../components/dashboard/DashboardCharts";
import DashboardInsightsCard from "../components/dashboard/DashboardInsightsCard";
import DashboardRecommendationsCard from "../components/dashboard/DashboardRecommendationsCard";
import DashboardRecentDocuments from "../components/dashboard/DashboardRecentDocuments";
import DashboardFinancialHealthCard from "../components/dashboard/DashboardFinancialHealthCard";
import DashboardAITipsCard from "../components/dashboard/DashboardAITipsCard";
import DashboardFullAnalysisCard from "../components/dashboard/DashboardFullAnalysisCard";
import DashboardScoresCard from "../components/dashboard/DashboardScoresCard";
import DashboardWhatsAppReport from "../components/dashboard/DashboardWhatsAppReport";
import { useDashboardDocuments } from "../hooks/useDashboardDocuments";
import { useDashboardUser } from "../hooks/useDashboardUser";
import { APP_ROUTES } from "../types/navigation";

export default function DashboardPage() {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  // Scroll to top whenever this page mounts
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

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

  const handleDrop = useCallback(
    (event: React.DragEvent<HTMLElement>) => {
      event.preventDefault();
      setIsDragOver(false);
      const file = event.dataTransfer.files?.[0] ?? null;
      if (!file || file.type !== "application/pdf") return;
      void documents.actions.uploadFile(file);
    },
    [documents.actions],
  );

  const handleDragOver = useCallback((event: React.DragEvent<HTMLElement>) => {
    event.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback(() => setIsDragOver(false), []);

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
  const isProcessing = documents.stats.processing > 0 || documents.isUploading;

  return (
    <div className="dashboard-page" dir="rtl">
      <div className="dashboard-shell">
        <DashboardHeader
          isUploading={documents.isUploading}
          fileInputRef={fileInputRef}
          onUploadClick={handleUploadClick}
          onFileSelected={handleFileSelected}
          onNavigateDashboard={() => navigate(APP_ROUTES.documents)}
          onNavigateDocuments={() => navigate(APP_ROUTES.documents)}
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

        {/* Upload progress banner */}
        {isProcessing ? (
          <div className="dashboard-processing-banner">
            <span className="dashboard-processing-spinner" aria-hidden="true" />
            מעלה ומנתח את התלוש באמצעות AI...
          </div>
        ) : null}

        {/* 3 Product quick-access cards */}
        <div dir="rtl" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 16, padding: "24px 24px 0" }}>
          {[
            { emoji: "📄", title: "תלושים ומסמכים", sub: "סוכן ניתוח שכר", color: "#9B7FE8", bg: "#F3EEFF", route: APP_ROUTES.documents },
            { emoji: "🛡️", title: "ביטוח ופוליסות", sub: "סוכן ביטוח AI", color: "#7B5EA7", bg: "#EDE8F9", route: APP_ROUTES.insurance },
            { emoji: "📈", title: "פנסיה וחיסכון", sub: "יועץ פנסיוני AI", color: "#6B4FA0", bg: "#EAE3F7", route: APP_ROUTES.pension },
          ].map(p => (
            <GlassCard
              key={p.title}
              padding="md"
              onClick={() => navigate(p.route)}
              style={{
                display: "flex", alignItems: "center", gap: 14, cursor: "pointer",
                transition: "box-shadow 0.2s, transform 0.2s",
              }}
            >
              <div style={{ width: 48, height: 48, borderRadius: 14, background: p.bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, flexShrink: 0 }}>
                {p.emoji}
              </div>
              <div>
                <div style={{ fontWeight: 800, fontSize: 15, color: "#1F1F1F", letterSpacing: "-0.01em" }}>{p.title}</div>
                <div style={{ fontSize: 12.5, color: p.color, fontWeight: 600, marginTop: 2 }}>{p.sub}</div>
              </div>
              <span style={{ marginRight: "auto", color: p.color, fontSize: 16, opacity: 0.6 }}>←</span>
            </GlassCard>
          ))}
        </div>

        {/* Upload prompt — shown when no documents yet */}
        {!hasDocuments && !documents.isLoading ? (
          <section
            className={`dashboard-upload-hero${isDragOver ? " is-dragover" : ""}`}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
          >
            <div className="dashboard-upload-hero-inner">
              <div className="dashboard-upload-hero-icon">
                <Sparkles aria-hidden="true" />
              </div>
              <h2>ברוכים הבאים ל-FinGuide</h2>
              <p>
                {isDragOver
                  ? "שחררו את הקובץ כדי להעלות"
                  : "גררו תלוש שכר לכאן, או לחצו להעלאה"}
              </p>
              <button
                type="button"
                className="dashboard-upload-hero-btn"
                onClick={handleUploadClick}
                disabled={documents.isUploading}
              >
                <Upload aria-hidden="true" />
                {documents.isUploading ? "מעלה ומנתח..." : "בחרו קובץ PDF"}
              </button>
              <p className="dashboard-upload-hero-hint">
                <FileText aria-hidden="true" />
                קבצי PDF בלבד · מוצפן ומאובטח
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

            {/* WhatsApp monthly report – prominent placement */}
            <DashboardWhatsAppReport />

            {/* AI Scores row */}
            <DashboardScoresCard />

            {/* Secondary row: health score + insights */}
            <div className="dashboard-secondary-grid">
              <DashboardFinancialHealthCard />
              <DashboardInsightsCard />
              <DashboardRecommendationsCard />
            </div>

            {/* Multi-agent full analysis card */}
            <DashboardFullAnalysisCard />

            {/* AI-generated personalized tips */}
            <DashboardAITipsCard />

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

        <footer className="dashboard-mini-footer" dir="rtl">
          <span>© 2026 FinGuide</span>
        </footer>
      </div>
    </div>
  );
}
