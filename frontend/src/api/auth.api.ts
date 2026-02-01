export type AuthResponse = {
  success: boolean;
  message?: string;
  data?: {
    user: {
      id: string;
      name: string;
      email: string;
    };
    token: string;
  };
};

const parseJson = async (response: Response) => {
  try {
    return await response.json();
  } catch (error) {
    return null;
  }
};

export const login = async (email: string, password: string) => {
  const response = await fetch("/api/auth/login", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email, password }),
  });

  const payload = await parseJson(response);

  if (!response.ok) {
    return {
      success: false,
      message:
        (payload && payload.message) || "אימייל או סיסמה לא נכונים.",
    } as AuthResponse;
  }

  return (payload || { success: false, message: "תגובה לא תקינה." }) as AuthResponse;
};
