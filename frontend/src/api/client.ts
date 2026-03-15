import { clearSession } from "../utils/logout";

export type ApiErrorPayload = {
  success?: boolean;
  message?: string;
  error?: {
    type?: string;
    message?: string;
    details?: unknown[];
  };
  errors?: unknown[];
};

export type ApiError = {
  status: number;
  message: string;
  type?: string;
  details?: unknown[];
  payload?: unknown;
};

export type ApiResult<T> =
  | { ok: true; status: number; data: T }
  | { ok: false; status: number; error: ApiError };

const getToken = () => localStorage.getItem("token");

const tryParseJson = async (response: Response) => {
  try {
    return (await response.json()) as unknown;
  } catch {
    return null;
  }
};

const toApiError = (
  status: number,
  payload: unknown,
  fallbackMessage: string,
): ApiError => {
  const p = payload as ApiErrorPayload | null;
  const firstError =
    p &&
    Array.isArray(p.errors) &&
    p.errors[0] &&
    typeof p.errors[0] === "object" &&
    p.errors[0] !== null
      ? (p.errors[0] as { message?: string; msg?: string }).message ??
        (p.errors[0] as { message?: string; msg?: string }).msg
      : undefined;
  const message =
    (p && typeof p.message === "string" && p.message) ||
    (p &&
      p.error &&
      typeof p.error.message === "string" &&
      p.error.message) ||
    (typeof firstError === "string" ? firstError : undefined) ||
    fallbackMessage;

  const type =
    (p && p.error && typeof p.error.type === "string" && p.error.type) ||
    (p &&
      p.error &&
      typeof p.error.message === "string" &&
      p.error.message) ||
    undefined;

  const details =
    (p && p.error && Array.isArray(p.error.details) && p.error.details) ||
    (p && Array.isArray(p.errors) && p.errors) ||
    undefined;

  return {
    status,
    message,
    type,
    details,
    payload,
  };
};

type JsonRequestOptions = {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  headers?: Record<string, string>;
  body?: unknown;
  auth?: boolean;
  fallbackErrorMessage?: string;
};

export async function apiJson<T>(
  path: string,
  options: JsonRequestOptions = {},
): Promise<ApiResult<T>> {
  const {
    method = "GET",
    headers = {},
    body,
    auth = false,
    fallbackErrorMessage = "שגיאה בבקשה לשרת.",
  } = options;

  const requestHeaders: Record<string, string> = {
    Accept: "application/json",
    ...headers,
  };

  const token = getToken();
  if (auth) {
    if (!token) {
      return {
        ok: false,
        status: 401,
        error: toApiError(401, null, "אין הרשאה. נא להתחבר."),
      };
    }
    requestHeaders.Authorization = `Bearer ${token}`;
  } else if (token) {
    requestHeaders.Authorization = `Bearer ${token}`;
  }

  let requestBody: BodyInit | undefined;
  if (body instanceof FormData) {
    requestBody = body;
  } else if (body !== undefined) {
    requestHeaders["Content-Type"] = "application/json";
    requestBody = JSON.stringify(body);
  }

  let response: Response;
  try {
    response = await fetch(path, {
      method,
      headers: requestHeaders,
      body: requestBody,
    });
  } catch (err) {
    return {
      ok: false,
      status: 0,
      error: {
        status: 0,
        message: "שגיאת רשת. נסו שוב.",
        payload: err,
      },
    };
  }

  const payload = await tryParseJson(response);

  if (response.status === 401) {
    clearSession();
    // AuthProvider listens to auth change and sets guest; RequireAuth redirects to login.
  }

  if (!response.ok) {
    return {
      ok: false,
      status: response.status,
      error: toApiError(response.status, payload, fallbackErrorMessage),
    };
  }

  return {
    ok: true,
    status: response.status,
    data: (payload as T) ?? ({} as T),
  };
}

type BlobRequestOptions = {
  headers?: Record<string, string>;
  auth?: boolean;
  fallbackErrorMessage?: string;
};

export async function apiBlob(
  path: string,
  options: BlobRequestOptions = {},
): Promise<
  | { ok: true; status: number; blob: Blob; response: Response }
  | { ok: false; status: number; error: ApiError }
> {
  const {
    headers = {},
    auth = false,
    fallbackErrorMessage = "שגיאה בבקשה לשרת.",
  } = options;

  const requestHeaders: Record<string, string> = {
    ...headers,
  };

  const token = getToken();
  if (auth) {
    if (!token) {
      return {
        ok: false,
        status: 401,
        error: toApiError(401, null, "אין הרשאה. נא להתחבר."),
      };
    }
    requestHeaders.Authorization = `Bearer ${token}`;
  } else if (token) {
    requestHeaders.Authorization = `Bearer ${token}`;
  }

  let response: Response;
  try {
    response = await fetch(path, {
      headers: requestHeaders,
    });
  } catch (err) {
    return {
      ok: false,
      status: 0,
      error: {
        status: 0,
        message: "שגיאת רשת. נסו שוב.",
        payload: err,
      },
    };
  }

  if (response.status === 401) {
    clearSession();
    // AuthProvider redirects to login via RequireAuth.
  }

  const contentType = response.headers.get("content-type") ?? "";
  const isJson = contentType.includes("application/json");

  if (!response.ok) {
    const payload = isJson ? await tryParseJson(response) : null;
    return {
      ok: false,
      status: response.status,
      error: toApiError(response.status, payload, fallbackErrorMessage),
    };
  }

  if (isJson) {
    const payload = await tryParseJson(response);
    return {
      ok: false,
      status: 500,
      error: toApiError(500, payload, "תגובה לא צפויה מהשרת."),
    };
  }

  const blob = await response.blob();
  return { ok: true, status: response.status, blob, response };
}

