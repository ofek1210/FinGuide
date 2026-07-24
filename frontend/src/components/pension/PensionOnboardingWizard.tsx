/**
 * PensionOnboardingWizard — 2-path data ingestion:
 * Option A (free): Har HaBituach / lite report → manual balance entry
 * Option B (paid): full clearinghouse Excel → auto dashboard
 */
import { useCallback, useRef, useState } from "react";
import {
  Check, ChevronRight, CloudUpload, FileSpreadsheet, HelpCircle,
  Loader2, Sparkles, Wallet,
} from "lucide-react";
import {
  uploadPensionFreePreview,
  uploadPensionClearinghouse,
  completeManualPensionFunds,
  type PensionFreePreviewFund,
  type ManualFundEntry,
} from "../../api/pension.api";
import { FUND_TYPE_LABELS } from "../../utils/pensionDisplay";
import { AgentPrimaryButton } from "../agent/AgentButtons";
import AgentOptionCard from "../agent/AgentOptionCard";
import "../agent/agent-onboarding.css";

type WizardStep = "choose" | "free-upload" | "free-manual" | "paid-upload" | "loading";
type Path = "free" | "paid";

const FUND_TYPES = Object.keys(FUND_TYPE_LABELS);

const surfaceCard: React.CSSProperties = {
  background: "var(--surface-card, var(--card))",
  border: "1px solid var(--border-hair)",
  borderRadius: "var(--r-card)",
  boxShadow: "var(--shadow-soft)",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  height: 48,
  padding: "0 12px",
  borderRadius: "var(--r-btn)",
  border: "1.5px solid var(--border-soft)",
  background: "var(--card)",
  fontFamily: "var(--font-body)",
  fontSize: 14,
  fontWeight: 600,
  color: "var(--text-body)",
  boxSizing: "border-box",
};

