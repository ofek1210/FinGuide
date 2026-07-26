import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  Check, ChevronRight, Download, RefreshCw, AlertTriangle, FileText, Loader2,
} from "lucide-react";
import PrivateTopbar from "../components/PrivateTopbar";
import AppFooter from "../components/AppFooter";
import MissingFieldsModal from "../components/payslip-history/MissingFieldsModal";
import { downloadDocument } from "../api/documents.api";
import { fetchPayslipDetail, reprocessPayslip } from "../services/payslip.service";
import type { PayslipDetail } from "../types/payslip";
import { APP_ROUTES } from "../types/navigation";
import { formatCurrencyILS } from "../utils/formatters";
import { useRegisterPageContext } from "../assistant/AiChatProvider";

const nis = (n: number | null | undefined) => (n == null ? "—" : formatCurrencyILS(n));

function useCountUp(target: number, run: boolean, dur = 1200) {
  const [v, setV] = useState(0);
  const raf = useRef(0);
  useEffect(() => {
    if (!run) { setV(target); return; }
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min((now - start) / dur, 1);
      setV(Math.round((1 - Math.pow(1 - t, 3)) * target));
      if (t < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [target, run, dur]);
  return v;
}

const findDeduction = (p: PayslipDetail, sub: string) =>
  p.deductions.find(d => d.label.includes(sub))?.amount ?? null;

/** Score ring fed by the payslip's components flowing into a center health score. */
function ScoreRing({ score, comps }: { score: number; comps: { label: string; val: string; x: number; y: number; color: string; bend: number }[] }) {
  const C = { x: 150, y: 132 };
  const pathFor = (n: { x: number; y: number; bend: number }) => {
    const mx = (n.x + C.x) / 2, my = (n.y + C.y) / 2;
    const dx = C.x - n.x, dy = C.y - n.y, len = Math.hypot(dx, dy) || 1;
    const k = 0.22 * len * n.bend;
    return `M${n.x} ${n.y} Q${mx + (-dy / len) * k} ${my + (dx / len) * k} ${C.x} ${C.y}`;
  };
  const r = 46, circ = 2 * Math.PI * r;
  const offset = circ - (score / 100) * circ;
  return (
    <svg viewBox="0 0 300 290" style={{ width: "100%", display: "block", overflow: "visible" }}>
      {comps.map((n, i) => (
        <g key={n.label}>
          <path d={pathFor(n)} fill="none" stroke={n.color} strokeOpacity=".2" strokeWidth="1.4" strokeLinecap="round" strokeDasharray="1.5 7" />
          <path className="pres-flow" d={pathFor(n)} fill="none" stroke={n.color} strokeWidth="2.4" strokeLinecap="round" pathLength={100} strokeDasharray="14 100" style={{ animation: `presFlow ${4.4 + i * 0.5}s linear infinite`, animationDelay: `${i * 0.55}s` }} />
        </g>
      ))}
      {comps.map((n, i) => (
        <g key={n.label + "n"} style={{ animation: `presNodeIn .5s var(--ease) ${0.25 + i * 0.08}s both` }}>
          <circle cx={n.x} cy={n.y} r="5" fill={n.color} />
          <circle cx={n.x} cy={n.y} r="9" fill="none" stroke={n.color} strokeOpacity=".28" strokeWidth="1.5" />
          <text x={n.x} y={n.y > C.y ? n.y + 24 : n.y - 30} textAnchor="middle" fontSize="11.5" fontWeight="800" fill="var(--ink-soft)">{n.label}</text>
          <text x={n.x} y={n.y > C.y ? n.y + 39 : n.y - 16} textAnchor="middle" fontSize="11.5" fontWeight="700" fill="var(--text-faint)">{n.val}</text>
        </g>
      ))}
      <circle cx={C.x} cy={C.y} r={r} fill="var(--card)" stroke="var(--hair)" strokeWidth="9" />
      <circle cx={C.x} cy={C.y} r={r} fill="none" stroke="var(--mint-ink)" strokeWidth="9" strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={offset} transform={`rotate(-90 ${C.x} ${C.y})`} style={{ transition: "stroke-dashoffset 1.2s var(--ease)" }} />
      <text x={C.x} y={C.y - 2} textAnchor="middle" fontSize="34" fontWeight="900" fill="var(--ink)" style={{ letterSpacing: "-.04em" }}>{score}</text>
      <text x={C.x} y={C.y + 18} textAnchor="middle" fontSize="11.5" fontWeight="700" fill="var(--text-muted)">מתוך 100</text>
    </svg>
  );
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

export default function PayslipDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [payslip, setPayslip] = useState<PayslipDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [seen, setSeen] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [reprocessing, setReprocessing] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    if (document.getElementById("pres-anim")) return;
    const st = document.createElement("style");
    st.id = "pres-anim";
    st.textContent =
      "@keyframes presFlow{from{stroke-dashoffset:124}to{stroke-dashoffset:0}}" +
      "@keyframes presRise{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}" +
      "@keyframes presNodeIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}" +
      "@keyframes presBar{from{width:0}}";
    document.head.appendChild(st);
  }, []);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true); setError(null);
    try {
      const data = await fetchPayslipDetail(id);
      setPayslip(data ?? null);
      setTimeout(() => setSeen(true), 60);
    } catch {
      setError("לא הצלחנו לטעון את התלוש.");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { void load(); }, [load]);

  const earningsTotal = useMemo(() => payslip?.earnings.reduce((s, i) => s + i.amount, 0) ?? 0, [payslip]);
  const deductionsTotal = useMemo(() => payslip?.deductions.reduce((s, i) => s + i.amount, 0) ?? 0, [payslip]);

  const handleDownload = useCallback(async () => {
    if (!payslip) return;
    setDownloading(true);
    const res = await downloadDocument(payslip.id);
    setDownloading(false);
    if (res.success && res.blob) {
      const url = window.URL.createObjectURL(res.blob);
      const a = window.document.createElement("a");
      a.href = url; a.download = res.filename ?? `${payslip.periodLabel}.pdf`;
      window.document.body.appendChild(a); a.click(); a.remove();
      window.URL.revokeObjectURL(url);
    } else setNotice(res.message ?? "שגיאה בהורדה.");
  }, [payslip]);

  const handleReprocess = useCallback(async () => {
    if (!payslip || reprocessing) return;
    setReprocessing(true); setNotice(null);
    try {
      const refreshed = await reprocessPayslip(payslip.id);
      if (refreshed) { setPayslip(refreshed); setNotice("התלוש נותח מחדש."); }
    } catch {
      setNotice("החילוץ מחדש נכשל.");
    } finally { setReprocessing(false); }
  }, [payslip, reprocessing]);

  const cGross = useCountUp(payslip?.grossSalary ?? 0, seen);
  const cNet = useCountUp(payslip?.netSalary ?? 0, seen);
  const cDed = useCountUp(deductionsTotal, seen);

  const pageContextLabel = useMemo(() => {
    if (!payslip) return null;
    const period =
      payslip.periodLabel && payslip.periodLabel !== "לא זוהה"
        ? payslip.periodLabel
        : null;
    const employer = payslip.employerName?.trim() || null;
    if (period && employer) return `צפייה בתלוש ${period} · ${employer}`;
    if (period) return `צפייה בתלוש ${period}`;
    if (employer) return `צפייה בתלוש · ${employer}`;
    return "צפייה בתלוש שכר";
  }, [payslip]);

  const pageContextDetail = useMemo(() => {
    if (!payslip) return null;
    const lines: string[] = [`המשתמש צופה כעת בתלוש: ${pageContextLabel}`];
    if (payslip.employerName) lines.push(`מעסיק: ${payslip.employerName}`);
    if (payslip.periodLabel && payslip.periodLabel !== "לא זוהה") {
      lines.push(`תקופה: ${payslip.periodLabel}`);
    }
    if (payslip.grossSalary != null) {
      lines.push(`ברוטו: ${formatCurrencyILS(payslip.grossSalary)}`);
    }
    if (payslip.netSalary != null) {
      lines.push(`נטו: ${formatCurrencyILS(payslip.netSalary)}`);
    }
    const tax = findDeduction(payslip, "מס הכנסה");
    if (tax != null) lines.push(`מס הכנסה: ${formatCurrencyILS(tax)}`);
    const pensionEmp =
      payslip.pensionEmployee ?? findDeduction(payslip, "פנסיה (עובד)");
    if (pensionEmp != null) {
      lines.push(`פנסיה עובד: ${formatCurrencyILS(pensionEmp)}`);
    }
    return lines.join("\n");
  }, [payslip, pageContextLabel]);

  useRegisterPageContext(pageContextLabel, pageContextDetail);

  if (loading) {
    return <Shell><div style={{ minHeight: "55vh", display: "grid", placeItems: "center", color: "var(--lav-600)" }}><Loader2 size={28} style={{ animation: "spin .8s linear infinite" }} /></div></Shell>;
  }
  if (error || !payslip) {
    return (
      <Shell><main style={{ maxWidth: 600, margin: "0 auto", padding: "60px 24px", textAlign: "center" }}>
        <div style={{ color: "var(--danger)", fontWeight: 700, marginBottom: 14 }}>{error ?? "התלוש לא נמצא."}</div>
        <button onClick={() => navigate(APP_ROUTES.payslipHistory)} style={{ padding: "11px 22px", borderRadius: "var(--r-btn)", background: "var(--ink)", color: "#fff", border: "none", cursor: "pointer", fontFamily: "inherit", fontWeight: 800 }}>חזרה להיסטוריה</button>
      </main></Shell>
    );
  }

  const p = payslip;
  const needsReview = p.extractionStatus === "needs_review";
  const tax = findDeduction(p, "מס הכנסה");
  const ni = findDeduction(p, "ביטוח לאומי");
  const pensionEmployee = p.pensionEmployee ?? findDeduction(p, "פנסיה (עובד)");
  const pensionEmployer = p.pensionEmployer ?? findDeduction(p, "פנסיה (מעסיק)");
  const pensionTotal =
    pensionEmployee != null && pensionEmployer != null
      ? Math.round((pensionEmployee + pensionEmployer) * 100) / 100
      : p.pensionTotal ?? pensionEmployee ?? pensionEmployer ?? null;

  // data-completeness health score (honest: how much of the payslip was extracted)
  const checks = [p.grossSalary != null, p.netSalary != null, Boolean(p.employerName), Boolean(p.periodLabel && p.periodLabel !== "לא זוהה"), p.deductions.length > 0, p.earnings.length > 0];
  const score = needsReview ? Math.min(70, Math.round((checks.filter(Boolean).length / checks.length) * 100)) : Math.round((checks.filter(Boolean).length / checks.length) * 100);

  const comps = [
    { label: "ברוטו", val: nis(p.grossSalary), x: 40, y: 44, color: "#7C5FD6", bend: -1 },
    { label: "מס הכנסה", val: nis(tax), x: 262, y: 40, color: "#DA6F44", bend: 1 },
    { label: "ביטוח לאומי", val: nis(ni), x: 30, y: 216, color: "#B98B16", bend: 1 },
    { label: "פנסיה (עובד)", val: nis(pensionEmployee), x: 270, y: 214, color: "#2F9C62", bend: -1 },
  ];

  const breakdown = [
    { label: "נטו לחשבון", value: p.netSalary ?? 0, color: "var(--mint-ink)" },
    { label: "מס הכנסה", value: tax ?? 0, color: "var(--peach-ink)" },
    { label: "פנסיה (עובד)", value: pensionEmployee ?? 0, color: "var(--lav-600)" },
    { label: "ביטוח לאומי", value: ni ?? 0, color: "var(--butter-ink)" },
  ].filter(b => b.value > 0);
  const bSum = breakdown.reduce((s, b) => s + b.value, 0) || 1;

  // Every identifying field we extracted/saved (incl. manually completed ones).
  const txt = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);
  const numTxt = (v: number | null | undefined, suffix = "") => (v != null ? `${v}${suffix}` : null);
  const detailRows: { label: string; value: string }[] = [
    { label: "שם העובד", value: txt(p.employeeName) },
    { label: "תעודת זהות", value: txt(p.employeeId) },
    { label: "מעסיק", value: txt(p.employerName) },
    { label: "תקופה", value: txt(p.periodLabel) && p.periodLabel !== "לא זוהה" ? p.periodLabel : null },
    { label: "תאריך תשלום", value: txt(p.paymentDate) },
    { label: "אחוז משרה", value: numTxt(p.jobPercent, "%") },
    { label: "ימי עבודה", value: numTxt(p.workingDays) },
    { label: "שעות עבודה", value: numTxt(p.workingHours) },
    { label: "ימי חופשה", value: numTxt(p.vacationDays) },
    { label: "ימי מחלה", value: numTxt(p.sickDays) },
    { label: "נקודות זיכוי", value: numTxt(p.taxCreditPoints) },
    { label: "זיכוי אישי", value: p.personalCredit != null ? formatCurrencyILS(p.personalCredit) : null },
  ].flatMap(d => (d.value ? [{ label: d.label, value: d.value }] : []));

  return (
    <Shell>
      <main style={{ maxWidth: 980, margin: "0 auto", padding: "40px 24px 84px" }}>
        <button onClick={() => navigate(APP_ROUTES.payslipHistory)} style={{ display: "inline-flex", alignItems: "center", gap: 7, background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", fontWeight: 700, fontSize: 13.5, color: "var(--text-muted)", marginBottom: 18, padding: 0 }}>
          <ChevronRight size={15} strokeWidth={2.4} /> היסטוריית תלושים
        </button>

        {/* header */}
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 20, flexWrap: "wrap", marginBottom: 26, animation: "presRise .55s var(--ease) both" }}>
          <div>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "5px 12px", borderRadius: 999, marginBottom: 13, fontSize: 12.5, fontWeight: 800, background: needsReview ? "var(--peach-soft)" : "var(--mint-soft)", color: needsReview ? "var(--peach-ink)" : "var(--mint-ink)" }}>
              {needsReview ? <AlertTriangle size={14} /> : <Check size={14} strokeWidth={2.6} />}
              {needsReview ? "דורש השלמה" : "הסריקה הושלמה"}
            </span>
            <h1 style={{ margin: 0, fontSize: "clamp(28px,3.6vw,42px)", fontWeight: 900, letterSpacing: "-.035em", lineHeight: 1.05, color: "var(--text-strong)" }}>{p.periodLabel} — {needsReview ? "דורש בדיקה" : "נותח"}</h1>
            <p style={{ margin: "8px 0 0", fontSize: 15.5, color: "var(--text-muted)", fontWeight: 500 }}>
              {[p.employerName, p.paymentDate ? `שולם ${p.paymentDate}` : null].filter(Boolean).join(" · ") || "תלוש שכר"}
            </p>
          </div>
          <div style={{ display: "flex", gap: 9 }}>
            <button onClick={() => void handleReprocess()} disabled={reprocessing} style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "11px 18px", borderRadius: "var(--r-btn)", border: "1px solid var(--border-soft)", background: "var(--card)", color: "var(--text-body)", cursor: reprocessing ? "wait" : "pointer", fontFamily: "inherit", fontWeight: 700, fontSize: 14 }}>
              <RefreshCw size={16} style={{ animation: reprocessing ? "spin .8s linear infinite" : "none" }} /> ניתוח מחדש
            </button>
            <button onClick={() => void handleDownload()} disabled={downloading} style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "11px 20px", borderRadius: "var(--r-btn)", border: "none", background: "var(--ink)", color: "#fff", cursor: "pointer", fontFamily: "inherit", fontWeight: 800, fontSize: 14, boxShadow: "var(--shadow-ink)" }}>
              {downloading ? <Loader2 size={16} style={{ animation: "spin .8s linear infinite" }} /> : <Download size={16} />} הורדת PDF
            </button>
          </div>
        </div>

        {notice && <div style={{ marginBottom: 18, padding: "11px 16px", borderRadius: "var(--r-btn)", background: "var(--accent-soft)", border: "1px solid var(--lav-200)", color: "var(--lav-600)", fontWeight: 700, fontSize: 13.5 }}>{notice}</div>}

        {/* needs-review banner */}
        {needsReview && (
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 18, padding: "14px 16px", borderRadius: "var(--r-btn)", background: "var(--peach-soft)", border: "1px solid var(--peach)", color: "var(--peach-ink)" }}>
            <AlertTriangle size={18} strokeWidth={2} style={{ flexShrink: 0 }} />
            <span style={{ flex: 1, fontSize: 13.5, fontWeight: 700 }}>{p.extractionMessage || "חלק מהשדות הקריטיים לא זוהו מה‑PDF."}</span>
            <button onClick={() => setModalOpen(true)} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: "var(--r-sm)", border: "1px solid var(--peach-ink)", background: "var(--card)", color: "var(--peach-ink)", cursor: "pointer", fontFamily: "inherit", fontWeight: 800, fontSize: 12.5, whiteSpace: "nowrap" }}>השלמת פרטים</button>
          </div>
        )}

        {/* hero: score ring + KPIs */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1.05fr", gap: 18, marginBottom: 18 }}>
          <div style={{ background: "var(--card)", border: "1px solid var(--border-hair)", borderRadius: "var(--radius)", boxShadow: "var(--shadow-card)", padding: "18px 18px 14px", backgroundImage: "radial-gradient(rgba(123,95,214,.05) 1px,transparent 1px)", backgroundSize: "18px 18px", animation: "presRise .5s var(--ease) .05s both" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 2 }}>
              <span style={{ fontSize: 13.5, fontWeight: 800, color: "var(--ink)" }}>תקינות התלוש</span>
              <span style={{ fontSize: 11, fontWeight: 800, color: "var(--text-faint)", letterSpacing: ".04em" }}>ניתוח AI</span>
            </div>
            <ScoreRing score={score} comps={comps} />
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 12px", borderRadius: "var(--r-sm)", background: needsReview ? "var(--peach-soft)" : "var(--mint-soft)", marginTop: 2 }}>
              <span style={{ color: needsReview ? "var(--peach-ink)" : "var(--mint-ink)", display: "inline-flex" }}>{needsReview ? <AlertTriangle size={15} /> : <Check size={15} strokeWidth={2.6} />}</span>
              <span style={{ fontSize: 12.5, fontWeight: 700, color: "var(--ink-soft)" }}>{needsReview ? "חסרים פרטים — השלמה תשפר את הדיוק" : "התלוש נקרא במלואו ונותח"}</span>
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ position: "relative", overflow: "hidden", borderRadius: "var(--radius)", padding: "20px 22px", background: "var(--grad-prism)", border: "1px solid var(--border-hair)", boxShadow: "var(--shadow-soft)" }}>
              <div style={{ fontSize: 12.5, fontWeight: 800, color: "var(--mint-ink)", marginBottom: 6 }}>נטו לתשלום</div>
              <div style={{ fontSize: 40, fontWeight: 900, letterSpacing: "-.04em", lineHeight: 1, color: "var(--ink)", fontVariantNumeric: "tabular-nums" }}>{nis(cNet)}</div>
              <div style={{ fontSize: 13, color: "var(--text-muted)", fontWeight: 600, marginTop: 7 }}>{p.grossSalary ? `${Math.round(((p.netSalary ?? 0) / p.grossSalary) * 100)}% מהברוטו נכנס לחשבון` : "השכר שנכנס לחשבון"}</div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              {[{ l: "שכר ברוטו", v: cGross, c: "var(--ink)" }, { l: "סך ניכויים", v: cDed, c: "var(--peach-ink)" }].map(k => (
                <div key={k.l} style={{ background: "var(--card)", border: "1px solid var(--border-hair)", borderRadius: "var(--radius)", padding: "18px 20px", boxShadow: "var(--shadow-soft)" }}>
                  <div style={{ fontSize: 12.5, color: "var(--text-muted)", fontWeight: 700, marginBottom: 7 }}>{k.l}</div>
                  <div style={{ fontSize: 27, fontWeight: 900, letterSpacing: "-.03em", color: k.c, fontVariantNumeric: "tabular-nums" }}>{nis(k.v)}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {(pensionEmployee != null || pensionEmployer != null) && (
          <div style={{ background: "var(--card)", border: "1px solid var(--border-hair)", borderRadius: "var(--radius)", boxShadow: "var(--shadow-soft)", padding: "20px 24px", marginBottom: 18 }}>
            <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 14, color: "var(--text-strong)" }}>הפרשות לפנסיה — פירוט</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "14px 18px" }}>
              {pensionEmployee != null && (
                <div>
                  <div style={{ fontSize: 12, color: "var(--text-faint)", fontWeight: 600, marginBottom: 4 }}>הפרשת עובד</div>
                  <div style={{ fontSize: 18, fontWeight: 900, color: "var(--ink)", fontVariantNumeric: "tabular-nums" }}>{nis(pensionEmployee)}</div>
                </div>
              )}
              {pensionEmployer != null && (
                <div>
                  <div style={{ fontSize: 12, color: "var(--text-faint)", fontWeight: 600, marginBottom: 4 }}>הפרשת מעסיק</div>
                  <div style={{ fontSize: 18, fontWeight: 900, color: "var(--ink)", fontVariantNumeric: "tabular-nums" }}>{nis(pensionEmployer)}</div>
                </div>
              )}
              {pensionTotal != null && (
                <div>
                  <div style={{ fontSize: 12, color: "var(--text-faint)", fontWeight: 600, marginBottom: 4 }}>סה״כ לקרן הפנסיה</div>
                  <div style={{ fontSize: 18, fontWeight: 900, color: "var(--mint-ink)", fontVariantNumeric: "tabular-nums" }}>{nis(pensionTotal)}</div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* where the money goes */}
        {breakdown.length > 0 && (
          <div style={{ background: "var(--card)", border: "1px solid var(--border-hair)", borderRadius: "var(--radius)", padding: "22px 24px", boxShadow: "var(--shadow-soft)", marginBottom: 18 }}>
            <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 16, color: "var(--text-strong)" }}>לאן הולך השכר שלך</div>
            <div style={{ display: "flex", height: 16, borderRadius: 999, overflow: "hidden", marginBottom: 16 }}>
              {breakdown.map((b, i) => (
                <div key={b.label} className="pres-bar" title={b.label} style={{ width: `${(b.value / bSum) * 100}%`, background: b.color, animation: `presBar 1s var(--ease) ${0.2 + i * 0.1}s both` }} />
              ))}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: `repeat(${breakdown.length},1fr)`, gap: 12 }}>
              {breakdown.map(b => (
                <div key={b.label} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                    <span style={{ width: 9, height: 9, borderRadius: 3, background: b.color }} />
                    <span style={{ fontSize: 12.5, color: "var(--text-muted)", fontWeight: 600 }}>{b.label}</span>
                  </div>
                  <div style={{ fontSize: 16, fontWeight: 900, letterSpacing: "-.02em", color: "var(--ink)", fontVariantNumeric: "tabular-nums" }}>{nis(b.value)}</div>
                  <div style={{ fontSize: 11.5, color: "var(--text-faint)", fontWeight: 700 }}>{Math.round((b.value / bSum) * 100)}%</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* payslip details — every identifying field we extracted/saved */}
        {detailRows.length > 0 && (
          <div style={{ background: "var(--card)", border: "1px solid var(--border-hair)", borderRadius: "var(--radius)", boxShadow: "var(--shadow-soft)", padding: "20px 24px", marginBottom: 18 }}>
            <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 16, color: "var(--text-strong)" }}>פרטי התלוש</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "16px 18px" }}>
              {detailRows.map(d => (
                <div key={d.label}>
                  <div style={{ fontSize: 12, color: "var(--text-faint)", fontWeight: 600, marginBottom: 4 }}>{d.label}</div>
                  <div style={{ fontSize: 14.5, fontWeight: 800, color: "var(--text-strong)", fontVariantNumeric: "tabular-nums" }}>{d.value}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* earnings + deductions detail */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }}>
          <DetailList title="הכנסות" items={p.earnings} total={earningsTotal} accent="var(--mint-ink)" />
          <DetailList title="ניכויים והפרשות" items={p.deductions} total={deductionsTotal} accent="var(--peach-ink)" negative />
        </div>
      </main>

      {modalOpen && (
        <MissingFieldsModal docId={p.id} onClose={() => setModalOpen(false)} onSaved={() => { void load(); }} />
      )}
    </Shell>
  );
}

