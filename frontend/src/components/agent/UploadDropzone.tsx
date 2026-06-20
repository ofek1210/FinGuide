import { useRef, useState } from "react";
import { Upload, File, X } from "lucide-react";

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
  accentColor = "#9B7FE8",
}: UploadDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [selected, setSelected] = useState<File | null>(null);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) { setSelected(file); onFile(file); }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) { setSelected(file); onFile(file); }
  };

  const clear = (e: React.MouseEvent) => {
    e.stopPropagation();
    setSelected(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  return (
    <div
      onClick={() => !loading && inputRef.current?.click()}
      onDragOver={e => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      style={{
        borderRadius: "var(--lg-r-lg, 24px)",
        border: `2px dashed ${dragging ? accentColor : "rgba(184,157,255,0.40)"}`,
        background: dragging ? `${accentColor}08` : "rgba(255,255,255,0.5)",
        padding: "36px 24px",
        textAlign: "center",
        cursor: loading ? "wait" : "pointer",
        transition: "all 0.2s ease",
        position: "relative",
      }}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        onChange={handleChange}
        style={{ display: "none" }}
      />

      {selected ? (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}>
          <File size={20} color={accentColor} />
          <span style={{ fontSize: 14, fontWeight: 600, color: "#1F1F1F" }}>{selected.name}</span>
          {!loading && (
            <button onClick={clear} style={{ background: "none", border: "none", cursor: "pointer", padding: 4, color: "#DC2626", display: "flex" }}>
              <X size={16} />
            </button>
          )}
        </div>
      ) : (
        <>
          <div style={{
            width: 52, height: 52, borderRadius: 16, margin: "0 auto 14px",
            background: `${accentColor}15`,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <Upload size={22} color={accentColor} />
          </div>
          <div style={{ fontSize: 14.5, fontWeight: 600, color: "#1F1F1F", marginBottom: 4 }}>{label}</div>
          <div style={{ fontSize: 12.5, color: "#7C6FA0" }}>{sublabel}</div>
        </>
      )}

      {loading && (
        <div style={{
          position: "absolute", inset: 0, borderRadius: "inherit",
          background: "rgba(255,255,255,0.7)", display: "flex",
          alignItems: "center", justifyContent: "center",
        }}>
          <div style={{
            width: 28, height: 28, border: `3px solid ${accentColor}30`,
            borderTop: `3px solid ${accentColor}`,
            borderRadius: "50%", animation: "spin 0.8s linear infinite",
          }} />
        </div>
      )}
    </div>
  );
}
