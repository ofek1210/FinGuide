import { useEffect, useRef } from "react";

/**
 * DocumentsRibbonWave — layered SVG ribbon background for the payslip/document
 * upload page. Same engine as the insurance ribbon, tuned to the payslip-agent
 * palette: lavender (documents) → mint (salary) → butter (warmth). Fixed
 * full-bleed, behind content (z-index 0), pointer-events:none; drifts/dims on
 * scroll. Brand tokens only.
 */
export default function DocumentsRibbonWave() {
  const TUNE = { baseOpacity: 0.48, blur: 28, scrollDrift: 64, scrollFade: 0.18, scrollSpan: 680, angle: -8 };
  const groupRef = useRef<SVGGElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const p = Math.min(window.scrollY / TUNE.scrollSpan, 1);
        if (groupRef.current) groupRef.current.setAttribute("transform", `translate(${p * -26} ${p * TUNE.scrollDrift}) rotate(${TUNE.angle} 720 450)`);
        if (rootRef.current) rootRef.current.style.opacity = String(TUNE.baseOpacity - p * TUNE.scrollFade);
      });
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => { window.removeEventListener("scroll", onScroll); cancelAnimationFrame(raf); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div ref={rootRef} aria-hidden="true" style={{ position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none", overflow: "hidden", opacity: TUNE.baseOpacity, transition: "opacity .3s linear" }}>
      <svg viewBox="0 0 1440 900" preserveAspectRatio="xMidYMid slice" style={{ width: "100%", height: "100%", display: "block", filter: `blur(${TUNE.blur}px)` }}>
        <defs>
          <linearGradient id="dwCore" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#CDB6FF" /><stop offset="52%" stopColor="#E4D7FF" /><stop offset="100%" stopColor="#C9ECD6" />
          </linearGradient>
          <linearGradient id="dwDeep" x1="0" y1="0" x2="1" y2="0.6">
            <stop offset="0%" stopColor="#7C5FD6" /><stop offset="100%" stopColor="#2F9C62" />
          </linearGradient>
          <linearGradient id="dwWarm" x1="0" y1="1" x2="1" y2="0">
            <stop offset="0%" stopColor="#F6E4A8" /><stop offset="100%" stopColor="#CDB6FF" />
          </linearGradient>
        </defs>
        <g ref={groupRef} transform={`rotate(${TUNE.angle} 720 450)`}>
          <path d="M-200 300 C 300 140, 760 460, 1660 180 L 1660 470 C 760 760, 300 520, -200 600 Z" fill="url(#dwWarm)" opacity="0.55" />
          <path d="M-200 430 C 320 300, 820 560, 1660 320 L 1660 470 C 820 690, 320 470, -200 560 Z" fill="url(#dwDeep)" opacity="0.38" />
          <path d="M-200 360 C 340 210, 800 520, 1660 250 L 1660 430 C 800 660, 340 430, -200 520 Z" fill="url(#dwCore)" opacity="0.85" />
        </g>
      </svg>
    </div>
  );
}
