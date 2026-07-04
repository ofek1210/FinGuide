/**
 * PayslipsAgentPage — 2-step agent flow (personal details handled by onboarding)
 *
 * Step 1 (upload)  — connect Gmail OR upload PDFs
 * Step 2 (results) — AI insights dashboard
 *
 * Personal data is loaded from the saved onboarding profile; if none exists the
 * user is redirected to /onboarding. Restyled to the FinGuide design system.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Mail, Upload, FileText, RefreshCw, Sparkles, Check, ArrowLeft, ChevronRight,
  History, Plus, Lock, Wallet, TrendingUp, Landmark, ShieldCheck,
  PiggyBank, GraduationCap, CalendarDays, HeartPulse, type LucideIcon,
} from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import PrivateTopbar from "../components/PrivateTopbar";
import AppFooter from "../components/AppFooter";
import DocumentsRibbonWave from "../components/documents/DocumentsRibbonWave";
import Loader from "../components/ui/Loader";
import { listDocuments, type DocumentItem } from "../api/documents.api";
import { InsightsPanel } from "../components/ai/InsightsPanel";
import { syncGmail, getGmailStatus, type GmailIntegrationStatus } from "../api/integrations.api";
import { APP_ROUTES } from "../types/navigation";
import { getUserProfile, type UserProfileResponseData } from "../api/userProfile.api";
import {
  MAX_PAYSLIPS,
  uploadFailureMessage,
  isAnalyzableUpload,
  uploadPayslipFile,
  unlockPayslipDocument,
} from "../hooks/usePayslipUpload";
import {
  buildAnalysisSummary,
  fetchLastPayslipAnalysis,
  type PayslipAnalysisSummary,
  type MoneyFlow,
} from "../utils/payslipAnalysisSummary";
import { documentToPayslipDetail } from "../utils/documentToPayslip";
import { formatCurrencyPositiveOrDash } from "../utils/formatters";

/* ── Types & helpers ─────────────────────────────────────────── */
interface IntakeData {
  firstName: string;
  age: string;
  maritalStatus: string;
  children: string;
  city: string;
}

const EMPTY_INTAKE: IntakeData = { firstName: "", age: "", maritalStatus: "", children: "0", city: "" };

function profileToIntake(p: UserProfileResponseData): IntakeData {
  const name = p.personal?.fullName || "";
  return {
    firstName: name.split(/\s+/)[0] || "",
    age: p.personal?.age != null ? String(p.personal.age) : "",
    maritalStatus: p.personal?.maritalStatus || "",
    children: p.personal?.childrenCount != null ? String(p.personal.childrenCount) : "0",
    city: "",
  };
}

function mergeDocumentsById(...groups: DocumentItem[][]): DocumentItem[] {
  const map = new Map<string, DocumentItem>();
  for (const group of groups) for (const d of group) {
    const id = d._id || d.id;
    if (id) map.set(id, d);
  }
  return Array.from(map.values());
}

const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms));
const fmt = formatCurrencyPositiveOrDash;

type UploadedEntry = { id: string; name: string; doc: DocumentItem };

function entryDisplayLabel(entry: UploadedEntry): string {
  const detail = documentToPayslipDetail(entry.doc);
  if (detail?.periodLabel && detail.periodLabel !== "תלוש משכורת") return detail.periodLabel;
  return entry.name;
}

type Tone = "lavender" | "mint" | "peach" | "butter" | "neutral";
const TONES: Record<Tone, [string, string]> = {
  lavender: ["var(--lav-100)", "var(--lav-600)"],
  mint: ["var(--mint-soft)", "var(--mint-ink)"],
  peach: ["var(--peach-soft)", "var(--peach-ink)"],
  butter: ["var(--butter-soft)", "var(--butter-ink)"],
  neutral: ["var(--surface-sunken)", "var(--text-faint)"],
};

type WizardStep = "upload" | "results";

