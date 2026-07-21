import { useRef } from "react";
import { smooth, uid, useCountUp, useInView, type Tone } from "./hubVizCore";

/* ============================================================
   Shared visual atoms for the Hub — gauge and sparkline, in the
   FinGuide design language. Non-component helpers (tones, hooks,
   svg utils) live in hubVizCore.ts.
   ============================================================ */

/* ── Radial gauge ────────────────────────────────────────────── */
export function RadialGauge({ value, max = 100, sub, tone = "lavender", size = 148, onDark = false }: { value: number; max?: number; sub?: string; tone?: Tone; size?: number; onDark?: boolean }) {
  const [ref, seen] = useInView<HTMLDivElement>();
  const id = useRef(uid()).current;
  const grads: Record<Tone, [string, string]> = {
    lavender: ["#9B7FE8", "#6F8BE8"], mint: ["#48C98B", "#2F9C62"], peach: ["#F4A87E", "#DA6F44"], butter: ["#E5C35C", "#B98B16"],
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
export function Sparkline({ points, tone = "mint", w = 78, h = 30 }: { points: number[]; tone?: Tone; w?: number; h?: number }) {
  const id = useRef(uid()).current;
  const max = Math.max(...points), min = Math.min(...points);
  const pts = points.map((v, i) => [(i / (points.length - 1)) * w, h - ((v - min) / (max - min || 1)) * (h - 8) - 4]);
  const cols: Record<Tone, [string, string]> = { mint: ["#48C98B", "#2F9C62"], peach: ["#F4A87E", "#DA6F44"], lavender: ["#B49BF0", "#7C5FD6"], butter: ["#E5C35C", "#B98B16"] };
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
