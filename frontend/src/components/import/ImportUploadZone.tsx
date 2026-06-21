import { AlertCircle, CheckCircle } from "lucide-react";
import type { ReactNode, RefObject } from "react";
import GlassCard from "../ui/GlassCard";

type UploadMsg = { type: "success" | "error"; text: string } | null;

type ImportUploadZoneProps = {
  fileInputRef: RefObject<HTMLInputElement | null>;
  accept: string;
  uploading: boolean;
  uploadMsg: UploadMsg;
  isDragging: boolean;
  setIsDragging: (v: boolean) => void;
  onUpload: (file: File) => void;
  accentColor: string;
  gradientFrom: string;
  gradientTo: string;
  progressSteps: string[];
  uploadProgressStep: number | null;
  progressFallback: string;
  progressDotSize?: number;
  idleEmoji: string;
  idleTitle: string;
  idleSub: string;
  pickFileLabel: string;
  fileHint: string;
  pickFileIcon?: ReactNode;
  uploadingHint?: string;
};

export function ImportUploadZone({
  fileInputRef,
  accept,
  uploading,
  uploadMsg,
  isDragging,
  setIsDragging,
  onUpload,
  accentColor,
  gradientFrom,
  gradientTo,
  progressSteps,
  uploadProgressStep,
  progressFallback,
  progressDotSize = 10,
  idleEmoji,
  idleTitle,
  idleSub,
  pickFileLabel,
  fileHint,
  pickFileIcon,
  uploadingHint = "זה יכול לקחת כמה שניות",
}: ImportUploadZoneProps) {
  return (
    <GlassCard padding="lg" elevated style={{ marginBottom: 20 }}>
      <input
        ref={fileInputRef}
        type="file"
        accept={accept}
        onChange={e => {
          const f = e.target.files?.[0];
          if (f) onUpload(f);
          e.target.value = "";
        }}
        style={{ display: "none" }}
      />
      <div
        role="button"
        tabIndex={0}
        onClick={() => !uploading && fileInputRef.current?.click()}
        onKeyDown={e => { if (e.key === "Enter" && !uploading) fileInputRef.current?.click(); }}
        onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={e => {
          e.preventDefault();
          setIsDragging(false);
          const f = e.dataTransfer.files?.[0];
          if (f) onUpload(f);
        }}
        style={{
          border: `2px dashed ${isDragging ? accentColor : uploading ? "rgba(5,150,105,0.4)" : "rgba(184,157,255,0.40)"}`,
          borderRadius: 20,
          padding: "52px 24px",
          textAlign: "center",
          cursor: uploading ? "wait" : "pointer",
          background: isDragging ? `${accentColor}0D` : uploading ? "rgba(5,150,105,0.04)" : "rgba(250,247,255,0.5)",
          transition: "all 0.2s",
        }}
      >
        {uploading ? (
          <>
            <div style={{ fontSize: 36, marginBottom: 12 }}>⚙️</div>
            <div style={{ fontSize: 15, color: accentColor, fontWeight: 700 }}>
              {uploadProgressStep != null ? progressSteps[uploadProgressStep] : progressFallback}
            </div>
            <div style={{ display: "flex", gap: progressDotSize === 8 ? 6 : 8, justifyContent: "center", marginTop: progressDotSize === 8 ? 12 : 14 }}>
              {progressSteps.map((_, i) => (
                <div
                  key={i}
                  style={{
                    width: progressDotSize,
                    height: progressDotSize,
                    borderRadius: "50%",
                    background: uploadProgressStep != null && i <= uploadProgressStep ? accentColor : `${accentColor}33`,
                  }}
                />
              ))}
            </div>
            {uploadingHint ? (
              <div style={{ fontSize: 13, color: "#A89CC8", marginTop: 6 }}>{uploadingHint}</div>
            ) : null}
          </>
        ) : (
          <>
            <div style={{ fontSize: 44, marginBottom: 14 }}>{idleEmoji}</div>
            <div style={{ fontSize: 17, fontWeight: 700, color: "#1F1F1F", marginBottom: 6 }}>{idleTitle}</div>
            <div style={{ fontSize: 14, color: "#7C6FA0", marginBottom: 20 }}>{idleSub}</div>
            <div style={{
              display: "inline-flex", alignItems: "center", gap: 7,
              padding: "10px 22px", borderRadius: 12,
              background: `linear-gradient(135deg, ${gradientFrom}, ${gradientTo})`,
              color: "#fff", fontSize: 14, fontWeight: 700,
            }}>
              {pickFileIcon}
              {pickFileLabel}
            </div>
            <div style={{ fontSize: 12, color: "#A89CC8", marginTop: 12 }}>{fileHint}</div>
          </>
        )}
      </div>

      {uploadMsg ? (
        <div style={{
          marginTop: 16, padding: "12px 16px", borderRadius: 12, fontWeight: 600, fontSize: 14,
          background: uploadMsg.type === "error" ? "#FEF2F2" : "#ECFDF5",
          color: uploadMsg.type === "error" ? "#DC2626" : "#059669",
          border: `1px solid ${uploadMsg.type === "error" ? "rgba(220,38,38,0.2)" : "rgba(5,150,105,0.2)"}`,
          display: "flex", alignItems: "center", gap: 8,
        }}>
          {uploadMsg.type === "error" ? <AlertCircle size={16} /> : <CheckCircle size={16} />}
          {uploadMsg.text}
        </div>
      ) : null}
    </GlassCard>
  );
}
