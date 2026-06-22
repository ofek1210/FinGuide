import { useCallback, useState } from "react";

export function useGovReportUploadProgress(stepCount: number, intervalMs = 800) {
  const [uploadProgressStep, setUploadProgressStep] = useState<number | null>(null);

  const start = useCallback(() => {
    setUploadProgressStep(0);
    return window.setInterval(() => {
      setUploadProgressStep(prev =>
        prev != null && prev < stepCount - 1 ? prev + 1 : prev,
      );
    }, intervalMs);
  }, [stepCount, intervalMs]);

  const stop = useCallback((timerId: number) => {
    window.clearInterval(timerId);
    setUploadProgressStep(null);
  }, []);

  return { uploadProgressStep, start, stop };
}
