import { apiJson, type ApiErrorPayload } from "./client";

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

const getToken = () => localStorage.getItem("token");

export const login = async (email: string, password: string) => {
  const result = await apiJson<LoginResponse>("/api/auth/login", {
    method: "POST",
    body: { email, password },
    fallbackErrorMessage: "אימייל או סיסמה לא נכונים.",
  });
  if (!result.ok) {
    return { success: false, message: result.error.message } as LoginResponse;
  }
  return result.data || ({ success: false, message: "תגובה לא תקינה." } as LoginResponse);
};

export const register = async (name: string, email: string, password: string) => {
  const result = await apiJson<RegisterResponse>("/api/auth/register", {
    method: "POST",
    body: { name, email, password },
    fallbackErrorMessage: "לא הצלחנו להשלים את ההרשמה.",
  });
  if (!result.ok) {
    const payload = result.error.payload as ApiErrorPayload | null;
    return {
      success: false,
      message: result.error.message,
      errors: (payload && Array.isArray(payload.errors) ? payload.errors : undefined) as RegisterResponse["errors"],
    } as RegisterResponse;
  }
  return result.data || ({ success: false, message: "תגובה לא תקינה." } as RegisterResponse);
};

export const loginWithGoogle = async (credential: string) => {
  const result = await apiJson<LoginResponse>("/api/auth/google", {
    method: "POST",
    body: { credential },
    fallbackErrorMessage: "לא הצלחנו להתחבר עם Google.",
  });
  if (!result.ok) {
    return { success: false, message: result.error.message } as LoginResponse;
  }
  return result.data || ({ success: false, message: "תגובה לא תקינה." } as LoginResponse);
};

export const getMe = async () => {
  const token = getToken();
  if (!token) {
    return { success: false, message: "אין הרשאה. נא להתחבר." } as MeResponse;
  }

  const result = await apiJson<MeResponse>("/api/auth/me", {
    auth: true,
    fallbackErrorMessage: "לא הצלחנו לטעון את פרטי המשתמש.",
  });
  if (!result.ok) {
    return { success: false, message: result.error.message } as MeResponse;
  }
  return result.data || ({ success: false, message: "תגובה לא תקינה." } as MeResponse);
};
