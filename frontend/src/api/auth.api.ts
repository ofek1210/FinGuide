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
  avatarUrl?: string;
};

export type ChangePasswordResponse = {
  success: boolean;
  message?: string;
  errors?: Array<{
    field?: string;
    message?: string;
    msg?: string;
  }>;
};

export type MeResponse = {
  success: boolean;
  message?: string;
  data?: {
    user: AuthUser;
  };
};

export type PasswordResetRequestResponse = {
  success: boolean;
  message?: string;
  errors?: Array<{
    field?: string;
    message?: string;
    msg?: string;
  }>;
};

const getToken = () => localStorage.getItem("token");

const extractErrors = (payload: ApiErrorPayload | null) =>
  (payload && Array.isArray(payload.errors) ? payload.errors : undefined) as
    | PasswordResetRequestResponse["errors"]
    | ChangePasswordResponse["errors"]
    | RegisterResponse["errors"]
    | undefined;

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
      errors: extractErrors(payload) as RegisterResponse["errors"],
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

export const changePassword = async (currentPassword: string, newPassword: string) => {
  const body: { currentPassword: string; newPassword: string } = {
    currentPassword: currentPassword.trim(),
    newPassword,
  };

  const result = await apiJson<ChangePasswordResponse>("/api/auth/change-password", {
    method: "POST",
    body,
    auth: true,
    fallbackErrorMessage: "שגיאה בעדכון הסיסמה.",
  });

  if (!result.ok) {
    const payload = result.error.payload as ApiErrorPayload | null;
    return {
      success: false,
      message: result.error.message,
      errors: extractErrors(payload) as ChangePasswordResponse["errors"],
    } as ChangePasswordResponse;
  }

  return result.data || ({ success: false, message: "תגובה לא תקינה." } as ChangePasswordResponse);
};

export const requestPasswordReset = async (email: string) => {
  const result = await apiJson<PasswordResetRequestResponse>("/api/auth/forgot-password", {
    method: "POST",
    body: { email: email.trim() },
    fallbackErrorMessage: "לא הצלחנו לשלוח קישור לאיפוס סיסמה.",
  });

  if (!result.ok) {
    const payload = result.error.payload as ApiErrorPayload | null;
    return {
      success: false,
      message: result.error.message,
      errors: extractErrors(payload) as PasswordResetRequestResponse["errors"],
    } as PasswordResetRequestResponse;
  }

  return result.data || ({ success: false, message: "תגובה לא תקינה." } as PasswordResetRequestResponse);
};

export const resetPassword = async (token: string, newPassword: string) => {
  const result = await apiJson<PasswordResetRequestResponse>("/api/auth/reset-password", {
    method: "POST",
    body: { token: token.trim(), newPassword },
    fallbackErrorMessage: "לא הצלחנו לעדכן את הסיסמה.",
  });

  if (!result.ok) {
    const payload = result.error.payload as ApiErrorPayload | null;
    return {
      success: false,
      message: result.error.message,
      errors: extractErrors(payload) as PasswordResetRequestResponse["errors"],
    } as PasswordResetRequestResponse;
  }

  return result.data || ({ success: false, message: "תגובה לא תקינה." } as PasswordResetRequestResponse);
};
