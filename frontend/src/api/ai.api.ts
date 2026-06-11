import { apiJson } from "./client";

export type ChatResponse = {
  success: boolean;
  answer?: string;
  intent?: string;
  source?: string;
  conversationId?: string;
  contextUsed?: string[];
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
    contextUsed?: string[];
    model?: string;
  };
  createdAt: string;
};

export type ConversationSummary = {
  conversationId: string;
  preview: string;
  updatedAt: string;
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
  | { type: "meta"; conversationId: string; intent: string }
  | { type: "token"; token: string }
  | { type: "done"; source: string; tokensUsed?: number | null }
  | { type: "error"; message: string };

export const chatWithAI = async (
  message: string,
  history: ConversationMessage[] = [],
  conversationId?: string,
): Promise<ChatResponse> => {
  const result = await apiJson<ChatResponse>("/api/ai/chat", {
    method: "POST",
    auth: true,
    body: { message, history, conversationId },
    fallbackErrorMessage: "שגיאה בשיחה עם הבוט.",
  });

  if (!result.ok) {
    return { success: false, message: result.error.message };
  }

  return result.data ?? { success: false, message: "תגובה לא תקינה." };
};

/**
 * Streaming version of chatWithAI — uses Server-Sent Events.
 * Calls onToken for each text chunk, onDone when finished, onError on failure.
 * Returns a cleanup function to abort the stream.
 */
export function streamChatWithAI(
  message: string,
  history: ConversationMessage[],
  conversationId: string | null,
  onToken: (token: string) => void,
  onDone: (source: string, convId: string) => void,
  onError: (msg: string) => void,
): () => void {
  const controller = new AbortController();
  const token = localStorage.getItem("token");

  void (async () => {
    try {
      const response = await fetch("/api/ai/chat/stream", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ message, history, conversationId }),
        signal: controller.signal,
      });

      if (!response.ok || !response.body) {
        onError("לא הצלחנו להתחבר לשרת.");
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let resolvedConvId = conversationId ?? "";
      let source = "claude";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        // SSE events are separated by double newline
        const parts = buffer.split("\n\n");
        buffer = parts.pop() ?? "";

        for (const part of parts) {
          const line = part.trim();
          if (!line.startsWith("data:")) continue;
          try {
            const event = JSON.parse(line.slice(5).trim()) as StreamEvent;
            if (event.type === "meta") {
              resolvedConvId = event.conversationId;
            } else if (event.type === "token") {
              onToken(event.token);
            } else if (event.type === "done") {
              source = event.source;
              onDone(source, resolvedConvId);
            } else if (event.type === "error") {
              onError(event.message);
            }
          } catch {
            // skip malformed event
          }
        }
      }
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        onError("שגיאה בזמן קבלת התשובה.");
      }
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
