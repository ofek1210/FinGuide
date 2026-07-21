import { useCallback, useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Download,
  FileText,
  History,
  Lightbulb,
  RefreshCw,
  Sparkles,
  Star,
  Target,
} from "lucide-react";
import PrivateTopbar from "../components/PrivateTopbar";
import AppFooter from "../components/AppFooter";
import Loader from "../components/ui/Loader";
import {
  downloadExecutiveReportPdf,
  generateExecutiveReport,
  getLatestExecutiveReport,
  type ExecutiveReport,
} from "../api/executiveReport.api";
import { APP_ROUTES } from "../types/navigation";

function ImpactStars({ count }: { count: number }) {
  return (
    <span style={{ color: "var(--lav-500)", letterSpacing: 1 }} aria-label={`השפעה: ${count} מתוך 5`}>
      {Array.from({ length: 5 }, (_, i) => (
        <Star
          key={i}
          size={14}
          fill={i < count ? "currentColor" : "none"}
          strokeWidth={2}
          style={{ display: "inline", verticalAlign: "middle", opacity: i < count ? 1 : 0.25 }}
        />
      ))}
    </span>
  );
}

function SectionCard({
  id,
  icon,
  title,
  children,
}: {
  id: string;
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  const headingId = `${id}-heading`;
  return (
    <section
      id={id}
      aria-labelledby={headingId}
      style={{
        background: "var(--card)",
        border: "1px solid var(--border-hair)",
        borderRadius: "var(--radius)",
        boxShadow: "var(--shadow-soft)",
        padding: "24px 26px",
        marginBottom: 22,
        scrollMarginTop: 90,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
        <span
          aria-hidden="true"
          style={{
            width: 34,
            height: 34,
            borderRadius: 10,
            background: "var(--lav-100)",
            color: "var(--lav-600)",
            display: "grid",
            placeItems: "center",
          }}
        >
          {icon}
        </span>
        <h2 id={headingId} style={{ margin: 0, fontSize: 20, fontWeight: 900, color: "var(--text-strong)" }}>{title}</h2>
      </div>
      {children}
    </section>
  );
}

function RoadmapBucket({
  label,
  items,
}: {
  label: string;
  items: { title: string; explanation: string; rank: number }[];
}) {
  if (!items.length) return null;
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontSize: 13, fontWeight: 800, color: "var(--lav-600)", marginBottom: 8 }}>{label}</div>
      <ul style={{ margin: 0, paddingInlineStart: 18, display: "flex", flexDirection: "column", gap: 8 }}>
        {items.map((item) => (
          <li key={`${label}-${item.rank}-${item.title}`} style={{ lineHeight: 1.5 }}>
            <strong style={{ color: "var(--text-strong)" }}>{item.title}</strong>
            {item.explanation ? (
              <span style={{ color: "var(--text-muted)", fontSize: 14 }}> — {item.explanation}</span>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
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

  // Entry behavior: an explicit run from the Hub (state.fresh) generates a new
  // report; any other visit (back navigation, direct link, refresh) shows the
  // last saved report instantly and only generates when none exists yet.
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

  const tocItems = sections
    ? [
        { id: "report-summary", label: "סיכום מנהלים" },
        { id: "report-actions", label: "פעולות בעדיפות עליונה" },
        ...(sections.conflicts.length ? [{ id: "report-conflicts", label: "נושאים שדורשים איזון" }] : []),
        ...(sections.financialStrengths.length ? [{ id: "report-strengths", label: "חוזקות פיננסיות" }] : []),
        ...(sections.risks.length ? [{ id: "report-risks", label: "סיכונים" }] : []),
        ...(sections.opportunities.length ? [{ id: "report-opportunities", label: "הזדמנויות" }] : []),
        { id: "report-roadmap", label: "מפת דרכים" },
        { id: "report-review", label: "דברים לבדיקה שוטפת" },
      ]
    : [];
  const generatedLabel = report?.meta.generatedAt
    ? new Date(report.meta.generatedAt).toLocaleDateString("he-IL", {
        day: "numeric",
        month: "long",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;

  return (
    <div style={{ minHeight: "100vh", background: "var(--surface-page)", direction: "rtl", fontFamily: "var(--font-body)" }}>
      <PrivateTopbar />

      <main id="main-content" style={{ maxWidth: 860, margin: "0 auto", padding: "44px 24px 80px" }}>
        <button
          type="button"
          onClick={() => navigate(APP_ROUTES.hub)}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            background: "none",
            border: "none",
            cursor: "pointer",
            fontFamily: "inherit",
            fontSize: 13.5,
            fontWeight: 700,
            color: "var(--text-muted)",
            marginBottom: 20,
            padding: 0,
          }}
        >
          <ArrowRight size={16} /> חזרה ל-Hub
        </button>

        <header style={{ marginBottom: 28 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 10 }}>
            <Sparkles size={17} color="var(--lav-500)" />
            <span style={{ fontSize: 12.5, fontWeight: 800, letterSpacing: ".12em", color: "var(--lav-600)" }}>
              יועץ פיננסי אחד · דוח מנהלים
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
            <div>
              <h1 style={{ margin: "0 0 8px", fontSize: "clamp(28px,3.5vw,40px)", fontWeight: 900, letterSpacing: "-.03em", color: "var(--text-strong)" }}>
                הדוח הפיננסי שלך
              </h1>
              {generatedLabel ? (
                <p style={{ margin: 0, color: "var(--text-muted)", fontSize: 14 }}>
                  נוצר ב-{generatedLabel}
                  {fromCache ? (
                    <span
                      style={{
                        marginInlineStart: 10,
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 5,
                        background: "var(--lav-50)",
                        color: "var(--lav-600)",
                        borderRadius: 999,
                        padding: "3px 10px",
                        fontSize: 12,
                        fontWeight: 800,
                        verticalAlign: "middle",
                      }}
                    >
                      <History size={12} /> הניתוח האחרון שנשמר
                    </span>
                  ) : null}
                </p>
              ) : null}
            </div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button
                type="button"
                onClick={() => void loadReport()}
                disabled={loading}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "12px 18px",
                  borderRadius: "var(--r-btn)",
                  border: "1px solid var(--border-hair)",
                  background: "var(--card)",
                  cursor: loading ? "not-allowed" : "pointer",
                  fontFamily: "inherit",
                  fontWeight: 700,
                  fontSize: 14,
                  opacity: loading ? 0.6 : 1,
                }}
              >
                <RefreshCw size={16} /> {fromCache ? "ניתוח חדש" : "רענון"}
              </button>
              <button
                type="button"
                onClick={() => void handleDownloadPdf()}
                disabled={loading || downloading || !report || !runId}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "12px 20px",
                  borderRadius: "var(--r-btn)",
                  border: "none",
                  background: "var(--ink)",
                  color: "#fff",
                  cursor: loading || downloading || !report ? "not-allowed" : "pointer",
                  fontFamily: "inherit",
                  fontWeight: 800,
                  fontSize: 14,
                  opacity: loading || downloading || !report ? 0.6 : 1,
                }}
              >
                <Download size={16} />
                {downloading ? "מוריד..." : "הורדת דוח פיננסי (PDF)"}
              </button>
            </div>
          </div>
        </header>

        {loading ? (
          <section style={{ textAlign: "center", padding: "60px 20px" }}>
            <Loader />
            <p style={{ marginTop: 16, color: "var(--text-muted)", fontWeight: 600 }}>
              {generating ? "מרכזים את כל הסוכנים לדוח אחד..." : "טוענים את הניתוח האחרון שלך..."}
            </p>
          </section>
        ) : null}

        {error ? (
          <section
            style={{
              background: "rgba(218,111,68,.08)",
              border: "1px solid rgba(218,111,68,.25)",
              borderRadius: "var(--r-md)",
              padding: "18px 20px",
              color: "var(--peach-ink)",
              marginBottom: 24,
            }}
          >
            {error}
          </section>
        ) : null}

        {sections ? (
          <>
            <nav
              aria-label="תוכן הדוח"
              style={{
                background: "var(--card)",
                border: "1px solid var(--border-hair)",
                borderRadius: "var(--radius)",
                padding: "16px 20px",
                marginBottom: 24,
              }}
            >
              <div style={{ fontSize: 13, fontWeight: 800, color: "var(--text-muted)", marginBottom: 10 }}>מה יש בדוח</div>
              <ul style={{ margin: 0, paddingInlineStart: 18, display: "flex", flexDirection: "column", gap: 6 }}>
                {tocItems.map(item => (
                  <li key={item.id}>
                    <a href={`#${item.id}`} style={{ color: "var(--lav-600)", fontWeight: 700, fontSize: 14, textDecoration: "none" }}>
                      {item.label}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>

            <SectionCard id="report-summary" icon={<FileText size={18} />} title="סיכום מנהלים">
              <p style={{ margin: 0, fontSize: 16, lineHeight: 1.75, color: "var(--text-strong)" }}>
                {sections.executiveSummary}
              </p>
              {report.meta.globalHealthScore != null ? (
                <div
                  style={{
                    marginTop: 16,
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 8,
                    background: "var(--mint-soft)",
                    color: "var(--mint-ink)",
                    borderRadius: 999,
                    padding: "6px 14px",
                    fontSize: 13,
                    fontWeight: 800,
                  }}
                >
                  ציון בריאות פיננסית: {report.meta.globalHealthScore}/100
                </div>
              ) : null}
            </SectionCard>

            <SectionCard id="report-actions" icon={<Target size={18} />} title="פעולות בעדיפות עליונה">
              {sections.topPriorityActions.length === 0 ? (
                <p style={{ margin: 0, color: "var(--text-muted)" }}>לא זוהו פעולות דחופות כרגע.</p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                  {sections.topPriorityActions.map((action) => (
                    <article
                      key={action.rank}
                      style={{
                        border: "1px solid var(--border-hair)",
                        borderRadius: "var(--r-md)",
                        padding: "18px 20px",
                        background: action.rank === 1 ? "linear-gradient(135deg,var(--lav-50),var(--card))" : "var(--surface-sunken)",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8, flexWrap: "wrap" }}>
                        <span style={{ fontSize: 22, fontWeight: 900, color: "var(--lav-600)" }}>#{action.rank}</span>
                        <h3 style={{ margin: 0, fontSize: 17, fontWeight: 900, color: "var(--text-strong)" }}>{action.title}</h3>
                      </div>
                      <p style={{ margin: "0 0 12px", fontSize: 14.5, lineHeight: 1.6, color: "var(--text-muted)" }}>{action.explanation}</p>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 10, fontSize: 13.5 }}>
                        <div>
                          <div style={{ fontWeight: 800, color: "var(--text-strong)", marginBottom: 4 }}>למה עכשיו?</div>
                          <div style={{ color: "var(--text-muted)", lineHeight: 1.5 }}>{action.whyNow}</div>
                        </div>
                        <div>
                          <div style={{ fontWeight: 800, color: "var(--text-strong)", marginBottom: 4 }}>תועלת צפויה</div>
                          <div style={{ color: "var(--text-muted)", lineHeight: 1.5 }}>{action.expectedBenefit}</div>
                        </div>
                        <div>
                          <div style={{ fontWeight: 800, color: "var(--text-strong)", marginBottom: 4 }}>עדיפות · דחיפות · השפעה</div>
                          <div style={{ color: "var(--text-muted)" }}>
                            {action.priorityLabel} · {action.urgency} · <ImpactStars count={action.impactStars} />
                          </div>
                        </div>
                      </div>
                      {action.conflictNote ? (
                        <p style={{ margin: "12px 0 0", fontSize: 13, color: "var(--peach-ink)", fontWeight: 600 }}>
                          הערה: {action.conflictNote}
                        </p>
                      ) : null}
                    </article>
                  ))}
                </div>
              )}
            </SectionCard>

            {sections.conflicts.length > 0 ? (
              <SectionCard id="report-conflicts" icon={<AlertTriangle size={18} />} title="נושאים שדורשים איזון">
                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  {sections.conflicts.map((c) => (
                    <div key={c.title} style={{ padding: "14px 16px", borderRadius: "var(--r-md)", background: "var(--surface-sunken)" }}>
                      <div style={{ fontWeight: 900, marginBottom: 6 }}>{c.title}</div>
                      <p style={{ margin: "0 0 6px", fontSize: 14, color: "var(--text-muted)", lineHeight: 1.55 }}>{c.explanation}</p>
                      <p style={{ margin: "0 0 6px", fontSize: 13.5, color: "var(--text-muted)" }}>
                        <strong>הפשרה:</strong> {c.tradeOff}
                      </p>
                      <p style={{ margin: 0, fontSize: 13.5, fontWeight: 700, color: "var(--lav-600)" }}>
                        המלצה: {c.recommendation}
                      </p>
                    </div>
                  ))}
                </div>
              </SectionCard>
            ) : null}

            <SectionCard id="report-strengths" icon={<CheckCircle2 size={18} />} title="חוזקות פיננסיות">
              {sections.financialStrengths.length === 0 ? (
                <p style={{ margin: 0, color: "var(--text-muted)" }}>נמשיך לזהות חוזקות ככל שייכנסו עוד נתונים.</p>
              ) : (
                <ul style={{ margin: 0, paddingInlineStart: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 10 }}>
                  {sections.financialStrengths.map((s) => (
                    <li key={s.title} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                      <CheckCircle2 size={18} color="var(--mint-ink)" style={{ flexShrink: 0, marginTop: 2 }} />
                      <div>
                        <div style={{ fontWeight: 800, color: "var(--text-strong)" }}>{s.title}</div>
                        {s.explanation ? <div style={{ fontSize: 14, color: "var(--text-muted)", marginTop: 2 }}>{s.explanation}</div> : null}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </SectionCard>

            <SectionCard id="report-risks" icon={<AlertTriangle size={18} />} title="סיכונים">
              {sections.risks.length === 0 ? (
                <p style={{ margin: 0, color: "var(--text-muted)" }}>לא זוהו סיכונים משמעותיים.</p>
              ) : (
                <ul style={{ margin: 0, paddingInlineStart: 18, display: "flex", flexDirection: "column", gap: 10 }}>
                  {sections.risks.map((r) => (
                    <li key={r.title} style={{ lineHeight: 1.55 }}>
                      <strong>{r.title}</strong>
                      {r.explanation ? <span style={{ color: "var(--text-muted)" }}> — {r.explanation}</span> : null}
                    </li>
                  ))}
                </ul>
              )}
            </SectionCard>

            <SectionCard id="report-opportunities" icon={<Lightbulb size={18} />} title="הזדמנויות">
              {sections.opportunities.length === 0 ? (
                <p style={{ margin: 0, color: "var(--text-muted)" }}>אין הזדמנויות חדשות כרגע.</p>
              ) : (
                <ul style={{ margin: 0, paddingInlineStart: 18, display: "flex", flexDirection: "column", gap: 10 }}>
                  {sections.opportunities.map((o) => (
                    <li key={o.title} style={{ lineHeight: 1.55 }}>
                      <strong>{o.title}</strong>
                      {o.explanation ? <span style={{ color: "var(--text-muted)" }}> — {o.explanation}</span> : null}
                      {o.possibleSavings ? (
                        <span style={{ color: "var(--mint-ink)", fontWeight: 800, fontSize: 13 }}> · חיסכון פוטנציאלי</span>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </SectionCard>

            <SectionCard id="report-roadmap" icon={<Target size={18} />} title="מפת דרכים">
              <RoadmapBucket label="מיידי" items={sections.roadmap.immediate} />
              <RoadmapBucket label="ב-30 יום" items={sections.roadmap.within30Days} />
              <RoadmapBucket label="ב-3 חודשים" items={sections.roadmap.within3Months} />
              <RoadmapBucket label="ארוך טווח" items={sections.roadmap.longTerm} />
            </SectionCard>

            <SectionCard id="report-review" icon={<RefreshCw size={18} />} title="דברים לבדיקה שוטפת">
              <ul style={{ margin: 0, paddingInlineStart: 18, display: "flex", flexDirection: "column", gap: 8 }}>
                {sections.thingsToReviewRegularly.map((item) => (
                  <li key={item} style={{ color: "var(--text-muted)", lineHeight: 1.5 }}>{item}</li>
                ))}
              </ul>
            </SectionCard>

            <p style={{ fontSize: 12.5, color: "var(--text-muted)", lineHeight: 1.6, marginTop: 8 }} role="note">
              {report.disclaimer}
            </p>
          </>
        ) : null}
      </main>

      <AppFooter variant="private" />
    </div>
  );
}
