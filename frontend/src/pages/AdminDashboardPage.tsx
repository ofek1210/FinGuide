import { useCallback, useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import {
  Users,
  FileCheck2,
  MessageSquareText,
  Activity,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import { useAuth } from "../auth/AuthProvider";
import PrivateTopbar from "../components/PrivateTopbar";
import AppFooter from "../components/AppFooter";
import { getAdminStats, type AdminStats, type DayCount } from "../api/admin.api";

/* ============================================================
   Admin Dashboard — מרכז בקרה למנהלים.
   One quiet, data-first page in the FinGuide design language:
   hero stat tiles → two 30-day bar charts (signups / uploads)
   → AI usage breakdown. Custom SVG marks, token colors only.
   ============================================================ */

const DAY_MS = 24 * 60 * 60 * 1000;

/** משלים סדרת 30 יום רציפה — ימים ללא נתונים מקבלים 0 */
function toContinuousSeries(rows: DayCount[], days = 30): DayCount[] {
  const map = new Map(rows.map(r => [r.date, r.count]));
  const out: DayCount[] = [];
  const today = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today.getTime() - i * DAY_MS);
    const key = d.toISOString().slice(0, 10);
    out.push({ date: key, count: map.get(key) ?? 0 });
  }
  return out;
}

const formatDayLabel = (iso: string) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString("he-IL", {
    day: "numeric",
    month: "short",
  });

const formatNumber = (n: number) => n.toLocaleString("he-IL");

/* ---------- bar chart (single series, hover tooltip) ---------- */

function DailyBarChart({
  series,
  color,
  title,
}: {
  series: DayCount[];
  color: string;
  title: string;
}) {
  const [hover, setHover] = useState<number | null>(null);

  const W = 560;
  const H = 150;
  const PAD_TOP = 18;
  const PAD_BOTTOM = 24;
  const max = Math.max(1, ...series.map(d => d.count));
  const bw = W / series.length;
  const plotH = H - PAD_TOP - PAD_BOTTOM;

  const maxIndex = series.reduce(
    (best, d, i) => (d.count > series[best].count ? i : best),
    0,
  );

  return (
    <div style={{ position: "relative" }}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={title}
        style={{ width: "100%", height: "auto", display: "block", direction: "ltr" }}
        onMouseLeave={() => setHover(null)}
      >
        {/* recessive grid — baseline + midline only */}
        <line x1={0} y1={H - PAD_BOTTOM} x2={W} y2={H - PAD_BOTTOM} stroke="var(--hair)" strokeWidth={1} />
        <line x1={0} y1={PAD_TOP + plotH / 2} x2={W} y2={PAD_TOP + plotH / 2} stroke="var(--hair)" strokeWidth={1} strokeDasharray="3 5" />

        {series.map((d, i) => {
          const h = d.count === 0 ? 2 : Math.max(3, (d.count / max) * plotH);
          const x = i * bw + 2;
          const y = H - PAD_BOTTOM - h;
          const isHover = hover === i;
          return (
            <g key={d.date}>
              {/* hit target wider than the mark */}
              <rect
                x={i * bw}
                y={0}
                width={bw}
                height={H - PAD_BOTTOM}
                fill="transparent"
                onMouseEnter={() => setHover(i)}
              />
              <rect
                x={x}
                y={y}
                width={Math.max(2, bw - 4)}
                height={h}
                rx={2.5}
                fill={d.count === 0 ? "var(--hair)" : color}
                opacity={hover === null || isHover ? 1 : 0.45}
                style={{ transition: "opacity .15s ease", pointerEvents: "none" }}
              />
              {/* direct label — peak only */}
              {i === maxIndex && series[maxIndex].count > 0 && hover === null && (
                <text
                  x={x + (bw - 4) / 2}
                  y={y - 5}
                  textAnchor="middle"
                  fontSize={10.5}
                  fontWeight={700}
                  fill="var(--text-muted)"
                >
                  {series[maxIndex].count}
                </text>
              )}
            </g>
          );
        })}

        {/* sparse axis labels — every ~7 days */}
        {series.map((d, i) =>
          i % 7 === 3 ? (
            <text
              key={`ax-${d.date}`}
              x={i * bw + bw / 2}
              y={H - 7}
              textAnchor="middle"
              fontSize={9.5}
              fill="var(--text-faint)"
            >
              {formatDayLabel(d.date)}
            </text>
          ) : null,
        )}
      </svg>

      {hover !== null && (
        <div
          style={{
            position: "absolute",
            top: 0,
            insetInlineStart: `${(hover / series.length) * 100}%`,
            transform: "translateX(50%)",
            background: "var(--surface-ink)",
            color: "var(--text-on-ink)",
            borderRadius: 6,
            padding: "5px 10px",
            fontSize: 12,
            fontWeight: 600,
            whiteSpace: "nowrap",
            pointerEvents: "none",
            boxShadow: "var(--shadow-soft)",
            zIndex: 2,
          }}
        >
          {formatDayLabel(series[hover].date)} · {formatNumber(series[hover].count)}
        </div>
      )}
    </div>
  );
}

