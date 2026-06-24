import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  FileText, Upload, Search, Download, Eye, AlertTriangle, ChevronRight, Loader2,
} from "lucide-react";
import PrivateTopbar from "../components/PrivateTopbar";
import AppFooter from "../components/AppFooter";
import { downloadDocument } from "../api/documents.api";
import { usePayslipHistory } from "../hooks/usePayslipHistory";
import type { PayslipHistoryItem } from "../types/payslip";
import { APP_ROUTES } from "../types/navigation";
import { formatCurrencyILS } from "../utils/formatters";
import MissingFieldsModal from "../components/payslip-history/MissingFieldsModal";

const nis = (n: number | null | undefined) => (n == null ? "—" : formatCurrencyILS(n));

/** Incomplete = the extraction flagged it (needs_review / missing critical fields). */
function isIncomplete(item: PayslipHistoryItem): boolean {
  if (item.needsReview) return true;
  if (item.missingCritical && item.missingCritical.length > 0) return true;
  return item.grossSalary == null || item.netSalary == null;
}

type StatusKey = "analyzed" | "flagged";
const STATUS: Record<StatusKey, { label: string; bg: string; fg: string }> = {
  analyzed: { label: "נותח", bg: "var(--mint-soft)", fg: "var(--mint-ink)" },
  flagged: { label: "דורש השלמה", bg: "var(--peach-soft)", fg: "var(--peach-ink)" },
};

