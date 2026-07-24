import { AlertCircle, CheckCircle } from "lucide-react";
import type { ReactNode, RefObject } from "react";
import "../agent/agent-onboarding.css";

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

const surfaceCard: React.CSSProperties = {
  background: "var(--surface-card, var(--card))",
  border: "1px solid var(--border-hair)",
  borderRadius: "var(--r-card)",
  boxShadow: "var(--shadow-soft)",
  padding: "clamp(20px, 4vw, 32px) clamp(18px, 4vw, 36px)",
  marginBottom: 20,
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
    <div style={surfaceCard}>
      <input
        ref={fileInputRef}
        type="file"
        accept={accept}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onUpload(f);
          e.target.value = "";
        }}
        style={{ display: "none" }}
      />
      <div
        className="agent-upload-dropzone"
        role="button"
        tabIndex={uploading ? -1 : 0}
        aria-disabled={uploading}
        aria-busy={uploading}
        aria-label={`${idleTitle}. ${idleSub}`}
        onClick={() => !uploading && fileInputRef.current?.click()}
        onKeyDown={(e) => {
          if (!uploading && (e.key === "Enter" || e.key === " ")) {
            e.preventDefault();
            fileInputRef.current?.click();
          }
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragging(false);
          const f = e.dataTransfer.files?.[0];
          if (f) onUpload(f);
        }}
        style={{
          border: `1.5px dashed ${isDragging ? accentColor : uploading ? "var(--mint)" : "var(--border-soft)"}`,
          borderRadius: "var(--r-card)",
          padding: "52px 24px",
          textAlign: "center",
          cursor: uploading ? "wait" : "pointer",
          background: isDragging
            ? "var(--agent-soft, var(--lav-50))"
            : uploading
              ? "var(--mint-soft)"
              : "var(--surface-sunken)",
          transition: "all 0.2s var(--ease)",
        }}
      >
        {uploading ? (
          <div role="status" aria-live="polite">
            <div aria-hidden="true" style={{ fontSize: 36, marginBottom: 12 }}>⚙️</div>
            <div style={{ fontSize: 15, color: accentColor, fontWeight: 700 }}>
              {uploadProgressStep != null ? progressSteps[uploadProgressStep] : progressFallback}
            </div>
            <div
              style={{
                display: "flex",
                gap: progressDotSize === 8 ? 6 : 8,
                justifyContent: "center",
                marginTop: progressDotSize === 8 ? 12 : 14,
              }}
            >
              {progressSteps.map((_, i) => (
                <div
                  key={i}
                  style={{
                    width: progressDotSize,
                    height: progressDotSize,
                    borderRadius: "50%",
                    background:
                      uploadProgressStep != null && i <= uploadProgressStep
                        ? accentColor
                        : "var(--agent-ring, var(--lav-200))",
                  }}
                />
              ))}
            </div>
            {uploadingHint ? (
              <div style={{ fontSize: 13, color: "var(--text-faint)", marginTop: 6, fontWeight: 500 }}>
                {uploadingHint}
              </div>
            ) : null}
          </div>
        ) : (
          <>
            <div aria-hidden="true" style={{ fontSize: 44, marginBottom: 14 }}>{idleEmoji}</div>
            <div style={{ fontSize: 17, fontWeight: 800, color: "var(--text-strong)", marginBottom: 6 }}>
              {idleTitle}
            </div>
            <div style={{ fontSize: 14, color: "var(--text-muted)", marginBottom: 20, fontWeight: 500 }}>
              {idleSub}
            </div>
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 7,
                padding: "12px 22px",
                borderRadius: "var(--r-btn)",
                background: "var(--ink)",
                color: "#fff",
                fontSize: 14,
                fontWeight: 800,
                boxShadow: "var(--shadow-ink)",
              }}
            >
              {pickFileIcon}
              {pickFileLabel}
            </div>
            <div style={{ fontSize: 12, color: "var(--text-faint)", marginTop: 12, fontWeight: 500 }}>{fileHint}</div>
          </>
        )}
      </div>

      {uploadMsg ? (
        <div
          role={uploadMsg.type === "error" ? "alert" : "status"}
          aria-live="polite"
          style={{
            marginTop: 16,
            padding: "12px 16px",
            borderRadius: "var(--r-btn)",
            fontWeight: 600,
            fontSize: 14,
            background: uploadMsg.type === "error" ? "var(--danger-soft, #FEF2F2)" : "var(--mint-soft)",
            color: uploadMsg.type === "error" ? "var(--danger)" : "var(--mint-ink)",
            border: `1px solid ${uploadMsg.type === "error" ? "rgba(220,38,38,0.2)" : "var(--mint)"}`,
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          {uploadMsg.type === "error" ? <AlertCircle size={16} /> : <CheckCircle size={16} />}
          {uploadMsg.text}
        </div>
      ) : null}
    </div>
  );
}
