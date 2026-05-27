import { useCallback, useEffect, useRef, useState } from "react";
import {
  getSavingsForecast,
  type SavingsForecastData,
  type SavingsForecastRequest,
} from "../api/findings.api";
import { getApiErrorMessage } from "../utils/apiErrorMessages";

export const FORECAST_STORAGE_KEY = "finguide_savings_forecast_inputs";
const FORECAST_DEBOUNCE_MS = 400;

export type ForecastFormState = {
  currentBalance: string;
  currentAge: string;
  retirementAge: string;
  adjustedMonthlyContribution: string;
  currentMonthlyContribution: string;
};

export const DEFAULT_FORECAST_FORM: ForecastFormState = {
  currentBalance: "",
  currentAge: "",
  retirementAge: "",
  adjustedMonthlyContribution: "",
  currentMonthlyContribution: "",
};

const readStoredForecastForm = (): ForecastFormState => {
  if (typeof window === "undefined") {
    return DEFAULT_FORECAST_FORM;
  }

  try {
    const raw = window.sessionStorage.getItem(FORECAST_STORAGE_KEY);
    if (!raw) {
      return DEFAULT_FORECAST_FORM;
    }

    const parsed = JSON.parse(raw) as Partial<ForecastFormState>;
    return {
      currentBalance: typeof parsed.currentBalance === "string" ? parsed.currentBalance : "",
      currentAge: typeof parsed.currentAge === "string" ? parsed.currentAge : "",
      retirementAge: typeof parsed.retirementAge === "string" ? parsed.retirementAge : "",
      adjustedMonthlyContribution:
        typeof parsed.adjustedMonthlyContribution === "string"
          ? parsed.adjustedMonthlyContribution
          : "",
      currentMonthlyContribution:
        typeof parsed.currentMonthlyContribution === "string"
          ? parsed.currentMonthlyContribution
          : "",
    };
  } catch {
    return DEFAULT_FORECAST_FORM;
  }
};

export const getNumericStringValue = (value: string) => {
  if (!value.trim()) return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  return parsed;
};

export const hasCoreForecastInputs = (form: ForecastFormState) =>
  Boolean(
    form.currentBalance.trim() &&
      form.currentAge.trim() &&
      form.retirementAge.trim() &&
      form.adjustedMonthlyContribution.trim()
  );

export const canRequestForecast = (
  form: ForecastFormState,
  showManualContributionInput: boolean
) => {
  if (!hasCoreForecastInputs(form)) {
    return false;
  }

  if (showManualContributionInput && !form.currentMonthlyContribution.trim()) {
    return false;
  }

  return true;
};