/* ── area sparkline (net trend) ──────────────────────────────── */
function NetTrend({ points, w = 330, h = 104 }: { points: number[]; w?: number; h?: number }) {
  if (points.length < 2) return <div style={{ height: h }} />;
  const max = Math.max(...points), min = Math.min(...points), span = max - min || 1;
  const pts = points.map((v, i) => [(i / (points.length - 1)) * w, h - ((v - min) / span) * (h - 12) - 6]);
  const line = pts.map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width="100%" height={h} style={{ display: "block", overflow: "visible" }}>
      <defs>
        <linearGradient id="netTrendFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#9B7FE8" stopOpacity="0.22" />
          <stop offset="100%" stopColor="#9B7FE8" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="netTrendLine" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#B49BF0" /><stop offset="100%" stopColor="#7C5FD6" />
        </linearGradient>
      </defs>
      <path d={`${line} L${w} ${h} L0 ${h} Z`} fill="url(#netTrendFill)" />
      <path d={line} fill="none" stroke="url(#netTrendLine)" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={pts[pts.length - 1][0]} cy={pts[pts.length - 1][1]} r={3.4} fill="#7C5FD6" stroke="#fff" strokeWidth={1.6} />
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

export default function PayslipHistoryPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const highlightedPeriods = useMemo(() => {
    const raw = searchParams.get("highlight");
    if (!raw) return undefined;
    return new Set(raw.split(",").map(v => v.trim()).filter(Boolean));
  }, [searchParams]);
  const highlightedYear = useMemo(() => {
    const first = highlightedPeriods ? Array.from(highlightedPeriods)[0] : "";
    const parsed = Number(first?.split("-")[0]);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
  }, [highlightedPeriods]);

  const [selectedYear, setSelectedYear] = useState<number | "all">(highlightedYear ?? "all");
  const { data, isLoading, error, reload } = usePayslipHistory(selectedYear);
  const [query, setQuery] = useState("");
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [modalDocId, setModalDocId] = useState<string | null>(null);

  useEffect(() => {
    if (highlightedYear) setSelectedYear(highlightedYear);
  }, [highlightedYear]);

  const handleDownload = useCallback(async (item: PayslipHistoryItem) => {
    if (!item.id) return;
    setDownloadError(null);
    setDownloadingId(item.id);
    const response = await downloadDocument(item.id);
    setDownloadingId(null);
    if (!response.success || !response.blob) {
      setDownloadError(response.message ?? "שגיאה בהורדת המסמך.");
      return;
    }
    const url = window.URL.createObjectURL(response.blob);
    const link = window.document.createElement("a");
    link.href = url;
    link.download = response.filename ?? item.periodLabel ?? "document.pdf";
    window.document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  }, []);

  const goDetail = (item: PayslipHistoryItem) => navigate(`${APP_ROUTES.payslipHistory}/${item.id}`);
  const goComplete = (item: PayslipHistoryItem) => setModalDocId(item.id);
  const goUpload = () => navigate(APP_ROUTES.documents);

  if (isLoading) {
    return <Shell><div style={{ minHeight: "55vh", display: "grid", placeItems: "center", color: "var(--lav-600)" }}><Loader2 size={28} style={{ animation: "spin .8s linear infinite" }} /></div></Shell>;
  }
  if (error) {
    return (
      <Shell><main style={{ maxWidth: 920, margin: "0 auto", padding: "60px 24px", textAlign: "center" }}>
        <div style={{ color: "var(--danger)", fontWeight: 700, marginBottom: 14 }}>{error}</div>
        <button onClick={reload} style={{ padding: "11px 22px", borderRadius: "var(--r-btn)", background: "var(--grad-brand)", color: "#fff", border: "none", cursor: "pointer", fontFamily: "inherit", fontWeight: 800 }}>נסה שוב</button>
      </main></Shell>
    );
  }
  if (!data || data.items.length === 0) {
    return (
      <Shell><main style={{ maxWidth: 920, margin: "0 auto", padding: "70px 24px", textAlign: "center" }}>
        <span style={{ width: 60, height: 60, borderRadius: 16, background: "var(--lav-100)", color: "var(--lav-600)", display: "grid", placeItems: "center", margin: "0 auto 18px" }}><FileText size={28} strokeWidth={1.85} /></span>
        <h1 style={{ fontSize: 24, fontWeight: 900, color: "var(--text-strong)", margin: "0 0 10px", letterSpacing: "-.02em" }}>אין עדיין תלושים בארכיון</h1>
        <p style={{ fontSize: 15, color: "var(--text-muted)", margin: "0 0 22px" }}>העלה תלושי שכר כדי שהם יופיעו כאן.</p>
        <button onClick={goUpload} style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "13px 26px", borderRadius: "var(--r-btn)", background: "var(--grad-brand)", color: "#fff", border: "none", cursor: "pointer", fontFamily: "inherit", fontWeight: 800, fontSize: 15, boxShadow: "var(--shadow-lav)" }}><Upload size={17} /> העלאת תלושים</button>
      </main></Shell>
    );
  }

  const { stats, items, years } = data;
  const yearOptions = years.map(y => y.year).sort((a, b) => b - a);

  const filtered = items.filter(it => query === "" || (it.periodLabel || "").includes(query));
  const incompleteCount = items.filter(isIncomplete).length;
  const netSeries = items
    .slice()
    .sort((a, b) => new Date(a.periodDate).getTime() - new Date(b.periodDate).getTime())
    .map(it => it.netSalary ?? it.grossSalary ?? 0)
    .filter(v => v > 0);

  const groupsMap = new Map<number, PayslipHistoryItem[]>();
  filtered.forEach(it => {
    const y = it.periodYear ?? Number((it.periodMonth || "").split("-")[0]) ?? 0;
    if (!groupsMap.has(y)) groupsMap.set(y, []);
    groupsMap.get(y)!.push(it);
  });
  const groups = Array.from(groupsMap.entries()).sort((a, b) => b[0] - a[0]);

  const summaryStats = [
    { v: String(stats.totalPayslips), l: "תלושים בארכיון", c: "var(--lav-600)" },
    { v: nis(stats.averageNet), l: "ממוצע נטו", c: "var(--mint-ink)" },
    { v: String(incompleteCount), l: "דורשים השלמה", c: "var(--peach-ink)" },
    { v: nis(stats.averageGross), l: "ממוצע ברוטו", c: "var(--ink)" },
  ];

  return (
    <Shell>
      <main style={{ maxWidth: 920, margin: "0 auto", padding: "40px 24px 80px" }}>
        <button onClick={goUpload} style={{ display: "inline-flex", alignItems: "center", gap: 7, background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", fontWeight: 700, fontSize: 13.5, color: "var(--text-muted)", marginBottom: 18, padding: 0 }}>
          <ChevronRight size={15} strokeWidth={2.4} /> סוכן התלושים
        </button>

        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 20, flexWrap: "wrap", marginBottom: 28 }}>
          <div>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "5px 12px", borderRadius: 999, background: "var(--lav-100)", color: "var(--lav-600)", fontSize: 12.5, fontWeight: 800, marginBottom: 14 }}>
              <FileText size={14} /> סוכן התלושים
            </span>
            <h1 style={{ margin: 0, fontSize: "clamp(28px,3.6vw,42px)", fontWeight: 900, letterSpacing: "-.035em", lineHeight: 1.05, color: "var(--text-strong)" }}>היסטוריית תלושים</h1>
            <p style={{ margin: "8px 0 0", fontSize: 15.5, color: "var(--text-muted)", fontWeight: 500 }}>כל התלושים שהעלית — מנותחים, מתויקים וזמינים בכל רגע.</p>
          </div>
          <button onClick={goUpload} style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "13px 22px", borderRadius: "var(--r-btn)", background: "var(--grad-brand)", color: "#fff", border: "none", cursor: "pointer", fontFamily: "inherit", fontWeight: 800, fontSize: 15, boxShadow: "var(--shadow-lav)" }}><Upload size={17} /> העלאת תלושים</button>
        </div>

        {downloadError && <div style={{ marginBottom: 16, padding: "11px 16px", borderRadius: "var(--r-btn)", background: "#FEF2F2", border: "1px solid rgba(220,38,38,.2)", color: "var(--danger)", fontWeight: 700, fontSize: 13.5 }}>{downloadError}</div>}

        {incompleteCount > 0 && (
          <div style={{ display: "flex", alignItems: "center", gap: 11, marginBottom: 24, padding: "13px 16px", borderRadius: "var(--r-btn)", background: "var(--peach-soft)", border: "1px solid var(--peach)", color: "var(--peach-ink)" }}>
            <AlertTriangle size={18} strokeWidth={2} style={{ flexShrink: 0 }} />
            <span style={{ fontSize: 13.5, fontWeight: 700 }}>
              ב‑{incompleteCount} {incompleteCount === 1 ? "תלוש" : "תלושים"} לא הצלחנו לחלץ את כל הפרטים מה‑PDF — לחצו על "השלמת פרטים" כדי להשלים ידנית.
            </span>
          </div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "1.1fr 1fr", gap: 16, marginBottom: 30 }}>
          <div style={{ background: "var(--card)", border: "1px solid var(--border-hair)", borderRadius: "var(--radius)", padding: "22px 24px", boxShadow: "var(--shadow-soft)", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px 14px", alignContent: "center" }}>
            {summaryStats.map(s => (
              <div key={s.l}>
                <div style={{ fontSize: 24, fontWeight: 900, letterSpacing: "-.03em", lineHeight: 1, color: s.c, fontVariantNumeric: "tabular-nums" }}>{s.v}</div>
                <div style={{ fontSize: 12.5, color: "var(--text-muted)", fontWeight: 600, marginTop: 6 }}>{s.l}</div>
              </div>
            ))}
          </div>
          <div style={{ background: "var(--card)", border: "1px solid var(--border-hair)", borderRadius: "var(--radius)", padding: "18px 20px", boxShadow: "var(--shadow-soft)", display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
              <span style={{ fontSize: 13, fontWeight: 800, color: "var(--ink)" }}>מגמת נטו</span>
              <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text-faint)" }}>{netSeries.length} תלושים</span>
            </div>
            <div style={{ flex: 1, display: "flex", alignItems: "center" }}><div style={{ width: "100%" }}><NetTrend points={netSeries} /></div></div>
            {netSeries.length >= 2 && (
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, fontWeight: 700, color: "var(--text-muted)", marginTop: 4 }}>
                <span>{nis(netSeries[0])}</span>
                <span style={{ color: "var(--mint-ink)" }}>{nis(netSeries[netSeries.length - 1])} ←</span>
              </div>
            )}
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 20 }}>
          <div style={{ position: "relative", flex: 1, minWidth: 220 }}>
            <span style={{ position: "absolute", insetInlineStart: 13, top: "50%", transform: "translateY(-50%)", color: "var(--text-faint)", display: "inline-flex" }}><Search size={17} /></span>
            <input value={query} onChange={e => setQuery(e.target.value)} placeholder="חיפוש לפי חודש…"
              style={{ width: "100%", boxSizing: "border-box", padding: "11px 40px 11px 14px", borderRadius: "var(--r-md)", border: "1px solid var(--border-soft)", background: "var(--card)", fontFamily: "inherit", fontSize: 14, color: "var(--ink)", outline: "none" }} />
          </div>
          {yearOptions.length > 1 && (
            <div style={{ display: "flex", gap: 7, background: "var(--surface-sunken)", border: "1px solid var(--border-hair)", borderRadius: 999, padding: 4 }}>
              {(["all", ...yearOptions] as const).map((y) => {
                const on = selectedYear === y;
                return (
                  <button key={String(y)} onClick={() => setSelectedYear(y)} style={{ padding: "7px 15px", borderRadius: 999, border: "none", cursor: "pointer", fontFamily: "inherit", fontWeight: 800, fontSize: 13, background: on ? "var(--card)" : "transparent", color: on ? "var(--ink)" : "var(--text-muted)", boxShadow: on ? "var(--shadow-soft)" : "none", transition: "all .18s var(--ease)" }}>
                    {y === "all" ? "כל השנים" : y}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {groups.length === 0 ? (
          <div style={{ textAlign: "center", padding: "60px 20px", background: "var(--card)", border: "1px dashed var(--border-soft)", borderRadius: "var(--radius)" }}>
            <div style={{ display: "inline-flex", marginBottom: 12, color: "var(--text-faint)" }}><Search size={30} /></div>
            <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text-muted)" }}>לא נמצאו תלושים שתואמים לחיפוש</div>
          </div>
        ) : (
          groups.map(([y, list]) => (
            <div key={y} style={{ marginBottom: 26 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "0 2px 12px" }}>
                <span style={{ fontSize: 14, fontWeight: 900, color: "var(--ink)" }}>{y || "—"}</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text-faint)", background: "var(--surface-sunken)", borderRadius: 999, padding: "2px 9px" }}>{list.length} תלושים</span>
                <span style={{ flex: 1, height: 1, background: "var(--hair)" }} />
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {list.map(p => {
                  const incomplete = isIncomplete(p);
                  const st = STATUS[incomplete ? "flagged" : "analyzed"];
                  const highlighted = p.periodMonth && highlightedPeriods?.has(p.periodMonth);
                  return (
                    <div key={p.id} className={highlighted ? "payslip-row-highlight" : undefined}
                      style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 16px", background: "var(--card)", border: `1px solid ${highlighted ? "var(--lav-300)" : "var(--border-hair)"}`, borderRadius: "var(--r-md)", boxShadow: "var(--shadow-soft)" }}>
                      <span style={{ width: 42, height: 42, borderRadius: 11, flex: "none", background: "var(--lav-100)", color: "var(--lav-600)", display: "grid", placeItems: "center" }}><FileText size={20} strokeWidth={1.85} /></span>
                      <div style={{ minWidth: 0, width: 140 }}>
                        <div style={{ fontWeight: 800, fontSize: 14.5, color: "var(--text-strong)" }}>{p.periodLabel}</div>
                        <div style={{ fontSize: 12, color: "var(--text-muted)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.isLatest ? "התלוש האחרון" : "תלוש שכר"}</div>
                      </div>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 800, color: st.fg, background: st.bg, borderRadius: 999, padding: "5px 11px", flex: "none" }}>
                        <span style={{ width: 6, height: 6, borderRadius: "50%", background: st.fg }} />{st.label}
                      </span>
                      <div style={{ marginInlineStart: "auto", display: "flex", gap: 22, textAlign: "center", flex: "none" }}>
                        <div>
                          <div style={{ fontSize: 11, color: "var(--text-faint)", fontWeight: 600 }}>ברוטו</div>
                          <div style={{ fontSize: 14.5, fontWeight: 800, color: "var(--ink-soft)", fontVariantNumeric: "tabular-nums" }}>{nis(p.grossSalary)}</div>
                        </div>
                        <div>
                          <div style={{ fontSize: 11, color: "var(--text-faint)", fontWeight: 600 }}>נטו</div>
                          <div style={{ fontSize: 15, fontWeight: 900, color: "var(--mint-ink)", fontVariantNumeric: "tabular-nums" }}>{nis(p.netSalary)}</div>
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: 4, flex: "none" }}>
                        {incomplete && (
                          <button onClick={() => goComplete(p)} title="השלמת פרטים"
                            style={{ display: "inline-flex", alignItems: "center", gap: 6, height: 34, padding: "0 12px", borderRadius: 9, border: "1px solid var(--peach)", background: "var(--peach-soft)", color: "var(--peach-ink)", cursor: "pointer", fontFamily: "inherit", fontWeight: 800, fontSize: 12.5 }}>
                            <AlertTriangle size={14} /> השלמת פרטים
                          </button>
                        )}
                        <RowAction title="צפייה" onClick={() => goDetail(p)}><Eye size={16} /></RowAction>
                        <RowAction title="הורדה" onClick={() => void handleDownload(p)} busy={downloadingId === p.id}><Download size={16} /></RowAction>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </main>

      {modalDocId && (
        <MissingFieldsModal
          docId={modalDocId}
          onClose={() => setModalDocId(null)}
          onSaved={() => { void reload(); }}
        />
      )}
    </Shell>
  );
}

function RowAction({ children, title, onClick, busy }: { children: React.ReactNode; title: string; onClick: () => void; busy?: boolean }) {
  return (
    <button title={title} onClick={onClick} disabled={busy}
      style={{ width: 34, height: 34, borderRadius: 9, border: "1px solid var(--border-hair)", background: "var(--card)", color: "var(--text-muted)", cursor: busy ? "wait" : "pointer", display: "grid", placeItems: "center", transition: "all .15s" }}
      onMouseEnter={e => { e.currentTarget.style.background = "var(--surface-sunken)"; e.currentTarget.style.color = "var(--lav-600)"; }}
      onMouseLeave={e => { e.currentTarget.style.background = "var(--card)"; e.currentTarget.style.color = "var(--text-muted)"; }}>
      {busy ? <Loader2 size={15} style={{ animation: "spin .8s linear infinite" }} /> : children}
    </button>
  );
}
