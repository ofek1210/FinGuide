import { apiJson } from "./client";

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
  status?: number;
  count?: number;
  data?: FindingItem[];
};

const getToken = () => localStorage.getItem("token");

export const listFindings = async () => {
  const token = getToken();
  if (!token) {
    return { success: false, message: "אין הרשאה. נא להתחבר." } as ListFindingsResponse;
  }

  const result = await apiJson<ListFindingsResponse>("/api/findings", {
    auth: true,
    fallbackErrorMessage: "לא הצלחנו לטעון את הממצאים.",
  });

  if (!result.ok) {
    return {
      success: false,
      message: result.error.message,
      status: result.status,
    } as ListFindingsResponse;
  }

  return result.data || ({ success: false, message: "תגובה לא תקינה." } as ListFindingsResponse);
};