/* ════════════════════════════════════════════════════════════════
   MAIN PAGE
════════════════════════════════════════════════════════════════ */
export default function PayslipsAgentPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const gmailResult = searchParams.get("gmail");

  const [intake, setIntake] = useState<IntakeData>(EMPTY_INTAKE);
  const [step, setStep] = useState<WizardStep>(gmailResult === "success" ? "results" : "upload");
  const [resultsRefreshKey, setResultsRefreshKey] = useState(0);
  const [resultsSeedDocs, setResultsSeedDocs] = useState<DocumentItem[] | null>(null);

  useEffect(() => {
    if (gmailResult === "success") setResultsRefreshKey(k => k + 1);
  }, [gmailResult]);

  // Best-effort personalization from the onboarding profile. RequireAuth already
  // guarantees onboarding is complete before this route renders, so we never
  // block or redirect here — the upload screen is always reachable.
  useEffect(() => {
    let cancelled = false;
    void getUserProfile().then(res => {
      if (!cancelled && res.success && res.data) setIntake(profileToIntake(res.data));
    });
    return () => { cancelled = true; };
  }, []);

  return (
    <div data-agent="payslips" style={{ minHeight: "100vh", background: "var(--surface-page)", color: "var(--text-body)", fontFamily: "var(--font-body)", direction: "rtl", position: "relative" }}>
      {step === "upload" && <DocumentsRibbonWave />}
      <div style={{ position: "relative", zIndex: 1 }}>
        <PrivateTopbar />

        {step === "upload" ? (
          <UploadStep
            intake={intake}
            onComplete={(analyzableCount, uploadedDocs) => {
              setResultsSeedDocs(analyzableCount > 0 ? uploadedDocs : null);
              setResultsRefreshKey(k => k + 1);
              setStep("results");
            }}
            onBack={() => navigate(APP_ROUTES.hub)}
          />
        ) : (
          <ResultsStep
            intake={intake}
            refreshKey={resultsRefreshKey}
            initialDocs={resultsSeedDocs}
            onAddMore={() => { setResultsSeedDocs(null); setStep("upload"); }}
            onEditProfile={() => navigate(APP_ROUTES.onboarding)}
          />
        )}

        <AppFooter variant="private" />
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════
   STEP INDICATOR — personal details done (in onboarding)
════════════════════════════════════════════════════════════════ */
function StepIndicator({ step }: { step: WizardStep }) {
  const steps: { label: string; state: "done" | "active" | "todo" }[] = [
    { label: "פרטים אישיים", state: "done" },
    { label: "העלאת תלושים", state: step === "upload" ? "active" : "done" },
    { label: "תובנות AI", state: step === "results" ? "active" : "todo" },
  ];
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 44 }}>
      {steps.map((s, i) => (
        <div key={s.label} style={{ display: "flex", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
            <span style={{
              width: 30, height: 30, borderRadius: "50%", display: "grid", placeItems: "center", fontWeight: 800, fontSize: 13, flex: "none",
              background: s.state === "active" ? "var(--ink)" : s.state === "done" ? "var(--lav-100)" : "transparent",
              color: s.state === "active" ? "#fff" : s.state === "done" ? "var(--lav-600)" : "var(--text-faint)",
              border: s.state === "todo" ? "1.5px solid var(--border-soft)" : "none",
            }}>
              {s.state === "done" ? <Check size={15} strokeWidth={3} /> : i + 1}
            </span>
            <span style={{ fontSize: 13, fontWeight: 700, color: s.state === "active" ? "var(--ink)" : "var(--text-faint)" }}>{s.label}</span>
          </div>
          {i < steps.length - 1 && <div style={{ width: 40, height: 1.5, margin: "0 14px", background: s.state === "done" ? "var(--lav-300)" : "var(--hair)" }} />}
        </div>
      ))}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════
   STEP 1 — UPLOAD (Gmail / manual segmented switch)
════════════════════════════════════════════════════════════════ */
function UploadStep({ intake, onComplete, onBack }: {
  intake: IntakeData;
  onComplete: (analyzableCount: number, uploadedDocs: DocumentItem[]) => void;
  onBack: () => void;
}) {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [method, setMethod] = useState<"gmail" | "manual">("gmail");
  const [gmail, setGmail] = useState<GmailIntegrationStatus | null>(null);
  const [gmailLoading, setGmailLoading] = useState(true);
  const [syncLoading, setSyncLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [continuing, setContinuing] = useState(false);
  const [uploadedEntries, setUploadedEntries] = useState<UploadedEntry[]>([]);
  const [passwordInputs, setPasswordInputs] = useState<Record<string, string>>({});
  const [unlockingId, setUnlockingId] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ type: "success" | "error" | "info"; text: string } | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const analyzableDocs = uploadedEntries.map(e => e.doc).filter(doc => isAnalyzableUpload(doc));
  const canShowResults = analyzableDocs.length > 0;
  const hasUploadAttempts = uploadedEntries.length > 0;
  const slotsLeft = MAX_PAYSLIPS - uploadedEntries.length;
  const ready = canShowResults || gmail?.connected === true;

  useEffect(() => {
    if (document.getElementById("up-anim")) return;
    const st = document.createElement("style");
    st.id = "up-anim";
    st.textContent = "@keyframes upFade{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}@keyframes fgspin{to{transform:rotate(360deg)}}";
    document.head.appendChild(st);
  }, []);

  useEffect(() => {
    void getGmailStatus().then(res => {
      if (res.success && res.data) setGmail(res.data);
      setGmailLoading(false);
    });
  }, []);

  const handleGmailConnect = () => navigate(`${APP_ROUTES.integrationsEmail}?from=documents`);

  const handleGmailSync = async () => {
    setSyncLoading(true); setMsg(null);
    const res = await syncGmail();
    setSyncLoading(false);
    if (res.success && res.data) {
      const count = res.data.imported;
      if (count > 0) {
        setMsg({ type: "success", text: `יובאו ${count} תלושים חדשים — טוען ניתוח...` });
        try {
          const analysis = await fetchLastPayslipAnalysis(3);
          if (analysis.count > 0) setTimeout(() => onComplete(analysis.count, []), 800);
          else setMsg({ type: "error", text: "התלושים יובאו אך עדיין לא מוכנים לניתוח — נסו שוב בעוד רגע" });
        } catch { setMsg({ type: "error", text: "שגיאה בטעינת התלושים אחרי הסנכרון" }); }
      } else if (res.data.found === 0) {
        setMsg({ type: "info", text: "לא נמצאו תלושי שכר חדשים בתיבת הדואר" });
      } else {
        setMsg({ type: "info", text: `נמצאו ${res.data.found} קבצים, ${res.data.skippedDuplicates} כבר קיימים` });
      }
    } else {
      setMsg({ type: "error", text: res.message || "שגיאה בסנכרון Gmail" });
    }
  };

  const handleUnlock = async (entry: UploadedEntry) => {
    const password = passwordInputs[entry.id]?.trim();
    if (!password) return;
    setUnlockingId(entry.id); setMsg(null);
    const res = await unlockPayslipDocument(entry.doc._id, password);
    setUnlockingId(null);
    if (res.success && res.data) {
      setUploadedEntries(prev => prev.map(e => (e.id === entry.id ? { ...e, doc: res.data! } : e)));
      if (isAnalyzableUpload(res.data)) setMsg({ type: "success", text: `${entry.name} נפתח ועובד בהצלחה ✓` });
      else setMsg({ type: "error", text: uploadFailureMessage(res.data, entry.name) });
    } else {
      setMsg({ type: "error", text: res.message || `שגיאה בפתיחת ${entry.name}` });
    }
  };

  const handleFileUpload = async (files: FileList) => {
    if (slotsLeft <= 0) { setMsg({ type: "error", text: `ניתן להעלות עד ${MAX_PAYSLIPS} תלושים בלבד` }); return; }
    setUploading(true); setMsg(null);
    const newEntries: UploadedEntry[] = [];
    const errors: string[] = [];
    const successes: string[] = [];
    const fileList = Array.from(files).slice(0, slotsLeft);
    if (files.length > slotsLeft) errors.push(`ניתן להעלות עד ${MAX_PAYSLIPS} תלושים — ${files.length - slotsLeft} קבצים לא הועלו`);

    for (const file of fileList) {
      if (!file.name.toLowerCase().endsWith(".pdf")) { errors.push(`${file.name}: רק קובצי PDF נתמכים`); continue; }
      const res = await uploadPayslipFile(file);
      if (!res.success || !res.data) { errors.push(`${file.name}: ${res.message || "שגיאה בהעלאה"}`); continue; }
      const doc = res.data;
      newEntries.push({ id: doc._id || doc.id || `${file.name}-${Date.now()}`, name: file.name, doc });
      if (isAnalyzableUpload(doc)) successes.push(file.name);
      else errors.push(uploadFailureMessage(doc, file.name));
    }
    setUploading(false);
    if (newEntries.length > 0) setUploadedEntries(prev => [...prev, ...newEntries]);
    if (successes.length > 0 && errors.length > 0) setMsg({ type: "info", text: `${successes.length} תלוש/ים מוכנים · ${errors.join(" · ")}` });
    else if (successes.length > 0) setMsg({ type: "success", text: `${successes.length} תלוש/ים מוכנים לניתוח ✓` });
    else if (errors.length > 0) setMsg({ type: "error", text: errors.join(" · ") });
  };

  const handleContinue = () => {
    if (continuing || uploading) return;
    if (hasUploadAttempts && !canShowResults) return;
    setContinuing(true);
    try { onComplete(canShowResults ? analyzableDocs.length : 0, canShowResults ? analyzableDocs : []); }
    finally { setContinuing(false); }
  };

  const seg = (key: "gmail" | "manual", label: string, recommended?: boolean) => {
    const on = method === key;
    return (
      <button onClick={() => setMethod(key)} style={{ position: "relative", zIndex: 1, flex: 1, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "12px 10px", border: "none", background: "transparent", cursor: "pointer", fontFamily: "inherit", fontWeight: 800, fontSize: 14.5, color: on ? "var(--ink)" : "var(--text-muted)", transition: "color .25s var(--ease)" }}>
        {label}
        {recommended && <span style={{ fontSize: 10.5, fontWeight: 800, color: on ? "var(--lav-600)" : "var(--text-faint)", background: on ? "var(--lav-100)" : "transparent", borderRadius: 999, padding: "2px 8px", transition: "all .25s" }}>מומלץ</span>}
      </button>
    );
  };

  return (
    <main style={{ maxWidth: 640, margin: "0 auto", padding: "44px 24px 80px" }}>
      <StepIndicator step="upload" />

      <div style={{ textAlign: "center", marginBottom: 32 }}>
        <h1 style={{ fontSize: "clamp(28px,3.4vw,40px)", fontWeight: 900, letterSpacing: "-.035em", lineHeight: 1.1, margin: "0 0 12px", color: "var(--text-strong)" }}>
          {intake.firstName ? `${intake.firstName}, נמשוך את התלושים שלך.` : "בוא נמשוך את התלושים שלך."}
        </h1>
        <p style={{ fontSize: 16.5, color: "var(--text-muted)", lineHeight: 1.55, fontWeight: 500, margin: "0 auto", maxWidth: 420 }}>שתי דרכים להעביר תלושים לסוכן. הוא ינתח, יזהה חריגות ויחשב מה מגיע לך.</p>
      </div>

      {/* one focused panel */}
      <div style={{ background: "var(--card)", border: "1px solid var(--border-soft)", borderRadius: "var(--radius)", boxShadow: "var(--shadow-card)", overflow: "hidden" }}>
        {/* segmented switch */}
        <div style={{ position: "relative", display: "flex", margin: 10, background: "var(--surface-sunken)", borderRadius: "var(--r-md)", padding: 4 }}>
          <div style={{ position: "absolute", top: 4, bottom: 4, insetInlineStart: method === "gmail" ? 4 : "calc(50% + 0px)", width: "calc(50% - 4px)", background: "var(--card)", borderRadius: "calc(var(--r-md) - 3px)", boxShadow: "var(--shadow-soft)", transition: "inset-inline-start .32s cubic-bezier(.4,0,.15,1)" }} />
          {seg("gmail", "חיבור Gmail", true)}
          {seg("manual", "העלאה ידנית")}
        </div>

        <div style={{ padding: "12px 30px 30px", minHeight: 280 }}>
          {method === "gmail" ? (
            <div key="g" style={{ animation: "upFade .35s var(--ease)", textAlign: "center", paddingTop: 14 }}>
              <span style={{ width: 60, height: 60, borderRadius: 16, background: "var(--peach-soft)", color: "var(--peach-ink)", display: "grid", placeItems: "center", margin: "0 auto 18px" }}><Mail size={28} strokeWidth={1.85} /></span>
              <h3 style={{ margin: "0 0 8px", fontSize: 21, fontWeight: 900, letterSpacing: "-.02em", color: "var(--text-strong)" }}>ייבוא אוטומטי מ‑Gmail</h3>
              <p style={{ margin: "0 auto 22px", maxWidth: 360, fontSize: 14.5, color: "var(--text-muted)", lineHeight: 1.6 }}>הסוכן מאתר ומייבא את כל תלושי השכר מהמייל — אוטומטית, כל חודש.</p>

              <div style={{ maxWidth: 360, margin: "0 auto 24px" }}>
                {gmailLoading ? (
                  <div style={{ color: "var(--lav-600)", fontSize: 13, fontWeight: 600 }}>בודק חיבור...</div>
                ) : gmail?.connected ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 9, padding: "12px 14px", borderRadius: "var(--r-btn)", background: "var(--mint-soft)", color: "var(--mint-ink)", fontWeight: 800, fontSize: 14, animation: "upFade .4s var(--ease)" }}>
                      <Check size={17} strokeWidth={3} /> מחובר · {gmail.gmailEmail} · {gmail.importedCount} תלושים
                    </div>
                    <button onClick={() => void handleGmailSync()} disabled={syncLoading}
                      style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "12px", borderRadius: "var(--r-btn)", background: "var(--accent-soft)", color: "var(--lav-600)", border: "1px solid var(--lav-200)", cursor: syncLoading ? "wait" : "pointer", fontFamily: "inherit", fontWeight: 800, fontSize: 14 }}>
                      <RefreshCw size={15} style={{ animation: syncLoading ? "fgspin .8s linear infinite" : "none" }} /> {syncLoading ? "מסנכרן..." : "סנכרן ונתח"}
                    </button>
                  </div>
                ) : gmail?.oauthConfigured === false ? (
                  <div style={{ padding: "12px 14px", borderRadius: "var(--r-btn)", background: "var(--butter-soft)", border: "1px solid var(--butter)", textAlign: "start" }}>
                    <div style={{ fontSize: 13, fontWeight: 800, color: "var(--butter-ink)", marginBottom: 4 }}>חיבור Gmail לא מוגדר בשרת</div>
                    <div style={{ fontSize: 12, color: "var(--butter-ink)", lineHeight: 1.55, opacity: .85 }}>יש להוסיף GOOGLE_CLIENT_SECRET לקובץ backend/.env ולהפעיל מחדש את השרת.</div>
                  </div>
                ) : (
                  <PrimaryBtn fullWidth onClick={handleGmailConnect} iconLeft={<Mail size={18} strokeWidth={2} />}>התחבר עם Gmail</PrimaryBtn>
                )}
              </div>

              <div style={{ display: "inline-flex", alignItems: "center", gap: 12, fontSize: 12.5, color: "var(--text-faint)", fontWeight: 600 }}>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><Lock size={13} color="var(--lav-500)" />תלושים בלבד</span>
                <span style={{ width: 3, height: 3, borderRadius: "50%", background: "var(--border-soft)" }} />
                <span>אוטומטי כל חודש</span>
                <span style={{ width: 3, height: 3, borderRadius: "50%", background: "var(--border-soft)" }} />
                <span>ניתן לנתק</span>
              </div>
            </div>
          ) : (
            <div key="m" style={{ animation: "upFade .35s var(--ease)", paddingTop: 14 }}>
              <input ref={fileInputRef} type="file" accept=".pdf" multiple style={{ display: "none" }}
                onChange={e => { if (e.target.files?.length) void handleFileUpload(e.target.files); e.target.value = ""; }} />
              <div
                onClick={() => !uploading && slotsLeft > 0 && fileInputRef.current?.click()}
                onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={e => { e.preventDefault(); setIsDragging(false); if (e.dataTransfer.files.length) void handleFileUpload(e.dataTransfer.files); }}
                style={{ cursor: uploading || slotsLeft <= 0 ? "not-allowed" : "pointer", borderRadius: "var(--r-md)", border: "1.5px dashed " + (isDragging ? "var(--lav-500)" : "var(--border-soft)"), background: isDragging ? "var(--accent-soft)" : "transparent", padding: "38px 20px", textAlign: "center", transition: "all .2s var(--ease)", marginBottom: uploadedEntries.length ? 16 : 0, opacity: slotsLeft <= 0 ? 0.6 : 1 }}>
                <span style={{ width: 50, height: 50, borderRadius: 13, background: "var(--lav-100)", color: "var(--lav-600)", display: "grid", placeItems: "center", margin: "0 auto 14px" }}><Upload size={23} strokeWidth={1.85} /></span>
                <div style={{ fontWeight: 800, fontSize: 15.5, marginBottom: 4, color: "var(--text-strong)" }}>{uploading ? "מעלה ומעבד..." : slotsLeft <= 0 ? `הגעת למקסימום ${MAX_PAYSLIPS} תלושים` : "גרור תלושים לכאן"}</div>
                {!uploading && slotsLeft > 0 && <div style={{ fontSize: 13, color: "var(--text-muted)" }}>PDF · עד {MAX_PAYSLIPS} קבצים · {slotsLeft} נותרו</div>}
              </div>

              {uploadedEntries.length > 0 && (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {uploadedEntries.map(entry => {
                    const ok = isAnalyzableUpload(entry.doc);
                    const needsPassword = entry.doc.status === "needs_password";
                    const [bg, fg] = ok ? TONES.mint : needsPassword ? TONES.butter : TONES.peach;
                    return (
                      <div key={entry.id}>
                        <div style={{ display: "flex", alignItems: "center", gap: 11, padding: "10px 13px", borderRadius: "var(--r-sm)", background: "var(--surface-sunken)", border: "1px solid var(--border-hair)", animation: "upFade .3s var(--ease)" }}>
                          <span style={{ width: 30, height: 30, borderRadius: 8, flex: "none", background: bg, color: fg, display: "grid", placeItems: "center" }}><FileText size={16} /></span>
                          <span style={{ flex: 1, minWidth: 0, fontSize: 13.5, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "var(--text-strong)" }}>{entryDisplayLabel(entry)}</span>
                          <span style={{ fontSize: 11, fontWeight: 800, color: fg }}>{ok ? "מוכן" : needsPassword ? "סיסמה" : "שגיאה"}</span>
                        </div>
                        {needsPassword && (
                          <div style={{ marginTop: 6, padding: "10px 12px", borderRadius: "var(--r-sm)", background: "var(--butter-soft)", border: "1px solid var(--butter)" }}>
                            <div style={{ fontSize: 12, color: "var(--butter-ink)", marginBottom: 6, fontWeight: 600 }}>הזן/י סיסמת PDF לפתיחה ועיבוד</div>
                            <div style={{ display: "flex", gap: 6 }}>
                              <input type="password" value={passwordInputs[entry.id] || ""} placeholder="סיסמת PDF" disabled={unlockingId === entry.id}
                                onChange={e => setPasswordInputs(prev => ({ ...prev, [entry.id]: e.target.value }))}
                                style={{ flex: 1, padding: "8px 10px", borderRadius: "var(--r-sm)", border: "1px solid var(--butter)", fontFamily: "inherit", fontSize: 13, background: "var(--card)" }} />
                              <button type="button" onClick={() => void handleUnlock(entry)} disabled={unlockingId === entry.id || !passwordInputs[entry.id]?.trim()}
                                style={{ padding: "8px 14px", borderRadius: "var(--r-sm)", background: "var(--butter-ink)", color: "#fff", border: "none", cursor: unlockingId === entry.id ? "wait" : "pointer", fontFamily: "inherit", fontWeight: 700, fontSize: 12 }}>
                                {unlockingId === entry.id ? "פותח..." : "פתח"}
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {slotsLeft > 0 && (
                    <button onClick={() => fileInputRef.current?.click()} disabled={uploading}
                      style={{ marginTop: 4, padding: "10px", borderRadius: "var(--r-btn)", background: "var(--accent-soft)", color: "var(--lav-600)", border: "1px solid var(--lav-200)", cursor: "pointer", fontFamily: "inherit", fontWeight: 700, fontSize: 13 }}>
                      + הוסף תלוש נוסף ({analyzableDocs.length}/{uploadedEntries.length} מוכנים)
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {msg && (
        <div style={{ marginTop: 16, padding: "12px 18px", borderRadius: "var(--r-btn)", fontWeight: 700, fontSize: 13.5, textAlign: "center",
          background: msg.type === "error" ? "#FEF2F2" : msg.type === "success" ? "var(--mint-soft)" : "var(--accent-soft)",
          color: msg.type === "error" ? "var(--danger)" : msg.type === "success" ? "var(--mint-ink)" : "var(--lav-600)",
          border: "1px solid " + (msg.type === "error" ? "rgba(220,38,38,.2)" : msg.type === "success" ? "var(--mint)" : "var(--lav-200)") }}>
          {msg.text}
        </div>
      )}

      {/* footer actions */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 26, gap: 16, flexWrap: "wrap" }}>
        <button onClick={onBack} style={{ display: "inline-flex", alignItems: "center", gap: 7, background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", fontWeight: 700, fontSize: 14.5, color: "var(--text-muted)" }}>
          <ChevronRight size={16} strokeWidth={2.4} /> חזרה
        </button>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          {!ready && !hasUploadAttempts && <button onClick={handleContinue} style={{ background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", fontWeight: 700, fontSize: 14.5, color: "var(--text-faint)" }}>דלג</button>}
          <PrimaryBtn disabled={continuing || uploading || (hasUploadAttempts && !canShowResults)} onClick={handleContinue} iconRight={<ArrowLeft size={18} strokeWidth={2.2} />}>
            {continuing ? "טוען..." : hasUploadAttempts && !canShowResults ? "יש לתקן את ההעלאות" : "המשך לניתוח"}
          </PrimaryBtn>
        </div>
      </div>
    </main>
  );
}

/* ════════════════════════════════════════════════════════════════
   STEP 2 — RESULTS (AI insights)
════════════════════════════════════════════════════════════════ */
function ResultsStep({ intake, refreshKey, initialDocs, onEditProfile, onAddMore }: {
  intake: IntakeData;
  refreshKey: number;
  initialDocs?: DocumentItem[] | null;
  onEditProfile: () => void;
  onAddMore: () => void;
}) {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<PayslipAnalysisSummary | null>(null);
  const [passwordDoc, setPasswordDoc] = useState<DocumentItem | null>(null);
  const [passwordInput, setPasswordInput] = useState("");
  const [unlocking, setUnlocking] = useState(false);

  useEffect(() => {
    if (document.getElementById("res-anim")) return;
    const st = document.createElement("style");
    st.id = "res-anim";
    st.textContent = "@keyframes resShine{to{background-position:220% center}}@keyframes resFloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-7px)}}";
    document.head.appendChild(st);
  }, []);

  const loadAnalysis = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      if (initialDocs?.length) {
        const listRes = await listDocuments();
        const allDocs = listRes.success ? (listRes.data ?? []) : [];
        const seeded = buildAnalysisSummary(mergeDocumentsById(initialDocs, allDocs), 3);
        if (seeded.count > 0) { setSummary(seeded); return; }
      }
      let data = await fetchLastPayslipAnalysis(3);
      if (data.count === 0 && initialDocs?.length) {
        for (let attempt = 0; attempt < 3; attempt++) { await sleep(500); data = await fetchLastPayslipAnalysis(3); if (data.count > 0) break; }
      }
      setSummary(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "שגיאה בטעינת התלושים");
      setSummary(null);
    } finally { setLoading(false); }
  }, [initialDocs]);

  useEffect(() => { void loadAnalysis(); }, [refreshKey, loadAnalysis]);

  const handleFileUpload = async (file: File) => {
    setUploading(true); setPasswordDoc(null);
    const res = await uploadPayslipFile(file);
    setUploading(false);
    if (res.success && res.data && isAnalyzableUpload(res.data)) { setUploadMsg("התלוש הועלה ועובד בהצלחה!"); await loadAnalysis(); }
    else if (res.success && res.data?.status === "needs_password") { setPasswordDoc(res.data); setUploadMsg("נדרשת סיסמה לפתיחת הקובץ"); }
    else setUploadMsg(res.message || res.data?.processingError || "שגיאה בהעלאה — נסה שוב");
  };

  const handleResultsUnlock = async () => {
    if (!passwordDoc || !passwordInput.trim()) return;
    setUnlocking(true);
    const res = await unlockPayslipDocument(passwordDoc._id, passwordInput.trim());
    setUnlocking(false);
    if (res.success && res.data && isAnalyzableUpload(res.data)) { setPasswordDoc(null); setPasswordInput(""); setUploadMsg("התלוש נפתח ועובד בהצלחה!"); await loadAnalysis(); }
    else setUploadMsg(res.message || "שגיאה בפתיחת הקובץ — בדקו את הסיסמה");
  };

  const rows = summary?.rows ?? [];
  const hasData = rows.length > 0;
  const netGrossPct = summary && summary.avgGross && summary.avgNet ? Math.round((summary.avgNet / summary.avgGross) * 100) : null;

  const statTiles: { v: string; l: string; icon: LucideIcon; tone: Tone }[] = summary ? [
    { v: fmt(summary.avgNet), l: "ממוצע נטו", icon: TrendingUp, tone: "mint" },
    { v: fmt(summary.avgGross), l: "ממוצע ברוטו", icon: Wallet, tone: "lavender" },
    { v: fmt(summary.avgTax), l: "ממוצע מס הכנסה", icon: Landmark, tone: "butter" },
    { v: fmt(summary.avgNationalInsurance), l: "ביטוח לאומי", icon: ShieldCheck, tone: "peach" },
    { v: fmt(summary.avgPensionEmployee), l: "פנסיה (עובד)", icon: PiggyBank, tone: "mint" },
    { v: fmt(summary.avgStudyFundEmployee), l: "קרן השתלמות", icon: GraduationCap, tone: "lavender" },
    { v: summary.avgVacationDays != null ? String(summary.avgVacationDays) : "—", l: "ימי חופשה", icon: CalendarDays, tone: "butter" },
    { v: summary.avgSickDays != null ? String(summary.avgSickDays) : "—", l: "ימי מחלה", icon: HeartPulse, tone: "peach" },
  ] : [];

  return (
    <main style={{ maxWidth: 880, margin: "0 auto", padding: "44px 24px 80px" }}>
      <StepIndicator step="results" />

      {/* toolbar */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", padding: "12px 16px", background: "var(--card)", border: "1px solid var(--border-soft)", borderRadius: "var(--r-md)", boxShadow: "var(--shadow-soft)", marginBottom: 36 }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 9, fontWeight: 800, fontSize: 14.5, color: "var(--text-strong)" }}>
          <span style={{ width: 34, height: 34, borderRadius: "50%", background: "var(--ink)", color: "#fff", display: "grid", placeItems: "center", fontWeight: 800, fontSize: 14 }}>{intake.firstName?.charAt(0)?.toUpperCase() ?? "✦"}</span>
          {intake.firstName || "תוצאות ניתוח"}
        </span>
        <span style={{ marginInlineStart: "auto", display: "flex", gap: 8, flexWrap: "wrap" }}>
          <ToolBtn icon={<History size={15} />} onClick={() => navigate(APP_ROUTES.payslipHistory)}>היסטוריית תלושים</ToolBtn>
          <PrimaryBtn size="sm" onClick={onAddMore} iconLeft={<Plus size={15} strokeWidth={2.4} />}>הוסף תלושים</PrimaryBtn>
        </span>
      </div>

      {loading ? (
        <div style={{ background: "var(--card)", border: "1px solid var(--border-soft)", borderRadius: "var(--radius)", boxShadow: "var(--shadow-soft)", padding: 48, textAlign: "center" }}>
          <Loader />
          <div style={{ color: "var(--text-muted)", fontSize: 14, marginTop: 14 }}>טוען 3 תלושים אחרונים ומפעיל ניתוח AI...</div>
        </div>
      ) : error ? (
        <div style={{ background: "var(--card)", border: "1px solid var(--border-soft)", borderRadius: "var(--radius)", boxShadow: "var(--shadow-soft)", padding: 40, textAlign: "center" }}>
          <div style={{ color: "var(--danger)", fontSize: 14, marginBottom: 14, fontWeight: 600 }}>{error}</div>
          <PrimaryBtn onClick={() => void loadAnalysis()}>נסה שוב</PrimaryBtn>
        </div>
      ) : hasData && summary ? (
        <>
          {/* HERO — analysis result */}
          <div style={{ position: "relative", overflow: "hidden", borderRadius: "var(--radius)", padding: "34px 32px", marginBottom: 40, background: "linear-gradient(120deg,var(--lav-100),var(--mint-soft) 52%,var(--butter-soft))", border: "1px solid var(--border-soft)", boxShadow: "var(--shadow-card)" }}>
            <div style={{ position: "absolute", inset: 0, backgroundImage: "radial-gradient(rgba(255,255,255,.55) 1px,transparent 1px)", backgroundSize: "20px 20px", opacity: .5, pointerEvents: "none" }} />
            <div style={{ position: "absolute", width: 260, height: 260, borderRadius: "50%", insetInlineStart: -90, top: -110, background: "radial-gradient(circle,rgba(155,127,232,.28),transparent 70%)", pointerEvents: "none" }} />
            <span style={{ position: "absolute", insetInlineStart: 26, top: 26, color: "var(--lav-500)", animation: "resFloat 4s ease-in-out infinite" }}><Sparkles size={22} /></span>
            <div style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 28, flexWrap: "wrap" }}>
              <div style={{ minWidth: 280 }}>
                <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "rgba(255,255,255,.7)", border: "1px solid var(--border-soft)", borderRadius: 999, padding: "6px 14px", marginBottom: 16, fontSize: 12.5, fontWeight: 800, color: "var(--lav-600)" }}>
                  <span style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--mint-ink)", boxShadow: "0 0 0 4px rgba(47,156,98,.18)" }} />הניתוח הושלם
                </div>
                <div style={{ fontSize: 14.5, color: "var(--ink-soft)", fontWeight: 600, marginBottom: 6 }}>נטו ממוצע ב‑{summary.count} התלושים האחרונים</div>
                <div style={{ fontSize: "clamp(42px,6vw,68px)", fontWeight: 900, letterSpacing: "-.045em", lineHeight: .92, fontVariantNumeric: "tabular-nums", backgroundImage: "linear-gradient(96deg,var(--lav-700),var(--peach-ink) 42%,var(--mint-ink) 70%,var(--lav-600))", backgroundSize: "220% auto", WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent", animation: "resShine 4.5s linear infinite" }}>{fmt(summary.avgNet)}</div>
                <div style={{ fontSize: 15, color: "var(--text-muted)", fontWeight: 500, marginTop: 10, maxWidth: 360 }}>מתוך ברוטו ממוצע של {fmt(summary.avgGross)}.</div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 12, minWidth: 200 }}>
                {[[String(summary.count), "תלושים נותחו", "var(--lav-600)"], [netGrossPct != null ? `${netGrossPct}%` : "—", "יחס נטו/ברוטו", "var(--mint-ink)"], [fmt(summary.avgTax), "מס הכנסה ממוצע", "var(--peach-ink)"]].map(([v, l, c]) => (
                  <div key={l} style={{ display: "flex", alignItems: "center", gap: 12, background: "rgba(255,255,255,.62)", backdropFilter: "blur(8px)", border: "1px solid var(--border-soft)", borderRadius: "var(--r-md)", padding: "12px 16px" }}>
                    <span style={{ fontSize: 20, fontWeight: 900, letterSpacing: "-.03em", color: c, minWidth: 64, fontVariantNumeric: "tabular-nums" }}>{v}</span>
                    <span style={{ fontSize: 13.5, color: "var(--text-body)", fontWeight: 600 }}>{l}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* salary picture */}
          <ResSection title="תמונת השכר שלך" sub={`ממוצע ${summary.count} תלושים אחרונים · ברוטו ${fmt(summary.avgGross)} → נטו ${fmt(summary.avgNet)}`}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14 }}>
              {statTiles.map(s => {
                const [bg, fg] = TONES[s.tone];
                const Icon = s.icon;
                return (
                  <div key={s.l} style={{ background: "var(--card)", border: "1px solid var(--border-hair)", borderRadius: "var(--r-md)", padding: "18px 16px", boxShadow: "var(--shadow-soft)" }}>
                    <span style={{ width: 36, height: 36, borderRadius: 10, background: bg, color: fg, display: "grid", placeItems: "center", marginBottom: 12 }}><Icon size={18} strokeWidth={1.85} /></span>
                    <div style={{ fontSize: 21, fontWeight: 900, letterSpacing: "-.03em", lineHeight: 1, color: "var(--text-strong)", fontVariantNumeric: "tabular-nums" }}>{s.v}</div>
                    <div style={{ fontSize: 12.5, color: "var(--text-muted)", fontWeight: 600, marginTop: 6 }}>{s.l}</div>
                  </div>
                );
              })}
            </div>
          </ResSection>

          {/* where money goes */}
          {summary.moneyFlow && <MoneyFlowSection flow={summary.moneyFlow} />}

          {/* recent payslips */}
          <ResSection title={`${summary.count} תלושים אחרונים`}>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {rows.map(p => (
                <button key={p.id} onClick={() => navigate(`${APP_ROUTES.payslipHistory}/${p.id}`)}
                  style={{ width: "100%", textAlign: "start", fontFamily: "inherit", cursor: "pointer", display: "flex", alignItems: "center", gap: 14, padding: "16px 18px", background: "var(--card)", border: "1px solid var(--border-hair)", borderRadius: "var(--r-md)", boxShadow: "var(--shadow-soft)" }}>
                  <span style={{ width: 40, height: 40, borderRadius: 11, flex: "none", background: "var(--lav-100)", color: "var(--lav-600)", display: "grid", placeItems: "center" }}><FileText size={20} strokeWidth={1.85} /></span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 800, fontSize: 15, color: "var(--text-strong)" }}>{p.displayLabel}</div>
                    <div style={{ fontSize: 12.5, color: "var(--text-muted)" }}>ברוטו {fmt(p.grossSalary)} · {p.employerName || "מעסיק"}{p.extractionStatus === "needs_review" ? " · דורש סקירה" : ""}</div>
                  </div>
                  <div style={{ textAlign: "center" }}>
                    <div style={{ fontWeight: 900, fontSize: 16, color: "var(--mint-ink)", fontVariantNumeric: "tabular-nums" }}>{fmt(p.netSalary)}</div>
                    <div style={{ fontSize: 11.5, color: "var(--text-faint)" }}>נטו</div>
                  </div>
                </button>
              ))}
            </div>
          </ResSection>
        </>
      ) : (
        /* empty state */
        <div style={{ background: "var(--card)", border: "1px solid var(--border-soft)", borderRadius: "var(--radius)", boxShadow: "var(--shadow-soft)", padding: 40, textAlign: "center", marginBottom: 36 }}>
          <span style={{ width: 56, height: 56, borderRadius: 15, background: "var(--lav-100)", color: "var(--lav-600)", display: "grid", placeItems: "center", margin: "0 auto 16px" }}><FileText size={26} strokeWidth={1.85} /></span>
          <h3 style={{ fontSize: 21, fontWeight: 900, color: "var(--text-strong)", margin: "0 0 10px", letterSpacing: "-.02em" }}>אין עדיין תלושים לניתוח</h3>
          <p style={{ fontSize: 14.5, color: "var(--text-muted)", margin: "0 0 20px", lineHeight: 1.65 }}>העלה תלוש שכר כדי שהסוכן יתחיל לנתח — או חזרה למסך ההעלאה.</p>
          <input ref={fileInputRef} type="file" accept=".pdf" style={{ display: "none" }}
            onChange={e => { const f = e.target.files?.[0]; if (f) void handleFileUpload(f); e.target.value = ""; }} />
          <div onClick={() => fileInputRef.current?.click()}
            onDragOver={e => { e.preventDefault(); setIsDragging(true); }} onDragLeave={() => setIsDragging(false)}
            onDrop={e => { e.preventDefault(); setIsDragging(false); const f = e.dataTransfer.files?.[0]; if (f) void handleFileUpload(f); }}
            style={{ border: "1.5px dashed " + (isDragging ? "var(--lav-500)" : "var(--border-soft)"), borderRadius: "var(--r-md)", padding: 24, cursor: uploading ? "wait" : "pointer", marginBottom: 12, maxWidth: 360, margin: "0 auto 12px" }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text-strong)" }}>{uploading ? "מעלה..." : "גרור תלוש לכאן"}</div>
            {!uploading && <div style={{ fontSize: 12.5, color: "var(--text-muted)", marginTop: 4 }}>PDF בלבד</div>}
          </div>
          {uploadMsg && <div style={{ fontSize: 13, color: uploadMsg.includes("שגיאה") ? "var(--danger)" : "var(--mint-ink)", fontWeight: 600, marginBottom: 12 }}>{uploadMsg}</div>}
          {passwordDoc && (
            <div style={{ maxWidth: 360, margin: "0 auto 16px", padding: "12px 14px", borderRadius: "var(--r-md)", background: "var(--butter-soft)", border: "1px solid var(--butter)", textAlign: "start" }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "var(--butter-ink)", marginBottom: 8 }}>הזן/י סיסמת PDF לפתיחה ועיבוד</div>
              <div style={{ display: "flex", gap: 8 }}>
                <input type="password" value={passwordInput} placeholder="סיסמת PDF" disabled={unlocking}
                  onChange={e => setPasswordInput(e.target.value)}
                  style={{ flex: 1, padding: "8px 10px", borderRadius: "var(--r-sm)", border: "1px solid var(--butter)", fontFamily: "inherit", fontSize: 13, background: "var(--card)" }} />
                <button type="button" onClick={() => void handleResultsUnlock()} disabled={unlocking || !passwordInput.trim()}
                  style={{ padding: "8px 14px", borderRadius: "var(--r-sm)", background: "var(--butter-ink)", color: "#fff", border: "none", cursor: unlocking ? "wait" : "pointer", fontFamily: "inherit", fontWeight: 700, fontSize: 13 }}>{unlocking ? "פותח..." : "פתח"}</button>
              </div>
            </div>
          )}
          <PrimaryBtn onClick={onAddMore} iconLeft={<Upload size={15} strokeWidth={2} />}>הוסף תלושים</PrimaryBtn>
        </div>
      )}

      {/* AI insights */}
      {(hasData || summary?.moneyFlow) && (
        <ResSection title="תובנות AI" sub="מחקר מעמיק: מאיפה נעלם ההפרש בין ברוטו לנטו?">
          <div style={{ background: "var(--card)", border: "1px solid var(--border-soft)", borderRadius: "var(--radius)", boxShadow: "var(--shadow-soft)", padding: 24 }}>
            <InsightsPanel agent="payslip" trigger={refreshKey + (summary?.count ?? 0)} />
          </div>
        </ResSection>
      )}

      {/* ask agent */}
      <div style={{ textAlign: "center", background: "radial-gradient(120% 100% at 50% 0%,var(--lav-100),var(--surface-card))", border: "1px solid var(--border-soft)", borderRadius: "var(--radius)", padding: "38px 28px", boxShadow: "var(--shadow-soft)" }}>
        <span style={{ width: 54, height: 54, borderRadius: 15, background: "var(--ink)", color: "#fff", display: "grid", placeItems: "center", margin: "0 auto 16px", boxShadow: "var(--shadow-ink)" }}><Sparkles size={26} /></span>
        <h3 style={{ margin: "0 0 8px", fontSize: 24, fontWeight: 900, letterSpacing: "-.03em", color: "var(--text-strong)" }}>שאל את הסוכן שאלות</h3>
        <p style={{ margin: "0 auto 22px", maxWidth: 420, fontSize: 15, color: "var(--text-muted)", lineHeight: 1.6 }}>"למה המשכורת ירדה?" · "כמה מס שילמתי?" · "האם מגיע לי החזר מס?"</p>
        <PrimaryBtn size="lg" onClick={() => navigate(APP_ROUTES.planning)} iconLeft={<Sparkles size={18} />}>פתח שיחה עם הסוכן</PrimaryBtn>
        <div style={{ marginTop: 16 }}>
          <button onClick={onEditProfile} style={{ background: "none", border: "none", color: "var(--text-faint)", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>עדכן פרטים אישיים</button>
        </div>
      </div>
    </main>
  );
}

/* ════════════════════════════════════════════════════════════════
   MONEY FLOW — לאן הולך הכסף
════════════════════════════════════════════════════════════════ */
function MoneyFlowSection({ flow }: { flow: MoneyFlow }) {
  const pctNet = flow.avgGross > 0 ? Math.round((flow.avgNet / flow.avgGross) * 100) : 0;
  const pctWithheld = flow.avgGross > 0 ? Math.round((flow.totalWithheld / flow.avgGross) * 100) : 0;
  const maxPct = Math.max(...flow.items.map(it => it.pctOfGross), 1);
  return (
    <ResSection title="לאן הולך הכסף?" sub={`מ‑₪${flow.avgGross.toLocaleString("he-IL")} ברוטו → ₪${flow.avgNet.toLocaleString("he-IL")} נטו · ₪${flow.totalWithheld.toLocaleString("he-IL")} ניכויים (${pctWithheld}%)`}>
      <div style={{ background: "var(--card)", border: "1px solid var(--border-soft)", borderRadius: "var(--radius)", padding: 26, boxShadow: "var(--shadow-soft)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13.5, fontWeight: 800, marginBottom: 10 }}>
          <span style={{ color: "var(--lav-600)" }}>ברוטו ₪{flow.avgGross.toLocaleString("he-IL")}</span>
          <span style={{ color: "var(--mint-ink)" }}>נטו ₪{flow.avgNet.toLocaleString("he-IL")} ({pctNet}%)</span>
        </div>
        <div style={{ height: 14, borderRadius: 999, background: "var(--hair)", overflow: "hidden", marginBottom: 8 }}>
          <div style={{ height: "100%", width: `${pctNet}%`, borderRadius: 999, background: "linear-gradient(90deg,var(--mint),var(--mint-ink))" }} />
        </div>
        <div style={{ textAlign: "center", fontSize: 12.5, color: "var(--text-muted)", fontWeight: 600, marginBottom: 22 }}>₪{flow.totalWithheld.toLocaleString("he-IL")} ניכויים והפרשות מהברוטו</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {flow.items.map(item => (
            <div key={item.label}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 7 }}>
                <span style={{ fontWeight: 700, color: "var(--text-body)" }}>{item.label}</span>
                <span style={{ fontWeight: 900, color: "var(--ink)", fontVariantNumeric: "tabular-nums" }}>₪{item.avgAmount.toLocaleString("he-IL")} · {item.pctOfGross}%</span>
              </div>
              <div style={{ height: 12, borderRadius: 999, background: "var(--surface-sunken)", overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${Math.max((item.pctOfGross / maxPct) * 100, 4)}%`, borderRadius: 999, background: "linear-gradient(90deg,var(--lav-400),var(--lav-600))" }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </ResSection>
  );
}

/* ── small UI atoms ──────────────────────────────────────────── */
function ResSection({ title, sub, children }: { title: string; sub?: string; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: 40 }}>
      <h2 style={{ margin: "0 0 4px", fontSize: "clamp(22px,2.6vw,30px)", fontWeight: 900, letterSpacing: "-.03em", color: "var(--text-strong)" }}>{title}</h2>
      {sub && <p style={{ margin: "0 0 20px", fontSize: 14.5, color: "var(--text-muted)", fontWeight: 500 }}>{sub}</p>}
      {children}
    </section>
  );
}

function PrimaryBtn({ children, onClick, disabled, fullWidth, size = "md", iconLeft, iconRight }: {
  children: React.ReactNode; onClick?: () => void; disabled?: boolean; fullWidth?: boolean;
  size?: "sm" | "md" | "lg"; iconLeft?: React.ReactNode; iconRight?: React.ReactNode;
}) {
  const pad = size === "lg" ? "14px 28px" : size === "sm" ? "8px 16px" : "12px 22px";
  const fs = size === "lg" ? 16 : size === "sm" ? 13.5 : 15;
  return (
    <button type="button" onClick={onClick} disabled={disabled}
      style={{ width: fullWidth ? "100%" : undefined, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, padding: pad, borderRadius: "var(--r-btn)", border: "none", cursor: disabled ? "not-allowed" : "pointer", fontFamily: "inherit", fontWeight: 800, fontSize: fs, color: "#fff", background: disabled ? "var(--lav-300)" : "var(--ink)", opacity: disabled ? 0.7 : 1, boxShadow: disabled ? "none" : "var(--shadow-ink)", transition: "opacity var(--dur-fast) var(--ease)" }}>
      {iconLeft}{children}{iconRight}
    </button>
  );
}

function ToolBtn({ children, icon, onClick }: { children: React.ReactNode; icon: React.ReactNode; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "8px 14px", borderRadius: "var(--r-sm)", border: "1px solid var(--border-soft)", background: "var(--surface-sunken)", cursor: "pointer", fontFamily: "inherit", fontWeight: 700, fontSize: 13, color: "var(--text-body)" }}>
      {icon}{children}
    </button>
  );
}
