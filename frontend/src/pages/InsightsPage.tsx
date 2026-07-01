import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Sparkles, AlertTriangle, TrendingUp, Check, Upload, ArrowLeft } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import PrivateTopbar from "../components/PrivateTopbar";
import AppFooter from "../components/AppFooter";
import AIInsightsLoadingState from "../components/ai/AIInsightsLoadingState";
import { useInsights } from "../hooks/useInsights";
import { dismissInsight, runInsightsAnalysis, type InsightSeverity, type InsightItem } from "../api/insights.api";
import { APP_ROUTES } from "../types/navigation";

type Sev = InsightSeverity;
const SEV: Record<Sev, { label: string; ink: string; soft: string; chip: string; line: string; bar: string; Icon: LucideIcon }> = {
  critical: { label: "קריטי", ink: "var(--danger)", soft: "rgba(220,38,38,.07)", chip: "rgba(220,38,38,.10)", line: "rgba(220,38,38,.30)", bar: "linear-gradient(90deg, #F8D2BE, #DA6F44, #DC2626)", Icon: AlertTriangle },
  warning: { label: "אזהרה", ink: "var(--butter-ink)", soft: "var(--butter-soft)", chip: "rgba(185,139,22,.13)", line: "rgba(185,139,22,.30)", bar: "linear-gradient(90deg, #F6E4A8, #B98B16, #DA6F44)", Icon: AlertTriangle },
  info: { label: "מידע", ink: "var(--lav-600)", soft: "var(--lav-50)", chip: "var(--lav-100)", line: "rgba(124,95,214,.28)", bar: "linear-gradient(90deg, #CDB6FF, #7C5FD6, #B49BF0)", Icon: TrendingUp },
};

/** Card surface with a thick gradient accent bar across the top (severity tone). */
function topBar(bar: string, h = 5) {
  return <span style={{ position: "absolute", insetInline: 0, top: 0, height: h, background: bar, borderRadius: "var(--radius) var(--radius) 0 0" }} />;
}
const RANK: Record<Sev, number> = { critical: 0, warning: 1, info: 2 };

