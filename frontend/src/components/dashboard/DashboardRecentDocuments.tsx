import { Download, FileText, Trash2 } from "lucide-react";
import type { DocumentItem, DocumentStatus } from "../../api/documents.api";
import { formatFileSize, formatLongDate } from "../../utils/formatters";
import { formatDocumentMetadataSummary } from "../../utils/documentMetadata";
import Loader from "../ui/Loader";

interface DashboardRecentDocumentsProps {
  documents: DocumentItem[];
  isLoading: boolean;
  statusLabels: Record<DocumentStatus, string>;
  downloadingIds: string[];
  deletingIds: string[];
  onDownload: (doc: DocumentItem) => void;
  onDelete: (doc: DocumentItem) => void;
  onViewAll: () => void;
}

export default function DashboardRecentDocuments({
  documents,
  isLoading,
  statusLabels,
  downloadingIds,
  deletingIds,
  onDownload,
  onDelete,
  onViewAll,
}: DashboardRecentDocumentsProps) {
  return (
    <article className="dashboard-card dashboard-documents-card">
      <div className="dashboard-documents-header">
        <h3>מסמכים אחרונים</h3>
        <button className="dashboard-documents-link" type="button" onClick={onViewAll}>
          צפייה בהכל
        </button>
      </div>
      {isLoading ? (
        <div className="dashboard-documents-placeholder">
          <Loader />
          טוענים מסמכים...
        </div>
      ) : documents.length === 0 ? (
        <div className="dashboard-documents-placeholder">
          אין עדיין מסמכים. התחילו בהעלאה ראשונה.
        </div>
      ) : (
        <div className="dashboard-documents-list">
          {documents.map((doc) => (
            <div key={doc.id} className="dashboard-documents-row">
              <div className="dashboard-documents-icon">
                <FileText aria-hidden="true" />
              </div>
              <div className="dashboard-documents-info">
                <span>{doc.originalName}</span>
                <span className="dashboard-documents-meta">
                  {[
                    formatDocumentMetadataSummary(doc.metadata),
                    formatLongDate(doc.uploadedAt),
                    formatFileSize(doc.fileSize),
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              </div>
              <div className={`dashboard-documents-chip status-${doc.status}`}>
                {statusLabels[doc.status || "pending"]}
              </div>
              <div className="dashboard-documents-actions">
                <button
                  type="button"
                  onClick={() => onDownload(doc)}
                  disabled={downloadingIds.includes(doc.id)}
                  aria-label={`הורדת ${doc.originalName}`}
                >
                  <Download aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onClick={() => onDelete(doc)}
                  disabled={deletingIds.includes(doc.id)}
                  aria-label={`מחיקת ${doc.originalName}`}
                >
                  <Trash2 aria-hidden="true" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </article>
  );
}
