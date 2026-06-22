import { FileText, Sparkles, Upload } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import GlassCard from "../components/ui/GlassCard";

import type { DocumentItem } from "../api/documents.api";
import { getDashboardSummary, type DashboardSummaryData } from "../api/dashboard.api";
import DashboardChatPanel from "../components/dashboard/DashboardChatPanel";
import DashboardHeader from "../components/dashboard/DashboardHeader";
import DashboardCharts from "../components/dashboard/DashboardCharts";
import DashboardInsightsCard from "../components/dashboard/DashboardInsightsCard";
import DashboardRecommendationsCard from "../components/dashboard/DashboardRecommendationsCard";
import DashboardRecentDocuments from "../components/dashboard/DashboardRecentDocuments";
import DashboardFinancialHealthCard from "../components/dashboard/DashboardFinancialHealthCard";
import DashboardPensionHealthCard from "../components/dashboard/DashboardPensionHealthCard";
import DashboardInsuranceHealthCard from "../components/dashboard/DashboardInsuranceHealthCard";
import DashboardFindingsSummary from "../components/dashboard/DashboardFindingsSummary";
import DashboardAITipsCard from "../components/dashboard/DashboardAITipsCard";
import DashboardFullAnalysisCard from "../components/dashboard/DashboardFullAnalysisCard";
import DashboardScoresCard from "../components/dashboard/DashboardScoresCard";
import DashboardWhatsAppReport from "../components/dashboard/DashboardWhatsAppReport";
import { useDashboardDocuments } from "../hooks/useDashboardDocuments";
import { useDashboardUser } from "../hooks/useDashboardUser";
import { APP_ROUTES } from "../types/navigation";

const PRODUCTS = [
  { emoji: "📄", title: "תלושים ומסמכים", sub: "סוכן ניתוח שכר", color: "#9B7FE8", bg: "#F3EEFF", route: APP_ROUTES.documents, dataKey: null as null },
  { emoji: "🛡️", title: "ביטוח ופוליסות", sub: "סוכן ביטוח AI", color: "#7B5EA7", bg: "#EDE8F9", route: APP_ROUTES.insurance, dataKey: "insurance" as const },
  { emoji: "📈", title: "פנסיה וחיסכון", sub: "יועץ פנסיוני AI", color: "#6B4FA0", bg: "#EAE3F7", route: APP_ROUTES.pension, dataKey: "pension" as const },
];

function productBadge(profile: DashboardSummaryData["profile"] | undefined, dataKey: "insurance" | "pension" | null): string | null {
  if (!dataKey || !profile) return null;
  if (dataKey === "insurance") return profile.hasInsuranceData ? "יובא" : "חסר";
  if (dataKey === "pension") return profile.hasPensionData ? "יובא" : "חסר";
  return null;
}

export default function DashboardPage() {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [summaryProfile, setSummaryProfile] = useState<DashboardSummaryData["profile"] | undefined>();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  useEffect(() => {
    getDashboardSummary().then(res => {
      if (res.ok && res.data.success && res.data.data) {
        setSummaryProfile(res.data.data.profile);
      }
    });
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

        {(documents.uploadError || documents.actionError || user.error || documents.error) ? (
          <div className="dashboard-errors">
            {[documents.uploadError, documents.actionError, user.error, documents.error]
              .filter(Boolean)
              .map((err, i) => (
                <div key={i} className="dashboard-inline-error">{err}</div>
              ))}
          </div>
        ) : null}

        {isProcessing ? (
          <div className="dashboard-processing-banner">
            <span className="dashboard-processing-spinner" aria-hidden="true" />
            מעלה ומנתח את התלוש באמצעות AI...
          </div>
        ) : null}

        <div dir="rtl" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 16, padding: "24px 24px 0" }}>
          {PRODUCTS.map(p => {
            const badge = productBadge(summaryProfile, p.dataKey);
            return (
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
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ fontWeight: 800, fontSize: 15, color: "#1F1F1F", letterSpacing: "-0.01em" }}>{p.title}</div>
                    {badge ? (
                      <span style={{
                        fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 999,
                        background: badge === "יובא" ? "rgba(5,150,105,0.12)" : "rgba(217,119,6,0.12)",
                        color: badge === "יובא" ? "#059669" : "#D97706",
                      }}>
                        {badge}
                      </span>
                    ) : null}
                  </div>
                  <div style={{ fontSize: 12.5, color: p.color, fontWeight: 600, marginTop: 2 }}>{p.sub}</div>
                </div>
                <span style={{ marginRight: "auto", color: p.color, fontSize: 16, opacity: 0.6 }}>←</span>
              </GlassCard>
            );
          })}
        </div>

        {/* Health Hub — always visible */}
        <div style={{ padding: "0 24px" }}>
          <DashboardScoresCard />
        </div>
        <div className="dashboard-secondary-grid" style={{ padding: "0 24px" }}>
          <DashboardFindingsSummary />
          <DashboardPensionHealthCard />
          <DashboardInsuranceHealthCard />
        </div>

        {hasDocuments ? (
          <>
            <section className="dashboard-ai-hero">
              <div className="dashboard-ai-hero-label">
                <Sparkles aria-hidden="true" />
                עוזר AI פיננסי
              </div>
              <DashboardChatPanel />
            </section>

            <DashboardWhatsAppReport />

            <div className="dashboard-secondary-grid">
              <DashboardFinancialHealthCard />
              <DashboardInsightsCard />
              <DashboardRecommendationsCard />
            </div>

            <DashboardFullAnalysisCard />
            <DashboardAITipsCard />
            <DashboardCharts />

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
        ) : (
          <section style={{ padding: "24px" }}>
            <GlassCard
              padding="lg"
              style={{
                textAlign: "center",
                border: isDragOver ? "2px dashed #9B7FE8" : undefined,
              }}
            >
              <div
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
              >
              <div style={{ fontSize: 28, marginBottom: 12 }}>📄</div>
              <h2 style={{ margin: "0 0 8px", fontSize: 18, fontWeight: 800 }}>העלאת תלוש שכר</h2>
              <p style={{ margin: "0 0 16px", color: "#7C6FA0", fontSize: 14 }}>
                {isDragOver ? "שחררו את הקובץ להעלאה" : "ניתוח תלושים מוסיף תובנות שכר, מס והפקדות"}
              </p>
              <button
                type="button"
                className="dashboard-upload-hero-btn"
                onClick={handleUploadClick}
                disabled={documents.isUploading}
                style={{ display: "inline-flex", alignItems: "center", gap: 8 }}
              >
                <Upload aria-hidden="true" />
                {documents.isUploading ? "מעלה..." : "העלאת תלוש PDF"}
              </button>
              <p style={{ margin: "12px 0 0", fontSize: 12, color: "#A89CC8", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                <FileText size={14} aria-hidden="true" />
                PDF בלבד · מוצפן
              </p>
              </div>
            </GlassCard>
          </section>
        )}

        <footer className="dashboard-mini-footer" dir="rtl">
          <span>© 2026 FinGuide</span>
        </footer>
      </div>
    </div>
  );
}
