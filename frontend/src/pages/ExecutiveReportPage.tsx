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
  Shield,
  Sparkles,
  Target,
  Wallet,
} from "lucide-react";
import PrivateTopbar from "../components/PrivateTopbar";
import AppFooter from "../components/AppFooter";
import Loader from "../components/ui/Loader";
import {
  downloadExecutiveReportPdf,
  generateExecutiveReport,
  getLatestExecutiveReport,
  type DecisionCard,
  type ExecutiveReport,
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

function DecisionCardView({ card }: { card: DecisionCard }) {
  return (
    <article
      style={{
        border: "1px solid var(--border-hair)",
        borderRadius: "var(--r-md)",
        padding: "18px 20px",
        background: "var(--surface-sunken)",
      }}
    >
      <h3 style={{ margin: "0 0 8px", fontSize: 17, fontWeight: 900, color: "var(--text-strong)" }}>{card.title}</h3>
      {(card.sourceAgents?.length ?? 0) > 0 ? (
        <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 10 }}>
          מקור: {card.sourceAgents.join(", ")}
          {card.sourceReports?.length ? ` · ${card.sourceReports.join(", ")}` : null}
        </div>
      ) : null}
      <div style={{ display: "grid", gap: 12, fontSize: 14, lineHeight: 1.6 }}>
        <div>
          <div style={{ fontWeight: 800, color: "var(--text-strong)" }}>המצב כיום</div>
          <div style={{ color: "var(--text-muted)" }}>{card.currentState}</div>
        </div>
        <div>
          <div style={{ fontWeight: 800, color: "var(--text-strong)" }}>מה מצאנו</div>
          <div style={{ color: "var(--text-muted)" }}>{card.finding}</div>
        </div>
        <div>
          <div style={{ fontWeight: 800, color: "var(--text-strong)" }}>למה זה חשוב</div>
          <div style={{ color: "var(--text-muted)" }}>{card.whyItMatters}</div>
        </div>
        {card.monetaryImpact?.hasImpact ? (
          <div>
            <div style={{ fontWeight: 800, color: "var(--text-strong)" }}>השפעה אפשרית</div>
            <div style={{ color: "var(--mint-ink)", fontWeight: 700 }}>{card.monetaryImpact.summary}</div>
            {card.monetaryImpact.assumptions?.length ? (
              <ul style={{ margin: "6px 0 0", paddingInlineStart: 18, color: "var(--text-muted)", fontSize: 13 }}>
                {card.monetaryImpact.assumptions.map(a => <li key={a}>{a}</li>)}
              </ul>
            ) : null}
            {card.monetaryImpact.disclaimer ? (
              <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>{card.monetaryImpact.disclaimer}</div>
            ) : null}
          </div>
        ) : null}
        <div>
          <div style={{ fontWeight: 800, color: "var(--text-strong)" }}>מה לעשות</div>
          <div style={{ color: "var(--text-muted)" }}>{card.recommendedAction}</div>
          {card.steps?.length ? (
            <ol style={{ margin: "8px 0 0", paddingInlineStart: 18, color: "var(--text-muted)" }}>
              {card.steps.map((s, i) => <li key={i}>{s}</li>)}
            </ol>
          ) : null}
        </div>
        {card.questionsForProvider?.length ? (
          <div>
            <div style={{ fontWeight: 800, color: "var(--text-strong)" }}>שאלות לספק / איש מקצוע</div>
            <ul style={{ margin: "6px 0 0", paddingInlineStart: 18, color: "var(--text-muted)" }}>
              {card.questionsForProvider.map(q => <li key={q}>{q}</li>)}
            </ul>
          </div>
        ) : null}
      </div>
      {card.conflictNote ? (
        <p style={{ margin: "12px 0 0", fontSize: 13, color: "var(--peach-ink)", fontWeight: 600 }}>
          הערה: {card.conflictNote}
        </p>
      ) : null}
    </article>
  );
}

