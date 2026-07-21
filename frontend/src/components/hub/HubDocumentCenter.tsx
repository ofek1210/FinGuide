/**
 * HubDocumentCenter — central document intake for clearinghouse, Har HaBituach, and payslips.
 * Reuses existing upload components and API endpoints; agents link here instead of duplicating flows.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  CheckCircle2, Clock, FileSpreadsheet, FileText, Loader2,
  PiggyBank, Shield, Upload,
} from "lucide-react";
import InsuranceImportGuide from "../insurance/InsuranceImportGuide";
import InsuranceUpload from "../insurance/InsuranceUpload";
import { INSURANCE_SITE_URL } from "../../config/govReportImportConfig";
import { uploadPensionClearinghouse } from "../../api/pension.api";
import { uploadInsuranceExcel } from "../../api/insuranceAI.api";
import { APP_ROUTES } from "../../types/navigation";
import { UPLOAD_PROGRESS_STEPS as INSURANCE_PROGRESS } from "../../utils/insuranceDisplay";
import { useGovReportUploadProgress } from "../../hooks/useGovReportUploadProgress";
import {
  clearinghouseReadinessLines,
  type ClearinghouseUploadReadiness,
  type HubDocumentId,
} from "../../utils/hubDocuments";

type CardFlow = "idle" | "guide" | "upload" | "waiting" | "success";

type Props = {
  focusDocument?: HubDocumentId | null;
  clearinghouseFundCount: number;
  insurancePolicyCount: number;
  completedPayslips: number;
  onUploadComplete?: () => void;
};

const CARD: React.CSSProperties = {
  background: "var(--card)",
  border: "1px solid var(--border-hair)",
  borderRadius: "var(--radius)",
  padding: "20px 22px",
  boxShadow: "var(--shadow-soft)",
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

function ClearinghouseOrderGuide({ onBack }: { onBack: () => void }) {
  const steps = [
    "היכנסו לאתר המסלקה הפנסיונית (mygemel / מסלקה פנסיונית) עם תעודת זהות.",
    "בחרו «הפקת דוח למסלקה פנסיונית» — עלות הדוח המלא כ-15 ₪.",
    "לאחר קבלת הקובץ (Excel עם 3 גיליונות: מוצרים, הפקדות, כיסויים ביטוחיים) — חזרו לכאן והעלו אותו.",
  ];
  return (
    <div style={{ marginTop: 16 }}>
      <button type="button" onClick={onBack} style={{ ...actionBtn(), marginBottom: 12 }}>← חזרה לכרטיס</button>
      <ol style={{ margin: 0, paddingInlineStart: 20, display: "grid", gap: 10 }}>
        {steps.map((s, i) => (
          <li key={i} style={{ fontSize: 14, lineHeight: 1.6, color: "var(--text-body)" }}>{s}</li>
        ))}
      </ol>
      <p style={{ margin: "14px 0 0", fontSize: 12.5, color: "var(--text-faint)" }}>
        דוח אחד מהמסלקה מזין את סוכן הפנסיה, סוכן הגמל וכיסויים פנסיוניים בסוכן הביטוח.
      </p>
    </div>
  );
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
      <button type="button" onClick={onBack} style={{ ...actionBtn(), marginBottom: 12 }}>← חזרה לכרטיס</button>
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
        <p style={{ margin: 0, fontSize: 13, color: "var(--text-muted)" }}>Excel עם 3 גיליונות מהמסלקה הפנסיונית</p>
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
  insurancePolicyCount,
  completedPayslips,
  onUploadComplete,
}: Props) {
  const navigate = useNavigate();
  const sectionRef = useRef<HTMLElement>(null);

  const [clearinghouseFlow, setClearinghouseFlow] = useState<CardFlow>("idle");
  const [insuranceFlow, setInsuranceFlow] = useState<CardFlow>("idle");
  const [clearinghouseSuccess, setClearinghouseSuccess] = useState<string[]>([]);
  const [insuranceSuccess, setInsuranceSuccess] = useState(false);

  const { uploadProgressStep, start: startInsuranceProgress, stop: stopInsuranceProgress } =
    useGovReportUploadProgress(INSURANCE_PROGRESS.length);
  const [insuranceUploading, setInsuranceUploading] = useState(false);
  const [insuranceUploadMsg, setInsuranceUploadMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [insuranceDragging, setInsuranceDragging] = useState(false);
  const [insuranceImported, setInsuranceImported] = useState<number | null>(null);

  useEffect(() => {
    if (!focusDocument) return;
    sectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    if (focusDocument === "clearinghouse") setClearinghouseFlow("idle");
    if (focusDocument === "insurance") setInsuranceFlow("idle");
  }, [focusDocument]);

  const handleInsuranceUpload = useCallback(async (file: File) => {
    const ext = file.name.split(".").pop()?.toLowerCase();
    if (!["xlsx", "xls"].includes(ext ?? "")) {
      setInsuranceUploadMsg({ type: "error", text: "ניתן להעלות קבצי Excel בלבד (.xlsx / .xls)" });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setInsuranceUploadMsg({ type: "error", text: "הקובץ גדול מדי. מקסימום 5MB." });
      return;
    }
    setInsuranceUploading(true);
    setInsuranceUploadMsg(null);
    const timer = startInsuranceProgress();
    const res = await uploadInsuranceExcel(file);
    stopInsuranceProgress(timer);
    setInsuranceUploading(false);
    if (!res.success) {
      setInsuranceUploadMsg({ type: "error", text: res.message ?? "שגיאה בייבוא הקובץ" });
      return;
    }
    setInsuranceImported(res.data?.imported ?? 0);
    setInsuranceUploadMsg({ type: "success", text: "הסוכן הביטוחי קיבל את נתוני הביטוחים הפרטיים" });
    setInsuranceSuccess(true);
    setInsuranceFlow("success");
    onUploadComplete?.();
  }, [onUploadComplete, startInsuranceProgress, stopInsuranceProgress]);

  const clearinghouseStatus = clearinghouseFundCount > 0 ? "ok" : "missing";
  const insuranceStatus = insurancePolicyCount > 0 ? "ok" : "missing";
  const payslipStatus = completedPayslips > 0 ? "ok" : "missing";

  return (
    <section ref={sectionRef} id="hub-document-center" style={{ marginBottom: 32, scrollMarginTop: 90 }}>
      <h2 style={{ margin: "0 0 6px", fontSize: "clamp(20px,2.4vw,26px)", fontWeight: 900, color: "var(--text-strong)" }}>
        המסמכים הפיננסיים שלי
      </h2>
      <p style={{ margin: "0 0 20px", fontSize: 14, color: "var(--text-muted)", fontWeight: 500 }}>
        העלאה מרכזית אחת לכל דוח — הסוכנים משתמשים באותם נתונים ש parsed.
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))", gap: 18 }}>
        <article data-document-card="clearinghouse" style={CARD}>
          <div style={{ display: "flex", gap: 12, marginBottom: 14 }}>
            <span style={{ width: 40, height: 40, borderRadius: 11, background: "var(--lav-100)", color: "var(--lav-600)", display: "grid", placeItems: "center" }}>
              <FileSpreadsheet size={20} />
            </span>
            <div>
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 900 }}>דוח המסלקה הפנסיונית</h3>
              <p style={{ margin: "4px 0 0", fontSize: 12.5, color: clearinghouseStatus === "ok" ? "var(--mint-ink)" : "var(--text-muted)" }}>
                {clearinghouseStatus === "ok" ? `${clearinghouseFundCount} מוצרים במעקב` : "טרם יובא דוח"}
              </p>
            </div>
          </div>

          {clearinghouseFlow === "idle" && !clearinghouseSuccess.length && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              <button type="button" style={actionBtn()} onClick={() => setClearinghouseFlow("guide")}>איך מזמינים את הדוח</button>
              <button type="button" style={actionBtn()} onClick={() => setClearinghouseFlow("upload")}>כבר יש לי דוח</button>
              <button type="button" style={actionBtn()} onClick={() => setClearinghouseFlow("waiting")}>
                <Clock size={14} /> הזמנתי ואני ממתין/ה
              </button>
            </div>
          )}

          {clearinghouseFlow === "guide" && (
            <ClearinghouseOrderGuide onBack={() => setClearinghouseFlow("idle")} />
          )}
          {clearinghouseFlow === "waiting" && (
            <div style={{ marginTop: 16 }}>
              <button type="button" onClick={() => setClearinghouseFlow("idle")} style={{ ...actionBtn(), marginBottom: 12 }}>← חזרה לכרטיס</button>
              <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6, color: "var(--text-muted)" }}>
                מצוין — כשהדוח יגיע, חזרו לכאן ובחרו «כבר יש לי דוח» להעלאה. בינתיים אפשר להמשיך לסוכנים שכבר יש להם נתונים.
              </p>
            </div>
          )}
          {clearinghouseFlow === "upload" && !clearinghouseSuccess.length && (
            <ClearinghouseUploadPanel
              onBack={() => setClearinghouseFlow("idle")}
              onSuccess={readiness => {
                setClearinghouseSuccess(clearinghouseReadinessLines(readiness));
                setClearinghouseFlow("success");
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

        <article data-document-card="insurance" style={CARD}>
          <div style={{ display: "flex", gap: 12, marginBottom: 14 }}>
            <span style={{ width: 40, height: 40, borderRadius: 11, background: "var(--peach-soft)", color: "var(--peach-ink)", display: "grid", placeItems: "center" }}>
              <Shield size={20} />
            </span>
            <div>
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 900 }}>דוח הר הביטוח</h3>
              <p style={{ margin: "4px 0 0", fontSize: 12.5, color: insuranceStatus === "ok" ? "var(--mint-ink)" : "var(--text-muted)" }}>
                {insuranceStatus === "ok" ? `${insurancePolicyCount} פוליסות במעקב` : "טרם יובא דוח"}
              </p>
            </div>
          </div>

          {insuranceFlow === "idle" && !insuranceSuccess && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              <button type="button" style={actionBtn()} onClick={() => setInsuranceFlow("guide")}>איך מורידים את הדוח בחינם</button>
              <button type="button" style={actionBtn()} onClick={() => setInsuranceFlow("upload")}>כבר יש לי דוח</button>
            </div>
          )}

          {insuranceFlow === "guide" && (
            <div style={{ marginTop: 8 }}>
              <InsuranceImportGuide
                onBack={() => setInsuranceFlow("idle")}
                onContinue={() => setInsuranceFlow("upload")}
                onVisitSite={() => window.open(INSURANCE_SITE_URL, "_blank", "noopener,noreferrer")}
              />
            </div>
          )}

          {insuranceFlow === "upload" && !insuranceSuccess && (
            <div style={{ marginTop: 8 }}>
              <InsuranceUpload
                onBack={() => setInsuranceFlow("idle")}
                onContinue={() => setInsuranceFlow("success")}
                onUpload={handleInsuranceUpload}
                uploading={insuranceUploading}
                uploadMsg={insuranceUploadMsg}
                uploadProgressStep={uploadProgressStep}
                progressSteps={INSURANCE_PROGRESS}
                isDragging={insuranceDragging}
                setIsDragging={setInsuranceDragging}
                importedCount={insuranceImported}
              />
            </div>
          )}

          {insuranceSuccess && (
            <UploadSuccessPanel
              title="הסוכן הביטוחי קיבל את נתוני הביטוחים הפרטיים"
              lines={insuranceImported != null && insuranceImported > 0
                ? [`${insuranceImported} פוליסות פעילות נקלטו מהדוח`]
                : ["הדוח נקלט — לא נמצאו פוליסות פעילות, אפשר להמשיך לפי השאלון"]}
              onDone={() => { setInsuranceFlow("idle"); setInsuranceSuccess(false); }}
            />
          )}
        </article>

        <article data-document-card="payslips" style={CARD}>
          <div style={{ display: "flex", gap: 12, marginBottom: 14 }}>
            <span style={{ width: 40, height: 40, borderRadius: 11, background: "var(--mint-soft)", color: "var(--mint-ink)", display: "grid", placeItems: "center" }}>
              <FileText size={20} />
            </span>
            <div>
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 900 }}>תלושי שכר</h3>
              <p style={{ margin: "4px 0 0", fontSize: 12.5, color: payslipStatus === "ok" ? "var(--mint-ink)" : "var(--text-muted)" }}>
                {payslipStatus === "ok" ? `${completedPayslips} תלושים נותחו` : "טרם הועלו תלושים"}
              </p>
            </div>
          </div>
          <p style={{ margin: "0 0 14px", fontSize: 13, lineHeight: 1.55, color: "var(--text-muted)" }}>
            העלאת תלושים נשארת במסלול הקיים — ללא שינוי ב-OCR, בפרסור או בהמלצות.
          </p>
          <button
            type="button"
            onClick={() => navigate(APP_ROUTES.documentsUpload)}
            style={{ ...actionBtn(true), width: "100%", justifyContent: "center" }}
          >
            <PiggyBank size={15} /> לסוכן התלושים
          </button>
        </article>
      </div>
    </section>
  );
}