/* ---------- AI source breakdown — segmented bar + legend ---------- */

const SOURCE_META: Record<string, { label: string; color: string }> = {
  rule: { label: "מנוע חוקים", color: "var(--mint-ink)" },
  llm: { label: "מודל שפה", color: "var(--lav-600)" },
};

function SourceBreakdown({ bySource }: { bySource: Record<string, number> }) {
  const entries = Object.entries(bySource)
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1]);
  const total = entries.reduce((s, [, v]) => s + v, 0);

  if (!total) {
    return <p style={{ margin: 0, fontSize: 13, color: "var(--text-muted)" }}>עדיין אין שיחות AI.</p>;
  }

  return (
    <div>
      <div
        style={{
          display: "flex",
          height: 14,
          borderRadius: 999,
          overflow: "hidden",
          gap: 2,
          background: "var(--surface-sunken)",
        }}
      >
        {entries.map(([key, value]) => (
          <span
            key={key}
            style={{
              width: `${(value / total) * 100}%`,
              background: SOURCE_META[key]?.color ?? "var(--faint)",
              minWidth: 6,
            }}
          />
        ))}
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "10px 22px", marginTop: 12 }}>
        {entries.map(([key, value]) => (
          <span key={key} style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 12.5, color: "var(--text-body)" }}>
            <span style={{ width: 9, height: 9, borderRadius: 3, background: SOURCE_META[key]?.color ?? "var(--faint)" }} />
            <strong style={{ fontWeight: 700 }}>{SOURCE_META[key]?.label ?? key}</strong>
            <span style={{ color: "var(--text-muted)" }}>
              {formatNumber(value)} · {Math.round((value / total) * 100)}%
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}

/* ---------- stat tile ---------- */

function StatTile({
  icon: Icon,
  label,
  value,
  sub,
  tint,
  tintInk,
}: {
  icon: typeof Users;
  label: string;
  value: string;
  sub?: string;
  tint: string;
  tintInk: string;
}) {
  return (
    <div
      style={{
        background: "var(--surface-card)",
        border: "1px solid var(--border-hair)",
        borderRadius: "var(--radius)",
        boxShadow: "var(--shadow-soft)",
        padding: "18px 20px",
        display: "flex",
        flexDirection: "column",
        gap: 10,
        minWidth: 0,
      }}
    >
      <span
        style={{
          width: 34,
          height: 34,
          borderRadius: 10,
          background: tint,
          color: tintInk,
          display: "grid",
          placeItems: "center",
        }}
      >
        <Icon size={17} strokeWidth={2.2} />
      </span>
      <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--text-muted)" }}>{label}</span>
      <span style={{ fontSize: 30, fontWeight: 800, letterSpacing: "-.02em", color: "var(--text-strong)", lineHeight: 1 }}>
        {value}
      </span>
      {sub && <span style={{ fontSize: 12, color: "var(--text-faint)" }}>{sub}</span>}
    </div>
  );
}

/* ---------- chart card wrapper ---------- */

function ChartCard({ title, sub, children }: { title: string; sub?: string; children: React.ReactNode }) {
  return (
    <section
      style={{
        background: "var(--surface-card)",
        border: "1px solid var(--border-hair)",
        borderRadius: "var(--radius)",
        boxShadow: "var(--shadow-soft)",
        padding: "20px 22px",
        minWidth: 0,
      }}
    >
      <header style={{ marginBottom: 16 }}>
        <h2 style={{ margin: 0, fontSize: 15.5, fontWeight: 800, color: "var(--text-strong)" }}>{title}</h2>
        {sub && <p style={{ margin: "3px 0 0", fontSize: 12.5, color: "var(--text-muted)" }}>{sub}</p>}
      </header>
      {children}
    </section>
  );
}

/* ============================================================ */

