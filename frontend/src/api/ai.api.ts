import { apiJson } from "./client";
import { clearSession } from "../utils/logout";

export type ChatCitation = {
  type: string;
  label: string;
  href?: string | null;
};

export type ChatResponse = {
  success: boolean;
  answer?: string;
  intent?: string;
  source?: string;
  conversationId?: string;
  contextUsed?: string[];
  citations?: ChatCitation[];
  degradedReason?: string;
  tokensUsed?: number | null;
  latencyMs?: number | null;
  model?: string | null;
  messageId?: string | null;
  message?: string;
};

export type ConversationMessage = {
  role: "user" | "assistant";
  content: string;
};

export type StoredChatMessage = {
  _id: string;
  role: "user" | "assistant" | "system";
  content: string;
  metadata?: {
    intent?: string;
    source?: string;
    contextUsed?: string[];
    model?: string;
    degradedReason?: string;
    title?: string;
    latencyMs?: number | null;
    feedbackRating?: number | null;
  };
  createdAt: string;
};

export type ConversationSummary = {
  conversationId: string;
  preview: string;
  title?: string;
  updatedAt: string;
  lastSource?: string | null;
  degraded?: boolean;
  degradedReason?: string;
};

export type FinancialTip = {
  tip: string;
  category: "pension" | "tax" | "savings" | "insurance" | "documents";
  priority: "high" | "medium" | "low";
};

export type FinancialTipsResponse = {
  success: boolean;
  data?: {
    tips: FinancialTip[];
    source: "claude" | "rule";
    staticTips?: FinancialTip[];
  };
};

export const getAIFinancialTips = async (): Promise<FinancialTipsResponse> => {
  const result = await apiJson<FinancialTipsResponse>("/api/ai/financial-tips", {
    method: "GET",
    auth: true,
    fallbackErrorMessage: "שגיאה בטעינת טיפים.",
  });
  if (!result.ok) return { success: false };
  return result.data ?? { success: false };
};

export type StreamEvent =
  | {
      type: "meta";
      conversationId: string;
      intent: string;
      contextUsed?: string[];
      citations?: ChatCitation[];
    }
  | { type: "token"; token: string }
  | {
      type: "done";
      source: string;
      tokensUsed?: number | null;
      degradedReason?: string | null;
      contextUsed?: string[];
      citations?: ChatCitation[];
      latencyMs?: number | null;
      intent?: string | null;
      model?: string | null;
      messageId?: string | null;
      conversationId?: string | null;
    }
  | { type: "error"; message: string };

export type StreamDoneMeta = {
  degradedReason?: string;
  contextUsed?: string[];
  citations?: ChatCitation[];
  tokensUsed?: number | null;
  latencyMs?: number | null;
  intent?: string | null;
  model?: string | null;
  messageId?: string | null;
};

export type StreamErrorInfo = {
  message: string;
  retryAfterSec?: number;
};

export const chatWithAI = async (
  message: string,
  conversationId?: string,
): Promise<ChatResponse> => {
  const result = await apiJson<ChatResponse>("/api/ai/chat", {
    method: "POST",
    auth: true,
    body: { message, history: [], conversationId },
    fallbackErrorMessage: "שגיאה בשיחה עם הבוט.",
  });

  if (!result.ok) {
    return { success: false, message: result.error.message };
  }

  return result.data ?? { success: false, message: "תגובה לא תקינה." };
};

/**
 * Streaming chat — history is always server-owned; client sends [].
 * Returns a cleanup function to abort the stream.
 */
