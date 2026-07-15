import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, Scale, Upload, FileText, Check, TrendingUp, ChevronRight, Loader2 } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import PrivateTopbar from "../components/PrivateTopbar";
import AppFooter from "../components/AppFooter";
import { APP_ROUTES } from "../types/navigation";
import {
  getTaxAssistantSummary,
  type TaxAssistantIssue,
  type TaxAssistantPayload,
  type TaxIssueSeverity,
} from "../api/taxAssistant.api";

const severityLabels: Record<TaxIssueSeverity, string> = { low: "נמוכה", medium: "בינונית", high: "גבוהה" };
const SEV_TONE: Record<TaxIssueSeverity, { bg: string; ink: string; Icon: LucideIcon }> = {
  high: { bg: "var(--peach-soft)", ink: "var(--peach-ink)", Icon: AlertTriangle },
  medium: { bg: "var(--butter-soft)", ink: "var(--butter-ink)", Icon: AlertTriangle },
  low: { bg: "var(--lav-100)", ink: "var(--lav-600)", Icon: TrendingUp },
};
const MONTHS = ["ינו", "פבר", "מרץ", "אפר", "מאי", "יונ", "יול", "אוג", "ספט", "אוק", "נוב", "דצמ"];
const fmt = (v: number) => new Intl.NumberFormat("he-IL", { style: "currency", currency: "ILS", maximumFractionDigits: 0 }).format(v);

const buildYearOptions = (centerYear: number) => {
  const years: number[] = [];
  for (let y = centerYear + 1; y >= centerYear - 4; y -= 1) years.push(y);
  return years;
};

