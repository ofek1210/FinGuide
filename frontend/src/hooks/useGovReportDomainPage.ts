import { useCallback, useRef, useState } from "react";
import { useGovReportUploadProgress } from "./useGovReportUploadProgress";

export type FlowStep = "landing" | "guide" | "upload" | "results";

type UploadMsg = { type: "success" | "error"; text: string } | null;

type UseGovReportDomainPageOptions<TUploadResult> = {
  progressStepCount: number;
  allowedExts: string[];
  maxFileBytes: number;
  extErrorMessage: string;
  sizeErrorMessage: string;
  uploadFile: (file: File) => Promise<TUploadResult>;
  onUploadSuccess?: (result: TUploadResult) => void;
  extractSavingsDelta?: (result: TUploadResult) => number | null | undefined;
  uploadSuccessMessage: (result: TUploadResult) => string;
  reloadAfterUpload: () => Promise<void>;
  reloadImportHistory?: () => Promise<void>;
  resultsTransitionDelay?: number;
  /**
   * When true (default) the flow auto-advances to the results step shortly after
   * a successful upload. Set false to keep the success state visible and let the
   * caller drive the transition (e.g. via a "view insights" button).
   */
  autoAdvanceOnSuccess?: boolean;
};

export function useGovReportDomainPage<TUploadResult extends { success?: boolean; message?: string }>({
  progressStepCount,
  allowedExts,
  maxFileBytes,
  extErrorMessage,
  sizeErrorMessage,
  uploadFile,
  onUploadSuccess,
  extractSavingsDelta,
  uploadSuccessMessage,
  reloadAfterUpload,
  reloadImportHistory,
  resultsTransitionDelay = 1400,
  autoAdvanceOnSuccess = true,
}: UseGovReportDomainPageOptions<TUploadResult>) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { uploadProgressStep, start: startProgress, stop: stopProgress } =
    useGovReportUploadProgress(progressStepCount);

  const [step, setStep] = useState<FlowStep>("landing");
  const [uploading, setUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState<UploadMsg>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [visitedSite, setVisitedSite] = useState(false);
  const [lastSavingsDelta, setLastSavingsDelta] = useState<number | null>(null);

  const handleUpload = useCallback(async (file: File) => {
    const ext = file.name.split(".").pop()?.toLowerCase();
    if (!allowedExts.includes(ext ?? "")) {
      setUploadMsg({ type: "error", text: extErrorMessage });
      return;
    }
    if (file.size > maxFileBytes) {
      setUploadMsg({ type: "error", text: sizeErrorMessage });
      return;
    }

    setUploading(true);
    setUploadMsg(null);
    const progressTimer = startProgress();
    const res = await uploadFile(file);
    stopProgress(progressTimer);
    setUploading(false);

    if (res.success) {
      if (extractSavingsDelta) {
        const delta = extractSavingsDelta(res);
        if (delta != null) setLastSavingsDelta(delta);
      }
      onUploadSuccess?.(res);
      setUploadMsg({ type: "success", text: uploadSuccessMessage(res) });
      await reloadAfterUpload();
      if (reloadImportHistory) await reloadImportHistory();
      if (autoAdvanceOnSuccess) setTimeout(() => setStep("results"), resultsTransitionDelay);
    } else {
      setUploadMsg({ type: "error", text: res.message ?? "שגיאה בייבוא הקובץ" });
    }
  }, [
    allowedExts, extErrorMessage, maxFileBytes, sizeErrorMessage,
    uploadFile, extractSavingsDelta, onUploadSuccess, uploadSuccessMessage,
    reloadAfterUpload, reloadImportHistory, resultsTransitionDelay,
    autoAdvanceOnSuccess, startProgress, stopProgress,
  ]);

  const resetUpload = useCallback(() => {
    setUploadMsg(null);
    setUploading(false);
  }, []);

  return {
    fileInputRef,
    step,
    setStep,
    uploading,
    uploadMsg,
    isDragging,
    setIsDragging,
    visitedSite,
    setVisitedSite,
    uploadProgressStep,
    lastSavingsDelta,
    setLastSavingsDelta,
    handleUpload,
    resetUpload,
  };
}