export function useSavingsForecast() {
  const [forecastForm, setForecastForm] = useState<ForecastFormState>(
    () => readStoredForecastForm()
  );
  const [showManualContributionInput, setShowManualContributionInput] = useState(
    () => Boolean(readStoredForecastForm().currentMonthlyContribution)
  );
  const [forecast, setForecast] = useState<SavingsForecastData | null>(null);
  const [forecastError, setForecastError] = useState("");
  const [isForecastLoading, setIsForecastLoading] = useState(false);
  const debounceTimerRef = useRef<number | null>(null);

  const buildForecastPayload = useCallback(
    (
      form: ForecastFormState,
      { manualContributionRequired = false }: { manualContributionRequired?: boolean } = {}
    ): SavingsForecastRequest | null => {
      if (!hasCoreForecastInputs(form)) {
        return null;
      }

      const currentBalance = getNumericStringValue(form.currentBalance);
      const currentAge = getNumericStringValue(form.currentAge);
      const retirementAge = getNumericStringValue(form.retirementAge);
      const adjustedMonthlyContribution = getNumericStringValue(
        form.adjustedMonthlyContribution
      );
      const currentMonthlyContribution = getNumericStringValue(
        form.currentMonthlyContribution
      );

      if (
        currentBalance === null ||
        currentAge === null ||
        retirementAge === null ||
        adjustedMonthlyContribution === null
      ) {
        setForecastError("נא להזין מספרים תקינים לכל שדות החובה.");
        return null;
      }

      if (
        currentBalance < 0 ||
        currentAge < 0 ||
        retirementAge < 0 ||
        adjustedMonthlyContribution < 0
      ) {
        setForecastError("כל הערכים חייבים להיות גדולים או שווים ל-0.");
        return null;
      }

      if (!Number.isInteger(currentAge) || !Number.isInteger(retirementAge)) {
        setForecastError("גיל נוכחי וגיל פרישה חייבים להיות מספרים שלמים.");
        return null;
      }

      if (retirementAge <= currentAge) {
        setForecastError("גיל הפרישה חייב להיות גדול מהגיל הנוכחי.");
        return null;
      }

      if (manualContributionRequired) {
        if (currentMonthlyContribution === null) {
          setForecastError("לא נמצאה הפקדה במסמכים. הזינו הפקדה חודשית נוכחית ידנית.");
          return null;
        }

        if (currentMonthlyContribution < 0) {
          setForecastError("הפקדה חודשית נוכחית חייבת להיות גדולה או שווה ל-0.");
          return null;
        }
      }

      return {
        currentBalance,
        currentAge,
        retirementAge,
        adjustedMonthlyContribution,
        ...(currentMonthlyContribution !== null && { currentMonthlyContribution }),
      };
    },
    []
  );

  const loadForecast = useCallback(
    async (
      form: ForecastFormState,
      {
        manualContributionRequired = false,
        silent = false,
      }: { manualContributionRequired?: boolean; silent?: boolean } = {}
    ) => {
      const payload = buildForecastPayload(form, { manualContributionRequired });
      if (!payload) {
        return false;
      }

      setIsForecastLoading(true);
      if (!silent) {
        setForecastError("");
      }

      const response = await getSavingsForecast(payload);
      setIsForecastLoading(false);

      if (!response.success || !response.data) {
        const resolvedMessage = getApiErrorMessage(
          response.message || "לא הצלחנו לחשב תחזית חיסכון.",
          response.status
        );

        const requiresManualContribution = Array.isArray(response.errors)
          ? response.errors.some((item) => {
              if (!item || typeof item !== "object") {
                return false;
              }
              const field = (item as { field?: string }).field;
              return field === "currentMonthlyContribution";
            })
          : false;

        if (requiresManualContribution) {
          setShowManualContributionInput(true);
          if (!silent) {
            setForecastError(
              "לא נמצאה הפקדה חודשית תקינה במסמכים. הזינו הפקדה נוכחית ידנית כדי להמשיך."
            );
          }
        } else if (!silent) {
          setForecastError(resolvedMessage);
        }

        return false;
      }

      setForecast(response.data);
      setShowManualContributionInput(response.data.meta.contributionSource === "manual");
      setForecastError("");
      return true;
    },
    [buildForecastPayload]
  );

  const handleForecastFieldChange = (field: keyof ForecastFormState, value: string) => {
    setForecastForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleForecastSubmit = useCallback(async () => {
    await loadForecast(forecastForm, {
      manualContributionRequired: showManualContributionInput,
    });
  }, [forecastForm, loadForecast, showManualContributionInput]);

  const refreshForecast = useCallback(async () => {
    if (!canRequestForecast(forecastForm, showManualContributionInput)) {
      return false;
    }

    return loadForecast(forecastForm, {
      manualContributionRequired: showManualContributionInput,
    });
  }, [forecastForm, loadForecast, showManualContributionInput]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    window.sessionStorage.setItem(FORECAST_STORAGE_KEY, JSON.stringify(forecastForm));
  }, [forecastForm]);

  useEffect(() => {
    if (!canRequestForecast(forecastForm, showManualContributionInput)) {
      return;
    }

    if (debounceTimerRef.current !== null) {
      window.clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = window.setTimeout(() => {
      void loadForecast(forecastForm, {
        manualContributionRequired: showManualContributionInput,
        silent: true,
      });
    }, FORECAST_DEBOUNCE_MS);

    return () => {
      if (debounceTimerRef.current !== null) {
        window.clearTimeout(debounceTimerRef.current);
      }
    };
  }, [forecastForm, loadForecast, showManualContributionInput]);

  const forecastDelta = forecast?.summary.differenceAtRetirement ?? null;
  const forecastWarnings = forecast?.meta.warnings ?? [];

  return {
    forecastForm,
    showManualContributionInput,
    forecast,
    forecastError,
    isForecastLoading,
    forecastDelta,
    forecastWarnings,
    handleForecastFieldChange,
    handleForecastSubmit,
    refreshForecast,
    setForecastError,
  };
}
