/**
 * HubDocumentCenter — clearinghouse report intake on the main Hub only.
 * Har HaBituach and payslips are uploaded inside their respective agents.
 */
import { useEffect, useRef, useState } from "react";
import {
  CheckCircle2, Clock, FileSpreadsheet, Loader2, Upload,
} from "lucide-react";
import ClearinghouseImportGuide from "../pension/ClearinghouseImportGuide";
import { CLEARINGHOUSE_SITE_URL } from "../../config/govReportImportConfig";
import { useAuth } from "../../auth/AuthProvider";
import { uploadPensionClearinghouse } from "../../api/pension.api";
import {
  clearinghouseReadinessLines,
  markClearinghouseIntakeComplete,
  markClearinghouseIntakeWaiting,
  type ClearinghouseUploadReadiness,
  type HubDocumentId,
} from "../../utils/hubDocuments";

type CardFlow = "idle" | "guide" | "upload" | "waiting" | "success";

type Props = {
  focusDocument?: HubDocumentId | null;
  clearinghouseFundCount: number;
  onUploadComplete?: () => void;
};

const CARD: React.CSSProperties = {
  background: "var(--card)",
  border: "1px solid var(--border-hair)",
  borderRadius: "var(--radius)",
  padding: "24px 26px",
  boxShadow: "var(--shadow-soft)",
  maxWidth: 640,
};

function actionBtn(active = false): React.CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    gap: 7,
    padding: "9px 14px",
    borderRadius: "var(--r-md)",
    border: `1px solid ${active ? "var(--lav-300)" : "var(--border-soft)"}`,
    background: active ? "var(--lav-50)" : "var(--surface-sunken)",
    color: "var(--text-strong)",
    cursor: "pointer",
    fontFamily: "inherit",
    fontWeight: 700,
    fontSize: 13,
  };
}

function ClearinghouseUploadPanel({
  onBack,
  onSuccess,
}: {
  onBack: () => void;
  onSuccess: (readiness: ClearinghouseUploadReadiness) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    const ext = file.name.split(".").pop()?.toLowerCase();
    if (!["xlsx", "xls"].includes(ext ?? "")) {
      setError("יש להעלות קובץ Excel (.xls / .xlsx) מהמסלקה הפנסיונית");
      return;
    }
    setUploading(true);
    setError(null);
    const res = await uploadPensionClearinghouse(file);
    setUploading(false);
    if (!res.success) {
      setError(res.message ?? "שגיאה בייבוא המסלקה");
      return;
    }
    const readiness = res.data?.agentReadiness ?? {
      pensionReady: false,
      gemelReady: false,
      pensionInsuranceReady: false,
      pensionFundCount: 0,
      gemelFundCount: 0,
      pensionCoverageCount: 0,
    };
    onSuccess(readiness);
  };

  return (
    <div style={{ marginTop: 16 }}>
      <button type="button" onClick={onBack} style={{ ...actionBtn(), marginBottom: 12 }}>← חזרה</button>
      <div
        onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={e => { e.preventDefault(); setIsDragging(false); void handleFile(e.dataTransfer.files[0]); }}
        onClick={() => !uploading && fileRef.current?.click()}
        style={{
          border: `2px dashed ${isDragging ? "var(--lav-500)" : "rgba(124,95,214,.35)"}`,
          borderRadius: 16,
          padding: "36px 20px",
          textAlign: "center",
          cursor: uploading ? "wait" : "pointer",
          background: isDragging ? "var(--lav-50)" : "var(--surface-sunken)",
        }}
      >
        <input ref={fileRef} type="file" accept=".xlsx,.xls" hidden onChange={e => {
          const f = e.target.files?.[0];
          if (f) void handleFile(f);
          e.target.value = "";
        }}
        />
        {uploading ? (
          <Loader2 size={32} color="var(--lav-600)" style={{ animation: "fgSpin 1s linear infinite", margin: "0 auto 10px" }} />
        ) : (
          <Upload size={32} color="var(--lav-600)" style={{ margin: "0 auto 10px" }} />
        )}
        <p style={{ margin: "0 0 4px", fontWeight: 800, fontSize: 15 }}>גרור קובץ מסלקה או לחץ לבחירה</p>
        <p style={{ margin: 0, fontSize: 13, color: "var(--text-muted)" }}>Excel עם 3 גיליונות מהמסלקה הפנסיונית · דוח חדש יחליף את הקודם</p>
      </div>
      {error && <p style={{ marginTop: 12, color: "var(--danger)", fontSize: 13.5 }}>{error}</p>}
    </div>
  );
}

function UploadSuccessPanel({
  title,
  lines,
  onDone,
}: {
  title: string;
  lines: string[];
  onDone: () => void;
}) {
  return (
    <div style={{ marginTop: 16, padding: 16, borderRadius: "var(--r-md)", background: "var(--mint-soft)", border: "1px solid var(--mint)" }}>
      <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
        <CheckCircle2 size={20} color="var(--mint-ink)" style={{ flex: "none", marginTop: 2 }} />
        <div style={{ flex: 1 }}>
          <p style={{ margin: "0 0 8px", fontWeight: 900, fontSize: 15, color: "var(--mint-ink)" }}>{title}</p>
          {lines.length > 0 ? (
            <ul style={{ margin: 0, paddingInlineStart: 18, display: "grid", gap: 4 }}>
              {lines.map(line => (
                <li key={line} style={{ fontSize: 13.5, color: "var(--text-body)", fontWeight: 600 }}>{line}</li>
              ))}
            </ul>
          ) : (
            <p style={{ margin: 0, fontSize: 13, color: "var(--text-muted)" }}>הדוח נקלט — היכנסו לסוכן הרלוונטי להשלמת האונבורדינג.</p>
          )}
        </div>
      </div>
      <button type="button" onClick={onDone} style={{ ...actionBtn(true), marginTop: 14 }}>סגור</button>
    </div>
  );
}

