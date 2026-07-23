import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Check,
  Download,
  FileText,
  History,
  PiggyBank,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";
import PrivateTopbar from "../components/PrivateTopbar";
import AppFooter from "../components/AppFooter";
import Loader from "../components/ui/Loader";
import {
  downloadExecutiveReportPdf,
  generateExecutiveReport,
  getLatestExecutiveReport,
  type AgentReportSection,
  type ExecutiveReport,
  type PreservedRecommendation,
} from "../api/executiveReport.api";
import { APP_ROUTES } from "../types/navigation";

/* ============================================================
   ExecutiveReportPage — "הדוח הפיננסי האישי שלי". A long,
   scannable report document in the design-system language:
   a purple report hero, a sticky scroll-spy table of contents,
   and color-coded agent sections (pension=mint, gemel=butter,
   insurance=peach, payslip=lavender). Every field of the real
   ExecutiveReport payload is preserved and mapped in.
   ============================================================ */

const MONO = "'SF Mono',ui-monospace,'Cascadia Mono',Consolas,monospace";

type Tone = { soft: string; ink: string; line: string; Icon: LucideIcon };

const TONES: Record<"mint" | "butter" | "peach" | "lav", Tone> = {
  mint: { soft: "var(--mint-soft)", ink: "var(--mint-ink)", line: "rgba(47,156,98,.5)", Icon: TrendingUp },
  butter: { soft: "var(--butter-soft)", ink: "var(--butter-ink)", line: "rgba(185,139,22,.5)", Icon: PiggyBank },
  peach: { soft: "var(--peach-soft)", ink: "var(--peach-ink)", line: "rgba(218,111,68,.5)", Icon: ShieldCheck },
  lav: { soft: "var(--lav-100)", ink: "var(--lav-600)", line: "var(--lav-400)", Icon: FileText },
};

/** map a backend agentId onto a design tone + icon */
function agentTone(agentId: string): Tone {
  const id = agentId.toLowerCase();
  if (id.includes("pension")) return TONES.mint;
  if (id.includes("gemel") || id.includes("hishtalmut") || id.includes("provident")) return TONES.butter;
  if (id.includes("insur") || id.includes("bituach")) return TONES.peach;
  return TONES.lav; // payslips / default
}

const card: React.CSSProperties = {
  background: "var(--card)",
  border: "1px solid var(--border-hair)",
  borderRadius: "var(--radius)",
  boxShadow: "var(--shadow-soft)",
};

function sectionStatusPill(section: AgentReportSection) {
  if (section.dataStatus === "error") {
    return { label: "שגיאה בטעינה", fg: "#C23B3B", bg: "rgba(214,69,69,.09)", dot: false };
  }
  if (section.dataStatus === "missing") {
    return { label: "נתונים חסרים", fg: "var(--text-muted)", bg: "var(--surface-sunken)", dot: false };
  }
  if (section.recommendationStatus === "hasRecommendations") {
    return { label: "יש המלצות", fg: "var(--mint-ink)", bg: "var(--mint-soft)", dot: true };
  }
  return { label: "נבדק — ללא המלצות מהותיות", fg: "var(--lav-600)", bg: "var(--lav-50)", dot: false };
}

/* ---- one recommendation card (color rail + all preserved fields) ---- */
function RecommendationCard({ rec, tone }: { rec: PreservedRecommendation; tone: Tone }) {
  return (
    <div style={{ padding: "15px 17px", borderRadius: "var(--r-md)", background: "var(--surface-sunken)", border: "1px solid var(--border-hair)", borderInlineStart: `3px solid ${tone.line}` }}>
      <div style={{ fontSize: 14.5, fontWeight: 800, marginBottom: 6, color: "var(--text-strong)" }}>{rec.title}</div>
      {rec.description ? (
        <div style={{ fontSize: 13, color: "var(--text-muted)", lineHeight: 1.55 }}>{rec.description}</div>
      ) : null}
      {rec.reason ? (
        <div style={{ fontSize: 12.5, color: "var(--text-muted)", lineHeight: 1.5, marginTop: 4 }}>
          <b style={{ color: "var(--ink-soft)", fontWeight: 700 }}>למה זה חשוב:</b> {rec.reason}
        </div>
      ) : null}
      {rec.expectedBenefit ? (
        <div style={{ display: "inline-flex", alignItems: "center", gap: 6, marginTop: 10, fontSize: 13, fontWeight: 800, color: tone.ink }}>
          <ArrowLeft size={14} strokeWidth={2.4} /> {rec.expectedBenefit}
        </div>
      ) : null}
      {rec.source ? (
        <div style={{ marginTop: 8, fontSize: 11.5, color: "var(--text-faint)", fontWeight: 600 }}>מקור: {rec.source}</div>
      ) : null}
    </div>
  );
}

