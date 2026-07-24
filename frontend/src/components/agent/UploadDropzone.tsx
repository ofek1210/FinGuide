import { useRef, useState } from "react";
import { Upload, File, X } from "lucide-react";
import "./agent-onboarding.css";

interface UploadDropzoneProps {
  accept?: string;
  label?: string;
  sublabel?: string;
  onFile: (file: File) => void;
  loading?: boolean;
  accentColor?: string;
}

export default function UploadDropzone({
  accept = "*",
  label = "גרור קובץ לכאן",
  sublabel = "או לחץ לבחירה",
  onFile,
  loading = false,
  accentColor = "var(--agent, var(--lav-600))",
}: UploadDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [selected, setSelected] = useState<File | null>(null);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      setSelected(file);
      onFile(file);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelected(file);
      onFile(file);
    }
  };

  const clear = (e: React.MouseEvent) => {
    e.stopPropagation();
    setSelected(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  return (
    <div
      className="agent-upload-dropzone"
      role="button"
      tabIndex={loading ? -1 : 0}
      aria-disabled={loading}
      aria-busy={loading}
      aria-label={selected ? `קובץ נבחר: ${selected.name}` : `${label}. ${sublabel}`}
      onClick={() => !loading && inputRef.current?.click()}
      onKeyDown={(e) => {
        if (!loading && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          inputRef.current?.click();
        }
      }}
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      style={{
        borderRadius: "var(--r-card)",
        border: `1.5px dashed ${dragging ? accentColor : "var(--border-soft)"}`,
        background: dragging ? "var(--agent-soft, var(--lav-50))" : "var(--card)",
        padding: "36px 24px",
        textAlign: "center",
        cursor: loading ? "wait" : "pointer",
        transition: "all 0.2s var(--ease)",
        position: "relative",
        boxShadow: "var(--shadow-soft)",
      }}
    >
      <input ref={inputRef} type="file" accept={accept} onChange={handleChange} style={{ display: "none" }} />

      {selected ? (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}>
          <File size={20} color={accentColor} />
          <span style={{ fontSize: 14, fontWeight: 600, color: "var(--text-strong)" }}>{selected.name}</span>
          {!loading && (
            <button
              type="button"
              aria-label={`הסר את הקובץ ${selected.name}`}
              onClick={clear}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                padding: 4,
                color: "var(--danger)",
                display: "flex",
              }}
            >
              <X size={16} />
            </button>
          )}
        </div>
      ) : (
        <>
          <div
            style={{
              width: 52,
              height: 52,
              borderRadius: 12,
              margin: "0 auto 14px",
              background: "var(--agent-soft, var(--lav-100))",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Upload size={22} color={accentColor} />
          </div>
          <div style={{ fontSize: 14.5, fontWeight: 700, color: "var(--text-strong)", marginBottom: 4 }}>{label}</div>
          <div style={{ fontSize: 12.5, color: "var(--text-muted)", fontWeight: 500 }}>{sublabel}</div>
        </>
      )}

      {loading && (
        <div
          role="status"
          aria-label="מעלה ומעבד את הקובץ"
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: "inherit",
            background: "rgba(255,255,255,0.7)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div
            style={{
              width: 28,
              height: 28,
              border: "3px solid var(--agent-ring, var(--lav-200))",
              borderTop: `3px solid ${accentColor}`,
              borderRadius: "50%",
              animation: "spin 0.8s linear infinite",
            }}
          />
        </div>
      )}
    </div>
  );
}