export default function InsightsPage() {
  const navigate = useNavigate();
  const { items, isLoading, error, refresh } = useInsights("active");
  const [filter, setFilter] = useState<Sev | "all">("all");
  const [running, setRunning] = useState(false);
  const [finishing, setFinishing] = useState(false);

  const busy = running || isLoading;
  const showLoader = busy || finishing;

  const counts = useMemo(() => ({
    all: items.length,
    critical: items.filter(i => i.severity === "critical").length,
    warning: items.filter(i => i.severity === "warning").length,
    info: items.filter(i => i.severity === "info").length,
  }), [items]);

  const sorted = useMemo(() => [...items].sort((a, b) => RANK[a.severity] - RANK[b.severity]), [items]);
  const visible = filter === "all" ? sorted : sorted.filter(i => i.severity === filter);
  const featured = visible[0] ?? null;
  const feed = featured ? visible.slice(1) : [];

  const handleRun = async () => {
    setRunning(true);
    setFinishing(true);
    await runInsightsAnalysis();
    await refresh();
    setRunning(false);
  };
  const handleDismiss = async (id: string) => { await dismissInsight(id); await refresh(); };

  const filters: { id: Sev | "all"; label: string; n: number }[] = [
    { id: "all", label: "הכל", n: counts.all },
    { id: "critical", label: "קריטי", n: counts.critical },
    { id: "warning", label: "אזהרה", n: counts.warning },
    { id: "info", label: "מידע", n: counts.info },
  ];

  return (
    <div data-agent="payslips" style={{ minHeight: "100vh", background: "var(--surface-page)", color: "var(--text-body)", fontFamily: "var(--font-body)", direction: "rtl" }}>
      <PrivateTopbar />
      <main style={{ maxWidth: 1080, margin: "0 auto", padding: "40px 24px 84px" }}>
        {/* header */}
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 20, flexWrap: "wrap", marginBottom: 26 }}>
          <div>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "5px 12px", borderRadius: 999, background: "var(--lav-100)", color: "var(--lav-600)", fontSize: 12.5, fontWeight: 800, marginBottom: 13 }}>
              <Sparkles size={13} /> ניתוח חכם
            </span>
            <h1 style={{ margin: 0, fontSize: "clamp(28px,3.6vw,42px)", fontWeight: 900, letterSpacing: "-.035em", lineHeight: 1.05, color: "var(--text-strong)" }}>תובנות חכמות</h1>
            <p style={{ margin: "8px 0 0", fontSize: 15.5, color: "var(--text-muted)", fontWeight: 500, maxWidth: 540 }}>הסוכן סורק את תלושי השכר שלך ומזהה שינויים, חריגות והזדמנויות — מסודר לפי דחיפות.</p>
          </div>
          <button onClick={() => void handleRun()} disabled={running} style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "13px 22px", borderRadius: "var(--r-btn)", border: "none", background: "var(--ink)", color: "#fff", cursor: running ? "wait" : "pointer", fontFamily: "inherit", fontWeight: 800, fontSize: 15, boxShadow: "var(--shadow-ink)" }}>
            <Sparkles size={16} /> הרץ ניתוח AI
          </button>
        </div>

        {/* status band */}
        {!showLoader && items.length > 0 && (
          <div style={{ display: "grid", gridTemplateColumns: "auto 1px 1fr 1px auto", gap: 22, alignItems: "center", background: "var(--card)", border: "1px solid var(--border-hair)", borderRadius: "var(--radius)", boxShadow: "var(--shadow-soft)", padding: "18px 24px", marginBottom: 26 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
              <span style={{ width: 38, height: 38, borderRadius: 11, background: "var(--mint-soft)", color: "var(--mint-ink)", display: "grid", placeItems: "center", flex: "none" }}><Check size={19} strokeWidth={2.6} /></span>
              <div>
                <div style={{ fontSize: 13.5, fontWeight: 800, lineHeight: 1.1, color: "var(--text-strong)" }}>הניתוח הושלם</div>
                <div style={{ fontSize: 11.5, color: "var(--text-faint)", fontWeight: 600, marginTop: 2 }}>{counts.all} תובנות פעילות</div>
              </div>
            </div>
            <span style={{ width: 1, height: 34, background: "var(--hair)" }} />
            <div>
              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 8 }}>
                <span style={{ fontSize: 12.5, fontWeight: 700, color: "var(--text-muted)" }}>פילוח לפי דחיפות</span>
                <span style={{ fontSize: 12, fontWeight: 800, color: "var(--ink)" }}>{counts.all} תובנות</span>
              </div>
              <div style={{ display: "flex", height: 9, borderRadius: 999, overflow: "hidden", gap: 2 }}>
                {counts.critical > 0 && <div style={{ flex: counts.critical, background: "var(--danger)" }} />}
                {counts.warning > 0 && <div style={{ flex: counts.warning, background: "var(--butter-ink)" }} />}
                {counts.info > 0 && <div style={{ flex: counts.info, background: "var(--lav-500)" }} />}
              </div>
              <div style={{ display: "flex", gap: 16, marginTop: 9 }}>
                {([["קריטי", counts.critical, "var(--danger)"], ["אזהרה", counts.warning, "var(--butter-ink)"], ["מידע", counts.info, "var(--lav-500)"]] as const).map(([l, n, col]) => (
                  <span key={l} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 700, color: "var(--text-muted)" }}>
                    <span style={{ width: 8, height: 8, borderRadius: 3, background: col }} />{l} <b style={{ color: "var(--ink)", fontWeight: 900 }}>{n}</b>
                  </span>
                ))}
              </div>
            </div>
            <span style={{ width: 1, height: 34, background: "var(--hair)" }} />
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 28, fontWeight: 900, letterSpacing: "-.03em", color: "var(--danger)", lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>{counts.critical}</div>
              <div style={{ fontSize: 11.5, color: "var(--text-faint)", fontWeight: 600, marginTop: 4 }}>דורש פעולה מיידית</div>
            </div>
          </div>
        )}

        {/* filter */}
        {!showLoader && items.length > 0 && (
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 20 }}>
            <div style={{ display: "flex", gap: 5, background: "var(--surface-sunken)", border: "1px solid var(--border-hair)", borderRadius: 999, padding: 4 }}>
              {filters.map(f => {
                const on = filter === f.id;
                return (
                  <button key={f.id} onClick={() => setFilter(f.id)} style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "7px 15px", borderRadius: 999, border: "none", cursor: "pointer", fontFamily: "inherit", fontWeight: 800, fontSize: 13, background: on ? "var(--card)" : "transparent", color: on ? "var(--ink)" : "var(--text-muted)", boxShadow: on ? "var(--shadow-soft)" : "none", transition: "all .18s var(--ease)" }}>
                    {f.label}
                    <span style={{ fontSize: 11, fontWeight: 900, color: on ? "var(--lav-600)" : "var(--text-faint)", background: on ? "var(--lav-100)" : "transparent", borderRadius: 999, padding: on ? "1px 7px" : "1px 3px", minWidth: 16, textAlign: "center" }}>{f.n}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* loading / error / content */}
        {showLoader ? (
          <div style={{ background: "var(--card)", border: "1px solid var(--border-hair)", borderRadius: "var(--radius)", boxShadow: "var(--shadow-soft)", padding: "22px 24px" }}>
            <AIInsightsLoadingState agent="payslip" ready={!busy} onComplete={() => setFinishing(false)} />
          </div>
        ) : error ? (
          <div style={{ background: "var(--card)", border: "1px solid var(--border-soft)", borderRadius: "var(--radius)", padding: 32, textAlign: "center", color: "var(--danger)", fontWeight: 700 }}>{error}</div>
        ) : items.length === 0 ? (
          <div style={{ background: "var(--card)", border: "1px solid var(--border-soft)", borderRadius: "var(--radius)", boxShadow: "var(--shadow-soft)", padding: "56px 24px", textAlign: "center" }}>
            <span style={{ width: 56, height: 56, borderRadius: 15, background: "var(--lav-100)", color: "var(--lav-600)", display: "grid", placeItems: "center", margin: "0 auto 16px" }}><Sparkles size={26} /></span>
            <h3 style={{ fontSize: 20, fontWeight: 900, color: "var(--text-strong)", margin: "0 0 10px" }}>אין עדיין תובנות</h3>
            <p style={{ fontSize: 14.5, color: "var(--text-muted)", margin: "0 0 20px" }}>העלה תלושים והרץ ניתוח AI כדי לקבל תובנות מותאמות.</p>
            <button onClick={() => navigate(APP_ROUTES.documents)} style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "12px 24px", borderRadius: "var(--r-btn)", background: "var(--ink)", color: "#fff", border: "none", cursor: "pointer", fontFamily: "inherit", fontWeight: 800, fontSize: 14, boxShadow: "var(--shadow-ink)" }}><Upload size={16} /> העלאת תלוש</button>
          </div>
        ) : (
          <>
            {featured && <FeaturedCard insight={featured} onDismiss={handleDismiss} />}
            {feed.length > 0 ? (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 14, alignItems: "start" }}>
                {feed.map(c => <FeedCard key={c._id} insight={c} onDismiss={handleDismiss} />)}
              </div>
            ) : !featured ? (
              <div style={{ textAlign: "center", padding: "50px 20px", color: "var(--text-faint)", background: "var(--card)", border: "1px dashed var(--border-soft)", borderRadius: "var(--radius)" }}>
                <div style={{ display: "inline-flex", marginBottom: 12, color: "var(--mint-ink)" }}><Check size={30} strokeWidth={2.4} /></div>
                <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text-muted)" }}>אין תובנות בקטגוריה הזו — הכל תקין כאן.</div>
              </div>
            ) : null}
          </>
        )}

        <p style={{ fontSize: 12, color: "var(--text-faint)", textAlign: "center", margin: "28px 0 0", lineHeight: 1.6 }}>
          ⚠️ התובנות נוצרות אוטומטית על ידי AI על בסיס הנתונים שהעלית. אינן מהוות ייעוץ פיננסי מקצועי.
        </p>
      </main>
      <AppFooter variant="private" />
    </div>
  );
}

