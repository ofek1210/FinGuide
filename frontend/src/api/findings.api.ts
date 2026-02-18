export type FindingSeverity = "info" | "warning";

export type FindingItem = {
  id: string;
  title: string;
  severity: FindingSeverity;
  details: string;
};

export type ListFindingsResponse = {
  success: boolean;
  message?: string;
  count?: number;
  data?: FindingItem[];
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

export const listFindings = async () => {
  const token = getToken();
  if (!token) {
    return { success: false, message: "אין הרשאה. נא להתחבר." } as ListFindingsResponse;
  }

  const response = await fetch("/api/findings", {
    headers: {
      Accept: "application/json",
      ...getAuthHeaders(),
    },
  });

  const payload = await parseJson(response);

  if (!response.ok) {
    return (payload || {
      success: false,
      message: "לא הצלחנו לטעון את הממצאים.",
    }) as ListFindingsResponse;
  }

  return (payload || {
    success: false,
    message: "תגובה לא תקינה.",
  }) as ListFindingsResponse;
};
