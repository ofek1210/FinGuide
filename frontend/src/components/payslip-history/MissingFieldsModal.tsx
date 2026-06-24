import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, Check, FileText, Loader2, Save, X } from "lucide-react";
import { fetchPayslipDetail } from "../../services/payslip.service";
import { downloadDocument, updateDocumentFields, type ManualPayslipFields } from "../../api/documents.api";
import type { PayslipDetail } from "../../types/payslip";

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

const isMissingText = (v: unknown) => typeof v !== "string" || v.trim().length === 0;

/**
 * Modal for completing payslip fields the OCR/LLM could not extract.
 * Shows the original PDF inline (left) and a manual-entry form for the missing
 * critical fields (right). Persists via PATCH /api/documents/:id/fields.
 */
export default function MissingFieldsModal({
  docId, onClose, onSaved,
}: {
  docId: string;
  onClose: () => void;
  onSaved?: () => void;
}) {
  const [payslip, setPayslip] = useState<PayslipDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = prevOverflow; };
  }, [onClose]);

  useEffect(() => {
    let alive = true;
    setLoading(true); setError(null);
    void fetchPayslipDetail(docId).then(d => { if (alive) setPayslip(d ?? null); })
      .catch(() => { if (alive) setError("לא הצלחנו לטעון את פרטי התלוש."); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [docId]);

  useEffect(() => {
    let url: string | null = null;
    let alive = true;
    void downloadDocument(docId).then(res => {
      if (!alive) return;
      if (res.success && res.blob) { url = window.URL.createObjectURL(res.blob); setPdfUrl(url); }
      else setPdfError(res.message ?? "לא ניתן לטעון תצוגה מקדימה של ה‑PDF.");
    });
    return () => { alive = false; if (url) window.URL.revokeObjectURL(url); };
  }, [docId]);

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
  const hasMissing = missingKeys.length > 0;

  const handleSave = useCallback(async () => {
    if (saving) return;
    setSaving(true); setSaveError(null);
    const patch: ManualPayslipFields = {};
    for (const k of missingKeys) {
      const v = (values[k] ?? "").trim();
      if (!v) continue;
      (patch[FIELD_DEFS[k].apiKey] as string) = v;
    }
    if (Object.keys(patch).length === 0) { setSaving(false); setSaveError("מלא/י לפחות שדה אחד."); return; }
    const res = await updateDocumentFields(docId, patch);
    setSaving(false);
    if (!res.success) { setSaveError(res.message ?? "שגיאה בשמירה."); return; }
    setSaved(true);
    onSaved?.();
  }, [saving, missingKeys, values, docId, onSaved]);

  return (
    <div
      onClick={onClose}
      style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(18,17,24,.55)", backdropFilter: "blur(4px)", WebkitBackdropFilter: "blur(4px)", display: "grid", placeItems: "center", padding: 24, direction: "rtl", fontFamily: "var(--font-body)", animation: "mfFade .2s var(--ease)" }}
    >
      <div data-agent="payslips" onClick={e => e.stopPropagation()}
        style={{ width: "min(1000px, 100%)", maxHeight: "90vh", overflow: "hidden", background: "var(--surface-card)", borderRadius: "var(--r-card)", boxShadow: "var(--shadow-xl)", display: "flex", flexDirection: "column", animation: "mfRise .25s var(--ease)" }}>
        {/* header */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "16px 20px", borderBottom: "1px solid var(--border-hair)" }}>
          <span style={{ width: 38, height: 38, borderRadius: 11, flex: "none", background: "var(--peach-soft)", color: "var(--peach-ink)", display: "grid", placeItems: "center" }}><AlertTriangle size={19} /></span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 16, fontWeight: 900, color: "var(--text-strong)", letterSpacing: "-.02em" }}>השלמת פרטים חסרים</div>
            <div style={{ fontSize: 12.5, color: "var(--text-muted)" }}>{payslip?.periodLabel || "תלוש שכר"}{hasMissing ? ` · ${missingKeys.length} שדות לא זוהו` : ""}</div>
          </div>
          <button onClick={onClose} aria-label="סגור" style={{ width: 34, height: 34, borderRadius: 9, border: "1px solid var(--border-hair)", background: "var(--card)", color: "var(--text-muted)", cursor: "pointer", display: "grid", placeItems: "center" }}><X size={17} /></button>
        </div>

        {/* body */}
        {loading ? (
          <div style={{ padding: 60, display: "grid", placeItems: "center", color: "var(--lav-600)" }}><Loader2 size={26} style={{ animation: "spin .8s linear infinite" }} /></div>
        ) : error || !payslip ? (
          <div style={{ padding: 40, textAlign: "center", color: "var(--danger)", fontWeight: 700 }}>{error ?? "התלוש לא נמצא."}</div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 0, overflow: "hidden", flex: 1, minHeight: 0 }}>
            {/* PDF */}
            <div style={{ borderInlineEnd: "1px solid var(--border-hair)", display: "flex", flexDirection: "column", minHeight: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 16px", borderBottom: "1px solid var(--border-hair)" }}>
                <FileText size={15} color="var(--lav-600)" /><span style={{ fontSize: 13, fontWeight: 800, color: "var(--ink)" }}>ה‑PDF המקורי</span>
              </div>
              <div style={{ flex: 1, minHeight: 360, background: "var(--surface-sunken)" }}>
                {pdfUrl ? <iframe title="PDF" src={pdfUrl} style={{ width: "100%", height: "100%", border: "none", display: "block" }} />
                  : pdfError ? <div style={{ height: "100%", display: "grid", placeItems: "center", color: "var(--text-muted)", fontSize: 13, padding: 20, textAlign: "center" }}>{pdfError}</div>
                  : <div style={{ height: "100%", display: "grid", placeItems: "center", color: "var(--lav-600)" }}><Loader2 size={22} style={{ animation: "spin .8s linear infinite" }} /></div>}
              </div>
            </div>

            {/* form */}
            <div style={{ padding: 20, overflowY: "auto", minHeight: 0 }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 16, padding: "11px 13px", borderRadius: "var(--r-sm)", background: "var(--peach-soft)", border: "1px solid var(--peach)", color: "var(--peach-ink)" }}>
                <AlertTriangle size={16} strokeWidth={2} style={{ flexShrink: 0, marginTop: 1 }} />
                <span style={{ fontSize: 12.5, fontWeight: 600, lineHeight: 1.55 }}>לא הצלחנו לחלץ חלק מהשדות הקריטיים מה‑PDF. עיין/י במסמך והשלם/י אותם — זה משפר את דיוק הניתוח.</span>
              </div>

              {!hasMissing ? (
                <div style={{ display: "flex", alignItems: "center", gap: 10, padding: 16, borderRadius: "var(--r-md)", background: "var(--mint-soft)", color: "var(--mint-ink)", fontWeight: 700, fontSize: 14 }}>
                  <Check size={18} strokeWidth={3} /> כל הפרטים הקריטיים זוהו.
                </div>
              ) : saved ? (
                <div style={{ textAlign: "center", padding: "24px 8px" }}>
                  <span style={{ width: 54, height: 54, borderRadius: "50%", background: "var(--mint-soft)", color: "var(--mint-ink)", display: "grid", placeItems: "center", margin: "0 auto 14px" }}><Check size={26} strokeWidth={3} /></span>
                  <div style={{ fontSize: 16, fontWeight: 900, color: "var(--text-strong)", marginBottom: 6 }}>הפרטים נשמרו!</div>
                  <p style={{ fontSize: 13.5, color: "var(--text-muted)", margin: "0 0 16px" }}>הניתוח יתעדכן בהתאם.</p>
                  <button onClick={onClose} style={{ padding: "11px 24px", borderRadius: "var(--r-btn)", background: "var(--grad-brand)", color: "#fff", border: "none", cursor: "pointer", fontFamily: "inherit", fontWeight: 800, fontSize: 14 }}>סגירה</button>
                </div>
              ) : (
                <>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                    <h3 style={{ margin: 0, fontSize: 15.5, fontWeight: 800, color: "var(--text-strong)" }}>מילוי ידני</h3>
                    <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text-faint)" }}>{filledCount}/{missingKeys.length} מולאו</span>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    {missingKeys.map(k => {
                      const def = FIELD_DEFS[k];
                      if (!def) return null;
                      return (
                        <label key={k} style={{ display: "block" }}>
                          <span style={{ display: "block", fontSize: 12.5, fontWeight: 700, color: "var(--text-body)", marginBottom: 6 }}>{def.label}</span>
                          <input type={def.type} placeholder={def.placeholder} inputMode={def.type === "number" ? "numeric" : undefined}
                            value={values[k] ?? ""} onChange={e => { setValues(p => ({ ...p, [k]: e.target.value })); setSaved(false); }}
                            style={{ width: "100%", height: 44, boxSizing: "border-box", padding: "0 13px", borderRadius: "var(--r-btn)", border: "1px solid var(--border-soft)", background: "var(--surface-page)", fontFamily: "inherit", fontSize: 14.5, fontWeight: 600, color: "var(--ink)", outline: "none" }}
                            onFocus={e => { e.currentTarget.style.borderColor = "var(--lav-500)"; e.currentTarget.style.boxShadow = "0 0 0 4px rgba(155,127,232,.14)"; }}
                            onBlur={e => { e.currentTarget.style.borderColor = "var(--border-soft)"; e.currentTarget.style.boxShadow = "none"; }} />
                        </label>
                      );
                    })}
                  </div>
                  {saveError && <div style={{ marginTop: 12, fontSize: 13, fontWeight: 600, color: "var(--danger)" }}>{saveError}</div>}
                  <button onClick={() => void handleSave()} disabled={saving || filledCount === 0}
                    style={{ marginTop: 18, width: "100%", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 9, padding: "13px", borderRadius: "var(--r-btn)", border: "none", cursor: saving || filledCount === 0 ? "not-allowed" : "pointer", fontFamily: "inherit", fontWeight: 800, fontSize: 15, color: "#fff", background: filledCount === 0 ? "var(--lav-300)" : "var(--grad-brand)", opacity: saving ? 0.8 : 1, boxShadow: filledCount === 0 ? "none" : "var(--shadow-lav)" }}>
                    {saving ? <Loader2 size={16} style={{ animation: "spin .8s linear infinite" }} /> : <Save size={16} />}
                    {saving ? "שומר..." : "שמירת הפרטים"}
                  </button>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