export default function AdminDashboardPage() {
  const { user, status } = useAuth();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const applyResult = useCallback(
    (result: Awaited<ReturnType<typeof getAdminStats>>) => {
      if (result.ok && result.data.data) {
        setStats(result.data.data);
        setError(null);
      } else if (!result.ok) {
        setError(result.error.message);
      }
    },
    [],
  );

  useEffect(() => {
    if (user?.role !== "admin") return;
    let cancelled = false;
    void getAdminStats().then(result => {
      if (!cancelled) applyResult(result);
    });
    return () => {
      cancelled = true;
    };
  }, [user?.role, applyResult]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    applyResult(await getAdminStats());
    setRefreshing(false);
  }, [applyResult]);

  const loading = refreshing || (!stats && !error);

  const signups = useMemo(
    () => toContinuousSeries(stats?.users.newByDay ?? []),
    [stats],
  );
  const uploads = useMemo(
    () => toContinuousSeries(stats?.documents.uploadsByDay ?? []),
    [stats],
  );

  // הרשאה: העמוד למנהלים בלבד
  if (status === "authenticated" && user && user.role !== "admin") {
    return <Navigate to="/403" replace />;
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", background: "var(--surface-page)", direction: "rtl" }}>
      <PrivateTopbar />

      <main style={{ flex: 1, width: "min(1080px, 100%)", margin: "0 auto", padding: "34px 24px 64px" }}>
        {/* header */}
        <header style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 16, marginBottom: 26, flexWrap: "wrap" }}>
          <div>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 11.5, fontWeight: 800, letterSpacing: ".08em", color: "var(--lav-600)" }}>
              <ShieldCheck size={14} strokeWidth={2.4} />
              ניהול
            </span>
            <h1 style={{ margin: "6px 0 0", fontSize: "clamp(26px, 3.4vw, 34px)", fontWeight: 900, letterSpacing: "-.02em", color: "var(--text-strong)" }}>
              מרכז בקרה
            </h1>
            {stats && (
              <p style={{ margin: "6px 0 0", fontSize: 12.5, color: "var(--text-faint)" }}>
                עודכן{" "}
                {new Date(stats.generatedAt).toLocaleString("he-IL", {
                  day: "numeric",
                  month: "short",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
            )}
          </div>

          <button
            type="button"
            onClick={() => void refresh()}
            disabled={loading}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "9px 16px",
              borderRadius: "var(--r-btn, 6px)",
              border: "1px solid var(--border-hair)",
              background: "var(--surface-card)",
              color: "var(--text-body)",
              fontSize: 13,
              fontWeight: 700,
              fontFamily: "inherit",
              cursor: loading ? "default" : "pointer",
              boxShadow: "var(--shadow-soft)",
            }}
          >
            <RefreshCw size={15} style={loading ? { animation: "spin 1s linear infinite" } : undefined} />
            רענון
          </button>
        </header>

        {error && (
          <div
            role="alert"
            style={{
              background: "var(--peach-soft)",
              color: "var(--peach-ink)",
              border: "1px solid var(--peach)",
              borderRadius: "var(--radius)",
              padding: "12px 16px",
              fontSize: 13.5,
              fontWeight: 600,
              marginBottom: 20,
            }}
          >
            {error}
          </div>
        )}

        {loading && !stats ? (
          <p style={{ fontSize: 14, color: "var(--text-muted)" }}>טוען נתונים…</p>
        ) : stats ? (
          <>
            {/* stat tiles */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                gap: 14,
                marginBottom: 18,
              }}
            >
              <StatTile
                icon={Users}
                label="משתמשים רשומים"
                value={formatNumber(stats.users.total)}
                sub={`${formatNumber(stats.users.googleUsers)} דרך Google · ${Math.round(stats.users.onboardingRate * 100)}% השלימו אונבורדינג`}
                tint="var(--lav-100)"
                tintInk="var(--lav-600)"
              />
              <StatTile
                icon={Activity}
                label="פעילים בשבוע האחרון"
                value={formatNumber(stats.users.activeLast7d)}
                sub="העלו מסמך או שוחחו עם ה-AI"
                tint="var(--mint-soft)"
                tintInk="var(--mint-ink)"
              />
              <StatTile
                icon={FileCheck2}
                label="תלושים שהועלו"
                value={formatNumber(stats.documents.total)}
                sub={
                  stats.documents.ocrSuccessRate !== null
                    ? `${Math.round(stats.documents.ocrSuccessRate * 100)}% עיבוד מוצלח`
                    : "עדיין אין עיבודים"
                }
                tint="var(--peach-soft)"
                tintInk="var(--peach-ink)"
              />
              <StatTile
                icon={MessageSquareText}
                label="הודעות AI"
                value={formatNumber(stats.ai.messages)}
                sub={`${formatNumber(stats.ai.conversations)} שיחות · ${formatNumber(stats.ai.totalTokens)} טוקנים`}
                tint="var(--butter-soft)"
                tintInk="var(--butter-ink)"
              />
            </div>

            {/* charts */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
                gap: 14,
                marginBottom: 18,
              }}
            >
              <ChartCard title="הרשמות חדשות" sub="30 הימים האחרונים">
                <DailyBarChart series={signups} color="var(--lav-500)" title="הרשמות חדשות לפי יום" />
              </ChartCard>
              <ChartCard title="העלאות תלושים" sub="30 הימים האחרונים">
                <DailyBarChart series={uploads} color="var(--peach-ink)" title="העלאות תלושים לפי יום" />
              </ChartCard>
            </div>

            <ChartCard title="מקור תשובות ה-AI" sub="חלוקת תשובות העוזר בין מנוע החוקים למודל השפה">
              <SourceBreakdown bySource={stats.ai.bySource} />
            </ChartCard>
          </>
        ) : null}
      </main>

      <AppFooter variant="private" />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
