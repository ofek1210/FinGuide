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

export type AuthUser = {
  id: string;
  name: string;
  email: string;
  createdAt?: string;
};

export type MeResponse = {
  success: boolean;
  message?: string;
  data?: {
    user: AuthUser;
  };
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

export const loginWithGoogle = async (credential: string) => {
  const response = await fetch("/api/auth/google", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ credential }),
  });

  const payload = await parseJson(response);

  if (!response.ok) {
    return {
      success: false,
      message:
        (payload && payload.message) || "לא הצלחנו להתחבר עם Google.",
    } as LoginResponse;
  }

  return (payload || {
    success: false,
    message: "תגובה לא תקינה.",
  }) as LoginResponse;
};

export const getMe = async () => {
  const token = getToken();
  if (!token) {
    return { success: false, message: "אין הרשאה. נא להתחבר." } as MeResponse;
  }

  const response = await fetch("/api/auth/me", {
    headers: {
      Accept: "application/json",
      ...getAuthHeaders(),
    },
  });

  const payload = await parseJson(response);

  if (!response.ok) {
    return (payload || {
      success: false,
      message: "לא הצלחנו לטעון את פרטי המשתמש.",
    }) as MeResponse;
  }

  return (payload || {
    success: false,
    message: "תגובה לא תקינה.",
  }) as MeResponse;
};
