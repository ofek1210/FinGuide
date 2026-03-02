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

export const chatWithAI = async (message: string) => {
  const response = await fetch("/api/ai/chat", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
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
