export type HealthResponse = {
  success: boolean;
  message?: string;
  timestamp?: string;
};

const parseJson = async (response: Response) => {
  try {
    return await response.json();
  } catch {
    return null;
  }
};

export const getHealth = async () => {
  const response = await fetch("/api/health", {
    headers: {
      Accept: "application/json",
    },
  });

  const payload = await parseJson(response);

  if (!response.ok) {
    return (payload || {
      success: false,
      message: "השרת לא זמין כרגע.",
    }) as HealthResponse;
  }

  return (payload || {
    success: false,
    message: "תגובה לא תקינה.",
  }) as HealthResponse;
};