/* ---- one agent section ---- */
function AgentSection({
  section, index, refCb, onRetry,
}: {
  section: AgentReportSection;
  index: number;
  refCb: (el: HTMLElement | null) => void;
  onRetry: () => void;
}) {
  const tone = agentTone(section.agentId);
  const Icon = tone.Icon;
  const pill = sectionStatusPill(section);

  return (
    <section
      ref={refCb}
      data-sec={`report-agent-${section.agentId}`}
      id={`report-agent-${section.agentId}`}
      style={{ ...card, padding: 0, overflow: "hidden", scrollMarginTop: 96 }}
    >
      {/* header with color rail */}
      <div style={{ display: "flex", alignItems: "center", gap: 13, padding: "18px 24px", borderBottom: "1px solid var(--hair)", borderInlineStart: `4px solid ${tone.ink}` }}>
        <span style={{ width: 38, height: 38, borderRadius: 10, flex: "none", background: tone.soft, color: tone.ink, display: "grid", placeItems: "center" }}>
          <Icon size={20} strokeWidth={1.9} />
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
            <span style={{ fontFamily: MONO, fontSize: 12, fontWeight: 800, color: tone.ink }}>0{index + 1}</span>
            <h2 style={{ margin: 0, fontSize: 19, fontWeight: 900, letterSpacing: "-.02em", color: "var(--text-strong)" }}>{section.title}</h2>
          </div>
        </div>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 800, color: pill.fg, background: pill.bg, borderRadius: 999, padding: "5px 12px", flex: "none" }}>
          {pill.dot ? <span style={{ width: 6, height: 6, borderRadius: "50%", background: pill.fg }} /> : section.dataStatus === "error" ? <AlertTriangle size={13} /> : null}
          {pill.label}
        </span>
      </div>

      <div style={{ padding: "20px 24px" }}>
        {section.dataStatus === "error" ? (
          <div style={{ display: "flex", alignItems: "center", gap: 13, padding: "16px 18px", borderRadius: "var(--r-md)", background: "rgba(214,69,69,.05)", border: "1px solid rgba(214,69,69,.18)" }}>
            <span style={{ width: 36, height: 36, borderRadius: 10, flex: "none", background: "rgba(214,69,69,.1)", color: "#C23B3B", display: "grid", placeItems: "center" }}><AlertTriangle size={18} /></span>
            <p style={{ margin: 0, fontSize: 14, color: "var(--text-body)", lineHeight: 1.55, fontWeight: 500 }}>
              {section.statusMessage || "לא ניתן לטעון את נתוני הסוכן. ניתן לרענן את הדוח או לנסות שוב מאוחר יותר."}
            </p>
            <button type="button" onClick={onRetry} style={{ marginInlineStart: "auto", flex: "none", display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: "var(--r-btn)", border: "1px solid var(--border-soft)", background: "var(--card)", color: "var(--text-strong)", cursor: "pointer", fontFamily: "inherit", fontWeight: 700, fontSize: 13 }}>
              <RefreshCw size={14} /> נסה שוב
            </button>
          </div>
        ) : (
          <>
            {section.statusMessage ? (
              <p style={{ margin: "0 0 16px", fontSize: 14.5, lineHeight: 1.65, color: "var(--text-strong)", fontWeight: 600 }}>{section.statusMessage}</p>
            ) : null}

            {/* data summary strips */}
            {section.dataSummary.length > 0 ? (
              <div style={{ display: "grid", gridTemplateColumns: section.dataSummary.length > 1 ? "repeat(auto-fit,minmax(180px,1fr))" : "1fr", gap: 10, marginBottom: 18 }}>
                {section.dataSummary.map(item => (
                  <div key={`${item.label}-${item.value}`} style={{ display: "flex", alignItems: "center", gap: 12, padding: "13px 18px", borderRadius: "var(--r-md)", background: tone.soft }}>
                    <span style={{ fontSize: 12.5, fontWeight: 700, color: "var(--ink-soft)" }}>{item.label}</span>
                    <span style={{ marginInlineStart: "auto", fontSize: 20, fontWeight: 900, letterSpacing: "-.03em", color: tone.ink }}>{item.value}</span>
                  </div>
                ))}
              </div>
            ) : null}

            {/* missing-data detail */}
            {section.missingDetail ? (
              <div style={{ padding: "14px 16px", borderRadius: "var(--r-md)", background: "var(--surface-sunken)", border: "1px solid var(--border-hair)", marginBottom: 18 }}>
                <div style={{ fontWeight: 800, fontSize: 13.5, marginBottom: 4 }}>מה חסר</div>
                <div style={{ color: "var(--text-muted)", fontSize: 13.5, lineHeight: 1.55 }}>{section.missingDetail.whatIsMissing}</div>
                <div style={{ fontWeight: 800, fontSize: 13.5, margin: "12px 0 4px" }}>מה ייפתח לאחר העלאה</div>
                <div style={{ color: "var(--text-muted)", fontSize: 13.5, lineHeight: 1.55 }}>{section.missingDetail.whatEnables}</div>
              </div>
            ) : null}

            {/* findings */}
            {section.findings.length > 0 ? (
              <div style={{ marginBottom: 18 }}>
                <div style={{ fontSize: 12.5, fontWeight: 700, color: "var(--text-muted)", marginBottom: 8 }}>ממצאי הסוכן</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {section.findings.map(f => (
                    <div key={f.title} style={{ display: "flex", alignItems: "baseline", gap: 8, fontSize: 13, lineHeight: 1.55 }}>
                      <span style={{ width: 6, height: 6, borderRadius: "50%", flex: "none", background: tone.ink, transform: "translateY(-2px)" }} />
                      <span><b style={{ fontWeight: 800, color: "var(--text-strong)" }}>{f.title}</b>{f.explanation ? ` — ${f.explanation}` : ""}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {/* recommendations */}
            {section.recommendations.length > 0 ? (
              <>
                <div style={{ fontSize: 12, fontWeight: 800, color: "var(--text-faint)", letterSpacing: ".06em", marginBottom: 11 }}>המלצות</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {section.recommendations.map(rec => (
                    <RecommendationCard key={rec.recommendationId || rec.title} rec={rec} tone={tone} />
                  ))}
                </div>
              </>
            ) : null}

            {/* plain-language explanation */}
            {section.plainLanguageExplanation ? (
              <div style={{ marginTop: 16 }}>
                <div style={{ fontWeight: 800, fontSize: 13.5, marginBottom: 6 }}>הסבר בשפה פשוטה</div>
                <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.65, color: "var(--text-muted)" }}>{section.plainLanguageExplanation}</p>
              </div>
            ) : null}

            {/* practical next steps */}
            {section.nextActions.length > 0 ? (
              <div style={{ marginTop: 16 }}>
                <div style={{ fontWeight: 800, fontSize: 13.5, marginBottom: 8 }}>צעדים מעשיים</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {section.nextActions.map(action => (
                    <div key={action} style={{ display: "flex", alignItems: "baseline", gap: 8, fontSize: 13.5, color: "var(--text-muted)", lineHeight: 1.55 }}>
                      <ArrowLeft size={13} strokeWidth={2.4} style={{ color: tone.ink, flex: "none", transform: "translateY(2px)" }} /> {action}
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </>
        )}

        {/* source */}
        {section.sourceData ? (
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 16, fontSize: 11.5, color: "var(--text-faint)", fontWeight: 600 }}>
            <FileText size={13} /> מקור נתונים: {section.sourceData}
          </div>
        ) : null}
      </div>
    </section>
  );
}

export default function ExecutiveReportPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [report, setReport] = useState<ExecutiveReport | null>(null);
  const [runId, setRunId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [fromCache, setFromCache] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [active, setActive] = useState<string>("report-overview");
  const refs = useRef<Record<string, HTMLElement | null>>({});

  const loadReport = useCallback(async () => {
    setLoading(true);
    setGenerating(true);
    setError(null);
    const result = await generateExecutiveReport();
    if (!result.success) {
      setError(result.message);
      setReport(null);
    } else {
      setReport(result.report);
      setRunId(result.runId);
      setFromCache(false);
    }
    setLoading(false);
    setGenerating(false);
  }, []);

  useEffect(() => {
    const wantsFresh = (location.state as { fresh?: boolean } | null)?.fresh === true;
    if (wantsFresh) {
      void loadReport();
      return;
    }
    void (async () => {
      setLoading(true);
      setError(null);
      const latest = await getLatestExecutiveReport();
      if (latest.success && latest.found) {
        setReport(latest.report);
        setRunId(latest.runId);
        setFromCache(true);
        setLoading(false);
        return;
      }
      await loadReport();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadReport]);

  const handleDownloadPdf = async () => {
    if (!runId) return;
    setDownloading(true);
    const result = await downloadExecutiveReportPdf({ runId });
    setDownloading(false);
    if (!result.success) {
      setError(result.message);
      return;
    }
    const url = URL.createObjectURL(result.blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = result.filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const sections = report?.sections;
  const agentReport = sections?.agentReport;

  const feeProducts = agentReport?.combinedSummary.managementFees?.products ?? [];
  const hasCombined = (agentReport?.combinedSummary.notes.length ?? 0) > 0 || feeProducts.length > 0;
  const hasConflicts = (sections?.conflicts?.length ?? 0) > 0;

  const tocItems = useMemo(() => {
    if (!agentReport) return [];
    return [
      { id: "report-overview", label: "התמונה הפיננסית שלי" },
      ...agentReport.agentSections.map(s => ({ id: `report-agent-${s.agentId}`, label: s.title })),
      ...(hasCombined ? [{ id: "report-combined", label: "סיכום משולב" }] : []),
      ...(hasConflicts ? [{ id: "report-conflicts", label: "הערות והתלבטויות" }] : []),
      ...(agentReport.whatToDo.length ? [{ id: "report-actions", label: "מה כדאי לעשות" }] : []),
      ...(agentReport.missingData.length ? [{ id: "report-missing", label: "מידע שחסר" }] : []),
    ];
  }, [agentReport, hasCombined, hasConflicts]);

  // scroll-spy — highlight the TOC entry for the section in view
  useEffect(() => {
    if (!agentReport) return;
    const io = new IntersectionObserver(
      entries => entries.forEach(e => { if (e.isIntersecting) setActive((e.target as HTMLElement).dataset.sec || ""); }),
      { rootMargin: "-40% 0px -55% 0px" },
    );
    Object.values(refs.current).forEach(el => el && io.observe(el));
    return () => io.disconnect();
  }, [agentReport, tocItems.length]);

  const goTo = (id: string) => {
    const el = refs.current[id];
    if (el) window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 92, behavior: "smooth" });
  };

  // ---- financial-picture stat tiles, derived from the real report ----
  const picture = useMemo(() => {
    if (!agentReport) return [] as [string, string, string][];
    const total = agentReport.agentSections.length;
    const withData = agentReport.agentSections.filter(s => s.dataStatus === "available").length;
    const errorCount = agentReport.agentSections.filter(s => s.dataStatus === "error").length;
    const totalRecs = agentReport.agentSections.reduce((n, s) => n + s.recommendations.length, 0);
    const totalFindings = agentReport.agentSections.reduce((n, s) => n + s.findings.length, 0);
    const deposit = agentReport.agentSections
      .flatMap(s => s.dataSummary)
      .find(d => /הפקד/.test(d.label))?.value;
    const tiles: [string, string, string][] = [
      [`${withData}/${total}`, "תחומים עם נתונים", "var(--lav-600)"],
      [`${totalRecs}`, "המלצות פעילות", "var(--peach-ink)"],
      deposit ? [deposit, "הפקדה חודשית", "var(--mint-ink)"] : [`${totalFindings}`, "ממצאי סוכנים", "var(--mint-ink)"],
      [`${errorCount}`, "תחום בשגיאה", "#C23B3B"],
    ];
    return tiles;
  }, [agentReport]);

  const generatedLabel = report?.meta.generatedAt
    ? new Date(report.meta.generatedAt).toLocaleDateString("he-IL", {
      day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit",
    })
    : null;
  const agentCount = report?.meta.agentCount ?? agentReport?.agentSections.length ?? 4;

  return (
    <div style={{ minHeight: "100vh", background: "var(--surface-page)", direction: "rtl", fontFamily: "var(--font-body)" }}>
      <style>{`
        @keyframes frIn { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: none; } }
        @media (prefers-reduced-motion: reduce) { .fr-sec { animation: none !important; } }
      `}</style>
      <PrivateTopbar />

      <main id="main-content" style={{ maxWidth: 1120, margin: "0 auto", padding: "28px 24px 96px" }}>
        <button
          type="button"
          onClick={() => navigate(APP_ROUTES.hub)}
          style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", fontSize: 13.5, fontWeight: 700, color: "var(--text-muted)", marginBottom: 16, padding: 0 }}
        >
          <ArrowRight size={16} /> חזרה ל-Hub
        </button>

        {/* ===== report hero ===== */}
        <div className="fr-sec" style={{ position: "relative", overflow: "hidden", borderRadius: "var(--radius)", padding: "30px 34px", marginBottom: 24, background: "linear-gradient(135deg,#241D45,#3B2E6E 62%,#5A47A8)", color: "#fff", boxShadow: "var(--shadow-card)", animation: "frIn .5s var(--ease) both" }}>
          <div style={{ position: "absolute", inset: 0, backgroundImage: "radial-gradient(rgba(255,255,255,.06) 1px,transparent 1px)", backgroundSize: "20px 20px", pointerEvents: "none" }} />
          <div style={{ position: "relative", display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 20, flexWrap: "wrap" }}>
            <div>
              <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "5px 12px", borderRadius: 999, background: "rgba(255,255,255,.12)", fontSize: 12, fontWeight: 800, marginBottom: 14 }}>
                <Sparkles size={13} /> דוח AI מאוחד
              </div>
              <h1 style={{ margin: 0, fontSize: "clamp(28px,3.6vw,40px)", fontWeight: 900, letterSpacing: "-.035em", lineHeight: 1.05 }}>
                {sections?.title || "הדוח הפיננסי האישי שלי"}
              </h1>
              <p style={{ margin: "8px 0 0", fontSize: 13.5, color: "rgba(255,255,255,.6)", fontWeight: 600 }}>
                {generatedLabel ? `נוצר ${generatedLabel} · ${agentCount} סוכנים · דרך הסוכנים שלך` : "מרכזים את כל הסוכנים לדוח אחד…"}
                {fromCache ? (
                  <span style={{ marginInlineStart: 10, display: "inline-flex", alignItems: "center", gap: 5, background: "rgba(255,255,255,.14)", borderRadius: 999, padding: "3px 10px", fontSize: 12, fontWeight: 800, verticalAlign: "middle" }}>
                    <History size={12} /> הניתוח האחרון שנשמר
                  </span>
                ) : null}
              </p>
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button
                type="button"
                onClick={() => void loadReport()}
                disabled={loading}
                style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "11px 18px", borderRadius: "var(--r-btn)", border: "1px solid rgba(255,255,255,.28)", background: "transparent", color: "#fff", fontFamily: "inherit", fontWeight: 800, fontSize: 14, cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.6 : 1 }}
              >
                <RefreshCw size={15} /> {fromCache ? "ניתוח חדש" : "רענן"}
              </button>
              <button
                type="button"
                onClick={() => void handleDownloadPdf()}
                disabled={loading || downloading || !report || !runId}
                style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "11px 18px", borderRadius: "var(--r-btn)", border: "none", background: "#fff", color: "var(--ink)", fontFamily: "inherit", fontWeight: 800, fontSize: 14, cursor: loading || downloading ? "not-allowed" : "pointer", opacity: loading || downloading ? 0.6 : 1 }}
              >
                <Download size={15} /> {downloading ? "מוריד..." : "הורדת PDF"}
              </button>
            </div>
          </div>
        </div>

        {loading ? (
          <section style={{ textAlign: "center", padding: "60px 20px" }}>
            <Loader />
            <p style={{ marginTop: 16, color: "var(--text-muted)", fontWeight: 600 }}>
              {generating ? "מרכזים את כל הסוכנים לדוח אחד..." : "טוענים את הניתוח האחרון שלך..."}
            </p>
          </section>
        ) : null}

        {error ? (
          <section style={{ background: "rgba(218,111,68,.08)", border: "1px solid rgba(218,111,68,.25)", borderRadius: "var(--r-md)", padding: "18px 20px", color: "var(--peach-ink)", marginBottom: 24 }}>
            {error}
          </section>
        ) : null}

        {sections && agentReport ? (
          <div style={{ display: "grid", gridTemplateColumns: "220px 1fr", gap: 26, alignItems: "start" }}>
            {/* ===== sticky TOC ===== */}
            <nav aria-label="תוכן הדוח" style={{ position: "sticky", top: 88, ...card, padding: "16px 12px" }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: "var(--text-faint)", letterSpacing: ".08em", padding: "0 8px 10px" }}>מה יש בדוח</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                {tocItems.map(t => {
                  const on = active === t.id;
                  return (
                    <button key={t.id} onClick={() => goTo(t.id)} style={{ display: "flex", alignItems: "center", gap: 9, padding: "9px 12px", borderRadius: "var(--r-sm)", border: "none", cursor: "pointer", fontFamily: "inherit", fontWeight: 700, fontSize: 13.5, textAlign: "start", background: on ? "var(--lav-100)" : "transparent", color: on ? "var(--lav-600)" : "var(--text-muted)", transition: "all .18s var(--ease)" }}>
                      <span style={{ width: 6, height: 6, borderRadius: "50%", flex: "none", background: on ? "var(--lav-600)" : "var(--border-soft)" }} />{t.label}
                    </button>
                  );
                })}
              </div>
            </nav>

            {/* ===== report body ===== */}
            <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
              {/* financial picture */}
              <section ref={el => { refs.current["report-overview"] = el; }} data-sec="report-overview" id="report-overview" className="fr-sec" style={{ ...card, padding: "24px 26px", scrollMarginTop: 96, animation: "frIn .5s var(--ease) both" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                  <span style={{ width: 32, height: 32, borderRadius: 9, background: "var(--lav-100)", color: "var(--lav-600)", display: "grid", placeItems: "center" }}><FileText size={17} /></span>
                  <h2 style={{ margin: 0, fontSize: 20, fontWeight: 900, letterSpacing: "-.02em", color: "var(--text-strong)" }}>התמונה הפיננסית שלי</h2>
                </div>
                <p style={{ margin: "0 0 16px", fontSize: 15, color: "var(--text-muted)", lineHeight: 1.6 }}>{sections.executiveSummary}</p>
                {agentReport.intro ? (
                  <p style={{ margin: "0 0 16px", fontSize: 13.5, color: "var(--text-faint)", lineHeight: 1.6 }}>{agentReport.intro}</p>
                ) : null}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 12 }}>
                  {picture.map(([v, l, c]) => (
                    <div key={l} style={{ padding: "14px 16px", borderRadius: "var(--r-md)", background: "var(--surface-sunken)", border: "1px solid var(--border-hair)" }}>
                      <div style={{ fontSize: 24, fontWeight: 900, letterSpacing: "-.03em", color: c, lineHeight: 1 }}>{v}</div>
                      <div style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 600, marginTop: 6 }}>{l}</div>
                    </div>
                  ))}
                </div>
              </section>

              {/* agent sections */}
              {agentReport.agentSections.map((section, index) => (
                <AgentSection
                  key={section.agentId}
                  section={section}
                  index={index}
                  refCb={el => { refs.current[`report-agent-${section.agentId}`] = el; }}
                  onRetry={() => void loadReport()}
                />
              ))}

              {/* combined summary */}
              {hasCombined ? (
                <section ref={el => { refs.current["report-combined"] = el; }} data-sec="report-combined" id="report-combined" className="fr-sec" style={{ ...card, padding: "24px 26px", scrollMarginTop: 96, animation: "frIn .5s var(--ease) both" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
                    <span style={{ width: 32, height: 32, borderRadius: 9, background: "var(--grad-brand)", color: "#fff", display: "grid", placeItems: "center" }}><Sparkles size={16} /></span>
                    <h2 style={{ margin: 0, fontSize: 20, fontWeight: 900, letterSpacing: "-.02em", color: "var(--text-strong)" }}>סיכום משולב</h2>
                  </div>
                  {agentReport.combinedSummary.notes.length > 0 ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: feeProducts.length > 0 ? 18 : 0 }}>
                      {agentReport.combinedSummary.notes.map(note => (
                        <div key={note} style={{ display: "flex", alignItems: "baseline", gap: 12, padding: "12px 15px", borderRadius: "var(--r-md)", background: "var(--surface-sunken)", border: "1px solid var(--border-hair)" }}>
                          <span style={{ width: 8, height: 8, borderRadius: "50%", flex: "none", background: "var(--lav-600)", transform: "translateY(-1px)" }} />
                          <span style={{ fontSize: 13.5, color: "var(--text-body)", fontWeight: 500, lineHeight: 1.55 }}>{note}</span>
                        </div>
                      ))}
                    </div>
                  ) : null}
                  {feeProducts.length > 0 ? (
                    <div style={{ overflowX: "auto" }}>
                      <div style={{ fontWeight: 800, fontSize: 13.5, marginBottom: 8 }}>דמי ניהול — השוואה בין תחומים</div>
                      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                        <thead>
                          <tr style={{ textAlign: "start", borderBottom: "1px solid var(--border-hair)", color: "var(--text-muted)" }}>
                            <th style={{ padding: 8, textAlign: "start", fontWeight: 800 }}>מוצר</th>
                            <th style={{ padding: 8, textAlign: "start", fontWeight: 800 }}>דמ"נ נוכחי</th>
                            <th style={{ padding: 8, textAlign: "start", fontWeight: 800 }}>השוואה</th>
                            <th style={{ padding: 8, textAlign: "start", fontWeight: 800 }}>עודף שנתי</th>
                            <th style={{ padding: 8, textAlign: "start", fontWeight: 800 }}>מסקנה</th>
                          </tr>
                        </thead>
                        <tbody>
                          {feeProducts.map(p => (
                            <tr key={p.product} style={{ borderBottom: "1px solid var(--border-hair)" }}>
                              <td style={{ padding: 8, fontWeight: 700 }}>{p.product}</td>
                              <td style={{ padding: 8 }}>{p.currentFee ?? "—"}</td>
                              <td style={{ padding: 8 }}>{p.comparisonValue ?? "—"}</td>
                              <td style={{ padding: 8 }}>{p.estimatedAnnualExcess != null ? `₪${Math.round(p.estimatedAnnualExcess).toLocaleString("he-IL")}` : "—"}</td>
                              <td style={{ padding: 8 }}>{p.conclusion ?? "—"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {agentReport.combinedSummary.managementFees?.totalEstimatedAnnualExcess != null ? (
                        <p style={{ marginTop: 12, fontWeight: 800 }}>
                          סה"כ עודף שנתי מוערך: ₪{Math.round(agentReport.combinedSummary.managementFees.totalEstimatedAnnualExcess).toLocaleString("he-IL")}
                        </p>
                      ) : null}
                    </div>
                  ) : null}
                </section>
              ) : null}

              {/* conflicts / trade-offs */}
              {hasConflicts ? (
                <section ref={el => { refs.current["report-conflicts"] = el; }} data-sec="report-conflicts" id="report-conflicts" className="fr-sec" style={{ ...card, padding: "24px 26px", scrollMarginTop: 96, animation: "frIn .5s var(--ease) both" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
                    <span style={{ width: 32, height: 32, borderRadius: 9, background: "var(--peach-soft)", color: "var(--peach-ink)", display: "grid", placeItems: "center" }}><AlertTriangle size={17} /></span>
                    <h2 style={{ margin: 0, fontSize: 20, fontWeight: 900, letterSpacing: "-.02em", color: "var(--text-strong)" }}>הערות והתלבטויות</h2>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    {sections.conflicts.map(c => (
                      <div key={c.title} style={{ padding: "15px 17px", borderRadius: "var(--r-md)", background: "var(--surface-sunken)", border: "1px solid var(--border-hair)" }}>
                        <div style={{ fontWeight: 900, fontSize: 14.5, color: "var(--text-strong)", marginBottom: 6 }}>{c.title}</div>
                        <div style={{ fontSize: 13.5, color: "var(--text-muted)", lineHeight: 1.6 }}>{c.explanation}</div>
                        {c.tradeOff ? <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 6 }}><b style={{ color: "var(--ink-soft)" }}>התלבטות:</b> {c.tradeOff}</div> : null}
                        {c.recommendation ? <div style={{ fontSize: 13, color: "var(--mint-ink)", fontWeight: 700, marginTop: 6 }}>המלצת המערכת: {c.recommendation}</div> : null}
                      </div>
                    ))}
                  </div>
                </section>
              ) : null}

              {/* action checklist */}
              {agentReport.whatToDo.length > 0 ? (
                <section ref={el => { refs.current["report-actions"] = el; }} data-sec="report-actions" id="report-actions" className="fr-sec" style={{ ...card, padding: "24px 26px", background: "var(--lav-50)", scrollMarginTop: 96, animation: "frIn .5s var(--ease) both" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
                    <span style={{ width: 32, height: 32, borderRadius: 9, background: "var(--lav-600)", color: "#fff", display: "grid", placeItems: "center" }}><Check size={17} strokeWidth={2.6} /></span>
                    <h2 style={{ margin: 0, fontSize: 20, fontWeight: 900, letterSpacing: "-.02em", color: "var(--text-strong)" }}>מה כדאי לעשות</h2>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
                    {agentReport.whatToDo.map((item, i) => (
                      <div key={`${item.agentId}-${item.title}-${item.action}`} style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "14px 16px", borderRadius: "var(--r-md)", background: "var(--card)", border: "1px solid var(--border-hair)" }}>
                        <span style={{ width: 24, height: 24, borderRadius: "50%", flex: "none", background: "var(--lav-100)", color: "var(--lav-600)", display: "grid", placeItems: "center", fontWeight: 900, fontSize: 12 }}>{i + 1}</span>
                        <span style={{ minWidth: 0 }}>
                          <span style={{ display: "block", fontSize: 14, fontWeight: 800, color: "var(--text-strong)" }}>{item.title}</span>
                          {item.action ? <span style={{ display: "block", fontSize: 13.5, color: "var(--text-muted)", fontWeight: 500, marginTop: 3, lineHeight: 1.5 }}>{item.action}</span> : null}
                        </span>
                      </div>
                    ))}
                  </div>
                </section>
              ) : null}

              {/* missing data */}
              {agentReport.missingData.length > 0 ? (
                <section ref={el => { refs.current["report-missing"] = el; }} data-sec="report-missing" id="report-missing" className="fr-sec" style={{ ...card, padding: "24px 26px", scrollMarginTop: 96, animation: "frIn .5s var(--ease) both" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
                    <span style={{ width: 32, height: 32, borderRadius: 9, background: "var(--surface-sunken)", color: "var(--text-muted)", display: "grid", placeItems: "center" }}><AlertTriangle size={17} /></span>
                    <h2 style={{ margin: 0, fontSize: 20, fontWeight: 900, letterSpacing: "-.02em", color: "var(--text-strong)" }}>מידע שחסר</h2>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {agentReport.missingData.map(item => (
                      <div key={item.agentId} style={{ padding: "14px 16px", borderRadius: "var(--r-md)", background: "var(--surface-sunken)", border: "1px solid var(--border-hair)" }}>
                        <div style={{ fontWeight: 800, fontSize: 14, color: "var(--text-strong)" }}>{item.title}</div>
                        <div style={{ fontSize: 13.5, color: "var(--text-muted)", marginTop: 4, lineHeight: 1.55 }}>{item.message}</div>
                        {item.whatIsMissing ? <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 4 }}>חסר: {item.whatIsMissing}</div> : null}
                        {item.whatEnables ? <div style={{ fontSize: 13, color: "var(--text-muted)" }}>לאחר העלאה: {item.whatEnables}</div> : null}
                      </div>
                    ))}
                  </div>
                </section>
              ) : null}

              <p style={{ fontSize: 12.5, color: "var(--text-faint)", lineHeight: 1.6, marginTop: 4 }} role="note">{report.disclaimer}</p>
            </div>
          </div>
        ) : null}
      </main>

      <AppFooter variant="private" />
    </div>
  );
}
