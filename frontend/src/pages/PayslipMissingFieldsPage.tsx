import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { AlertTriangle, ChevronRight, Check, FileText, Loader2, Save } from "lucide-react";
import PrivateTopbar from "../components/PrivateTopbar";
import AppFooter from "../components/AppFooter";
import { fetchPayslipDetail } from "../services/payslip.service";
import { downloadDocument, updateDocumentFields, type ManualPayslipFields } from "../api/documents.api";
import type { PayslipDetail } from "../types/payslip";
import { APP_ROUTES } from "../types/navigation";

type FieldDef = { label: string; apiKey: keyof ManualPayslipFields; type: "text" | "month" | "date" | "number"; placeholder?: string };

const FIELD_DEFS: Record<string, FieldDef> = {
  periodLabel: { label: "תקופת התלוש", apiKey: "periodMonth", type: "month" },
  employerName: { label: "שם המעסיק", apiKey: "employerName", type: "text", placeholder: "לדוגמה: אדיר יהושע בע״מ" },
  employeeName: { label: "שם העובד", apiKey: "employeeName", type: "text" },
  employeeId: { label: "תעודת זהות", apiKey: "employeeId", type: "text", placeholder: "9 ספרות" },
  paymentDate: { label: "תאריך תשלום", apiKey: "paymentDate", type: "date" },
  grossSalary: { label: "שכר ברוטו (₪)", apiKey: "grossSalary", type: "number", placeholder: "0" },
  netSalary: { label: "שכר נטו (₪)", apiKey: "netSalary", type: "number", placeholder: "0" },
};

function isMissingText(v: unknown): boolean {
  return typeof v !== "string" || v.trim().length === 0;
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div data-agent="payslips" style={{ minHeight: "100vh", background: "var(--surface-page)", color: "var(--text-body)", fontFamily: "var(--font-body)", direction: "rtl" }}>
      <PrivateTopbar />
      {children}
      <AppFooter variant="private" />
    </div>
  );
}