function useCountUp(target: number, run: boolean, dur = 1200) {
  const [v, setV] = useState(0);
  useEffect(() => {
    if (!run) { setV(target); return; }
    let raf = 0, start = 0;
    const tick = (now: number) => { if (!start) start = now; const t = Math.min((now - start) / dur, 1); setV(Math.round((1 - Math.pow(1 - t, 3)) * target)); if (t < 1) raf = requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, run, dur]);
  return v;
}

const explain = (issue: TaxAssistantIssue) => {
  switch (issue.type) {
    case "missing_payslips": return "חוסר תלושים עלול להצביע על פערים בדיווח השנתי או בתשלומי מס.";
    case "multiple_employers": return "עבודה אצל יותר ממעסיק אחד בשנה אחת משפיעה על ניכויי מס ודיווחים.";
    case "employer_change": return "מעבר בין מעסיקים במהלך השנה דורש בדיקה שהנתונים מדווחים נכון.";
    case "unusual_income_tax": return "קפיצה במס הכנסה לעומת הממוצע החודשי שווה בדיקה — ייתכן בונוס, תקופה חלקית או חריגה בניכויים.";
    case "missing_pension_contributions": return "היעדר הפקדות פנסיה בתלוש עשוי להצביע על חוסר בניכוי או על בעיה בדיווח המעסיק.";
    case "missing_form_106": return "טופס 106 מסכם את השנה — מומלץ להעלות אותו לצד תלושי השכר לבדיקה מלאה.";
    default: return issue.message;
  }
};

export default function TaxAssistantPage() {
  const navigate = useNavigate();
  const currentYear = new Date().getFullYear();
  const yearOptions = useMemo(() => buildYearOptions(currentYear), [currentYear]);
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [data, setData] = useState<TaxAssistantPayload | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [seen, setSeen] = useState(false);

  const loadSummary = useCallback(async (year: number) => {
    setIsLoading(true); setError(""); setSeen(false);
    const response = await getTaxAssistantSummary(year);
    if (response.success && response.data) { setData(response.data); setTimeout(() => setSeen(true), 60); }
    else { setData(null); setError(response.message || "לא הצלחנו לטעון את ניתוח המס."); }
    setIsLoading(false);
  }, []);

  useEffect(() => { void loadSummary(selectedYear); }, [loadSummary, selectedYear]);

  const summary = data?.summary;
  const issues = data?.issues ?? [];
  const gross = summary?.totalGrossIncome ?? 0;
  const net = summary?.totalNetIncome ?? 0;
  const taxPaid = summary?.totalIncomeTax ?? 0;
  const slips = summary?.totalSalaryDocuments ?? 0;
  const present = summary?.monthsPresent ?? [];
  const effectiveRate = gross > 0 ? Math.round((taxPaid / gross) * 1000) / 10 : 0;

  const cTax = useCountUp(taxPaid, seen);
  const cNet = useCountUp(net, seen);
  const cGross = useCountUp(gross, seen);

  const kpis = [
    { l: "מס הכנסה שנוכה", v: fmt(cTax), c: "var(--peach-ink)" },
    { l: "הכנסה נטו (לחשבון)", v: fmt(cNet), c: "var(--mint-ink)" },
    { l: "הכנסה ברוטו (לפני ניכויים)", v: fmt(cGross), c: "var(--ink)" },
    { l: "תלושים בשנה", v: `${slips} / 12`, c: "var(--lav-600)" },
  ];

  return (
    <div data-agent="payslips" style={{ minHeight: "100vh", background: "var(--surface-page)", color: "var(--text-body)", fontFamily: "var(--font-body)", direction: "rtl" }}>
      <PrivateTopbar />
      <main style={{ maxWidth: 980, margin: "0 auto", padding: "40px 24px 84px" }}>
        <button onClick={() => navigate(APP_ROUTES.hub)} style={{ display: "inline-flex", alignItems: "center", gap: 7, background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", fontWeight: 700, fontSize: 13.5, color: "var(--text-muted)", marginBottom: 18, padding: 0 }}>
          <ChevronRight size={15} strokeWidth={2.4} /> העוזר הראשי
        </button>

        {/* header */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 20, flexWrap: "wrap", marginBottom: 22 }}>
          <div>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "5px 12px", borderRadius: 999, background: "var(--lav-100)", color: "var(--lav-600)", fontSize: 12.5, fontWeight: 800, marginBottom: 13 }}>
              <Scale size={14} /> עוזר מס AI
            </span>
            <h1 style={{ margin: 0, fontSize: "clamp(28px,3.6vw,42px)", fontWeight: 900, letterSpacing: "-.035em", lineHeight: 1.05, color: "var(--text-strong)" }}>ניתוח מס חכם</h1>
            <p style={{ margin: "9px 0 0", fontSize: 16, color: "var(--text-muted)", fontWeight: 500, maxWidth: 520 }}>ה‑AI סורק את כל תלושי השכר, מזהה חריגות מס, תלושים חסרים ונקודות לבדיקה.</p>
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 12 }}>
            <label style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 700, color: "var(--text-muted)" }}>
              שנת מס
              <select value={selectedYear} onChange={e => setSelectedYear(Number(e.target.value))} style={{ padding: "8px 12px", borderRadius: "var(--r-btn)", border: "1px solid var(--border-soft)", background: "var(--card)", fontFamily: "inherit", fontWeight: 800, fontSize: 14, color: "var(--ink)", cursor: "pointer" }}>
                {yearOptions.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </label>
            {/* effective-rate emblem */}
            <div style={{ width: 132, background: "var(--card)", border: "1px solid var(--border-hair)", borderRadius: "var(--radius)", boxShadow: "var(--shadow-soft)", padding: "14px 14px 12px", textAlign: "center", backgroundImage: "radial-gradient(rgba(123,95,214,.06) 1px,transparent 1px)", backgroundSize: "13px 13px" }}>
              <div style={{ fontSize: 10.5, fontWeight: 800, color: "var(--text-faint)", letterSpacing: ".04em", marginBottom: 6 }}>שיעור מס אפקטיבי</div>
              <svg viewBox="0 0 80 80" style={{ width: 72, height: 72, display: "block", margin: "0 auto" }}>
                <circle cx="40" cy="40" r="32" fill="none" stroke="var(--hair)" strokeWidth="8" />
                <circle cx="40" cy="40" r="32" fill="none" stroke="var(--lav-600)" strokeWidth="8" strokeLinecap="round" pathLength={100} strokeDasharray="100" strokeDashoffset={100 - Math.min(effectiveRate, 100)} transform="rotate(-90 40 40)" style={{ transition: "stroke-dashoffset 1s var(--ease)" }} />
                <text x="40" y="38" textAnchor="middle" fontSize="18" fontWeight="900" fill="var(--ink)" style={{ letterSpacing: "-.04em" }}>{effectiveRate}%</text>
                <text x="40" y="52" textAnchor="middle" fontSize="8.5" fontWeight="700" fill="var(--text-muted)">מהברוטו</text>
              </svg>
            </div>
          </div>
        </div>

        {/* disclaimer */}
        <div style={{ display: "flex", alignItems: "center", gap: 11, padding: "13px 18px", borderRadius: "var(--r-md)", background: "var(--butter-soft)", border: "1px solid var(--butter)", marginBottom: 26 }}>
          <AlertTriangle size={17} color="var(--butter-ink)" style={{ flexShrink: 0 }} />
          <span style={{ fontSize: 13.5, fontWeight: 600, color: "var(--ink-soft)" }}>{data?.disclaimer || "המידע המוצג הוא הערכה בלבד ואינו מהווה ייעוץ מס מקצועי."}</span>
        </div>

        {isLoading ? (
          <div style={{ minHeight: "30vh", display: "grid", placeItems: "center", color: "var(--lav-600)" }}><Loader2 size={28} style={{ animation: "spin .8s linear infinite" }} /></div>
        ) : error ? (
          <div style={{ background: "var(--card)", border: "1px solid var(--border-soft)", borderRadius: "var(--radius)", padding: 32, textAlign: "center", color: "var(--danger)", fontWeight: 700 }}>{error}</div>
        ) : summary ? (
          <>
            {/* KPIs */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14, marginBottom: 18 }}>
              {kpis.map(k => (
                <div key={k.l} style={{ background: "var(--card)", border: "1px solid var(--border-hair)", borderRadius: "var(--radius)", padding: "18px 20px", boxShadow: "var(--shadow-soft)" }}>
                  <div style={{ fontSize: 12.5, color: "var(--text-muted)", fontWeight: 700, marginBottom: 8, lineHeight: 1.3 }}>{k.l}</div>
                  <div style={{ fontSize: 25, fontWeight: 900, letterSpacing: "-.03em", color: k.c, fontVariantNumeric: "tabular-nums" }}>{k.v}</div>
                </div>
              ))}
            </div>

            {/* 12-month coverage */}
            <div style={{ background: "var(--card)", border: "1px solid var(--border-hair)", borderRadius: "var(--radius)", padding: "20px 24px", boxShadow: "var(--shadow-soft)", marginBottom: 18 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
                <span style={{ fontSize: 14, fontWeight: 800, color: "var(--text-strong)" }}>כיסוי תלושים — {selectedYear}</span>
                <div style={{ display: "flex", gap: 16 }}>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 700, color: "var(--text-muted)" }}><span style={{ width: 9, height: 9, borderRadius: 3, background: "var(--mint-ink)" }} />התקבל</span>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 700, color: "var(--text-muted)" }}><span style={{ width: 9, height: 9, borderRadius: 3, background: "var(--peach-soft)", border: "1.5px dashed var(--peach-ink)" }} />חסר</span>
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(12,1fr)", gap: 8 }}>
                {MONTHS.map((m, i) => {
                  const has = present.includes(i + 1);
                  return (
                    <div key={m}>
                      <div style={{ height: 44, borderRadius: 10, display: "grid", placeItems: "center", background: has ? "var(--mint-soft)" : "var(--peach-soft)", border: has ? "1px solid var(--mint)" : "1.5px dashed var(--peach-ink)", color: has ? "var(--mint-ink)" : "var(--peach-ink)" }}>
                        {has ? <Check size={17} strokeWidth={2.6} /> : <span style={{ fontSize: 16, fontWeight: 900 }}>·</span>}
                      </div>
                      <div style={{ textAlign: "center", fontSize: 11, fontWeight: 700, color: "var(--text-faint)", marginTop: 6 }}>{m}</div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* CTAs */}
            <div style={{ display: "flex", gap: 12, justifyContent: "flex-end", flexWrap: "wrap", marginBottom: 36 }}>
              <button onClick={() => navigate(APP_ROUTES.documentsUpload)} style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "11px 20px", borderRadius: "var(--r-btn)", border: "1px solid var(--border-soft)", background: "var(--card)", color: "var(--text-body)", cursor: "pointer", fontFamily: "inherit", fontWeight: 700, fontSize: 14 }}><Upload size={17} /> העלה תלוש חסר</button>
              <button onClick={() => navigate(APP_ROUTES.documentsUpload)} style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "11px 20px", borderRadius: "var(--r-btn)", border: "none", background: "var(--ink)", color: "#fff", cursor: "pointer", fontFamily: "inherit", fontWeight: 800, fontSize: 14, boxShadow: "var(--shadow-ink)" }}><FileText size={17} /> העלה טופס 106</button>
            </div>

            {/* findings */}
            <div style={{ display: "flex", alignItems: "baseline", gap: 10, margin: "0 2px 14px" }}>
              <span style={{ fontSize: 13, fontWeight: 800, color: "var(--text-faint)", letterSpacing: ".06em" }}>ממצאים לבדיקה</span>
              <span style={{ fontSize: 12.5, fontWeight: 800, color: "var(--lav-600)", background: "var(--lav-100)", borderRadius: 999, padding: "2px 10px" }}>{issues.length}</span>
            </div>
            {issues.length === 0 ? (
              <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "16px 18px", borderRadius: "var(--r-md)", background: "var(--mint-soft)", color: "var(--mint-ink)", fontWeight: 700, fontSize: 14 }}>
                <Check size={18} strokeWidth={2.6} /> לא זוהו חריגות מס עבור {selectedYear} על בסיס התלושים הקיימים.
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {issues.map(issue => {
                  const t = SEV_TONE[issue.severity];
                  return (
                    <div key={`${issue.type}-${issue.message}`} style={{ display: "flex", alignItems: "flex-start", gap: 15, padding: "16px 18px", background: "var(--card)", border: "1px solid var(--border-hair)", borderRadius: "var(--r-md)", boxShadow: "var(--shadow-soft)" }}>
                      <span style={{ width: 44, height: 44, borderRadius: 12, flex: "none", background: t.bg, color: t.ink, display: "grid", placeItems: "center" }}><t.Icon size={22} /></span>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 4, flexWrap: "wrap" }}>
                          <span style={{ fontWeight: 800, fontSize: 15.5, color: "var(--text-strong)" }}>{issue.title}</span>
                          <span style={{ fontSize: 11, fontWeight: 800, color: t.ink, background: t.bg, borderRadius: 999, padding: "2px 9px" }}>חומרה: {severityLabels[issue.severity]}</span>
                        </div>
                        <div style={{ fontSize: 13.5, color: "var(--text-body)", lineHeight: 1.55, marginBottom: 4 }}>{issue.message}</div>
                        <div style={{ fontSize: 12.5, color: "var(--text-muted)", lineHeight: 1.5 }}>{explain(issue)}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        ) : null}
      </main>
      <AppFooter variant="private" />
    </div>
  );
}