export default function HubDocumentCenter({
  focusDocument,
  clearinghouseFundCount,
  onUploadComplete,
}: Props) {
  const { user } = useAuth();
  const sectionRef = useRef<HTMLElement>(null);

  const [clearinghouseFlow, setClearinghouseFlow] = useState<CardFlow>("idle");
  const [clearinghouseSuccess, setClearinghouseSuccess] = useState<string[]>([]);

  useEffect(() => {
    if (focusDocument !== "clearinghouse") return;
    sectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    setClearinghouseFlow("idle");
  }, [focusDocument]);

  const clearinghouseStatus = clearinghouseFundCount > 0 ? "ok" : "missing";

  return (
    <section ref={sectionRef} id="hub-document-center" style={{ marginBottom: 32, scrollMarginTop: 90 }}>
      <h2 style={{ margin: "0 0 6px", fontSize: "clamp(20px,2.4vw,26px)", fontWeight: 900, color: "var(--text-strong)" }}>
        דוח המסלקה הפנסיונית
      </h2>
      <p style={{ margin: "0 0 20px", fontSize: 14, color: "var(--text-muted)", fontWeight: 500, maxWidth: 520 }}>
        מהסוכן הראשי מעלים רק את דוח המסלקה (~15 ₪). דוח אחד מזין את סוכן הפנסיה, סוכן הגמל וכיסויים פנסיוניים.
        תלושים ודוח הר הביטוח — דרך הסוכנים שלהם.
      </p>

      <article data-document-card="clearinghouse" style={CARD}>
        <div style={{ display: "flex", gap: 12, marginBottom: 14 }}>
          <span style={{ width: 44, height: 44, borderRadius: 12, background: "var(--lav-100)", color: "var(--lav-600)", display: "grid", placeItems: "center" }}>
            <FileSpreadsheet size={22} />
          </span>
          <div>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 900 }}>ייבוא דוח Excel מהמסלקה</h3>
            <p style={{ margin: "4px 0 0", fontSize: 13, color: clearinghouseStatus === "ok" ? "var(--mint-ink)" : "var(--text-muted)" }}>
              {clearinghouseStatus === "ok" ? `${clearinghouseFundCount} מוצרים במעקב` : "טרם יובא דוח — הזמינו או העלו כשיגיע"}
            </p>
          </div>
        </div>

        {clearinghouseFlow === "idle" && !clearinghouseSuccess.length && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {clearinghouseStatus === "ok" ? (
              <button type="button" style={actionBtn(true)} onClick={() => setClearinghouseFlow("upload")}>
                <Upload size={14} /> העלה דוח מעודכן
              </button>
            ) : null}
            <button type="button" style={actionBtn()} onClick={() => setClearinghouseFlow("guide")}>איך מזמינים את הדוח</button>
            <button type="button" style={actionBtn()} onClick={() => setClearinghouseFlow("upload")}>כבר יש לי דוח</button>
            <button type="button" style={actionBtn()} onClick={() => {
              if (user?.id) markClearinghouseIntakeWaiting(user.id);
              setClearinghouseFlow("waiting");
            }}>
              <Clock size={14} /> הזמנתי ואני ממתין/ה
            </button>
          </div>
        )}

        {clearinghouseFlow === "guide" && (
          <div style={{ marginTop: 8 }}>
            <ClearinghouseImportGuide
              compact
              onBack={() => setClearinghouseFlow("idle")}
              onContinue={() => setClearinghouseFlow("upload")}
              onVisitSite={() => window.open(CLEARINGHOUSE_SITE_URL, "_blank", "noopener,noreferrer")}
            />
          </div>
        )}

        {clearinghouseFlow === "waiting" && (
          <div style={{ marginTop: 16 }}>
            <button type="button" onClick={() => setClearinghouseFlow("idle")} style={{ ...actionBtn(), marginBottom: 12 }}>← חזרה</button>
            <p style={{ margin: "0 0 12px", fontSize: 14, lineHeight: 1.6, color: "var(--text-muted)" }}>
              מצוין — הדוח יגיע תוך עד 24 שעות. כשיגיע, בחרו «כבר יש לי דוח» להעלאה.
            </p>
            <p style={{ margin: 0, fontSize: 13, color: "var(--text-faint)" }}>
              בינתיים אפשר להמשיך לסוכן התלושים ולסוכן הביטוח.
            </p>
          </div>
        )}

        {clearinghouseFlow === "upload" && !clearinghouseSuccess.length && (
          <ClearinghouseUploadPanel
            onBack={() => setClearinghouseFlow("idle")}
            onSuccess={readiness => {
              setClearinghouseSuccess(clearinghouseReadinessLines(readiness));
              setClearinghouseFlow("success");
              if (user?.id) markClearinghouseIntakeComplete(user.id);
              onUploadComplete?.();
            }}
          />
        )}

        {clearinghouseSuccess.length > 0 && (
          <UploadSuccessPanel
            title="דוח המסלקה נקלט בהצלחה"
            lines={clearinghouseSuccess}
            onDone={() => { setClearinghouseFlow("idle"); setClearinghouseSuccess([]); }}
          />
        )}
      </article>
    </section>
  );
}
