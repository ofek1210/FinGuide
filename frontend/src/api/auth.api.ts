export type LoginResponse = {
  success: boolean;
  message?: string;
  token?: string;
  data?: {
    user: {
      id: string;
      name: string;
      email: string;
    };
    token: string;
  };
};

export type RegisterResponse = {
  success: boolean;
  message?: string;
  token?: string;
  errors?: Array<{
    field?: string;
    message?: string;
    msg?: string;
    value?: string;
  }>;
  data?: {
    user?: {
      id: string;
      name: string;
      email: string;
    };
    token?: string;
  };
};

const parseJson = async (response: Response) => {
  try {
    return await response.json();
  } catch {
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
    } as LoginResponse;
  }

  return (payload || { success: false, message: "תגובה לא תקינה." }) as LoginResponse;
};

export const register = async (name: string, email: string, password: string) => {
  const response = await fetch("/api/auth/register", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ name, email, password }),
  });

  const payload = await parseJson(response);

  if (!response.ok) {
    return (payload || { success: false }) as RegisterResponse;
  }

  return (payload || { success: false, message: "תגובה לא תקינה." }) as RegisterResponse;
};
