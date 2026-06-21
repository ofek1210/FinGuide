import { apiJson } from "./client";
import type { DocumentItem } from "./documents.api";

export type GmailIntegrationStatus = {
  connected: boolean;
  gmailEmail: string | null;
  connectedAt: string | null;
  lastSyncAt: string | null;
  importedCount: number;
  recentImports: DocumentItem[];
  redirectUri: string;
  oauthConfigured?: boolean;
};

export type GmailConnectResult = {
  authUrl?: string;
  connected?: boolean;
  gmailEmail?: string | null;
  connectedAt?: string | null;
};

export type GmailSyncSummary = {
  found: number;
  imported: number;
  skippedDuplicates: number;
  failed: number;
  documents?: DocumentItem[];
};

type GmailStatusResponse = {
  success: boolean;
  message?: string;
  data?: GmailIntegrationStatus;
};

type GmailConnectResponse = {
  success: boolean;
  message?: string;
  data?: GmailConnectResult;
};

type GmailSyncResponse = {
  success: boolean;
  message?: string;
  data?: GmailSyncSummary;
};

type GmailDisconnectResponse = {
  success: boolean;
  message?: string;
};

export const getGmailStatus = async () => {
  const result = await apiJson<GmailStatusResponse>("/api/integrations/gmail/status", {
    auth: true,
    fallbackErrorMessage: "לא הצלחנו לטעון את סטטוס Gmail.",
  });

  if (!result.ok) {
    return { success: false, message: result.error.message } as GmailStatusResponse;
  }

  return result.data || ({ success: false, message: "תגובה לא תקינה." } as GmailStatusResponse);
};

export const connectGmail = async (payload?: { code?: string; redirectUri?: string }) => {
  const result = await apiJson<GmailConnectResponse>("/api/integrations/gmail/connect", {
    method: "POST",
    auth: true,
    body: payload || {},
    fallbackErrorMessage: "חיבור Gmail נכשל.",
  });

  if (!result.ok) {
    return { success: false, message: result.error.message } as GmailConnectResponse;
  }

  return result.data || ({ success: false, message: "תגובה לא תקינה." } as GmailConnectResponse);
};

export const syncGmail = async () => {
  const result = await apiJson<GmailSyncResponse>("/api/integrations/gmail/sync", {
    method: "POST",
    auth: true,
    fallbackErrorMessage: "סנכרון Gmail נכשל.",
  });

  if (!result.ok) {
    return { success: false, message: result.error.message } as GmailSyncResponse;
  }

  return result.data || ({ success: false, message: "תגובה לא תקינה." } as GmailSyncResponse);
};

export const disconnectGmail = async () => {
  const result = await apiJson<GmailDisconnectResponse>("/api/integrations/gmail/disconnect", {
    method: "DELETE",
    auth: true,
    fallbackErrorMessage: "ניתוק Gmail נכשל.",
  });

  if (!result.ok) {
    return { success: false, message: result.error.message } as GmailDisconnectResponse;
  }

  return result.data || ({ success: false, message: "תגובה לא תקינה." } as GmailDisconnectResponse);
};
