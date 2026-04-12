import {
  BarChart3,
  FileText,
  Mail,
  ScanLine,
  ShieldCheck,
  TrendingUp,
  Wand2,
} from "lucide-react";

/**
 * Hero decorative visual — single “dashboard” card, brand purple gradient, subtle motion.
 */
export default function HeroMediaAnimation() {
  return (
    <div className="hero-media-animation" aria-hidden="true">
      <div className="hero-media-float-icons">
        <FileText className="hero-float-icon hero-float-icon--1" strokeWidth={1.45} />
        <Wand2 className="hero-float-icon hero-float-icon--2" strokeWidth={1.45} />
        <BarChart3 className="hero-float-icon hero-float-icon--3" strokeWidth={1.45} />
        <ShieldCheck className="hero-float-icon hero-float-icon--4" strokeWidth={1.45} />
        <Mail className="hero-float-icon hero-float-icon--5" strokeWidth={1.45} />
        <TrendingUp className="hero-float-icon hero-float-icon--6" strokeWidth={1.45} />
        <ScanLine className="hero-float-icon hero-float-icon--7" strokeWidth={1.45} />
      </div>
      <svg
        className="hero-media-svg"
        viewBox="0 0 400 400"
        preserveAspectRatio="xMidYMid meet"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id="hero-brand-line" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="var(--hero-svg-accent, #5a56f6)" />
            <stop offset="100%" stopColor="var(--hero-svg-accent-2, #a646e8)" />
          </linearGradient>
          <linearGradient id="hero-brand-fill" x1="0%" y1="100%" x2="0%" y2="0%">
            <stop offset="0%" stopColor="var(--hero-svg-accent, #5a56f6)" stopOpacity="0.25" />
            <stop offset="100%" stopColor="var(--hero-svg-accent-2, #a646e8)" stopOpacity="0.45" />
          </linearGradient>
          <linearGradient id="hero-bar-fill" x1="0%" y1="100%" x2="0%" y2="0%">
            <stop offset="0%" stopColor="var(--hero-svg-accent, #5a56f6)" />
            <stop offset="100%" stopColor="var(--hero-svg-accent-2, #a646e8)" />
          </linearGradient>
          <pattern
            id="hero-grid"
            width="28"
            height="28"
            patternUnits="userSpaceOnUse"
          >
            <path
              d="M 28 0 L 0 0 0 28"
              fill="none"
              stroke="var(--hero-svg-grid, rgba(90, 86, 246, 0.14))"
              strokeWidth="0.55"
            />
          </pattern>
        </defs>

        {/* Base */}
        <rect width="400" height="400" fill="var(--hero-svg-base, rgba(15, 23, 42, 0.5))" />
        <rect
          x="-24"
          y="-24"
          width="448"
          height="448"
          fill="url(#hero-grid)"
          className="hero-anim-grid"
        />

        {/* Ambient glow — one soft spot, matches landing hero */}
        <circle
          cx="200"
          cy="155"
          r="120"
          fill="url(#hero-brand-fill)"
          className="hero-anim-glow-orb"
        />

        {/* Single main card */}
        <g className="hero-anim-card">
          <rect
            x="56"
            y="88"
            width="288"
            height="224"
            rx="18"
            fill="var(--hero-svg-card-fill, rgba(255, 255, 255, 0.06))"
            stroke="var(--hero-svg-card-stroke, rgba(166, 70, 232, 0.35))"
            strokeWidth="1.25"
          />

          {/* Top: trend line + soft area */}
          <path
            className="hero-anim-area"
            d="M 88 200 C 128 168 152 212 192 184 C 232 156 264 176 312 158 L 312 228 L 88 228 Z"
            fill="url(#hero-brand-fill)"
            opacity="0.35"
          />
          <path
            className="hero-anim-trend"
            d="M 88 200 C 128 168 152 212 192 184 C 232 156 264 176 312 158"
            fill="none"
            stroke="url(#hero-brand-line)"
            strokeWidth="2.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Divider */}
          <line
            x1="88"
            y1="236"
            x2="312"
            y2="236"
            stroke="var(--hero-svg-divider, rgba(255, 255, 255, 0.08))"
            strokeWidth="1"
          />

          {/* Bottom: four bars — shared baseline (y=300) inside card */}
          <g>
            <rect
              className="hero-bar hero-bar-1"
              x="92"
              y="248"
              width="36"
              height="52"
              rx="6"
              fill="url(#hero-bar-fill)"
              opacity="0.92"
            />
            <rect
              className="hero-bar hero-bar-2"
              x="144"
              y="238"
              width="36"
              height="62"
              rx="6"
              fill="url(#hero-bar-fill)"
              opacity="0.88"
            />
            <rect
              className="hero-bar hero-bar-3"
              x="196"
              y="244"
              width="36"
              height="56"
              rx="6"
              fill="url(#hero-bar-fill)"
              opacity="0.9"
            />
            <rect
              className="hero-bar hero-bar-4"
              x="248"
              y="232"
              width="36"
              height="68"
              rx="6"
              fill="url(#hero-bar-fill)"
              opacity="0.95"
            />
          </g>

          {/* Corner accent — small “live” dot */}
          <circle
            className="hero-anim-live-dot"
            cx="318"
            cy="108"
            r="5"
            fill="var(--hero-svg-accent-2, #a646e8)"
          />
        </g>
      </svg>
    </div>
  );
}
