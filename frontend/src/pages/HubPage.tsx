import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  ChevronLeft,
  Landmark,
  Receipt,
  HeartPulse,
  Sparkles,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useAuth } from "../auth/AuthProvider";
import PrivateTopbar from "../components/PrivateTopbar";
import AppFooter from "../components/AppFooter";
import { APP_ROUTES } from "../types/navigation";
import { AGENTS, type AgentId } from "../theme/agents";

/* ── Lightweight count-up hook ───────────────────────────────── */
function useCountUp(target: number, active: boolean, dur = 1400) {
  const [val, setVal] = useState(0);
  const raf = useRef<number>(0);
  useEffect(() => {
    if (!active) return;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min((now - start) / dur, 1);
      const ease = 1 - Math.pow(1 - t, 4);
      setVal(Math.round(ease * target));
      if (t < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [active, target, dur]);
  return val;
}

/* ── iOS-style squircle icon tile ────────────────────────────── */
function IconTile({
  Icon,
  bg,
  color,
  ring,
  size = 46,
  radius = 14,
  iconSize = 22,
}: {
  Icon: LucideIcon;
  bg: string;
  color: string;
  ring?: string;
  size?: number;
  radius?: number;
  iconSize?: number;
}) {
  return (
    <span
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        background: bg,
        border: ring ? `1px solid ${ring}` : "none",
        display: "grid",
        placeItems: "center",
        flexShrink: 0,
      }}
    >
      <Icon size={iconSize} strokeWidth={1.75} color={color} />
    </span>
  );
}

/* ── Radial gauge (SVG) ──────────────────────────────────────── */
function RadialGauge({ value, sub }: { value: number; sub: string }) {
  const r = 56, cx = 70, cy = 70;
  const circ = 2 * Math.PI * r;
  const sweep = 0.75; // 270° arc
  const dash = (value / 100) * circ * sweep;
  return (
    <svg width={150} height={150} viewBox="0 0 140 140">
      <circle
        cx={cx} cy={cy} r={r} fill="none" stroke="var(--surface-sunken)" strokeWidth={9}
        strokeDasharray={`${circ * sweep} ${circ * (1 - sweep)}`}
        strokeLinecap="round" transform={`rotate(135 ${cx} ${cy})`}
      />
      <circle
        cx={cx} cy={cy} r={r} fill="none" stroke="var(--lav-500)" strokeWidth={9}
        strokeDasharray={`${dash} ${circ - dash}`}
        strokeLinecap="round" transform={`rotate(135 ${cx} ${cy})`}
        style={{ transition: "stroke-dasharray 1.1s var(--ease)" }}
      />
      <text x={cx} y={cy - 2} textAnchor="middle" fontSize={32} fontWeight={900}
        fill="var(--text-strong)" fontFamily="var(--font-body)" style={{ fontVariantNumeric: "tabular-nums" }}>
        {value}
      </text>
      <text x={cx} y={cy + 19} textAnchor="middle" fontSize={11.5} fontWeight={700}
        fill="var(--mint-ink)" fontFamily="var(--font-body)" letterSpacing=".04em">
        {sub}
      </text>
    </svg>
  );
}

/* ── Mini sparkline (SVG) ────────────────────────────────────── */
function Sparkline({ points, color, w = 64, h = 24 }: { points: number[]; color: string; w?: number; h?: number }) {
  const max = Math.max(...points), min = Math.min(...points);
  const span = max - min || 1;
  const pts = points
    .map((v, i) => `${(i / (points.length - 1)) * w},${h - ((v - min) / span) * h}`)
    .join(" ");
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ overflow: "visible" }}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth={1.8} strokeLinejoin="round" strokeLinecap="round" opacity={0.9} />
    </svg>
  );
}

/* ── Agent cards (primary navigation) ─────────────────────────
   Visual data is per-agent; identity/colour comes from the shared
   source of truth (theme/agents.ts) so the Hub stays in sync. */
