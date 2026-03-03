import { apiJson } from "./client";

export type ChatResponse = {
  success: boolean;
  answer?: string;
  model?: string;
  message?: string;
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