export function streamChatWithAI(
  message: string,
  _history: ConversationMessage[],
  conversationId: string | null,
  onToken: (token: string) => void,
  onDone: (source: string, convId: string, meta?: StreamDoneMeta) => void,
  onError: (msg: string, info?: StreamErrorInfo) => void,
  pageContext?: string | null,
): () => void {
  const controller = new AbortController();
  const token = localStorage.getItem("token");

  void (async () => {
    let settled = false;
    const finishError = (msg: string, info?: StreamErrorInfo) => {
      if (settled) return;
      settled = true;
      onError(msg, info);
    };
    const finishDone = (source: string, convId: string, meta?: StreamDoneMeta) => {
      if (settled) return;
      settled = true;
      onDone(source, convId, meta);
    };

    const consumeSseChunk = (
      chunk: string,
      state: {
        resolvedConvId: string;
        source: string;
        degradedReason?: string;
        contextUsed?: string[];
        citations?: ChatCitation[];
        tokensUsed?: number | null;
        latencyMs?: number | null;
        intent?: string | null;
        model?: string | null;
        messageId?: string | null;
      },
    ) => {
      const line = chunk.trim();
      if (!line.startsWith("data:")) return;
      try {
        const event = JSON.parse(line.slice(5).trim()) as StreamEvent;
        if (event.type === "meta") {
          state.resolvedConvId = event.conversationId;
          if (event.contextUsed) state.contextUsed = event.contextUsed;
          if (event.citations) state.citations = event.citations;
          if (event.intent) state.intent = event.intent;
        } else if (event.type === "token") {
          onToken(event.token);
        } else if (event.type === "done") {
          state.source = event.source;
          if (event.degradedReason) state.degradedReason = event.degradedReason;
          if (event.contextUsed) state.contextUsed = event.contextUsed;
          if (event.citations) state.citations = event.citations;
          if (event.tokensUsed != null) state.tokensUsed = event.tokensUsed;
          if (event.latencyMs != null) state.latencyMs = event.latencyMs;
          if (event.intent != null) state.intent = event.intent;
          if (event.model != null) state.model = event.model;
          if (event.messageId) state.messageId = event.messageId;
          if (event.conversationId) state.resolvedConvId = event.conversationId;
          finishDone(state.source, state.resolvedConvId, {
            degradedReason: state.degradedReason,
            contextUsed: state.contextUsed,
            citations: state.citations,
            tokensUsed: state.tokensUsed,
            latencyMs: state.latencyMs,
            intent: state.intent,
            model: state.model,
            messageId: state.messageId,
          });
        } else if (event.type === "error") {
          finishError(event.message);
        }
      } catch {
        // skip malformed event
      }
    };

    try {
      if (!token) {
        finishError("אין הרשאה. נא להתחבר.");
        return;
      }

      const response = await fetch("/api/ai/chat/stream", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          message,
          history: [],
          conversationId,
          pageContext,
        }),
        signal: controller.signal,
      });

      if (response.status === 401) {
        clearSession();
        finishError("אין הרשאה. נא להתחבר.");
        return;
      }

      if (response.status === 429) {
        const retryHeader = response.headers.get("Retry-After");
        let retryAfterSec: number | undefined;
        try {
          const body = (await response.json()) as { retryAfterSec?: number; message?: string };
          if (typeof body.retryAfterSec === "number") retryAfterSec = body.retryAfterSec;
          const fromHeader = retryHeader ? Number(retryHeader) : NaN;
          if (!retryAfterSec && Number.isFinite(fromHeader)) retryAfterSec = fromHeader;
          finishError(body.message || "חרגת ממגבלת השאלות לעוזר. נסו שוב בעוד כמה דקות.", {
            message: body.message || "חרגת ממגבלת השאלות לעוזר. נסו שוב בעוד כמה דקות.",
            retryAfterSec,
          });
        } catch {
          const fromHeader = retryHeader ? Number(retryHeader) : NaN;
          finishError("חרגת ממגבלת השאלות לעוזר. נסו שוב בעוד כמה דקות.", {
            message: "חרגת ממגבלת השאלות לעוזר. נסו שוב בעוד כמה דקות.",
            retryAfterSec: Number.isFinite(fromHeader) ? fromHeader : 60,
          });
        }
        return;
      }

      if (!response.ok || !response.body) {
        finishError("לא הצלחנו להתחבר לשרת.");
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      const state = {
        resolvedConvId: conversationId ?? "",
        source: "claude",
      };

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const parts = buffer.split("\n\n");
        buffer = parts.pop() ?? "";

        for (const part of parts) {
          consumeSseChunk(part, state);
        }
      }

      if (buffer.trim()) {
        consumeSseChunk(buffer, state);
      }

      if (!settled) {
        finishError("התשובה נקטעה. נסו שוב.");
      }
    } catch (err) {
      if ((err as Error).name === "AbortError") {
        if (!settled) {
          settled = true;
          onError("");
        }
        return;
      }
      finishError("שגיאה בזמן קבלת התשובה.");
    }
  })();

  return () => controller.abort();
}

export async function getChatHistory(conversationId: string) {
  const result = await apiJson<{ success: boolean; data: StoredChatMessage[] }>(
    `/api/ai/chat/history?conversationId=${encodeURIComponent(conversationId)}`,
    { auth: true, fallbackErrorMessage: "לא הצלחנו לטעון היסטוריה." },
  );
  if (!result.ok) return { success: false, data: [] as StoredChatMessage[] };
  return result.data ?? { success: false, data: [] };
}

export async function listConversations() {
  const result = await apiJson<{ success: boolean; data: ConversationSummary[] }>(
    "/api/ai/chat/conversations",
    { auth: true, fallbackErrorMessage: "לא הצלחנו לטעון שיחות." },
  );
  if (!result.ok) return { success: false, data: [] as ConversationSummary[] };
  return result.data ?? { success: false, data: [] };
}

export async function deleteConversation(conversationId: string) {
  const result = await apiJson<{ success: boolean; deletedCount?: number }>(
    `/api/ai/chat/conversations/${encodeURIComponent(conversationId)}`,
    {
      method: "DELETE",
      auth: true,
      fallbackErrorMessage: "לא הצלחנו למחוק את השיחה.",
    },
  );
  if (!result.ok) return { success: false, message: result.error.message };
  return result.data ?? { success: true };
}

export async function renameConversation(conversationId: string, title: string) {
  const result = await apiJson<{ success: boolean; title?: string }>(
    `/api/ai/chat/conversations/${encodeURIComponent(conversationId)}`,
    {
      method: "PATCH",
      auth: true,
      body: { title },
      fallbackErrorMessage: "לא הצלחנו לשנות את שם השיחה.",
    },
  );
  if (!result.ok) return { success: false, message: result.error.message };
  return result.data ?? { success: true };
}

export async function submitMessageFeedback(
  messageId: string,
  rating: 1 | -1 | 0,
  note?: string,
) {
  const result = await apiJson<{ success: boolean; rating?: 1 | -1 | null }>(
    `/api/ai/chat/messages/${encodeURIComponent(messageId)}/feedback`,
    {
      method: "POST",
      auth: true,
      body: { rating, note },
      fallbackErrorMessage: "לא הצלחנו לשמור את הדירוג.",
    },
  );
  if (!result.ok) return { success: false, message: result.error.message };
  return result.data ?? { success: true };
}