function FeaturedCard({ insight, onDismiss }: { insight: InsightItem; onDismiss: (id: string) => void }) {
  const s = SEV[insight.severity];
  return (
    <div style={{ position: "relative", overflow: "hidden", borderRadius: "var(--radius)", border: "1px solid var(--border-hair)", background: "var(--card)", boxShadow: "var(--shadow-card)", padding: "30px 28px 26px", marginBottom: 18 }}>
      {topBar(s.bar, 6)}
      <div style={{ display: "inline-flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "5px 12px", borderRadius: 999, background: s.chip, color: s.ink, fontSize: 12, fontWeight: 800 }}><s.Icon size={13} strokeWidth={2.6} />{s.label}</span>
        <span style={{ fontSize: 12, fontWeight: 800, color: "var(--text-faint)", letterSpacing: ".06em" }}>הממצא החשוב ביותר</span>
      </div>
      <h2 style={{ margin: "0 0 12px", fontSize: 26, fontWeight: 900, letterSpacing: "-.03em", lineHeight: 1.1, color: "var(--text-strong)" }}>{insight.title}</h2>
      <p style={{ margin: "0 0 18px", fontSize: 15.5, color: "var(--text-body)", lineHeight: 1.6, maxWidth: 620 }}>{insight.description}</p>
      <button onClick={() => void onDismiss(insight._id)} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "9px 16px", borderRadius: "var(--r-btn)", border: "1px solid var(--border-soft)", background: "var(--card)", color: "var(--text-body)", cursor: "pointer", fontFamily: "inherit", fontWeight: 800, fontSize: 13 }}>
        <Check size={15} /> סמן כנקרא
      </button>
    </div>
  );
}

