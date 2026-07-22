import { useCallback, useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  ArrowRight,
  Download,
  FileText,
  History,
  RefreshCw,
  Sparkles,
  Target,
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

function statusBadge(section: AgentReportSection) {
  if (section.dataStatus === "error") {
    return { label: "שגיאה בטעינה", color: "var(--peach-ink)", bg: "rgba(218,111,68,.1)" };
  }
  if (section.dataStatus === "missing") {
    return { label: "נתונים חסרים", color: "var(--text-muted)", bg: "var(--surface-sunken)" };
  }
  if (section.recommendationStatus === "hasRecommendations") {
    return { label: "יש המלצות", color: "var(--mint-ink)", bg: "var(--mint-soft)" };
  }
  return { label: "נבדק — ללא המלצות מהותיות", color: "var(--lav-600)", bg: "var(--lav-50)" };
}

function RecommendationView({ rec }: { rec: PreservedRecommendation }) {
  return (
    <article
      style={{
        border: "1px solid var(--border-hair)",
        borderRadius: "var(--r-md)",
        padding: "16px 18px",
        background: "var(--surface-sunken)",
      }}
    >
      <h4 style={{ margin: "0 0 8px", fontSize: 16, fontWeight: 900, color: "var(--text-strong)" }}>{rec.title}</h4>
      {rec.description ? (
        <p style={{ margin: "0 0 8px", fontSize: 14, lineHeight: 1.6, color: "var(--text-muted)" }}>{rec.description}</p>
      ) : null}
      {rec.reason ? (
        <p style={{ margin: "0 0 8px", fontSize: 13, color: "var(--text-muted)" }}>
          <strong>למה זה חשוב:</strong> {rec.reason}
        </p>
      ) : null}
      {rec.expectedBenefit ? (
        <p style={{ margin: "0 0 8px", fontSize: 13, color: "var(--mint-ink)", fontWeight: 700 }}>
          צעד מומלץ: {rec.expectedBenefit}
        </p>
      ) : null}
      {rec.source ? (
        <p style={{ margin: 0, fontSize: 12, color: "var(--text-muted)" }}>מקור: {rec.source}</p>
      ) : null}
    </article>
  );
}

function AgentSectionView({ section, index }: { section: AgentReportSection; index: number }) {
  const badge = statusBadge(section);
  return (
    <SectionCard
      id={`report-agent-${section.agentId}`}
      icon={<FileText size={18} />}
      title={`${index + 1}. ${section.title}`}
    >
      <div
        style={{
          display: "inline-flex",
          padding: "4px 12px",
          borderRadius: 999,
          fontSize: 12,
          fontWeight: 800,
          color: badge.color,
          background: badge.bg,
          marginBottom: 14,
        }}
      >
        {badge.label}
      </div>

      {section.statusMessage ? (
        <p style={{ margin: "0 0 16px", fontSize: 15, lineHeight: 1.7, color: "var(--text-strong)", fontWeight: 600 }}>
          {section.statusMessage}
        </p>
      ) : null}

      {section.missingDetail ? (
        <div style={{ marginBottom: 16, padding: 14, background: "var(--surface-sunken)", borderRadius: "var(--r-md)" }}>
          <div style={{ fontWeight: 800, marginBottom: 6 }}>מה חסר</div>
          <div style={{ color: "var(--text-muted)", fontSize: 14 }}>{section.missingDetail.whatIsMissing}</div>
          <div style={{ fontWeight: 800, margin: "12px 0 6px" }}>מה ייפתח לאחר העלאה</div>
          <div style={{ color: "var(--text-muted)", fontSize: 14 }}>{section.missingDetail.whatEnables}</div>
        </div>
      ) : null}

      {section.dataSummary.length > 0 ? (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontWeight: 800, marginBottom: 8 }}>סיכום נתונים</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 8 }}>
            {section.dataSummary.map(item => (
              <div key={`${item.label}-${item.value}`} style={{ padding: 12, background: "var(--surface-sunken)", borderRadius: "var(--r-md)" }}>
                <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{item.label}</div>
                <div style={{ fontSize: 15, fontWeight: 800, color: "var(--text-strong)" }}>{item.value}</div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {section.findings.length > 0 ? (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontWeight: 800, marginBottom: 8 }}>ממצאי הסוכן</div>
          <ul style={{ margin: 0, paddingInlineStart: 18, color: "var(--text-muted)", fontSize: 14, lineHeight: 1.6 }}>
            {section.findings.map(f => (
              <li key={f.title}>
                <strong style={{ color: "var(--text-strong)" }}>{f.title}</strong>
                {f.explanation ? ` — ${f.explanation}` : ""}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {section.recommendations.length > 0 ? (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontWeight: 800, marginBottom: 10 }}>המלצות</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {section.recommendations.map(rec => (
              <RecommendationView key={`${rec.recommendationId || rec.title}`} rec={rec} />
            ))}
          </div>
        </div>
      ) : null}

      {section.plainLanguageExplanation ? (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontWeight: 800, marginBottom: 6 }}>הסבר בשפה פשוטה</div>
          <p style={{ margin: 0, fontSize: 14, lineHeight: 1.7, color: "var(--text-muted)" }}>{section.plainLanguageExplanation}</p>
        </div>
      ) : null}

      {section.nextActions.length > 0 ? (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontWeight: 800, marginBottom: 8 }}>צעדים מעשיים</div>
          <ul style={{ margin: 0, paddingInlineStart: 18, color: "var(--text-muted)", fontSize: 14 }}>
            {section.nextActions.map(action => (
              <li key={action}>{action}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {section.sourceData ? (
        <p style={{ margin: 0, fontSize: 12, color: "var(--text-muted)" }}>מקור נתונים: {section.sourceData}</p>
      ) : null}
    </SectionCard>
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

  const tocItems = agentReport
    ? [
        { id: "report-overview", label: "התמונה הפיננסית שלי" },
        ...agentReport.agentSections.map(s => ({
          id: `report-agent-${s.agentId}`,
          label: s.title,
        })),
        ...(hasCombined ? [{ id: "report-combined", label: "סיכום משולב" }] : []),
        ...(sections?.conflicts?.length ? [{ id: "report-conflicts", label: "הערות והתלבטויות" }] : []),
        ...(agentReport.whatToDo.length ? [{ id: "report-actions", label: "מה כדאי לעשות" }] : []),
        ...(agentReport.missingData.length ? [{ id: "report-missing", label: "מידע שחסר" }] : []),
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
              יועץ פיננסי אחד · דוח אישי
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
            <div>
              <h1 style={{ margin: "0 0 8px", fontSize: "clamp(28px,3.5vw,40px)", fontWeight: 900, letterSpacing: "-.03em", color: "var(--text-strong)" }}>
                {sections?.title || "הדוח הפיננסי האישי שלי"}
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
                  cursor: loading || downloading ? "not-allowed" : "pointer",
                  fontFamily: "inherit",
                  fontWeight: 800,
                  fontSize: 14,
                  opacity: loading || downloading ? 0.6 : 1,
                }}
              >
                <Download size={16} />
                {downloading ? "מוריד..." : "הורדת PDF"}
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

        {sections && agentReport ? (
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

            <SectionCard id="report-overview" icon={<FileText size={18} />} title="התמונה הפיננסית שלי">
              <p style={{ margin: "0 0 12px", fontSize: 16, lineHeight: 1.75, color: "var(--text-strong)" }}>
                {sections.executiveSummary}
              </p>
              {agentReport.intro ? (
                <p style={{ margin: 0, fontSize: 14, color: "var(--text-muted)" }}>{agentReport.intro}</p>
              ) : null}
            </SectionCard>

            {agentReport.agentSections.map((section, index) => (
              <AgentSectionView key={section.agentId} section={section} index={index} />
            ))}

            {hasCombined ? (
              <SectionCard id="report-combined" icon={<Target size={18} />} title="סיכום משולב">
                {agentReport.combinedSummary.notes.length > 0 ? (
                  <ul style={{ margin: "0 0 16px", paddingInlineStart: 18, color: "var(--text-muted)", fontSize: 14, lineHeight: 1.7 }}>
                    {agentReport.combinedSummary.notes.map(note => (
                      <li key={note}>{note}</li>
                    ))}
                  </ul>
                ) : null}
                {feeProducts.length > 0 ? (
                  <div style={{ overflowX: "auto" }}>
                    <div style={{ fontWeight: 800, marginBottom: 8 }}>דמי ניהול — השוואה בין תחומים</div>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                      <thead>
                        <tr style={{ textAlign: "right", borderBottom: "1px solid var(--border-hair)" }}>
                          <th style={{ padding: 8 }}>מוצר</th>
                          <th style={{ padding: 8 }}>דמ"נ נוכחי</th>
                          <th style={{ padding: 8 }}>השוואה</th>
                          <th style={{ padding: 8 }}>עודף שנתי</th>
                          <th style={{ padding: 8 }}>מסקנה</th>
                        </tr>
                      </thead>
                      <tbody>
                        {feeProducts.map(p => (
                          <tr key={p.product} style={{ borderBottom: "1px solid var(--border-hair)" }}>
                            <td style={{ padding: 8 }}>{p.product}</td>
                            <td style={{ padding: 8 }}>{p.currentFee ?? "—"}</td>
                            <td style={{ padding: 8 }}>{p.comparisonValue ?? "—"}</td>
                            <td style={{ padding: 8 }}>
                              {p.estimatedAnnualExcess != null
                                ? `₪${Math.round(p.estimatedAnnualExcess).toLocaleString("he-IL")}`
                                : "—"}
                            </td>
                            <td style={{ padding: 8 }}>{p.conclusion ?? "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {agentReport.combinedSummary.managementFees?.totalEstimatedAnnualExcess != null ? (
                      <p style={{ marginTop: 12, fontWeight: 800 }}>
                        סה"כ עודף שנתי מוערך: ₪
                        {Math.round(agentReport.combinedSummary.managementFees.totalEstimatedAnnualExcess).toLocaleString("he-IL")}
                      </p>
                    ) : null}
                  </div>
                ) : null}
              </SectionCard>
            ) : null}

            {(sections.conflicts?.length ?? 0) > 0 ? (
              <SectionCard id="report-conflicts" icon={<AlertTriangle size={18} />} title="הערות והתלבטויות">
                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  {sections.conflicts.map(c => (
                    <article key={c.title} style={{ padding: 14, background: "var(--surface-sunken)", borderRadius: "var(--r-md)" }}>
                      <div style={{ fontWeight: 900, color: "var(--text-strong)", marginBottom: 6 }}>{c.title}</div>
                      <div style={{ fontSize: 14, color: "var(--text-muted)", lineHeight: 1.6 }}>{c.explanation}</div>
                      {c.tradeOff ? (
                        <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 6 }}>
                          <strong>התלבטות:</strong> {c.tradeOff}
                        </div>
                      ) : null}
                      {c.recommendation ? (
                        <div style={{ fontSize: 13, color: "var(--mint-ink)", fontWeight: 700, marginTop: 6 }}>
                          המלצת האורקסטרטור: {c.recommendation}
                        </div>
                      ) : null}
                    </article>
                  ))}
                </div>
              </SectionCard>
            ) : null}

            {agentReport.whatToDo.length > 0 ? (
              <SectionCard id="report-actions" icon={<Target size={18} />} title="מה כדאי לעשות">
                <ul style={{ margin: 0, paddingInlineStart: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 12 }}>
                  {agentReport.whatToDo.map(item => (
                    <li key={`${item.agentId}-${item.title}-${item.action}`} style={{ padding: "12px 14px", borderRadius: "var(--r-md)", background: "var(--surface-sunken)" }}>
                      <div style={{ fontWeight: 800, color: "var(--text-strong)" }}>{item.title}</div>
                      <div style={{ fontSize: 14, color: "var(--text-muted)", marginTop: 4 }}>{item.action}</div>
                    </li>
                  ))}
                </ul>
              </SectionCard>
            ) : null}

            {agentReport.missingData.length > 0 ? (
              <SectionCard id="report-missing" icon={<AlertTriangle size={18} />} title="מידע שחסר">
                <ul style={{ margin: 0, paddingInlineStart: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 12 }}>
                  {agentReport.missingData.map(item => (
                    <li key={item.agentId} style={{ padding: "12px 14px", borderRadius: "var(--r-md)", background: "var(--surface-sunken)" }}>
                      <div style={{ fontWeight: 800, color: "var(--text-strong)" }}>{item.title}</div>
                      <div style={{ fontSize: 14, color: "var(--text-muted)", marginTop: 4 }}>{item.message}</div>
                      {item.whatIsMissing ? (
                        <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 4 }}>חסר: {item.whatIsMissing}</div>
                      ) : null}
                      {item.whatEnables ? (
                        <div style={{ fontSize: 13, color: "var(--text-muted)" }}>לאחר העלאה: {item.whatEnables}</div>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </SectionCard>
            ) : null}

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