function DetailList({ title, items, total, accent, negative }: { title: string; items: { label: string; amount: number }[]; total: number; accent: string; negative?: boolean }) {
  return (
    <div style={{ background: "var(--card)", border: "1px solid var(--border-hair)", borderRadius: "var(--radius)", boxShadow: "var(--shadow-soft)", padding: "20px 22px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
        <FileText size={16} color={accent} />
        <span style={{ fontSize: 14.5, fontWeight: 800, color: "var(--text-strong)" }}>{title}</span>
      </div>
      {items.length === 0 ? (
        <div style={{ fontSize: 13.5, color: "var(--text-faint)", padding: "10px 0" }}>לא זוהו פריטים</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column" }}>
          {items.map((row, i) => (
            <div key={row.label + i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "11px 0", borderTop: i === 0 ? "none" : "1px solid var(--border-hair)" }}>
              <span style={{ fontSize: 13.5, color: "var(--text-body)", fontWeight: 500 }}>{row.label}</span>
              <span style={{ fontSize: 14, fontWeight: 700, color: "var(--ink)", fontVariantNumeric: "tabular-nums" }}>{formatCurrencyILS(row.amount)}</span>
            </div>
          ))}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 0 0", marginTop: 4, borderTop: "1.5px solid var(--border-soft)" }}>
            <span style={{ fontSize: 13.5, fontWeight: 800, color: "var(--text-strong)" }}>סך הכל</span>
            <span style={{ fontSize: 15.5, fontWeight: 900, color: accent, fontVariantNumeric: "tabular-nums" }}>{negative ? "−" : ""}{formatCurrencyILS(total)}</span>
          </div>
        </div>
      )}
    </div>
  );
}
