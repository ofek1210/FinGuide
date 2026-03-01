export type ChatResponse = {
  success: boolean;
  answer?: string;
  model?: string;
  message?: string;
};

const parseJson = async (response: Response) => {
  try {
    return await response.json();
  } catch {
    return null;
  }
};

const getToken = () => localStorage.getItem("token");

const getAuthHeaders = (): Record<string, string> => {
  const headers: Record<string, string> = {};
  const token = getToken();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
};

export const chatWithAI = async (message: string) => {
  const token = getToken();
  if (!token) {
    return {
      success: false,
      message: "אין הרשאה. נא להתחבר.",
    } as ChatResponse;
  }

  const response = await fetch("/api/ai/chat", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeaders(),
    },
    body: JSON.stringify({ message }),
  });

  const payload = await parseJson(response);

  if (!response.ok) {
    return (payload || {
      success: false,
      message: "שגיאה בשיחה עם הבוט.",
    }) as ChatResponse;
  }

  return (payload || {
    success: false,
    message: "תגובה לא תקינה.",
  }) as ChatResponse;
};