function FeedCard({ insight, onDismiss }: { insight: InsightItem; onDismiss: (id: string) => void }) {
  const s = SEV[insight.severity];
  const big = insight.severity === "critical";
  return (
    <div style={{ position: "relative", overflow: "hidden", display: "flex", flexDirection: "column", borderRadius: "var(--radius)", border: "1px solid var(--border-hair)", background: "var(--card)", boxShadow: "var(--shadow-soft)", padding: "22px 20px 18px", transition: "transform .22s var(--ease), box-shadow .22s var(--ease), border-color .22s var(--ease)" }}
      onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-3px)"; e.currentTarget.style.boxShadow = "var(--shadow-card)"; e.currentTarget.style.borderColor = s.line; }}
      onMouseLeave={e => { e.currentTarget.style.transform = "none"; e.currentTarget.style.boxShadow = "var(--shadow-soft)"; e.currentTarget.style.borderColor = "var(--border-hair)"; }}>
      {topBar(s.bar, big ? 6 : 5)}
      <div style={{ marginBottom: 10 }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 10px", borderRadius: 999, background: s.chip, color: s.ink, fontSize: 11, fontWeight: 800 }}><s.Icon size={12} strokeWidth={2.6} />{s.label}</span>
      </div>
      <h3 style={{ margin: "0 0 7px", fontSize: 16.5, fontWeight: 800, letterSpacing: "-.01em", color: "var(--text-strong)" }}>{insight.title}</h3>
      <p style={{ margin: 0, fontSize: 13, color: "var(--text-muted)", lineHeight: 1.55 }}>{insight.description}</p>
      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 13, paddingTop: 12, borderTop: "1px solid var(--hair)" }}>
        <button onClick={() => void onDismiss(insight._id)} style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "none", border: "none", padding: 0, cursor: "pointer", fontFamily: "inherit", fontWeight: 800, fontSize: 13, color: s.ink }}>
          סמן כנקרא <ArrowLeft size={14} strokeWidth={2.6} />
        </button>
      </div>
    </div>
  );
}
