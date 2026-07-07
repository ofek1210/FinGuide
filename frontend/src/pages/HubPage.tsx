import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Sparkles, Upload } from "lucide-react";
import { useAuth } from "../auth/AuthProvider";
import PrivateTopbar from "../components/PrivateTopbar";
import AppFooter from "../components/AppFooter";
import MasterAgentPanel from "../components/hub/MasterAgentPanel";
import { APP_ROUTES } from "../types/navigation";
import { AGENTS, type AgentId } from "../theme/agents";
import { getDashboardSummary, type DashboardSummaryData } from "../api/dashboard.api";
import { listFindings, type FindingItem } from "../api/findings.api";
import { getPensionAnalysis, getPensionImportHistory, type PensionAnalysisData } from "../api/pension.api";
import { listDocuments, type DocumentItem } from "../api/documents.api";
import { enrichPayslipFromDoc } from "../utils/payslipEnrichment";

/* ============================================================
   Hub — editorial command center in the FinGuide design language:
   bold greeting, a dark prism "opportunity" band with a floating
   health card, a centered showcase of the 3 agent cards, then a
   pension projection + ranked findings row.
   Faithful implementation of the design-system Hub (ui_kits/app/Hub.jsx).
   ============================================================ */

type Tone = "lavender" | "peach" | "mint";

const AGENT_TONE: Record<AgentId, Tone> = {
  payslips: "lavender",
  insurance: "peach",
  pension: "mint",
};

/* ── hooks ───────────────────────────────────────────────────── */
function useInView<T extends HTMLElement>(): [React.RefObject<T | null>, boolean] {
  const ref = useRef<T>(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    if (seen) return;
    const fallback = setTimeout(() => setSeen(true), 500);
    let io: IntersectionObserver | undefined;
    if (ref.current && "IntersectionObserver" in window) {
      io = new IntersectionObserver(
        es => es.forEach(e => { if (e.isIntersecting) setSeen(true); }),
        { rootMargin: "-40px", threshold: 0.15 }
      );
      io.observe(ref.current);
    }
    return () => { clearTimeout(fallback); io?.disconnect(); };
  }, [seen]);
  return [ref, seen];
}

