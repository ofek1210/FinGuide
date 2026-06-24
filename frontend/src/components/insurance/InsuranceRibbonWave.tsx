import { useEffect, useRef } from "react";

/**
 * InsuranceRibbonWave — a layered SVG ribbon background for the insurance agent.
 * Soft, diagonal, premium-fintech; evokes protection / coverage / trust. Fixed
 * full-bleed, behind page content (z-index 0), pointer-events:none. Drifts and
 * dims slightly on scroll. Uses only the brand tokens (lavender → peach → mint).
 */
export default function InsuranceRibbonWave() {
  const TUNE = {
    baseOpacity: 0.5,
    blur: 26,
    scrollDrift: 70,
    scrollFade: 0.16,
    scrollSpan: 700,
    angle: -9,
  };

  const groupRef = useRef<SVGGElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const p = Math.min(window.scrollY / TUNE.scrollSpan, 1);
        if (groupRef.current) {
          groupRef.current.setAttribute(
            "transform",
            `translate(${p * -28} ${p * TUNE.scrollDrift}) rotate(${TUNE.angle} 720 450)`,
          );
        }
        if (rootRef.current) {
          rootRef.current.style.opacity = String(TUNE.baseOpacity - p * TUNE.scrollFade);
        }
      });
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => { window.removeEventListener("scroll", onScroll); cancelAnimationFrame(raf); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      ref={rootRef}
      aria-hidden="true"
      style={{ position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none", overflow: "hidden", opacity: TUNE.baseOpacity, transition: "opacity .3s linear" }}
    >
      <svg viewBox="0 0 1440 900" preserveAspectRatio="xMidYMid slice" style={{ width: "100%", height: "100%", display: "block", filter: `blur(${TUNE.blur}px)` }}>
        <defs>
          <linearGradient id="rwCore" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#CDB6FF" />
            <stop offset="55%" stopColor="#E4D7FF" />
            <stop offset="100%" stopColor="#F8D2BE" />
          </linearGradient>
          <linearGradient id="rwDeep" x1="0" y1="0" x2="1" y2="0.6">
            <stop offset="0%" stopColor="#7C5FD6" />
            <stop offset="100%" stopColor="#DA6F44" />
          </linearGradient>
          <linearGradient id="rwCool" x1="0" y1="1" x2="1" y2="0">
            <stop offset="0%" stopColor="#C9ECD6" />
            <stop offset="100%" stopColor="#CDB6FF" />
          </linearGradient>
        </defs>
        <g ref={groupRef} transform={`rotate(${TUNE.angle} 720 450)`}>
          <path d="M-200 300 C 300 140, 760 460, 1660 180 L 1660 470 C 760 760, 300 520, -200 600 Z" fill="url(#rwCool)" opacity="0.62" />
          <path d="M-200 430 C 320 300, 820 560, 1660 320 L 1660 470 C 820 690, 320 470, -200 560 Z" fill="url(#rwDeep)" opacity="0.4" />
          <path d="M-200 360 C 340 210, 800 520, 1660 250 L 1660 430 C 800 660, 340 430, -200 520 Z" fill="url(#rwCore)" opacity="0.85" />
        </g>
      </svg>
    </div>
  );
}
