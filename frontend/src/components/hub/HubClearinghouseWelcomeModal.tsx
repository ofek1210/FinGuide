/**
 * Full-screen welcome overlay on first Hub visit without clearinghouse data.
 * Guides ordering the ~15 ₪ report; user can wait (up to 24h) or upload when ready.
 */
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Clock, FileSpreadsheet, Loader2, Shield, Upload, X, PiggyBank } from "lucide-react";
import ClearinghouseImportGuide from "../pension/ClearinghouseImportGuide";
import { CLEARINGHOUSE_SITE_URL } from "../../config/govReportImportConfig";
import { uploadPensionClearinghouse } from "../../api/pension.api";
import { APP_ROUTES } from "../../types/navigation";
import {
  markClearinghouseIntakeComplete,
  markClearinghouseIntakeWaiting,
} from "../../utils/hubDocuments";

type Phase = "welcome" | "guide" | "upload" | "waiting";

type Props = {
  open: boolean;
  userId: string;
  onClose: () => void;
  onUploadComplete?: () => void;
};

export default function HubClearinghouseWelcomeModal({ open, userId, onClose, onUploadComplete }: Props) {
  const navigate = useNavigate();
  const [phase, setPhase] = useState<Phase>("welcome");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) setPhase("welcome");
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  const handleFile = async (file: File) => {
    const ext = file.name.split(".").pop()?.toLowerCase();
    if (!["xlsx", "xls"].includes(ext ?? "")) {
      setUploadError("יש להעלות קובץ Excel (.xls / .xlsx) מהמסלקה הפנסיונית");
      return;
    }
    setUploading(true);
    setUploadError(null);
    const res = await uploadPensionClearinghouse(file);
    setUploading(false);
    if (!res.success) {
      setUploadError(res.message ?? "שגיאה בייבוא המסלקה");
      return;
    }
    markClearinghouseIntakeComplete(userId);
    onUploadComplete?.();
    onClose();
  };

  const handleWaiting = () => {
    markClearinghouseIntakeWaiting(userId);
    setPhase("waiting");
  };

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="hub-ch-welcome-title"
      style={{
        position: "fixed", inset: 0, zIndex: 300,
        background: "rgba(26,24,38,.72)", backdropFilter: "blur(6px)",
        display: "grid", placeItems: "center", padding: "24px 16px",
        direction: "rtl", fontFamily: "var(--font-body)",
      }}
    >
      <div style={{
        width: "min(920px,100%)", maxHeight: "min(92vh,900px)", overflow: "auto",
        background: "var(--surface-page)", borderRadius: "var(--radius)",
        boxShadow: "0 24px 80px rgba(0,0,0,.35)", border: "1px solid var(--border-hair)",
        position: "relative",
      }}>
        <button
          type="button"
          aria-label="סגור"
          onClick={onClose}
          style={{
            position: "sticky", top: 12, float: "left", margin: "12px 0 0 12px",
            width: 36, height: 36, borderRadius: "50%", border: "1px solid var(--border-soft)",
            background: "var(--card)", cursor: "pointer", display: "grid", placeItems: "center",
            color: "var(--text-muted)", zIndex: 2,
          }}
        >
          <X size={18} />
        </button>

        {phase === "welcome" && (
          <div style={{ padding: "48px 36px 40px", textAlign: "center" }}>
            <span style={{
              width: 72, height: 72, borderRadius: 20, margin: "0 auto 22px",
              background: "linear-gradient(145deg,var(--lav-200),var(--lav-500))",
              color: "#fff", display: "grid", placeItems: "center",
              boxShadow: "0 12px 32px rgba(124,95,214,.35)",
            }}>
              <FileSpreadsheet size={34} strokeWidth={1.8} />
            </span>
            <h1 id="hub-ch-welcome-title" style={{ margin: "0 0 14px", fontSize: "clamp(26px,3.5vw,38px)", fontWeight: 900, letterSpacing: "-.035em", lineHeight: 1.08, color: "var(--text-strong)" }}>
              כדי שהסוכן הראשי יעבוד — צריך דוח מהמסלקה הפנסיונית
            </h1>
            <p style={{ margin: "0 auto 28px", maxWidth: 520, fontSize: 16, lineHeight: 1.65, color: "var(--text-muted)", fontWeight: 500 }}>
              הזמינו דוח Excel מרוכז (~15 ₪) מאתר המסלקה. הדוח מגיע תוך עד <b style={{ color: "var(--ink)" }}>24 שעות</b> — ואז מעלים אותו כאן.
              דוח אחד מפעיל את סוכן הפנסיה, סוכן הגמל וכיסויים פנסיוניים בסוכן הביטוח.
            </p>

            <div style={{ display: "flex", flexWrap: "wrap", gap: 10, justifyContent: "center", marginBottom: 28 }}>
              <ModalBtn primary onClick={() => setPhase("guide")}>איך מזמינים את הדוח</ModalBtn>
              <ModalBtn onClick={() => setPhase("upload")}>כבר יש לי דוח — העלאה</ModalBtn>
              <ModalBtn onClick={handleWaiting} icon={<Clock size={15} />}>הזמנתי ואני ממתין/ה</ModalBtn>
            </div>

            <div style={{
              padding: "18px 20px", borderRadius: "var(--r-md)", background: "var(--card)",
              border: "1px solid var(--border-hair)", textAlign: "right", maxWidth: 480, margin: "0 auto",
            }}>
              <p style={{ margin: "0 0 12px", fontSize: 13.5, fontWeight: 800, color: "var(--text-strong)" }}>עד שהדוח יגיע — אפשר להמשיך עם:</p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                <AgentChip icon={<PiggyBank size={14} />} label="סוכן התלושים" onClick={() => { onClose(); navigate(APP_ROUTES.documentsUpload); }} />
                <AgentChip icon={<Shield size={14} />} label="סוכן הביטוח" onClick={() => { onClose(); navigate(APP_ROUTES.insurance); }} />
              </div>
            </div>

            <button type="button" onClick={onClose} style={{ marginTop: 24, background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", fontWeight: 700, fontSize: 14, color: "var(--text-faint)" }}>
              המשך ללוח הבקרה בינתיים
            </button>
          </div>
        )}

        {phase === "guide" && (
          <ClearinghouseImportGuide
            compact
            onBack={() => setPhase("welcome")}
            onContinue={() => setPhase("upload")}
            onVisitSite={() => window.open(CLEARINGHOUSE_SITE_URL, "_blank", "noopener,noreferrer")}
          />
        )}

        {phase === "waiting" && (
          <div style={{ padding: "48px 36px 40px", textAlign: "center", maxWidth: 520, margin: "0 auto" }}>
            <span style={{ width: 64, height: 64, borderRadius: "50%", background: "var(--butter-soft)", color: "var(--butter-ink)", display: "grid", placeItems: "center", margin: "0 auto 20px" }}>
              <Clock size={28} />
            </span>
            <h2 style={{ margin: "0 0 12px", fontSize: 28, fontWeight: 900, color: "var(--text-strong)" }}>מצוין — ממתינים לדוח</h2>
            <p style={{ margin: "0 0 24px", fontSize: 15.5, lineHeight: 1.65, color: "var(--text-muted)" }}>
              כשהדוח יגיע (עד 24 שעות) — חזרו ל«המסמכים הפיננסיים שלי» בלוח הבקרה ובחרו «כבר יש לי דוח».
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center", marginBottom: 20 }}>
              <AgentChip icon={<PiggyBank size={14} />} label="סוכן התלושים" onClick={() => { onClose(); navigate(APP_ROUTES.documentsUpload); }} />
              <AgentChip icon={<Shield size={14} />} label="סוכן הביטוח" onClick={() => { onClose(); navigate(APP_ROUTES.insurance); }} />
            </div>
            <ModalBtn primary onClick={onClose}>המשך ללוח הבקרה</ModalBtn>
          </div>
        )}

        {phase === "upload" && (
          <div style={{ padding: "36px 32px 40px" }}>
            <h2 style={{ margin: "0 0 8px", fontSize: 24, fontWeight: 900, textAlign: "center", color: "var(--text-strong)" }}>העלאת דוח המסלקה</h2>
            <p style={{ margin: "0 0 24px", textAlign: "center", fontSize: 14.5, color: "var(--text-muted)" }}>Excel עם 3 גיליונות: מוצרים, הפקדות, כיסויים ביטוחיים</p>
            <div
              onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={e => { e.preventDefault(); setIsDragging(false); void handleFile(e.dataTransfer.files[0]); }}
              onClick={() => !uploading && fileRef.current?.click()}
              style={{
                border: `2px dashed ${isDragging ? "var(--lav-500)" : "rgba(124,95,214,.35)"}`,
                borderRadius: 16, padding: "48px 24px", textAlign: "center",
                cursor: uploading ? "wait" : "pointer",
                background: isDragging ? "var(--lav-50)" : "var(--surface-sunken)",
                maxWidth: 480, margin: "0 auto",
              }}
            >
              <input ref={fileRef} type="file" accept=".xlsx,.xls" hidden onChange={e => {
                const f = e.target.files?.[0];
                if (f) void handleFile(f);
                e.target.value = "";
              }}
              />
              {uploading ? (
                <Loader2 size={36} color="var(--lav-600)" style={{ animation: "fgSpin 1s linear infinite", margin: "0 auto 12px" }} />
              ) : (
                <Upload size={36} color="var(--lav-600)" style={{ margin: "0 auto 12px" }} />
              )}
              <p style={{ margin: "0 0 4px", fontWeight: 800, fontSize: 16 }}>{uploading ? "מייבא את המסלקה..." : "גרור קובץ או לחץ לבחירה"}</p>
            </div>
            {uploadError && <p style={{ marginTop: 16, textAlign: "center", color: "var(--danger)", fontSize: 14, fontWeight: 600 }}>{uploadError}</p>}
            <div style={{ textAlign: "center", marginTop: 20 }}>
              <button type="button" onClick={() => setPhase("welcome")} style={{ background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", fontWeight: 700, fontSize: 13.5, color: "var(--text-muted)" }}>← חזרה</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ModalBtn({ children, onClick, primary, icon }: {
  children: React.ReactNode; onClick: () => void; primary?: boolean; icon?: React.ReactNode;
}) {
  return (
    <button type="button" onClick={onClick} style={{
      display: "inline-flex", alignItems: "center", gap: 8,
      padding: "12px 20px", borderRadius: "var(--r-md)", cursor: "pointer",
      fontFamily: "inherit", fontWeight: 800, fontSize: 14,
      border: primary ? "none" : "1px solid var(--border-soft)",
      background: primary ? "var(--lav-600)" : "var(--card)",
      color: primary ? "#fff" : "var(--text-strong)",
      boxShadow: primary ? "var(--shadow-card)" : "none",
    }}>
      {icon}{children}
    </button>
  );
}

function AgentChip({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} style={{
      display: "inline-flex", alignItems: "center", gap: 7,
      padding: "8px 14px", borderRadius: 999, border: "1px solid var(--border-soft)",
      background: "var(--surface-sunken)", cursor: "pointer", fontFamily: "inherit",
      fontWeight: 700, fontSize: 13, color: "var(--text-body)",
    }}>
      {icon}{label}
    </button>
  );
}
