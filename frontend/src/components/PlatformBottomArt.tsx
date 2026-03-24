import type { ReactNode } from "react";

/**
 * Abstract “fintech / isometric neon” panels — no bitmap assets, brand-aligned.
 */
type ArtSlot = "left" | "center" | "right";

const svgProps = {
  className: "platform-bottom-art-svg",
  viewBox: "0 0 320 200",
  preserveAspectRatio: "xMidYMid meet" as const,
  xmlns: "http://www.w3.org/2000/svg",
  "aria-hidden": true as const,
};

/** מגדיל מעט את הציור בתוך המסגרת */
function ArtScene({ children }: { children: ReactNode }) {
  return (
    <g transform="translate(160 100) scale(1.08) translate(-160 -100)">{children}</g>
  );
}

export default function PlatformBottomArt({ variant }: { variant: ArtSlot }) {
  if (variant === "left") {
    return (
      <svg {...svgProps}>
        <defs>
          <linearGradient id="pba-shield" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="var(--platform-art-accent, #5a56f6)" stopOpacity="0.9" />
            <stop offset="100%" stopColor="var(--platform-art-accent-2, #a646e8)" stopOpacity="0.75" />
          </linearGradient>
        </defs>
        <ArtScene>
          <ellipse cx="160" cy="168" rx="120" ry="14" fill="rgba(90, 86, 246, 0.14)" />
          <ellipse
            cx="160"
            cy="100"
            rx="88"
            ry="88"
            fill="none"
            stroke="rgba(45, 212, 191, 0.28)"
            strokeWidth="1"
            strokeDasharray="6 10"
            className="platform-bottom-art-orbit"
          />
          <ellipse
            cx="160"
            cy="100"
            rx="62"
            ry="62"
            fill="none"
            stroke="rgba(166, 70, 232, 0.4)"
            strokeWidth="1"
            strokeDasharray="4 8"
            className="platform-bottom-art-orbit platform-bottom-art-orbit--slow"
          />
          <path
            d="M 160 52 L 210 78 V 128 C 210 152 160 168 160 168 C 160 168 110 152 110 128 V 78 Z"
            fill="url(#pba-shield)"
            opacity="0.88"
          />
          <path
            d="M 160 72 L 190 88 V 118 C 190 132 160 142 160 142 C 160 142 130 132 130 118 V 88 Z"
            fill="rgba(30, 41, 59, 0.65)"
            stroke="rgba(255,255,255,0.14)"
            strokeWidth="1"
          />
          <circle cx="160" cy="108" r="5" fill="rgba(45, 212, 191, 0.7)" className="platform-bottom-art-pulse" />
        </ArtScene>
      </svg>
    );
  }

  if (variant === "center") {
    return (
      <svg {...svgProps}>
        <defs>
          <linearGradient id="pba-phone-frame" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#a646e8" />
            <stop offset="100%" stopColor="#5a56f6" />
          </linearGradient>
        </defs>
        <ArtScene>
          <ellipse cx="160" cy="182" rx="56" ry="9" fill="rgba(90, 86, 246, 0.18)" />
          <rect
            x="102"
            y="24"
            width="116"
            height="176"
            rx="20"
            fill="rgba(90, 86, 246, 0.06)"
            stroke="url(#pba-phone-frame)"
            strokeWidth="2.75"
          />
          <rect
            x="114"
            y="40"
            width="92"
            height="136"
            rx="12"
            fill="rgba(15, 23, 42, 0.45)"
            stroke="rgba(45, 212, 191, 0.5)"
            strokeWidth="1.5"
          />
          <rect x="126" y="50" width="36" height="5" rx="2.5" fill="rgba(255, 255, 255, 0.28)" />
          <circle cx="192" cy="52.5" r="3.5" fill="rgba(166, 70, 232, 0.95)" />
          <line
            x1="126"
            y1="72"
            x2="194"
            y2="72"
            stroke="rgba(255, 255, 255, 0.4)"
            strokeWidth="3.5"
            strokeLinecap="round"
          />
          <line
            x1="126"
            y1="90"
            x2="176"
            y2="90"
            stroke="rgba(255, 255, 255, 0.22)"
            strokeWidth="3"
            strokeLinecap="round"
          />
          <line
            x1="126"
            y1="106"
            x2="188"
            y2="106"
            stroke="rgba(255, 255, 255, 0.22)"
            strokeWidth="3"
            strokeLinecap="round"
          />
          <g transform="translate(0 4)">
            <rect x="128" y="118" width="14" height="28" rx="3" fill="#5a56f6" opacity="0.9" />
            <rect x="148" y="110" width="14" height="36" rx="3" fill="#a646e8" opacity="0.9" />
            <rect x="168" y="122" width="14" height="24" rx="3" fill="rgba(45, 212, 191, 0.85)" />
            <rect x="188" y="114" width="14" height="32" rx="3" fill="#5a56f6" opacity="0.75" />
          </g>
          <rect x="138" y="188" width="44" height="5" rx="2.5" fill="rgba(255, 255, 255, 0.22)" />
        </ArtScene>
      </svg>
    );
  }

  return (
    <svg {...svgProps}>
      <defs>
        <linearGradient id="pba-bar" x1="0%" y1="100%" x2="0%" y2="0%">
          <stop offset="0%" stopColor="#5a56f6" />
          <stop offset="100%" stopColor="#a646e8" />
        </linearGradient>
      </defs>
      <ArtScene>
        <path
          d="M 48 148 L 272 148 L 280 168 L 40 168 Z"
          fill="rgba(90, 86, 246, 0.1)"
          stroke="rgba(45, 212, 191, 0.18)"
          strokeWidth="0.9"
        />
        <g className="platform-bottom-art-bars">
          <rect x="72" y="112" width="28" height="36" rx="4" fill="url(#pba-bar)" opacity="0.88" />
          <rect x="116" y="96" width="28" height="52" rx="4" fill="url(#pba-bar)" opacity="0.94" />
          <rect x="160" y="104" width="28" height="44" rx="4" fill="url(#pba-bar)" opacity="0.9" />
          <rect x="204" y="88" width="28" height="60" rx="4" fill="url(#pba-bar)" opacity="0.98" />
        </g>
        <rect
          x="210"
          y="52"
          width="72"
          height="48"
          rx="8"
          fill="rgba(255,255,255,0.06)"
          stroke="rgba(166, 70, 232, 0.4)"
          strokeWidth="1"
          transform="rotate(-8 246 76)"
        />
        <rect
          x="218"
          y="60"
          width="56"
          height="6"
          rx="2"
          fill="rgba(255,255,255,0.14)"
          transform="rotate(-8 246 76)"
        />
        <rect
          x="218"
          y="72"
          width="40"
          height="4"
          rx="1"
          fill="rgba(255,255,255,0.1)"
          transform="rotate(-8 246 76)"
        />
        <circle
          cx="118"
          cy="64"
          r="22"
          fill="none"
          stroke="rgba(45, 212, 191, 0.42)"
          strokeWidth="3"
          strokeDasharray="40 80"
          className="platform-bottom-art-donut"
        />
      </ArtScene>
    </svg>
  );
}