export default function PayslipMissingFieldsPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [payslip, setPayslip] = useState<PayslipDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [pdfError, setPdfError] = useState<string | null>(null);

  const [values, setValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const loadDetail = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const data = await fetchPayslipDetail(id);
      setPayslip(data ?? null);
    } catch {
      setError("לא הצלחנו לטעון את פרטי התלוש.");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { void loadDetail(); }, [loadDetail]);

  // fetch the PDF as a blob and render it inline via an object URL
  useEffect(() => {
    if (!id) return;
    let url: string | null = null;
    let alive = true;
    void downloadDocument(id).then(res => {
      if (!alive) return;
      if (res.success && res.blob) {
        url = window.URL.createObjectURL(res.blob);
        setPdfUrl(url);
      } else {
        setPdfError(res.message ?? "לא ניתן לטעון תצוגה מקדימה של ה‑PDF.");
      }
    });
    return () => { alive = false; if (url) window.URL.revokeObjectURL(url); };
  }, [id]);

  const missingKeys = useMemo<string[]>(() => {
    if (!payslip) return [];
    const keys: string[] = [];
    if (isMissingText(payslip.periodLabel) || payslip.periodLabel === "לא זוהה") keys.push("periodLabel");
    if (isMissingText(payslip.employerName)) keys.push("employerName");
    if (isMissingText(payslip.employeeName)) keys.push("employeeName");
    if (isMissingText(payslip.employeeId)) keys.push("employeeId");
    if (isMissingText(payslip.paymentDate)) keys.push("paymentDate");
    if (payslip.grossSalary == null) keys.push("grossSalary");
    if (payslip.netSalary == null) keys.push("netSalary");
    return keys;
  }, [payslip]);

  const filledCount = missingKeys.filter(k => (values[k] ?? "").trim() !== "").length;

  const handleSave = useCallback(async () => {
    if (!id || saving) return;
    setSaving(true);
    setSaveError(null);
    const patch: ManualPayslipFields = {};
    for (const k of missingKeys) {
      const v = (values[k] ?? "").trim();
      if (!v) continue;
      const def = FIELD_DEFS[k];
      (patch[def.apiKey] as string) = v;
    }
    if (Object.keys(patch).length === 0) {
      setSaving(false);
      setSaveError("מלא/י לפחות שדה אחד לפני השמירה.");
      return;
    }
    const res = await updateDocumentFields(id, patch);
    setSaving(false);
    if (!res.success) {
      setSaveError(res.message ?? "שגיאה בשמירה.");
      return;
    }
    setSaved(true);
    await loadDetail();
  }, [id, saving, missingKeys, values, loadDetail]);

  const goDetail = () => navigate(`${APP_ROUTES.payslipHistory}/${id}`);
  const goHistory = () => navigate(APP_ROUTES.payslipHistory);

  if (loading) {
    return <Shell><div style={{ minHeight: "55vh", display: "grid", placeItems: "center", color: "var(--lav-600)" }}><Loader2 size={28} style={{ animation: "spin .8s linear infinite" }} /></div></Shell>;
  }
  if (error || !payslip) {
    return (
      <Shell><main style={{ maxWidth: 600, margin: "0 auto", padding: "60px 24px", textAlign: "center" }}>
        <div style={{ color: "var(--danger)", fontWeight: 700, marginBottom: 14 }}>{error ?? "התלוש לא נמצא."}</div>
        <button onClick={goHistory} style={{ padding: "11px 22px", borderRadius: "var(--r-btn)", background: "var(--ink)", color: "#fff", border: "none", cursor: "pointer", fontFamily: "inherit", fontWeight: 800 }}>חזרה להיסטוריה</button>
      </main></Shell>
    );
  }

  const hasMissing = missingKeys.length > 0;
  const allDone = saved && hasMissing;

  return (
    <Shell>
      <main style={{ maxWidth: 1080, margin: "0 auto", padding: "36px 24px 80px" }}>
        <button onClick={goDetail} style={{ display: "inline-flex", alignItems: "center", gap: 7, background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", fontWeight: 700, fontSize: 13.5, color: "var(--text-muted)", marginBottom: 18, padding: 0 }}>
          <ChevronRight size={15} strokeWidth={2.4} /> חזרה לדוח התלוש
        </button>

        {/* header */}
        <div style={{ display: "flex", alignItems: "flex-start", gap: 14, marginBottom: 18 }}>
          <span style={{ width: 46, height: 46, borderRadius: 13, flex: "none", background: "var(--peach-soft)", color: "var(--peach-ink)", display: "grid", placeItems: "center" }}><AlertTriangle size={22} /></span>
          <div>
            <h1 style={{ margin: 0, fontSize: "clamp(24px,3vw,34px)", fontWeight: 900, letterSpacing: "-.03em", color: "var(--text-strong)" }}>השלמת פרטים חסרים</h1>
            <p style={{ margin: "6px 0 0", fontSize: 15, color: "var(--text-muted)", fontWeight: 500 }}>
              {payslip.periodLabel || "תלוש שכר"} · {hasMissing ? `${missingKeys.length} שדות לא זוהו` : "כל הפרטים זוהו"}
            </p>
          </div>
        </div>

        {/* alert about extraction gaps */}
        <div style={{ display: "flex", alignItems: "flex-start", gap: 11, marginBottom: 26, padding: "14px 16px", borderRadius: "var(--r-btn)", background: "var(--peach-soft)", border: "1px solid var(--peach)", color: "var(--peach-ink)" }}>
          <AlertTriangle size={18} strokeWidth={2} style={{ flexShrink: 0, marginTop: 1 }} />
          <span style={{ fontSize: 13.5, fontWeight: 600, lineHeight: 1.6 }}>
            לא הצלחנו לחלץ חלק מהפרטים מה‑PDF — זה קורה כשהסריקה לא חדה, הטקסט קטן/מטושטש או הפורמט לא סטנדרטי.
            עיין/י ב‑PDF מצד אחד והשלם/י את השדות החסרים מצד שני. ההשלמה תשפר את דיוק הניתוח והממצאים.
          </span>
        </div>

        {/* split: PDF preview + form */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, alignItems: "start" }}>
          {/* PDF preview */}
          <div style={{ background: "var(--card)", border: "1px solid var(--border-soft)", borderRadius: "var(--radius)", boxShadow: "var(--shadow-soft)", overflow: "hidden", display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "12px 16px", borderBottom: "1px solid var(--border-hair)" }}>
              <FileText size={16} color="var(--lav-600)" />
              <span style={{ fontSize: 13.5, fontWeight: 800, color: "var(--ink)" }}>תצוגת ה‑PDF המקורי</span>
            </div>
            <div style={{ height: "70vh", minHeight: 480, background: "var(--surface-sunken)" }}>
              {pdfUrl ? (
                <iframe title="תצוגת PDF" src={pdfUrl} style={{ width: "100%", height: "100%", border: "none", display: "block" }} />
              ) : pdfError ? (
                <div style={{ height: "100%", display: "grid", placeItems: "center", textAlign: "center", color: "var(--text-muted)", fontSize: 13.5, padding: 24 }}>{pdfError}</div>
              ) : (
                <div style={{ height: "100%", display: "grid", placeItems: "center", color: "var(--lav-600)" }}><Loader2 size={24} style={{ animation: "spin .8s linear infinite" }} /></div>
              )}
            </div>
          </div>

          {/* manual entry form */}
          <div style={{ background: "var(--card)", border: "1px solid var(--border-soft)", borderRadius: "var(--radius)", boxShadow: "var(--shadow-soft)", padding: 24 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
              <h2 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: "var(--text-strong)" }}>מילוי ידני</h2>
              {hasMissing && <span style={{ fontSize: 12.5, fontWeight: 700, color: "var(--text-faint)" }}>{filledCount}/{missingKeys.length} מולאו</span>}
            </div>

            {!hasMissing ? (
              <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "16px", borderRadius: "var(--r-md)", background: "var(--mint-soft)", color: "var(--mint-ink)", fontWeight: 700, fontSize: 14 }}>
                <Check size={18} strokeWidth={3} /> כל הפרטים בתלוש זוהו — אין מה להשלים.
              </div>
            ) : allDone ? (
              <div style={{ textAlign: "center", padding: "20px 8px" }}>
                <span style={{ width: 56, height: 56, borderRadius: "50%", background: "var(--mint-soft)", color: "var(--mint-ink)", display: "grid", placeItems: "center", margin: "0 auto 14px" }}><Check size={28} strokeWidth={3} /></span>
                <div style={{ fontSize: 17, fontWeight: 900, color: "var(--text-strong)", marginBottom: 6 }}>הפרטים נשמרו!</div>
                <p style={{ fontSize: 14, color: "var(--text-muted)", margin: "0 0 18px" }}>עדכנו את התלוש — הניתוח והממצאים ישתקפו בהתאם.</p>
                <button onClick={goDetail} style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "12px 24px", borderRadius: "var(--r-btn)", background: "var(--ink)", color: "#fff", border: "none", cursor: "pointer", fontFamily: "inherit", fontWeight: 800, fontSize: 15, boxShadow: "var(--shadow-ink)" }}>לדוח התלוש</button>
              </div>
            ) : (
              <>
                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  {missingKeys.map(k => {
                    const def = FIELD_DEFS[k];
                    if (!def) return null;
                    return (
                      <label key={k} style={{ display: "block" }}>
                        <span style={{ display: "block", fontSize: 13, fontWeight: 700, color: "var(--text-body)", marginBottom: 7 }}>{def.label}</span>
                        <input
                          type={def.type}
                          placeholder={def.placeholder}
                          inputMode={def.type === "number" ? "numeric" : undefined}
                          value={values[k] ?? ""}
                          onChange={e => { setValues(p => ({ ...p, [k]: e.target.value })); setSaved(false); }}
                          style={{ width: "100%", height: 48, boxSizing: "border-box", padding: "0 14px", borderRadius: "var(--r-btn)", border: "1px solid var(--border-soft)", background: "var(--surface-page)", fontFamily: "inherit", fontSize: 15, fontWeight: 600, color: "var(--ink)", outline: "none" }}
                          onFocus={e => { e.currentTarget.style.borderColor = "var(--lav-500)"; e.currentTarget.style.boxShadow = "0 0 0 4px rgba(155,127,232,.14)"; }}
                          onBlur={e => { e.currentTarget.style.borderColor = "var(--border-soft)"; e.currentTarget.style.boxShadow = "none"; }}
                        />
                      </label>
                    );
                  })}
                </div>

                {saveError && <div style={{ marginTop: 14, fontSize: 13, fontWeight: 600, color: "var(--danger)" }}>{saveError}</div>}

                <button onClick={() => void handleSave()} disabled={saving || filledCount === 0}
                  style={{ marginTop: 20, width: "100%", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 9, padding: "14px", borderRadius: "var(--r-btn)", border: "none", cursor: saving || filledCount === 0 ? "not-allowed" : "pointer", fontFamily: "inherit", fontWeight: 800, fontSize: 15, color: "#fff", background: filledCount === 0 ? "var(--lav-300)" : "var(--ink)", opacity: saving ? 0.8 : 1, boxShadow: filledCount === 0 ? "none" : "var(--shadow-ink)" }}>
                  {saving ? <Loader2 size={17} style={{ animation: "spin .8s linear infinite" }} /> : <Save size={17} />}
                  {saving ? "שומר..." : "שמירת הפרטים"}
                </button>
                <p style={{ margin: "12px 0 0", fontSize: 12, color: "var(--text-faint)", textAlign: "center" }}>הערכים שתמלא/י יישמרו לתלוש ויזינו את הניתוח.</p>
              </>
            )}
          </div>
        </div>
      </main>
    </Shell>
  );
}