export default function PensionOnboardingWizard({
  onBack,
  onComplete,
}: {
  onBack: () => void;
  onComplete: () => void;
}) {
  const [step, setStep] = useState<WizardStep>("choose");
  const [path, setPath] = useState<Path | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [narrative, setNarrative] = useState<string | null>(null);
  const [previewFunds, setPreviewFunds] = useState<PensionFreePreviewFund[]>([]);
  const [manualEntries, setManualEntries] = useState<ManualFundEntry[]>([]);
  const [uploading, setUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const pickPath = (p: Path) => {
    setPath(p);
    setError(null);
    setStep(p === "free" ? "free-upload" : "paid-upload");
  };

  const handleFreeUpload = useCallback(async (file: File) => {
    setUploading(true);
    setError(null);
    const res = await uploadPensionFreePreview(file);
    setUploading(false);
    if (!res.success || !res.data?.funds?.length) {
      setError(res.message ?? "לא הצלחנו לפרסר את הקובץ");
      return;
    }
    setPreviewFunds(res.data.funds);
    setNarrative(res.data.narrative ?? null);
    setManualEntries(
      res.data.funds.map((f) => ({
        previewKey: f.previewKey,
        fundName: f.fundName,
        provider: f.provider,
        accountNumber: f.accountNumber,
        activityStatus: f.activityStatus,
        fundType: f.fundType,
        currentBalance: f.isActive ? "" : 0,
        investmentTrack: "",
      })),
    );
    setStep("free-manual");
  }, []);

  const handlePaidUpload = useCallback(
    async (file: File) => {
      setUploading(true);
      setError(null);
      setStep("loading");
      const res = await uploadPensionClearinghouse(file);
      setUploading(false);
      if (!res.success) {
        setError(res.message ?? "שגיאה בייבוא המסלקה");
        setStep("paid-upload");
        return;
      }
      onComplete();
    },
    [onComplete],
  );

  const handleFiles = (files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;
    if (path === "free") void handleFreeUpload(file);
    else void handlePaidUpload(file);
  };

  const updateManual = (idx: number, patch: Partial<ManualFundEntry>) => {
    setManualEntries((prev) => prev.map((e, i) => (i === idx ? { ...e, ...patch } : e)));
  };

  const submitManual = async () => {
    setUploading(true);
    setError(null);
    const activeFunds = manualEntries.filter((e) => e.activityStatus !== "INACTIVE");
    for (const f of activeFunds) {
      if (f.currentBalance === "" || Number.isNaN(Number(f.currentBalance))) {
        setError(`הזן סכום צבירה עבור "${f.fundName}"`);
        setUploading(false);
        return;
      }
    }
    const payload = manualEntries.map((e) => ({
      ...e,
      currentBalance: Number(e.currentBalance) || 0,
    }));
    const res = await completeManualPensionFunds(payload);
    setUploading(false);
    if (!res.success) {
      setError(res.message ?? "שגיאה בשמירה");
      return;
    }
    onComplete();
  };

  const dropzone = (label: string, sub: string, accept: string) => (
    <div
      className="agent-upload-dropzone"
      role="button"
      tabIndex={uploading ? -1 : 0}
      aria-disabled={uploading}
      aria-busy={uploading}
      onKeyDown={(e) => {
        if (!uploading && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          fileRef.current?.click();
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
        handleFiles(e.dataTransfer.files);
      }}
      onClick={() => !uploading && fileRef.current?.click()}
      style={{
        border: `1.5px dashed ${isDragging ? "var(--mint-ink)" : "var(--border-soft)"}`,
        borderRadius: "var(--r-card)",
        padding: "48px 24px",
        textAlign: "center",
        cursor: uploading ? "wait" : "pointer",
        background: isDragging ? "var(--mint-soft)" : "var(--card)",
        boxShadow: "var(--shadow-soft)",
        transition: "border-color 0.2s, background 0.2s",
      }}
    >
      <input ref={fileRef} type="file" accept={accept} hidden onChange={(e) => handleFiles(e.target.files)} />
      {uploading ? (
        <Loader2 size={36} color="var(--mint-ink)" style={{ animation: "spin 1s linear infinite", margin: "0 auto 12px" }} />
      ) : (
        <CloudUpload size={40} color="var(--mint-ink)" style={{ margin: "0 auto 12px" }} />
      )}
      <p style={{ margin: "0 0 6px", fontWeight: 800, fontSize: 17, color: "var(--text-strong)" }}>{label}</p>
      <p style={{ margin: 0, fontSize: 13, color: "var(--text-muted)" }}>{sub}</p>
    </div>
  );

  if (step === "loading") {
    return (
      <main style={{ maxWidth: 720, margin: "0 auto", padding: "40px 24px 80px" }}>
        <div style={{ ...surfaceCard, padding: "32px 36px" }}>
          <div role="status" aria-live="polite" style={{ textAlign: "center", padding: "24px 0" }}>
            <Loader2 size={40} color="var(--mint-ink)" style={{ animation: "spin 1s linear infinite", margin: "0 auto 20px" }} />
            <h2 style={{ margin: "0 0 8px", fontSize: 20, fontWeight: 900, color: "var(--text-strong)" }}>
              מנתח את דוח המסלקה…
            </h2>
            <p style={{ margin: 0, color: "var(--text-muted)", fontSize: 14 }}>שולף יתרות, הפקדות וכיסויים ביטוחיים</p>
            <div style={{ display: "grid", gap: 10, marginTop: 28 }}>
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  style={{
                    height: 14,
                    borderRadius: 8,
                    background: "linear-gradient(90deg,var(--surface-sunken),var(--hair),var(--surface-sunken))",
                    backgroundSize: "200% 100%",
                    animation: "shimmer 1.2s infinite",
                  }}
                />
              ))}
            </div>
          </div>
        </div>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}} @keyframes shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}`}</style>
      </main>
    );
  }

  if (step === "choose") {
    return (
      <main style={{ maxWidth: 880, margin: "0 auto", padding: "32px 24px 80px" }}>
        <button
          type="button"
          onClick={onBack}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 7,
            background: "none",
            border: "none",
            cursor: "pointer",
            fontWeight: 700,
            fontSize: 13,
            color: "var(--text-muted)",
            marginBottom: 20,
            padding: 0,
          }}
        >
          <ChevronRight size={15} /> חזרה
        </button>
        <h1
          style={{
            margin: "0 0 8px",
            fontSize: 28,
            fontWeight: 900,
            letterSpacing: "-.03em",
            color: "var(--text-strong)",
            fontFamily: "var(--font-display)",
          }}
        >
          איך תרצה להזין את נתוני הפנסיה?
        </h1>
        <p style={{ margin: "0 0 28px", color: "var(--text-muted)", fontSize: 15, lineHeight: 1.6 }}>
          בחר מסלול — דוח חינמי עם הזנה ידנית, או דוח מסלקה מלא באוטומציה.
        </p>

        <div className="agent-path-grid">
          <AgentOptionCard
            label="דוח בסיסי + הזנה ידנית"
            hint="העלה דוח חינמי (כמו הר הביטוח). נזהה מוצרים פעילים/לא פעילים — ותזין צבירה ומסלול ידנית."
            icon={<Wallet size={20} strokeWidth={2} />}
            onClick={() => pickPath("free")}
          />
          <AgentOptionCard
            label="מסלקה פנסיונית מלאה · 15 ₪"
            hint="העלה Excel מהמסלקה (3 גיליונות). יתרות, הפקדות וכיסויים ביטוחיים — נשמרים אוטומטית."
            icon={<FileSpreadsheet size={20} strokeWidth={2} />}
            onClick={() => pickPath("paid")}
          />
        </div>
      </main>
    );
  }

  if (step === "free-upload") {
    return (
      <main style={{ maxWidth: 720, margin: "0 auto", padding: "32px 24px 80px" }}>
        <button
          type="button"
          onClick={() => setStep("choose")}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 7,
            background: "none",
            border: "none",
            cursor: "pointer",
            fontWeight: 700,
            fontSize: 13,
            color: "var(--text-muted)",
            marginBottom: 16,
            padding: 0,
          }}
        >
          <ChevronRight size={15} /> חזרה לבחירה
        </button>
        <h1 style={{ margin: "0 0 8px", fontSize: 24, fontWeight: 900, color: "var(--text-strong)", fontFamily: "var(--font-display)" }}>
          העלאת דוח חינמי
        </h1>
        <p style={{ margin: "0 0 24px", color: "var(--text-muted)", fontSize: 14 }}>Excel מ&quot;הר הביטוח&quot; או דוח בסיסי אחר</p>
        {dropzone("גרור קובץ לכאן או לחץ לבחירה", "קבצים נתמכים: .xlsx, .xls", ".xlsx,.xls")}
        {error && <p role="alert" style={{ marginTop: 16, color: "var(--danger)", fontSize: 14 }}>{error}</p>}
      </main>
    );
  }

  if (step === "paid-upload") {
    return (
      <main style={{ maxWidth: 720, margin: "0 auto", padding: "32px 24px 80px" }}>
        <button
          type="button"
          onClick={() => setStep("choose")}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 7,
            background: "none",
            border: "none",
            cursor: "pointer",
            fontWeight: 700,
            fontSize: 13,
            color: "var(--text-muted)",
            marginBottom: 16,
            padding: 0,
          }}
        >
          <ChevronRight size={15} /> חזרה לבחירה
        </button>
        <h1 style={{ margin: "0 0 8px", fontSize: 24, fontWeight: 900, color: "var(--text-strong)", fontFamily: "var(--font-display)" }}>
          העלאת דוח מסלקה (15 ₪)
        </h1>
        <p style={{ margin: "0 0 24px", color: "var(--text-muted)", fontSize: 14 }}>
          קובץ Excel מהמסלקה הפנסיונית — כולל 3 גיליונות
        </p>
        {dropzone("גרור את קובץ המסלקה", "פורמט: .xls / .xlsx (עותק של …144.xls)", ".xlsx,.xls")}
        {error && <p role="alert" style={{ marginTop: 16, color: "var(--danger)", fontSize: 14 }}>{error}</p>}
      </main>
    );
  }

  const activeFunds = previewFunds.filter((f) => f.isActive);
  const inactiveCount = previewFunds.length - activeFunds.length;

  return (
    <main style={{ maxWidth: 920, margin: "0 auto", padding: "28px 24px 80px" }}>
      <button
        type="button"
        onClick={() => setStep("free-upload")}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 7,
          background: "none",
          border: "none",
          cursor: "pointer",
          fontWeight: 700,
          fontSize: 13,
          color: "var(--text-muted)",
          marginBottom: 16,
          padding: 0,
        }}
      >
        <ChevronRight size={15} /> העלה קובץ אחר
      </button>

      <div style={{ ...surfaceCard, padding: "24px 28px", marginBottom: 24 }}>
        <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
          <Sparkles size={22} color="var(--mint-ink)" style={{ flexShrink: 0, marginTop: 2 }} />
          <div>
            <h2 style={{ margin: "0 0 6px", fontSize: 18, fontWeight: 900, color: "var(--text-strong)" }}>סיכום הממצאים</h2>
            <p style={{ margin: 0, fontSize: 14, color: "var(--text-muted)", lineHeight: 1.65 }}>
              {narrative ||
                (activeFunds.length
                  ? `לפי הממצאים: יש לך ${activeFunds.length} מוצרים פעילים${inactiveCount ? ` ו-${inactiveCount} לא פעילים` : ""}.`
                  : "לא זוהו מוצרים פעילים.")}
            </p>
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gap: 16 }}>
        {manualEntries.map((entry, idx) => {
          const preview = previewFunds[idx];
          const inactive = entry.activityStatus === "INACTIVE";
          return (
            <div key={entry.previewKey} style={{ ...surfaceCard, padding: "20px 24px" }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                  gap: 12,
                  marginBottom: 16,
                  flexWrap: "wrap",
                }}
              >
                <div>
                  <h3 style={{ margin: "0 0 4px", fontSize: 16, fontWeight: 800, color: "var(--text-strong)" }}>
                    {entry.fundName}
                  </h3>
                  <p style={{ margin: 0, fontSize: 13, color: "var(--text-muted)" }}>
                    {entry.provider || "—"} · {FUND_TYPE_LABELS[entry.fundType] || entry.fundType}
                  </p>
                </div>
                <span
                  style={{
                    padding: "4px 10px",
                    borderRadius: 999,
                    fontSize: 11,
                    fontWeight: 800,
                    background: inactive ? "rgba(220,38,38,0.1)" : "var(--mint-soft)",
                    color: inactive ? "var(--danger)" : "var(--mint-ink)",
                  }}
                >
                  {inactive ? "לא פעיל" : "פעיל"}
                </span>
              </div>

              {!inactive && (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 12 }}>
                  <label style={{ display: "block" }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)", display: "block", marginBottom: 6 }}>
                      סכום צבירה (₪)
                    </span>
                    <input
                      type="number"
                      min={0}
                      value={entry.currentBalance}
                      onChange={(e) =>
                        updateManual(idx, { currentBalance: e.target.value === "" ? "" : Number(e.target.value) })
                      }
                      style={inputStyle}
                      placeholder="120436"
                    />
                  </label>
                  <label style={{ display: "block" }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)", display: "block", marginBottom: 6 }}>
                      סוג מסלול / קופה
                    </span>
                    <select
                      value={entry.fundType}
                      onChange={(e) => updateManual(idx, { fundType: e.target.value })}
                      style={inputStyle}
                    >
                      {FUND_TYPES.map((t) => (
                        <option key={t} value={t}>
                          {FUND_TYPE_LABELS[t]}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label style={{ display: "block" }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)", display: "block", marginBottom: 6 }}>
                      מסלול השקעה (אופציונלי)
                    </span>
                    <input
                      type="text"
                      value={entry.investmentTrack ?? ""}
                      onChange={(e) => updateManual(idx, { investmentTrack: e.target.value })}
                      style={inputStyle}
                      placeholder="למשל: מניות, כללי"
                    />
                  </label>
                </div>
              )}

              {!inactive && (
                <p
                  style={{
                    margin: "12px 0 0",
                    fontSize: 12,
                    color: "var(--text-faint)",
                    display: "flex",
                    gap: 6,
                    alignItems: "flex-start",
                  }}
                >
                  <HelpCircle size={14} style={{ flexShrink: 0, marginTop: 1 }} />
                  על מנת לאסוף נתונים אלו במדויק, עליך להיכנס לאזור האישי של הגוף המוסדי הרלוונטי
                  {preview?.provider ? ` (${preview.provider})` : ""}.
                </p>
              )}
            </div>
          );
        })}
      </div>

      {error && <p role="alert" style={{ marginTop: 16, color: "var(--danger)", fontSize: 14 }}>{error}</p>}

      <AgentPrimaryButton
        disabled={uploading}
        onClick={() => void submitManual()}
        style={{ marginTop: 28, width: "100%" }}
      >
        {uploading ? <Loader2 size={18} style={{ animation: "spin 1s linear infinite" }} /> : <Check size={18} />}
        שמור והמשך לדשבורד הפנסיה
      </AgentPrimaryButton>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </main>
  );
}