function useCountUp(target: number, run: boolean, dur = 1300) {
  const [v, setV] = useState(0);
  useEffect(() => {
    if (!run) return;
    let raf = 0, start = 0;
    const tick = (t: number) => {
      if (!start) start = t;
      const p = Math.min((t - start) / dur, 1);
      const e = 1 - Math.pow(1 - p, 3);
      setV(target * e);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [run, target, dur]);
  return Math.round(v);
}

const nis = (n: number) => "₪" + Math.round(n).toLocaleString("en-US");

/* ── svg helpers ─────────────────────────────────────────────── */
function smooth(pts: number[][]): string {
  if (pts.length < 2) return "";
  let d = `M ${pts[0][0]} ${pts[0][1]}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
    const c1x = p1[0] + (p2[0] - p0[0]) / 6, c1y = p1[1] + (p2[1] - p0[1]) / 6;
    const c2x = p2[0] - (p3[0] - p1[0]) / 6, c2y = p2[1] - (p3[1] - p1[1]) / 6;
    d += ` C ${c1x} ${c1y}, ${c2x} ${c2y}, ${p2[0]} ${p2[1]}`;
  }
  return d;
}
let _uid = 0;
const uid = () => "fg" + (++_uid);

/* ── Area projection chart ───────────────────────────────────── */
function AreaChart({ base, optimized, height = 210, gapLabel }: { base: number[]; optimized: number[]; height?: number; gapLabel?: boolean }) {
  const [ref, seen] = useInView<HTMLDivElement>();
  const [id] = useState(uid);
  const W = 560, H = height, pad = { t: 26, r: 18, b: 24, l: 18 };
  const all = base.concat(optimized);
  const max = Math.max(...all) * 1.1, min = Math.min(...all) * 0.82;
  const X = (i: number, arr: number[]) => pad.l + (i / (arr.length - 1)) * (W - pad.l - pad.r);
  const Y = (v: number) => pad.t + (1 - (v - min) / (max - min || 1)) * (H - pad.t - pad.b);
  const bp = base.map((v, i) => [X(i, base), Y(v)]);
  const op = optimized.map((v, i) => [X(i, optimized), Y(v)]);
  const areaUnder = (pts: number[][]) => smooth(pts) + ` L ${pts[pts.length - 1][0]} ${H - pad.b} L ${pts[0][0]} ${H - pad.b} Z`;
  const band = smooth(op) + " L " + bp.slice().reverse().map(p => `${p[0]} ${p[1]}`).join(" L ") + " Z";
  const end = op[op.length - 1];

  return (
    <div ref={ref} style={{ width: "100%", position: "relative" }}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: "block", overflow: "visible" }}>
        <defs>
          <linearGradient id={id + "stroke"} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#9B7FE8" /><stop offset="0.55" stopColor="#6F8BE8" /><stop offset="1" stopColor="#2F9C62" />
          </linearGradient>
          <linearGradient id={id + "fill"} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#7C5FD6" stopOpacity="0.26" /><stop offset="1" stopColor="#7C5FD6" stopOpacity="0" />
          </linearGradient>
          <linearGradient id={id + "band"} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#2F9C62" stopOpacity="0.16" /><stop offset="1" stopColor="#2F9C62" stopOpacity="0.02" />
          </linearGradient>
          <filter id={id + "glow"} x="-20%" y="-40%" width="140%" height="180%"><feGaussianBlur stdDeviation="4" /></filter>
        </defs>
        {[0.2, 0.45, 0.7].map(g => (
          <line key={g} x1={pad.l} x2={W - pad.r} y1={pad.t + g * (H - pad.t - pad.b)} y2={pad.t + g * (H - pad.t - pad.b)} stroke="var(--border-hair)" strokeWidth="1.5" strokeDasharray="1.5 7" strokeLinecap="round" />
        ))}
        <path d={band} fill={`url(#${id}band)`} style={{ opacity: seen ? 1 : 0, transition: "opacity .8s .5s ease" }} />
        <path d={areaUnder(op)} fill={`url(#${id}fill)`} style={{ opacity: seen ? 1 : 0, transition: "opacity .9s .3s ease" }} />
        <path d={smooth(bp)} fill="none" stroke="var(--faint)" strokeWidth="2.2" strokeDasharray="2 6" strokeLinecap="round"
          style={{ opacity: seen ? 0.8 : 0, transition: "opacity .7s .4s ease" }} />
        <path d={smooth(op)} fill="none" stroke="#7C5FD6" strokeWidth="7" strokeLinecap="round" opacity="0.35" filter={`url(#${id}glow)`} pathLength={1}
          style={{ strokeDasharray: 1, strokeDashoffset: seen ? 0 : 1, transition: "stroke-dashoffset 1.5s cubic-bezier(.22,.61,.36,1)" }} />
        <path d={smooth(op)} fill="none" stroke={`url(#${id}stroke)`} strokeWidth="3.4" strokeLinecap="round" pathLength={1}
          style={{ strokeDasharray: 1, strokeDashoffset: seen ? 0 : 1, transition: "stroke-dashoffset 1.5s cubic-bezier(.22,.61,.36,1)" }} />
        <g style={{ opacity: seen ? 1 : 0, transition: "opacity .4s 1.2s ease" }}>
          <circle cx={end[0]} cy={end[1]} r="11" fill="#2F9C62" opacity="0.16">
            {seen && <animate attributeName="r" values="9;15;9" dur="2.4s" repeatCount="indefinite" />}
          </circle>
          <circle cx={end[0]} cy={end[1]} r="5.5" fill="#2F9C62" stroke="#fff" strokeWidth="2.5" />
        </g>
      </svg>
      {gapLabel && (
        <div style={{ display: "flex", gap: 18, marginTop: 12, fontSize: 12.5, fontWeight: 700, color: "var(--text-muted)" }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><i style={{ width: 16, height: 3, borderRadius: 2, background: "linear-gradient(90deg,#9B7FE8,#2F9C62)" }} />ממוטב</span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><i style={{ width: 16, height: 3, borderRadius: 2, background: "var(--faint)" }} />נוכחי</span>
        </div>
      )}
    </div>
  );
}

/* ── Radial gauge ────────────────────────────────────────────── */
function RadialGauge({ value, max = 100, sub, tone = "lavender", size = 148, onDark = false }: { value: number; max?: number; sub?: string; tone?: Tone; size?: number; onDark?: boolean }) {
  const [ref, seen] = useInView<HTMLDivElement>();
  const [id] = useState(uid);
  const grads: Record<Tone, [string, string]> = {
    lavender: ["#9B7FE8", "#6F8BE8"], mint: ["#48C98B", "#2F9C62"], peach: ["#F4A87E", "#DA6F44"],
  };
  const [g1, g2] = grads[tone];
  const s = size, r = s / 2 - 13, c = 2 * Math.PI * r, frac = Math.min(value / max, 1);
  const shown = useCountUp(value, seen, 1200);
  const ticks = Array.from({ length: 40 });
  const trackStroke = onDark ? "rgba(255,255,255,.12)" : "var(--surface-sunken)";
  const tickOff = onDark ? "rgba(255,255,255,.18)" : "var(--border-hair)";
  const valueColor = onDark ? "#fff" : "var(--ink)";
  return (
    <div ref={ref} style={{ position: "relative", width: s, height: s }}>
      <svg width={s} height={s} style={{ transform: "rotate(-90deg)", overflow: "visible" }}>
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor={g1} /><stop offset="1" stopColor={g2} /></linearGradient>
          <filter id={id + "g"} x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="3.5" /></filter>
        </defs>
        {ticks.map((_, i) => {
          const a = (i / ticks.length) * 2 * Math.PI, on = i / ticks.length <= frac;
          const r1 = r + 11, r2 = r + (on ? 6 : 8);
          return <line key={i} x1={s / 2 + r1 * Math.cos(a)} y1={s / 2 + r1 * Math.sin(a)} x2={s / 2 + r2 * Math.cos(a)} y2={s / 2 + r2 * Math.sin(a)} stroke={on ? g2 : tickOff} strokeWidth="1.5" style={{ opacity: seen ? (on ? 0.9 : 0.5) : 0, transition: `opacity .5s ${i * 0.012}s` }} />;
        })}
        <circle cx={s / 2} cy={s / 2} r={r} fill="none" stroke={trackStroke} strokeWidth="12" />
        <circle cx={s / 2} cy={s / 2} r={r} fill="none" stroke={`url(#${id})`} strokeWidth="12" strokeLinecap="round" opacity="0.4" filter={`url(#${id}g)`} strokeDasharray={c} strokeDashoffset={seen ? c * (1 - frac) : c} style={{ transition: "stroke-dashoffset 1.4s cubic-bezier(.22,.61,.36,1)" }} />
        <circle cx={s / 2} cy={s / 2} r={r} fill="none" stroke={`url(#${id})`} strokeWidth="12" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={seen ? c * (1 - frac) : c} style={{ transition: "stroke-dashoffset 1.4s cubic-bezier(.22,.61,.36,1)" }} />
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", textAlign: "center" }}>
        <div>
          <div style={{ fontSize: s * 0.27, fontWeight: 900, color: valueColor, letterSpacing: "-.03em", lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>
            {shown}<span style={{ fontSize: s * 0.13, color: g2 }}>%</span>
          </div>
          {sub && <div style={{ fontSize: 11.5, color: onDark ? "rgba(255,255,255,.6)" : "var(--text-muted)", fontWeight: 700, marginTop: 3 }}>{sub}</div>}
        </div>
      </div>
    </div>
  );
}

/* ── Sparkline ───────────────────────────────────────────────── */
function Sparkline({ points, tone = "mint", w = 78, h = 30 }: { points: number[]; tone?: Tone; w?: number; h?: number }) {
  const [id] = useState(uid);
  const max = Math.max(...points), min = Math.min(...points);
  const pts = points.map((v, i) => [(i / (points.length - 1)) * w, h - ((v - min) / (max - min || 1)) * (h - 8) - 4]);
  const cols: Record<Tone, [string, string]> = { mint: ["#48C98B", "#2F9C62"], peach: ["#F4A87E", "#DA6F44"], lavender: ["#B49BF0", "#7C5FD6"] };
  const [c1, c2] = cols[tone];
  const area = smooth(pts) + ` L ${pts[pts.length - 1][0]} ${h} L ${pts[0][0]} ${h} Z`;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width={w} height={h} style={{ overflow: "visible" }}>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor={c1} /><stop offset="1" stopColor={c2} /></linearGradient>
        <linearGradient id={id + "f"} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={c2} stopOpacity="0.2" /><stop offset="1" stopColor={c2} stopOpacity="0" /></linearGradient>
      </defs>
      <path d={area} fill={`url(#${id}f)`} />
      <path d={smooth(pts)} fill="none" stroke={`url(#${id})`} strokeWidth="2.6" strokeLinecap="round" />
      <circle cx={pts[pts.length - 1][0]} cy={pts[pts.length - 1][1]} r="3.2" fill={c2} stroke="#fff" strokeWidth="1.5" />
    </svg>
  );
}

/* ── static display bits ─────────────────────────────────────── */
const AGENT_ORDINAL: Record<AgentId, string> = { payslips: "01", insurance: "02", pension: "03" };

const DOT = "radial-gradient(rgba(123,95,214,.10) 1px,transparent 1px)";

/* ── data mapping ────────────────────────────────────────────── */
const PENSION_KINDS = new Set(["pension_health_low", "fee_above_market", "risk_wrong_for_age", "track_underperforming"]);

function domainOf(f: FindingItem): AgentId {
  const kind = String(f.meta?.findingKind || "");
  if (kind.startsWith("insurance_")) return "insurance";
  if (PENSION_KINDS.has(kind) || f.meta?.fundType === "pension") return "pension";
  return "payslips";
}

const DOMAIN_LABEL: Record<AgentId, string> = {
  payslips: "תלושי שכר",
  insurance: "ביטוח",
  pension: "פנסיה",
};

/** interpolate a smooth growth series from a starting balance to a projected end */
function growthSeries(start: number, end: number, n = 9): number[] {
  const s = Math.max(start, 0);
  if (!(end > 0)) return [];
  if (s <= 0) return Array.from({ length: n }, (_, i) => (end * i) / (n - 1));
  const r = Math.pow(end / s, 1 / (n - 1));
  return Array.from({ length: n }, (_, i) => s * Math.pow(r, i));
}

/** sortable YYYYMM key — explicit payslip period when present, else upload date */
function periodKey(d: DocumentItem): number {
  const y = d.metadata?.periodYear, m = d.metadata?.periodMonth;
  if (y && m) return y * 100 + m;
  const t = new Date(d.processedAt || d.uploadedAt || d.createdAt || 0);
  return Number.isNaN(t.getTime()) ? 0 : t.getFullYear() * 100 + (t.getMonth() + 1);
}

/** net-salary trend across the user's completed payslips (last 6 with a net value) */
function netTrend(docs: DocumentItem[]): number[] {
  const points = docs
    .filter(d => d.status === "completed" || d.status === "needs_review")
    .sort((a, b) => periodKey(a) - periodKey(b))
    .map(d => enrichPayslipFromDoc(d).netSalary)
    .filter((n): n is number => n != null)
    .slice(-6);
  return points.length >= 2 ? points : [];
}

export default function HubPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [heroRef, heroSeen] = useInView<HTMLDivElement>();

  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<DashboardSummaryData | null>(null);
  const [findings, setFindings] = useState<FindingItem[]>([]);
  const [pension, setPension] = useState<PensionAnalysisData | null>(null);
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [pensionScoreTrend, setPensionScoreTrend] = useState<number[]>([]);
  // Overall score reported live by the master agent panel — overrides the
  // dashboard summary score after a fresh full-analysis run.
  const [liveScore, setLiveScore] = useState<number | null>(null);

  useEffect(() => {
    let alive = true;
    Promise.allSettled([
      getDashboardSummary(),
      listFindings(),
      getPensionAnalysis(),
      listDocuments(),
      getPensionImportHistory(),
    ]).then(([sumRes, findRes, penRes, docRes, histRes]) => {
      if (!alive) return;
      if (sumRes.status === "fulfilled" && sumRes.value.ok && sumRes.value.data.data) {
        setSummary(sumRes.value.data.data);
      }
      if (findRes.status === "fulfilled" && findRes.value.success && findRes.value.data) {
        setFindings(findRes.value.data);
      }
      if (penRes.status === "fulfilled" && penRes.value.ok && penRes.value.data.data) {
        setPension(penRes.value.data.data);
      }
      if (docRes.status === "fulfilled" && docRes.value.success && docRes.value.data) {
        setDocuments(docRes.value.data);
      }
      if (histRes.status === "fulfilled" && histRes.value.ok && histRes.value.data.data) {
        const scores = histRes.value.data.data
          .slice()
          .reverse() // history arrives newest-first; sparkline reads oldest→newest
          .map(s => s.healthScore)
          .filter((s): s is number => s != null)
          .slice(-6);
        setPensionScoreTrend(scores.length >= 2 ? scores : []);
      }
      setLoading(false);
    });
    return () => { alive = false; };
  }, []);

  const scores = summary?.scores;
  const completedDocs = summary?.documents.completed ?? 0;
  const importedPolicies = summary?.profile.importedPolicies ?? 0;
  const pensionFundCount = pension?.summary.fundCount ?? 0;
  const pensionRecs = pension?.recommendations ?? [];

  // ranked findings — warnings first, top 3
  const rankedFindings = useMemo(() => {
    const order = { warning: 0, info: 1 } as const;
    return [...findings].sort((a, b) => order[a.severity] - order[b.severity]).slice(0, 3);
  }, [findings]);

  const findingsCount = findings.length;
  const domainCounts = useMemo(() => {
    const c: Record<AgentId, number> = { payslips: 0, insurance: 0, pension: 0 };
    findings.forEach(f => { c[domainOf(f)]++; });
    return c;
  }, [findings]);

  // hero: potential savings to retirement, from real pension analysis
  const potentialSavings =
    pension?.benchmark?.summary.totalPotentialSavings ??
    pension?.projection?.mgmtFeeSavings?.savingsByRetirement ??
    0;
  const opportunities = findingsCount + pensionRecs.length;
  const total = useCountUp(potentialSavings, heroSeen && !loading);
  const bigOpportunities = useCountUp(opportunities, heroSeen && !loading);
  const heroMode: "money" | "counts" | "empty" =
    loading || potentialSavings > 0 ? "money" : opportunities > 0 ? "counts" : "empty";

  const heroRows = useMemo(() => {
    const rows: [string, string][] = [];
    if (domainCounts.payslips) rows.push(["ממצאים בתלושי שכר", `${domainCounts.payslips}`]);
    if (domainCounts.insurance) rows.push(["ממצאי ביטוח", `${domainCounts.insurance}`]);
    if (domainCounts.pension) rows.push(["ממצאי פנסיה", `${domainCounts.pension}`]);
    if (pensionRecs.length) rows.push(["המלצות פנסיה", `${pensionRecs.length}`]);
    return rows.slice(0, 3);
  }, [domainCounts, pensionRecs.length]);

  // pension projection series derived from the real analysis
  const projection = pension?.projection;
  const projSeries = useMemo(() => {
    if (!projection?.available || !projection.scenarios) return null;
    const start = pension?.summary.currentAccumulation ?? 0;
    const base = growthSeries(start, projection.scenarios.base.accumulation);
    const opt = growthSeries(start, projection.scenarios.optimistic.accumulation);
    if (base.length < 2 || opt.length < 2) return null;
    const delta = projection.scenarios.optimistic.accumulation - projection.scenarios.base.accumulation;
    return { base, opt, delta };
  }, [projection, pension?.summary.currentAccumulation]);

  const firstName = user?.name?.split(" ")[0] ?? "שלום";
  const reviewLabel = new Date().toLocaleDateString("he-IL", { month: "long", year: "numeric" });
  const retirementAge = pension?.summary.retirementAge ?? 67;

  const oppLine = loading
    ? "טוענים את התמונה הפיננסית שלך…"
    : opportunities === 1
      ? "ריכזנו עבורך הזדמנות אחת לשיפור."
      : opportunities > 1
        ? `ריכזנו עבורך ${opportunities} הזדמנויות לשיפור.`
        : completedDocs > 0
          ? "לא נמצאו הזדמנויות חדשות — הכל נראה תקין."
          : "העלו תלוש ראשון כדי שנתחיל לזהות הזדמנויות.";

  const healthRows: [string, number | null][] = [
    ["תלושי שכר", scores?.payslip ?? null],
    ["יעילות פנסיה", scores?.pension ?? null],
    ["כיסוי ביטוחי", scores?.insurance ?? null],
  ];

  // real per-agent trend series; a card simply shows no chart when there is no history yet
  const payslipTrend = useMemo(() => netTrend(documents), [documents]);
  const agentSpark: Record<AgentId, number[]> = {
    payslips: payslipTrend,
    insurance: [],
    pension: pensionScoreTrend,
  };

  const agentMetric: Record<AgentId, string> = {
    payslips: completedDocs > 0
      ? (domainCounts.payslips > 0 ? `${domainCounts.payslips} ממצאים פעילים` : `${completedDocs} תלושים נותחו`)
      : "טרם הועלו תלושים",
    insurance: importedPolicies > 0
      ? (domainCounts.insurance > 0 ? `${domainCounts.insurance} ממצאים פעילים` : `${importedPolicies} פוליסות במעקב`)
      : "טרם יובאו פוליסות",
    pension: pensionFundCount > 0
      ? (pensionRecs.length > 0 ? `${pensionRecs.length} המלצות` : `${pensionFundCount} קרנות במעקב`)
      : "טרם חובר מידע פנסיוני",
  };

  return (
    <div style={{ minHeight: "100vh", background: "var(--surface-page)", direction: "rtl", fontFamily: "var(--font-body)" }}>
      <PrivateTopbar />

      <main style={{ maxWidth: 1160, margin: "0 auto", padding: "44px 24px 80px" }}>
        {/* greeting */}
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 16, flexWrap: "wrap", marginBottom: 26 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 10 }}>
              <Sparkles size={17} color="var(--lav-500)" />
              <span style={{ fontSize: 12.5, fontWeight: 800, letterSpacing: ".12em", color: "var(--lav-600)" }}>סקירה שבועית · {reviewLabel}</span>
            </div>
            <h1 style={{ margin: 0, fontSize: "clamp(32px,4vw,48px)", fontWeight: 900, letterSpacing: "-.035em", lineHeight: 1.04, color: "var(--text-strong)" }}>בוקר טוב, {firstName}.</h1>
          </div>
          <p style={{ margin: 0, color: "var(--text-muted)", fontSize: 16, fontWeight: 500, maxWidth: 280, textWrap: "balance" }}>{oppLine}</p>
        </div>

        {/* OPPORTUNITY BAND */}
        <div ref={heroRef} style={{ position: "relative", borderRadius: "var(--radius)", overflow: "hidden", background: "radial-gradient(120% 90% at 88% 4%,#26242F,#16151B 60%,#0E0D12)", color: "#fff", boxShadow: "var(--shadow-xl)", marginBottom: 46 }}>
          <div style={{ position: "absolute", inset: 0, backgroundImage: "radial-gradient(rgba(255,255,255,.055) 1px,transparent 1px)", backgroundSize: "22px 22px", pointerEvents: "none" }} />
          <div style={{ position: "absolute", width: 360, height: 360, borderRadius: "50%", insetInlineStart: -120, top: -140, background: "radial-gradient(circle,rgba(155,127,232,.32),transparent 70%)", pointerEvents: "none" }} />
          <div style={{ position: "relative", display: "grid", gridTemplateColumns: "1.25fr .85fr", gap: 30, padding: 34, alignItems: "center" }}>
            {/* text side */}
            {heroMode === "empty" ? (
              <div>
                <div style={{ fontSize: 13.5, color: "rgba(255,255,255,.6)", fontWeight: 600, marginBottom: 12 }}>עוד אין לנו מספיק נתונים</div>
                <div style={{ fontSize: "clamp(26px,3vw,38px)", fontWeight: 900, letterSpacing: "-.03em", lineHeight: 1.15, maxWidth: 420 }}>
                  העלו תלוש שכר ראשון — ושלושת הסוכנים יתחילו לחפש עבורך הזדמנויות לחיסכון.
                </div>
                <button onClick={() => navigate(APP_ROUTES.documents)} style={{ marginTop: 24, display: "inline-flex", alignItems: "center", gap: 9, background: "#fff", color: "var(--ink)", border: "none", borderRadius: "var(--r-btn)", padding: "14px 24px", fontFamily: "inherit", fontWeight: 800, fontSize: 15, cursor: "pointer", transition: "transform .2s var(--ease)" }}
                  onMouseEnter={e => e.currentTarget.style.transform = "translateY(-2px)"}
                  onMouseLeave={e => e.currentTarget.style.transform = "none"}>
                  <Upload size={17} strokeWidth={2.4} /> העלאת תלוש ראשון
                </button>
              </div>
            ) : (
              <div>
                <div style={{ fontSize: 13.5, color: "rgba(255,255,255,.6)", fontWeight: 600, marginBottom: 12 }}>
                  {heroMode === "money" ? "פוטנציאל חיסכון מצטבר עד הפרישה" : "הזדמנויות פתוחות לשיפור"}
                </div>
                <div style={{ fontSize: "clamp(38px,5vw,58px)", fontWeight: 900, letterSpacing: "-.04em", lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>
                  {heroMode === "money" ? nis(total) : bigOpportunities}
                  {heroMode === "counts" && (
                    <span style={{ fontSize: "clamp(18px,2vw,24px)", fontWeight: 800, marginInlineStart: 10, color: "rgba(255,255,255,.7)" }}>הזדמנויות</span>
                  )}
                </div>
                {heroRows.length > 0 && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 7, marginTop: 18, maxWidth: 340 }}>
                    {heroRows.map(([k, v]) => (
                      <div key={k} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 13.5 }}>
                        <span style={{ color: "rgba(255,255,255,.62)", fontWeight: 500 }}>{k}</span>
                        <span style={{ fontWeight: 800, fontVariantNumeric: "tabular-nums" }}>{v}</span>
                      </div>
                    ))}
                  </div>
                )}
                <button onClick={() => navigate(APP_ROUTES.financialHealth)} style={{ marginTop: 24, display: "inline-flex", alignItems: "center", gap: 9, background: "#fff", color: "var(--ink)", border: "none", borderRadius: "var(--r-btn)", padding: "14px 24px", fontFamily: "inherit", fontWeight: 800, fontSize: 15, cursor: "pointer", transition: "transform .2s var(--ease)" }}
                  onMouseEnter={e => e.currentTarget.style.transform = "translateY(-2px)"}
                  onMouseLeave={e => e.currentTarget.style.transform = "none"}>
                  ממש את ההזדמנויות <ArrowLeft size={17} strokeWidth={2.4} />
                </button>
              </div>
            )}
            {/* floating health card — fed live by the master agent panel */}
            <div style={{ background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.12)", borderRadius: "var(--r-md)", backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)", padding: 24, display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
              <div style={{ alignSelf: "stretch", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontSize: 13.5, fontWeight: 800 }}>בריאות פיננסית</span>
                <span style={{ fontSize: 11, fontWeight: 800, color: "#fff", background: "rgba(255,255,255,.14)", borderRadius: 999, padding: "3px 10px" }}>
                  {completedDocs > 0 ? `${completedDocs} מסמכים נותחו` : "ממתין לנתונים"}
                </span>
              </div>
              <RadialGauge
                value={liveScore ?? scores?.overall ?? 0}
                sub={(() => {
                  const v = liveScore ?? scores?.overall;
                  if (v == null) return "טרם חושב";
                  return v >= 75 ? "מצב טוב" : v >= 50 ? "מצב סביר" : "דורש טיפול";
                })()}
                tone="lavender" size={148} onDark
              />
              <div style={{ alignSelf: "stretch", display: "flex", flexDirection: "column", gap: 9, marginTop: 4 }}>
                {healthRows.map(([k, v], i) => (
                  <div key={k} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 13 }}>
                    <span style={{ color: "rgba(255,255,255,.62)", fontWeight: 500 }}>{k}</span>
                    <span style={{ fontWeight: 800, color: ["var(--mint-ink)", "var(--lav-300)", "var(--peach)"][i], fontVariantNumeric: "tabular-nums" }}>
                      {v == null ? "—" : `${v}%`}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* MASTER AGENT PANEL — live orchestrator console */}
        <MasterAgentPanel onResult={r => setLiveScore(r.globalScore?.score ?? null)} />

        {/* AGENTS — enter each specialist */}
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 16, flexWrap: "wrap", marginBottom: 22 }}>
          <div>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 12.5, fontWeight: 800, letterSpacing: ".12em", color: "var(--lav-600)" }}>
              <Sparkles size={17} color="var(--lav-500)" />
              מרכז הסוכנים
            </span>
            <h2 style={{ margin: "8px 0 0", fontSize: "clamp(24px,2.6vw,32px)", fontWeight: 900, letterSpacing: "-.03em", color: "var(--text-strong)" }}>היכנס לכל סוכן בנפרד.</h2>
          </div>
          <p style={{ margin: 0, color: "var(--text-muted)", fontSize: 15, fontWeight: 500, maxWidth: 300, textWrap: "balance" }}>כל סוכן מנהל את התחום שלו — לחץ כדי לצלול פנימה.</p>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 20, marginBottom: 46 }}>
          {AGENTS.map(a => {
            const tone = AGENT_TONE[a.id];
            const c1 = a.tone.soft, c2 = a.tone.accent;
            const Icon = a.Icon;
            return (
              <button key={a.route} onClick={() => navigate(a.route)}
                style={{ textAlign: "start", background: "var(--surface-sunken)", border: "1px solid var(--border-hair)", borderRadius: "var(--radius)", padding: 20, cursor: "pointer", fontFamily: "inherit", boxShadow: "var(--shadow-soft)", transition: "transform .32s var(--ease), box-shadow .32s var(--ease)", display: "flex", flexDirection: "column", backgroundImage: DOT, backgroundSize: "16px 16px" }}
                onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-5px)"; e.currentTarget.style.boxShadow = "var(--shadow-card)"; }}
                onMouseLeave={e => { e.currentTarget.style.transform = "none"; e.currentTarget.style.boxShadow = "var(--shadow-soft)"; }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 9 }}>
                    <span style={{ width: 26, height: 26, borderRadius: 8, background: c2, color: "#fff", display: "grid", placeItems: "center", fontWeight: 900, fontSize: 12, letterSpacing: "-.02em" }}>{AGENT_ORDINAL[a.id]}</span>
                    <span style={{ fontSize: 11.5, fontWeight: 800, letterSpacing: ".11em", color: c2 }}>סוכן AI</span>
                  </span>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11.5, fontWeight: 700, color: "var(--mint-ink)" }}>
                    <span style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--mint-ink)", boxShadow: "0 0 0 3px rgba(47,156,98,.18)" }} />פעיל
                  </span>
                </div>
                <div style={{ background: "var(--card)", border: "1px solid var(--border-hair)", borderRadius: "var(--r-md)", padding: 16, boxShadow: "var(--shadow-soft)", marginBottom: 16 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <span style={{ width: 40, height: 40, borderRadius: 11, background: c1, color: c2, display: "grid", placeItems: "center" }}>
                      <Icon size={21} strokeWidth={1.85} />
                    </span>
                    {agentSpark[a.id].length >= 2 && <Sparkline points={agentSpark[a.id]} tone={tone} w={78} h={30} />}
                  </div>
                  <div style={{ marginTop: 14, fontSize: 13, fontWeight: 800, color: c2 }}>{loading ? "…" : agentMetric[a.id]}</div>
                </div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                  <div>
                    <div style={{ fontWeight: 900, fontSize: 18, letterSpacing: "-.02em", color: "var(--text-strong)" }}>{a.label}</div>
                    <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 3, fontWeight: 500 }}>{a.sub}</div>
                  </div>
                  <span style={{ width: 34, height: 34, borderRadius: 10, flex: "none", background: c1, color: c2, display: "grid", placeItems: "center" }}>
                    <ArrowLeft size={17} strokeWidth={2.2} />
                  </span>
                </div>
              </button>
            );
          })}
        </div>

        {/* PROJECTION + RANKED FINDINGS */}
        <div style={{ display: "grid", gridTemplateColumns: "1.15fr .85fr", gap: 20 }}>
          <div style={{ background: "var(--card)", border: "1px solid var(--border-hair)", borderRadius: "var(--radius)", boxShadow: "var(--shadow-soft)", padding: 24 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: "var(--text-strong)" }}>הפנסיה שלך — נוכחי מול ממוטב</h3>
                <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 3 }}>צבירה צפויה עד גיל {retirementAge}</div>
              </div>
              {projSeries && projSeries.delta > 0 && (
                <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12.5, fontWeight: 800, color: "var(--mint-ink)", background: "var(--mint-soft)", border: "1px solid var(--mint)", borderRadius: "var(--r-pill)", padding: "5px 12px", whiteSpace: "nowrap" }}>
                  <span style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--mint-ink)" }} />+ {Math.round(projSeries.delta).toLocaleString("en-US")} ₪
                </span>
              )}
            </div>
            {projSeries ? (
              <AreaChart base={projSeries.base} optimized={projSeries.opt} height={210} gapLabel />
            ) : (
              <div style={{ display: "grid", placeItems: "center", height: 210, textAlign: "center" }}>
                <div>
                  <div style={{ fontSize: 14.5, fontWeight: 700, color: "var(--text-body)", marginBottom: 6 }}>
                    {loading ? "טוענים את תחזית הפנסיה…" : "אין עדיין נתוני פנסיה לתחזית"}
                  </div>
                  {!loading && (
                    <button onClick={() => navigate(APP_ROUTES.pension)} style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "var(--lav-100)", color: "var(--lav-700)", border: "1px solid var(--lav-200)", borderRadius: "var(--r-btn)", padding: "10px 18px", fontFamily: "inherit", fontWeight: 800, fontSize: 13.5, cursor: "pointer" }}>
                      חיבור נתוני פנסיה <ArrowLeft size={15} strokeWidth={2.4} />
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

          <div style={{ background: "var(--card)", border: "1px solid var(--border-hair)", borderRadius: "var(--radius)", boxShadow: "var(--shadow-soft)", padding: 24 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: "var(--text-strong)" }}>ממצאים אחרונים</h3>
              <button onClick={() => navigate(APP_ROUTES.financialHealth)} style={{ marginInlineStart: "auto", display: "inline-flex", alignItems: "center", gap: 4, background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", fontSize: 13.5, fontWeight: 700, color: "var(--accent)" }}>
                הכל <ArrowLeft size={15} strokeWidth={2.4} />
              </button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {rankedFindings.length === 0 && (
                <div style={{ display: "grid", placeItems: "center", padding: "36px 12px", textAlign: "center", color: "var(--text-muted)", fontSize: 14, fontWeight: 600 }}>
                  {loading ? "טוענים ממצאים…" : "אין ממצאים פתוחים — הכל נראה תקין."}
                </div>
              )}
              {rankedFindings.map((f, i) => {
                const rank = i + 1;
                const top = rank === 1;
                return (
                  <button key={f.id} onClick={() => navigate(APP_ROUTES.financialHealth)}
                    style={{ width: "100%", textAlign: "start", fontFamily: "inherit", cursor: "pointer", display: "flex", alignItems: "center", gap: 13, padding: "13px 15px", borderRadius: "var(--r-md)", border: top ? "0" : "1px solid var(--border-hair)", background: top ? "linear-gradient(95deg,var(--peach) 0%,var(--lav-200) 55%,var(--mint) 100%)" : "var(--surface-sunken)" }}>
                    <span style={{ width: 30, height: 30, borderRadius: 9, flex: "none", display: "grid", placeItems: "center", fontWeight: 900, fontSize: 13, background: top ? "rgba(255,255,255,.6)" : "var(--card)", color: "var(--ink)", boxShadow: "var(--shadow-soft)" }}>#{rank}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 800, fontSize: 14, color: "var(--ink)" }}>{f.title}</div>
                      <div style={{ fontSize: 12, color: top ? "var(--ink-soft)" : "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {DOMAIN_LABEL[domainOf(f)]}{f.details ? ` · ${f.details}` : ""}
                      </div>
                    </div>
                    <span style={{ fontWeight: 900, fontSize: 12.5, color: top ? "var(--ink)" : f.severity === "warning" ? "var(--peach-ink, #DA6F44)" : "var(--mint-ink)", whiteSpace: "nowrap" }}>
                      {f.severity === "warning" ? "לטיפול" : "מידע"}
                    </span>
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