const AGENT_DISPLAY: Record<AgentId, { metric: string; spark: number[]; sparkColor: string }> = {
  payslips:  { metric: "3 ממצאים פעילים", spark: [4, 6, 5, 8, 7, 9], sparkColor: "#9B7FE8" },
  insurance: { metric: "כפילות אחת",       spark: [5, 4, 6, 5, 7, 6], sparkColor: "#DA6F44" },
  pension:   { metric: "2 המלצות",         spark: [3, 5, 6, 7, 8, 9], sparkColor: "#2F9C62" },
};

/* ── Recent findings ─────────────────────────────────────────── */
const FINDINGS: { tone: string; Icon: LucideIcon; title: string; sub: string; amt: string }[] = [
  { tone: "mint",   Icon: Receipt,    title: "החזר מס שלא נוצל", sub: "תלושי שכר · 3 שנות מס", amt: "4,210" },
  { tone: "peach",  Icon: Landmark,   title: "דמי ניהול גבוהים", sub: "פנסיה · 1.9% מהצבירה",   amt: "2,040" },
  { tone: "butter", Icon: HeartPulse, title: "כיסוי ביטוחי כפול", sub: "בריאות · חיוב חודשי",   amt: "1,180" },
];

const FINDING_TONE: Record<string, { bg: string; color: string }> = {
  mint:   { bg: "var(--mint-soft)",   color: "var(--mint-ink)"   },
  peach:  { bg: "var(--peach-soft)",  color: "var(--peach-ink)"  },
  butter: { bg: "var(--butter-soft)", color: "var(--butter-ink)" },
};