function ActionList({ items, emptyLabel }: { items: { title: string; explanation: string; whoToContact?: string; whatToRequest?: string }[]; emptyLabel: string }) {
  if (!items.length) {
    return <p style={{ margin: 0, color: "var(--text-muted)" }}>{emptyLabel}</p>;
  }
  return (
    <ul style={{ margin: 0, paddingInlineStart: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 12 }}>
      {items.map(item => (
        <li key={item.title} style={{ padding: "12px 14px", borderRadius: "var(--r-md)", background: "var(--surface-sunken)" }}>
          <div style={{ fontWeight: 800, color: "var(--text-strong)" }}>{item.title}</div>
          {item.explanation ? <div style={{ fontSize: 14, color: "var(--text-muted)", marginTop: 4 }}>{item.explanation}</div> : null}
          {item.whoToContact ? <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 4 }}>ליצירת קשר: {item.whoToContact}</div> : null}
          {item.whatToRequest ? <div style={{ fontSize: 13, color: "var(--text-muted)" }}>לבקש: {item.whatToRequest}</div> : null}
        </li>
      ))}
    </ul>
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
  const [downloading, setDownloading] = useState<"user" | "professional" | null>(null);
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

  const handleDownloadPdf = async (mode: "user" | "professional") => {
    if (!runId) return;
    setDownloading(mode);
    const result = await downloadExecutiveReportPdf({ runId, mode });
    setDownloading(null);
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
  const overview = sections?.personalOverview;

  const tocItems = sections
    ? [
        { id: "report-overview", label: "התמונה שלי" },
        { id: "report-position", label: "מצב פיננסי נוכחי" },
        { id: "report-decisions", label: "החלטות מרכזיות" },
        ...(sections.managementFees?.products?.length ? [{ id: "report-fees", label: "דמי ניהול" }] : []),
        ...(sections.insuranceSummary?.privatePolicies?.length || sections.insuranceSummary?.pensionEmbedded?.length
          ? [{ id: "report-insurance", label: "ביטוח" }]
          : []),
        { id: "report-actions", label: "מה כדאי לעשות" },
        { id: "report-before-change", label: "לפני שינוי" },
        { id: "report-missing", label: "מידע שחסר" },
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
                הדוח הפיננסי האישי שלי
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
                onClick={() => void handleDownloadPdf("user")}
                disabled={loading || downloading !== null || !report || !runId}
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
                {downloading === "user" ? "מוריד..." : "הורדת דוח אישי (PDF)"}
              </button>
              <button
                type="button"
                onClick={() => void handleDownloadPdf("professional")}
                disabled={loading || downloading !== null || !report || !runId}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "12px 18px",
                  borderRadius: "var(--r-btn)",
                  border: "1px solid var(--border-hair)",
                  background: "var(--card)",
                  cursor: loading || downloading ? "not-allowed" : "pointer",
                  fontFamily: "inherit",
                  fontWeight: 700,
                  fontSize: 14,
                  opacity: loading || downloading ? 0.6 : 1,
                }}
              >
                <FileText size={16} />
                {downloading === "professional" ? "מוריד..." : "דוח לאיש מקצוע"}
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

        {sections && overview ? (
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

            <SectionCard id="report-overview" icon={<FileText size={18} />} title="התמונה שלי">
              <p style={{ margin: "0 0 16px", fontSize: 16, lineHeight: 1.75, color: "var(--text-strong)" }}>
                {sections.executiveSummary}
              </p>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 10, fontSize: 14 }}>
                <div style={{ padding: 12, background: "var(--surface-sunken)", borderRadius: "var(--r-md)" }}>
                  <div style={{ fontWeight: 800 }}>תחומים שנותחו</div>
                  <div style={{ color: "var(--text-muted)" }}>{overview.analyzedDomains.join(", ") || "—"}</div>
                </div>
                <div style={{ padding: 12, background: "var(--surface-sunken)", borderRadius: "var(--r-md)" }}>
                  <div style={{ fontWeight: 800 }}>ממצאים</div>
                  <div style={{ color: "var(--text-muted)" }}>{overview.findingCount}</div>
                </div>
                <div style={{ padding: 12, background: "var(--surface-sunken)", borderRadius: "var(--r-md)" }}>
                  <div style={{ fontWeight: 800 }}>הזדמנויות מהותיות</div>
                  <div style={{ color: "var(--text-muted)" }}>{overview.materialOpportunityCount}</div>
                </div>
              </div>
              {overview.healthScore ? (
                <div style={{ marginTop: 16, padding: 14, background: "var(--mint-soft)", borderRadius: "var(--r-md)", fontSize: 13 }}>
                  <div style={{ fontWeight: 800, color: "var(--mint-ink)" }}>
                    ציון בריאות פיננסית: {overview.healthScore.score}/100
                    {overview.healthScore.label ? ` (${overview.healthScore.label})` : ""}
                  </div>
                  <div style={{ color: "var(--text-muted)", marginTop: 6 }}>{overview.healthScore.howCalculated}</div>
                  {overview.healthScore.pointsLost?.length ? (
                    <div style={{ color: "var(--text-muted)", marginTop: 4 }}>נקודות שאבדו: {overview.healthScore.pointsLost.join(" · ")}</div>
                  ) : null}
                  <div style={{ color: "var(--text-muted)", marginTop: 4 }}>רמת ביטחון: {overview.healthScore.confidence}</div>
                </div>
              ) : null}
              {overview.missingSources?.length ? (
                <div style={{ marginTop: 14 }}>
                  <div style={{ fontWeight: 800, marginBottom: 6 }}>מקורות חסרים</div>
                  <ul style={{ margin: 0, paddingInlineStart: 18, color: "var(--text-muted)", fontSize: 14 }}>
                    {overview.missingSources.map(s => (
                      <li key={s.agentId}>{s.message}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </SectionCard>

            <SectionCard id="report-position" icon={<Wallet size={18} />} title="מצב פיננסי נוכחי">
              {sections.currentPosition?.items?.length ? (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 10 }}>
                  {sections.currentPosition.items.map(item => (
                    <div key={item.label} style={{ padding: 14, background: "var(--surface-sunken)", borderRadius: "var(--r-md)" }}>
                      <div style={{ fontSize: 13, color: "var(--text-muted)" }}>{item.label}</div>
                      <div style={{ fontSize: 20, fontWeight: 900, color: "var(--text-strong)" }}>{item.formatted}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <p style={{ margin: 0, color: "var(--text-muted)" }}>אין עדיין מספיק נתונים להצגת מצב מספרי.</p>
              )}
              <p style={{ margin: "12px 0 0", fontSize: 12, color: "var(--text-muted)" }}>{sections.currentPosition?.disclaimer}</p>
            </SectionCard>

            <SectionCard id="report-decisions" icon={<Target size={18} />} title="החלטות מרכזיות">
              {sections.mainDecisions.length === 0 ? (
                <p style={{ margin: 0, color: "var(--text-muted)" }}>לא זוהו החלטות מהותיות כרגע — ראו «מה כדאי לבדוק בהמשך».</p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                  {sections.mainDecisions.map(card => (
                    <DecisionCardView key={card.id} card={card} />
                  ))}
                </div>
              )}
            </SectionCard>

            {sections.managementFees?.products?.length ? (
              <SectionCard id="report-fees" icon={<Wallet size={18} />} title="דמי ניהול — סיכום">
                <div style={{ overflowX: "auto" }}>
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
                      {sections.managementFees.products.map(p => (
                        <tr key={p.product} style={{ borderBottom: "1px solid var(--border-hair)" }}>
                          <td style={{ padding: 8 }}>{p.product}</td>
                          <td style={{ padding: 8 }}>{p.currentFee ?? "—"}</td>
                          <td style={{ padding: 8 }}>{p.comparisonValue ?? "—"}</td>
                          <td style={{ padding: 8 }}>{p.estimatedAnnualExcess != null ? `₪${Math.round(p.estimatedAnnualExcess).toLocaleString("he-IL")}` : "—"}</td>
                          <td style={{ padding: 8 }}>{p.conclusion ?? "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {sections.managementFees.totalEstimatedAnnualExcess != null ? (
                  <p style={{ marginTop: 12, fontWeight: 800 }}>
                    סה"כ עודף שנתי מוערך: ₪{Math.round(sections.managementFees.totalEstimatedAnnualExcess).toLocaleString("he-IL")}
                  </p>
                ) : null}
                {sections.managementFees.immaterialProducts?.map(im => (
                  <p key={im.product} style={{ fontSize: 13, color: "var(--text-muted)", margin: "6px 0 0" }}>
                    {im.product}: {im.reason}
                  </p>
                ))}
              </SectionCard>
            ) : null}

            {(sections.insuranceSummary?.privatePolicies?.length ?? 0) > 0 || (sections.insuranceSummary?.pensionEmbedded?.length ?? 0) > 0 ? (
              <SectionCard id="report-insurance" icon={<Shield size={18} />} title="ביטוח">
                <div style={{ fontWeight: 800, marginBottom: 8 }}>כיסויים ביטוחיים במסגרת הפנסיה</div>
                <ActionList items={sections.insuranceSummary.pensionEmbedded.map(p => ({ title: p.title, explanation: p.detail }))} emptyLabel="—" />
                <div style={{ fontWeight: 800, margin: "16px 0 8px" }}>ביטוחים פרטיים</div>
                <ActionList items={sections.insuranceSummary.privatePolicies.map(p => ({ title: p.title, explanation: p.detail }))} emptyLabel="—" />
                {sections.insuranceSummary.crossDomainNotes?.map(note => (
                  <p key={note} style={{ fontSize: 13, color: "var(--peach-ink)", marginTop: 10 }}>{note}</p>
                ))}
                <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 8 }}>
                  מקורות: {sections.insuranceSummary.sources.join(", ") || "—"}
                </p>
              </SectionCard>
            ) : null}

            <SectionCard id="report-actions" icon={<Target size={18} />} title="מה כדאי לעשות עכשיו">
              <ActionList items={sections.actionPlan.doNow} emptyLabel="אין פעולות מיידיות — המשך מעקב." />
            </SectionCard>

            <SectionCard id="report-before-change" icon={<AlertTriangle size={18} />} title="לפני שמבצעים מעבר או שינוי">
              <ActionList items={sections.actionPlan.beforeChange} emptyLabel="אין בדיקות מקדימות נדרשות כרגע." />
            </SectionCard>

            {sections.actionPlan.checkLater.length > 0 ? (
              <SectionCard id="report-check-later" icon={<Lightbulb size={18} />} title="מה כדאי לבדוק בהמשך">
                <ActionList items={sections.actionPlan.checkLater} emptyLabel="—" />
              </SectionCard>
            ) : null}

            <SectionCard id="report-missing" icon={<FileText size={18} />} title="מידע שחסר להשלמת התמונה">
              <ActionList items={sections.actionPlan.missingData} emptyLabel="כל המידע הנדרש קיים." />
            </SectionCard>

            {sections.financialStrengths.length > 0 ? (
              <SectionCard id="report-strengths" icon={<CheckCircle2 size={18} />} title="חוזקות">
                <ul style={{ margin: 0, paddingInlineStart: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 10 }}>
                  {sections.financialStrengths.map(s => (
                    <li key={s.title} style={{ display: "flex", gap: 10 }}>
                      <CheckCircle2 size={18} color="var(--mint-ink)" />
                      <div>
                        <div style={{ fontWeight: 800 }}>{s.title}</div>
                        {s.explanation ? <div style={{ fontSize: 14, color: "var(--text-muted)" }}>{s.explanation}</div> : null}
                      </div>
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
