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