export default function HubPage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const heroRef = useRef<HTMLDivElement>(null);
  const [seen, setSeen] = useState(false);
  const total = useCountUp(21830, seen);

  useEffect(() => {
    const el = heroRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) setSeen(true); }, { threshold: 0.2 });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const firstName = user?.name?.split(" ")[0] ?? "שלום";
  const today = new Date().toLocaleDateString("he-IL", { weekday: "long", day: "numeric", month: "long" });

  return (
    <div style={{ minHeight: "100vh", background: "var(--surface-page)", direction: "rtl", fontFamily: "var(--font-body)" }}>
      <PrivateTopbar />

      <main style={{ maxWidth: "var(--maxw-app)", margin: "0 auto", padding: "40px 24px 88px" }}>

        {/* ── Greeting ──────────────────────────────────────────── */}
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 16, flexWrap: "wrap", marginBottom: 30 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 10, color: "var(--text-faint)", fontSize: 12.5, fontWeight: 700, letterSpacing: ".02em" }}>
              <Sparkles size={14} strokeWidth={2} color="var(--lav-500)" />
              <span>{today}</span>
            </div>
            <h1 style={{ margin: 0, fontSize: "clamp(27px, 3.4vw, 38px)", fontWeight: 900, letterSpacing: "-.035em", color: "var(--text-strong)", lineHeight: 1.05 }}>
              בוקר טוב, {firstName}
            </h1>
          </div>
          <p style={{ margin: 0, color: "var(--text-muted)", fontSize: 14.5, fontWeight: 600 }}>
            ריכזנו עבורך 3 הזדמנויות חדשות לחיסכון
          </p>
        </div>

        {/* ── Bento grid ────────────────────────────────────────── */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(12, 1fr)", gap: 18 }}>

          {/* Hero — refined dark opportunity card */}
          <div
            ref={heroRef}
            style={{
              gridColumn: "span 7",
              borderRadius: "var(--r-card)",
              padding: "30px 32px",
              color: "#fff",
              position: "relative", overflow: "hidden",
              background: "linear-gradient(155deg,#211F29,#16151B 60%,#0F0E13)",
              boxShadow: "var(--shadow-xl)",
              display: "flex", flexDirection: "column",
              minHeight: 268,
            }}
          >
            {/* single soft glow, no noise */}
            <div style={{ position: "absolute", width: 320, height: 320, borderRadius: "50%", left: -120, bottom: -160, background: "radial-gradient(circle,rgba(155,127,232,.20),transparent 68%)", pointerEvents: "none" }} />

            <div style={{ position: "relative", flex: 1 }}>
              <div style={{ fontSize: 12.5, color: "rgba(255,255,255,.55)", fontWeight: 600, letterSpacing: ".02em", marginBottom: 12 }}>
                סך ההזדמנויות שזיהינו השנה
              </div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 4, marginBottom: 22 }}>
                <span style={{ fontSize: 22, fontWeight: 700, color: "rgba(255,255,255,.6)" }}>₪</span>
                <span style={{
                  fontSize: 54, fontWeight: 900, letterSpacing: "-.04em", lineHeight: 1,
                  fontVariantNumeric: "tabular-nums",
                  background: "var(--grad-prism)", WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent",
                }}>
                  {total.toLocaleString("en-US")}
                </span>
              </div>

              {/* breakdown as clean list rows */}
              <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
                {[
                  { k: "החזרי מס לא מנוצלים", v: "9,400" },
                  { k: "דמי ניהול עודפים", v: "8,030" },
                  { k: "זכויות והטבות", v: "4,400" },
                ].map((row, i) => (
                  <div
                    key={row.k}
                    style={{
                      display: "flex", alignItems: "center", justifyContent: "space-between",
                      padding: "9px 0",
                      borderTop: i === 0 ? "none" : "1px solid rgba(255,255,255,.08)",
                    }}
                  >
                    <span style={{ fontSize: 13.5, color: "rgba(255,255,255,.7)", fontWeight: 500 }}>{row.k}</span>
                    <span style={{ fontSize: 14, color: "rgba(255,255,255,.95)", fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>₪{row.v}</span>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ position: "relative", marginTop: 24 }}>
              <button
                onClick={() => navigate(APP_ROUTES.findings)}
                style={{
                  display: "inline-flex", alignItems: "center", gap: 8,
                  background: "#fff", color: "var(--ink)", border: "none",
                  borderRadius: "var(--r-pill)", padding: "12px 22px",
                  fontFamily: "inherit", fontWeight: 800, fontSize: 14, cursor: "pointer",
                  transition: "transform var(--dur-fast) var(--ease)",
                }}
                onMouseEnter={e => { e.currentTarget.style.transform = "translateX(-3px)"; }}
                onMouseLeave={e => { e.currentTarget.style.transform = "none"; }}
              >
                ממש את ההזדמנויות
                <ArrowLeft size={17} strokeWidth={2.4} />
              </button>
            </div>
          </div>

          {/* Financial health */}
          <div style={{
            gridColumn: "span 5",
            borderRadius: "var(--r-card)", background: "var(--surface-card)",
            border: "1px solid var(--border-soft)", boxShadow: "var(--shadow-soft)",
            padding: 24,
            display: "flex", flexDirection: "column",
          }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
              <div style={{ fontWeight: 800, fontSize: 16, color: "var(--text-strong)" }}>בריאות פיננסית</div>
              <span style={{ fontSize: 11.5, fontWeight: 700, color: "var(--mint-ink)", background: "var(--mint-soft)", borderRadius: "var(--r-pill)", padding: "4px 11px", border: "1px solid var(--mint)" }}>
                +6 החודש
              </span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
              <RadialGauge value={78} sub="מצב טוב" />
              <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 2 }}>
                {[
                  { label: "ניצול הטבות מס", val: "82%", tone: "var(--mint-ink)" },
                  { label: "יעילות פנסיה", val: "71%", tone: "var(--lav-600)" },
                  { label: "כיסוי ביטוחי", val: "68%", tone: "var(--peach-ink)" },
                ].map((m, i) => (
                  <div key={m.label} style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    padding: "8px 0", borderTop: i === 0 ? "none" : "1px solid var(--border-hair)",
                  }}>
                    <span style={{ fontSize: 12.5, color: "var(--text-muted)", fontWeight: 600 }}>{m.label}</span>
                    <span style={{ fontSize: 13.5, color: m.tone, fontWeight: 800, fontVariantNumeric: "tabular-nums" }}>{m.val}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* 3 agent cards */}
          {AGENTS.map(a => {
            const d = AGENT_DISPLAY[a.id];
            return (
              <button
                key={a.route}
                onClick={() => navigate(a.route)}
                style={{
                  gridColumn: "span 4",
                  textAlign: "start",
                  background: "var(--surface-card)",
                  border: "1px solid var(--border-soft)",
                  borderRadius: "var(--r-card)",
                  padding: 22, cursor: "pointer", fontFamily: "inherit",
                  boxShadow: "var(--shadow-soft)",
                  transition: "transform var(--dur-base) var(--ease), box-shadow var(--dur-base) var(--ease), border-color var(--dur-base) var(--ease)",
                  display: "flex", flexDirection: "column", gap: 16,
                }}
                onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-4px)"; e.currentTarget.style.boxShadow = "var(--shadow-card)"; e.currentTarget.style.borderColor = a.tone.ring; }}
                onMouseLeave={e => { e.currentTarget.style.transform = "none"; e.currentTarget.style.boxShadow = "var(--shadow-soft)"; e.currentTarget.style.borderColor = "var(--border-soft)"; }}
              >
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
                  <IconTile Icon={a.Icon} bg={a.tone.soft} color={a.tone.accent} ring={a.tone.ring} />
                  <Sparkline points={d.spark} color={d.sparkColor} />
                </div>
                <div>
                  <div style={{ fontWeight: 800, fontSize: 15.5, letterSpacing: "-.015em", color: "var(--text-strong)" }}>{a.label}</div>
                  <div style={{ fontSize: 12.5, color: "var(--text-muted)", fontWeight: 500, marginTop: 2 }}>{a.sub}</div>
                </div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: 14, borderTop: "1px solid var(--border-hair)" }}>
                  <span style={{ fontSize: 12.5, color: a.tone.accent, fontWeight: 700 }}>{d.metric}</span>
                  <ChevronLeft size={17} strokeWidth={2.2} color="var(--text-faint)" />
                </div>
              </button>
            );
          })}

          {/* Recent findings */}
          <div style={{
            gridColumn: "span 12",
            borderRadius: "var(--r-card)", background: "var(--surface-card)",
            border: "1px solid var(--border-soft)", boxShadow: "var(--shadow-soft)",
            padding: "22px 24px",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
              <h3 style={{ margin: 0, fontSize: 16.5, fontWeight: 800, color: "var(--text-strong)" }}>ממצאים אחרונים</h3>
              <button
                onClick={() => navigate(APP_ROUTES.findings)}
                style={{ marginInlineStart: "auto", display: "inline-flex", alignItems: "center", gap: 3, background: "none", border: "none", cursor: "pointer", fontSize: 13, fontWeight: 700, color: "var(--accent)", fontFamily: "inherit" }}
              >
                לכל הממצאים
                <ChevronLeft size={15} strokeWidth={2.4} />
              </button>
            </div>

            {/* iOS grouped list */}
            <div style={{ display: "flex", flexDirection: "column" }}>
              {FINDINGS.map((f, i) => {
                const ft = FINDING_TONE[f.tone];
                return (
                  <button
                    key={f.title}
                    onClick={() => navigate(APP_ROUTES.findings)}
                    style={{
                      display: "flex", alignItems: "center", gap: 14,
                      padding: "14px 4px",
                      background: "none", border: "none",
                      borderTop: i === 0 ? "none" : "1px solid var(--border-hair)",
                      cursor: "pointer", fontFamily: "inherit", textAlign: "start",
                      transition: "background var(--dur-fast) var(--ease)",
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = "var(--surface-sunken)"; }}
                    onMouseLeave={e => { e.currentTarget.style.background = "none"; }}
                  >
                    <IconTile Icon={f.Icon} bg={ft.bg} color={ft.color} size={40} radius={12} iconSize={19} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 800, fontSize: 14, color: "var(--text-strong)" }}>{f.title}</div>
                      <div style={{ fontSize: 12.5, color: "var(--text-muted)", marginTop: 2, fontWeight: 500 }}>{f.sub}</div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                      <span style={{ fontWeight: 900, fontSize: 15, color: "var(--text-strong)", fontVariantNumeric: "tabular-nums" }}>
                        ₪{f.amt}
                      </span>
                      <ChevronLeft size={17} strokeWidth={2.2} color="var(--text-faint)" />
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </main>

      <AppFooter variant="private" />
    </div>
  );
}
