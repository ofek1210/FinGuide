import { useCallback, useEffect, useState } from "react";
import {
  getScoreGaps,
  submitScoreAnswer,
  type ScoreGapsData,
} from "../api/scoreAgent.api";

export const useScoreGaps = (year: number, enabled: boolean) => {
  const [data, setData] = useState<ScoreGapsData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");

  const reload = useCallback(async () => {
    setIsLoading(true);
    setError("");
    const response = await getScoreGaps(year);
    if (response.success && response.data) {
      setData(response.data);
    } else {
      setData(null);
      setError(response.message || "לא הצלחנו לטעון את החוסרים לציון.");
    }
    setIsLoading(false);
  }, [year]);

  useEffect(() => {
    if (enabled) void reload();
  }, [enabled, reload]);

  const submit = useCallback(
    async (gapId: string, documentId: string, value: number) => {
      setIsSaving(true);
      setError("");
      const response = await submitScoreAnswer(gapId, documentId, value, year);
      setIsSaving(false);
      if (response.success && response.data) {
        setData(response.data);
        return { ok: true as const, data: response.data };
      }
      const message = response.message || "לא הצלחנו לשמור את הנתון.";
      setError(message);
      return { ok: false as const, message };
    },
    [year],
  );

  return { data, isLoading, isSaving, error, reload, submit };
};
