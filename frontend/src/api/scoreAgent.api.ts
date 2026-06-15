import { apiJson } from "./client";

export type GapImpact = {
  kind: "score" | "finding";
  label: string;
};

export type ScoreGap = {
  id: string;
  kind: "payslip_field" | "missing_document";
  fundType?: "pension" | "study_fund";
  role?: "employee" | "employer";
  documentId?: string;
  period: string;
  periodLabel: string;
  fieldLabel: string;
  question: string;
  inputType?: "currency";
  actionUrl?: string;
  improves: GapImpact;
};

export type ScoreGapsData = {
  year: number;
  score: number;
  level: "poor" | "fair" | "good" | "excellent";
  label: string;
  gaps: ScoreGap[];
  fillableCount: number;
  saved?: { gapId: string; value: number; documentId: string };
};

type ScoreGapsResponse = {
  success: boolean;
  message?: string;
  data?: ScoreGapsData;
};

export const getScoreGaps = async (year: number) => {
  const result = await apiJson<ScoreGapsResponse>(
    `/api/score-agent/gaps?year=${year}`,
    {
      auth: true,
      fallbackErrorMessage: "לא הצלחנו לטעון את החוסרים לציון.",
    },
  );

  if (!result.ok) {
    return { success: false, message: result.error.message } as ScoreGapsResponse;
  }

  return (
    result.data ||
    ({ success: false, message: "תגובה לא תקינה." } as ScoreGapsResponse)
  );
};

export const submitScoreAnswer = async (
  gapId: string,
  documentId: string,
  value: number,
  year: number,
) => {
  const result = await apiJson<ScoreGapsResponse>("/api/score-agent/answer", {
    method: "POST",
    auth: true,
    body: { gapId, documentId, value, year },
    fallbackErrorMessage: "לא הצלחנו לשמור את הנתון.",
  });

  if (!result.ok) {
    return { success: false, message: result.error.message } as ScoreGapsResponse;
  }

  return (
    result.data ||
    ({ success: false, message: "תגובה לא תקינה." } as ScoreGapsResponse)
  );
};
