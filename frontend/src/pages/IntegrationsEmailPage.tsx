import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Mail, RefreshCw, Unplug } from "lucide-react";
import PrivateTopbar from "../components/PrivateTopbar";
import AppFooter from "../components/AppFooter";
import Loader from "../components/ui/Loader";
import { APP_ROUTES } from "../types/navigation";
import {
  connectGmail,
  disconnectGmail,
  getGmailStatus,
  syncGmail,
  type GmailIntegrationStatus,
  type GmailSyncSummary,
} from "../api/integrations.api";
import { formatLongDate } from "../utils/formatters";
import { getDocumentImportSourceLabel } from "../utils/documentSource";

const formatSyncSummary = (summary: GmailSyncSummary) => {
  const parts = [
    `נמצאו ${summary.found} קבצים`,
    `יובאו בהצלחה ${summary.imported} תלושים`,
  ];
  if (summary.skippedDuplicates > 0) {
    parts.push(`דולגו ${summary.skippedDuplicates} קבצים שכבר קיימים`);
  }
  if (summary.failed > 0) {
    parts.push(`${summary.failed} נכשלו`);
  }
  return parts.join(" · ");
};

export default function IntegrationsEmailPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [status, setStatus] = useState<GmailIntegrationStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionMessage, setActionMessage] = useState("");
  const [isConnecting, setIsConnecting] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [lastSyncSummary, setLastSyncSummary] = useState<GmailSyncSummary | null>(null);

  const oauthCode = searchParams.get("code");
  const oauthError = searchParams.get("error");

  const redirectUri = useMemo(
    () => status?.redirectUri || `${window.location.origin}/integrations/email`,
    [status?.redirectUri],
  );

  const loadStatus = useCallback(async () => {
    setIsLoading(true);
    const response = await getGmailStatus();
    if (response.success && response.data) {
      setStatus(response.data);
      setError("");
    } else {
      setStatus(null);
      setError(response.message || "לא הצלחנו לטעון את סטטוס החיבור.");
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  useEffect(() => {
    if (!oauthCode || isConnecting) {
      return;
    }

    const finishOAuth = async () => {
      setIsConnecting(true);
      setError("");
      const response = await connectGmail({ code: oauthCode, redirectUri });
      setSearchParams({});
      setIsConnecting(false);

      if (response.success && response.data?.connected) {
        setActionMessage("Gmail חובר בהצלחה.");
        await loadStatus();
        return;
      }

      setError(response.message || "השלמת חיבור Gmail נכשלה.");
    };

    void finishOAuth();
  }, [oauthCode, redirectUri, isConnecting, loadStatus, setSearchParams]);

  useEffect(() => {
    if (oauthError) {
      setError("חיבור Gmail בוטל או נדחה.");
      setSearchParams({});
    }
  }, [oauthError, setSearchParams]);

  const handleConnect = async () => {
    setError("");
    setActionMessage("");
    setIsConnecting(true);

    const response = await connectGmail({ redirectUri });
    if (!response.success) {
      setError(response.message || "לא הצלחנו להתחיל חיבור Gmail.");
      setIsConnecting(false);
      return;
    }

    if (response.data?.authUrl) {
      window.location.assign(response.data.authUrl);
      return;
    }

    if (response.data?.connected) {
      setActionMessage("Gmail כבר מחובר.");
      await loadStatus();
    }

    setIsConnecting(false);
  };

  const handleSync = async () => {
    setError("");
    setActionMessage("");
    setIsSyncing(true);

    const response = await syncGmail();
    setIsSyncing(false);

    if (!response.success || !response.data) {
      setError(response.message || "סנכרון Gmail נכשל.");
      return;
    }

    setLastSyncSummary(response.data);
    setActionMessage(formatSyncSummary(response.data));
    await loadStatus();
  };

  const handleDisconnect = async () => {
    setError("");
    setActionMessage("");
    setIsDisconnecting(true);

    const response = await disconnectGmail();
    setIsDisconnecting(false);

    if (!response.success) {
      setError(response.message || "ניתוק Gmail נכשל.");
      return;
    }

    setLastSyncSummary(null);
    setActionMessage("חיבור Gmail נותק.");
    await loadStatus();
  };

  const recentImports = status?.recentImports ?? [];

  return (
    <div className="feature-page dashboard-page gmail-integration-page" dir="rtl">
      <div className="dashboard-shell">
        <PrivateTopbar />

        <section className="dashboard-card">
          <div className="gmail-integration-hero">
            <div className="gmail-integration-icon" aria-hidden="true">
              <Mail />
            </div>
            <div>
              <h1 className="feature-page-title">חיבור תיבת מייל</h1>
              <p className="feature-page-subtitle">
                חבר את Gmail כדי לייבא תלושי שכר אוטומטית. הגישה לתיבה היא לקריאה בלבד.
              </p>
            </div>
          </div>
        </section>

        {isLoading ? (
          <section className="dashboard-card gmail-integration-status-card">
            <Loader />
            <span>טוענים סטטוס חיבור...</span>
          </section>
        ) : (
          <section className="dashboard-card gmail-integration-status-card">
            <h2>סטטוס חיבור</h2>
            <p className={`gmail-integration-badge ${status?.connected ? "is-connected" : "is-disconnected"}`}>
              {status?.connected ? "מחובר" : "לא מחובר"}
            </p>
            {status?.connected ? (
              <div className="gmail-integration-connected">
                <p>
                  <strong>חשבון:</strong> {status.gmailEmail || "Gmail"}
                </p>
                <p>
                  <strong>חובר בתאריך:</strong>{" "}
                  {status.connectedAt ? formatLongDate(status.connectedAt) : "—"}
                </p>
                <p>
                  <strong>סנכרון אחרון:</strong>{" "}
                  {status.lastSyncAt ? formatLongDate(status.lastSyncAt) : "עדיין לא בוצע"}
                </p>
                <p>
                  <strong>תלושים שיובאו:</strong> {status.importedCount}
                </p>
              </div>
            ) : (
              <p className="gmail-integration-disconnected">
                חבר את Gmail כדי לייבא תלושי שכר אוטומטית.
              </p>
            )}

            <div className="gmail-integration-actions">
              {!status?.connected ? (
                <button
                  className="dashboard-hero-action"
                  type="button"
                  onClick={() => void handleConnect()}
                  disabled={isConnecting}
                >
                  {isConnecting ? "מתחבר..." : "חבר Gmail"}
                </button>
              ) : (
                <>
                  <button
                    className="dashboard-hero-action"
                    type="button"
                    onClick={() => void handleSync()}
                    disabled={isSyncing}
                  >
                    <RefreshCw aria-hidden="true" />
                    {isSyncing ? "מסנכרן..." : "סנכרן עכשיו"}
                  </button>
                  <button
                    className="dashboard-hero-action gmail-integration-disconnect"
                    type="button"
                    onClick={() => void handleDisconnect()}
                    disabled={isDisconnecting}
                  >
                    <Unplug aria-hidden="true" />
                    {isDisconnecting ? "מנתק..." : "נתק Gmail"}
                  </button>
                </>
              )}
            </div>

            {error ? <div className="dashboard-inline-error">{error}</div> : null}
            {actionMessage ? (
              <div className="gmail-integration-success" role="status">
                {actionMessage}
              </div>
            ) : null}
            {lastSyncSummary ? (
              <p className="gmail-integration-sync-detail">{formatSyncSummary(lastSyncSummary)}</p>
            ) : null}
          </section>
        )}

        <section className="dashboard-card">
          <h2>תלושים שיובאו מ-Gmail</h2>
          {recentImports.length === 0 ? (
            <p className="gmail-integration-empty">
              עדיין לא יובאו תלושים מ-Gmail. לחצו &quot;סנכרן עכשיו&quot; לאחר החיבור.
            </p>
          ) : (
            <ul className="gmail-integration-import-list">
              {recentImports.map((doc) => (
                <li key={doc._id}>
                  <button
                    type="button"
                    className="gmail-integration-import-item"
                    onClick={() => navigate(`/documents/${doc._id}`)}
                  >
                    <span className="gmail-integration-import-name">{doc.originalName}</span>
                    <span className="gmail-integration-import-meta">
                      {getDocumentImportSourceLabel(doc)}
                      {doc.uploadedAt ? ` · ${formatLongDate(doc.uploadedAt)}` : ""}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="dashboard-card feature-page-actions">
          <button
            className="dashboard-hero-action"
            type="button"
            onClick={() => navigate(APP_ROUTES.documents)}
          >
            מעבר למסמכים
          </button>
          <button
            className="dashboard-hero-action"
            type="button"
            onClick={() => navigate(APP_ROUTES.dashboard)}
          >
            חזרה ללוח הבקרה
          </button>
        </section>

        <AppFooter variant="private" />
      </div>
    </div>
  );
}
