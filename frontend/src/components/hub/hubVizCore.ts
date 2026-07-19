import { useEffect, useRef, useState } from "react";
import type { AgentId } from "../../theme/agents";

/* ============================================================
   hubVizCore — the non-component half of the Hub's visual kit:
   tone mapping, textures, svg path helpers and animation hooks.
   (Split from hubViz.tsx so fast-refresh sees pure components.)
   ============================================================ */

export type Tone = "lavender" | "peach" | "mint" | "butter";

export const AGENT_TONE: Record<AgentId, Tone> = {
  payslips: "lavender",
  insurance: "peach",
  pension: "mint",
  gemel: "butter",
};

/** Dot-grid texture used on the sunken showcase cards. */
export const DOT = "radial-gradient(rgba(123,95,214,.10) 1px,transparent 1px)";

/* ── hooks ───────────────────────────────────────────────────── */
export function useInView<T extends HTMLElement>(): [React.RefObject<T | null>, boolean] {
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

export function useCountUp(target: number, run: boolean, dur = 1300) {
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

/* ── svg helpers ─────────────────────────────────────────────── */
export function smooth(pts: number[][]): string {
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
export const uid = () => "fg" + (++_uid);
