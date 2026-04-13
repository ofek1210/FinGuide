import { apiJson } from "./client";

export type ChatResponse = {
  success: boolean;
  answer?: string;
  source?: string;
  message?: string;
};

export type AIStatusResponse = {
  success: boolean;
  message?: string;
  data?: {
    available: boolean;
    source: string;
    reason?: string;
  };
};

const getToken = () => localStorage.getItem("token");

export const chatWithAI = async (message: string) => {
  const token = getToken();
  if (!token) {
    return {
      success: false,
      message: "אין הרשאה. נא להתחבר.",
    } as ChatResponse;
  }

  const result = await apiJson<ChatResponse>("/api/ai/chat", {
    method: "POST",
    auth: true,
    body: { message },
    fallbackErrorMessage: "שגיאה בשיחה עם הבוט.",
  });
  if (!result.ok) {
    return { success: false, message: result.error.message } as ChatResponse;
  }
  return result.data || ({ success: false, message: "תגובה לא תקינה." } as ChatResponse);
};

export const getAIStatus = async () => {
  const token = getToken();
  if (!token) {
    return {
      success: false,
      message: "אין הרשאה. נא להתחבר.",
    } as AIStatusResponse;
  }

  const result = await apiJson<AIStatusResponse>("/api/ai/status", {
    auth: true,
    fallbackErrorMessage: "לא הצלחנו לבדוק את זמינות ה-AI.",
  });

  if (!result.ok) {
    return { success: false, message: result.error.message } as AIStatusResponse;
  }

  return result.data || ({ success: false, message: "תגובה לא תקינה." } as AIStatusResponse);
};
