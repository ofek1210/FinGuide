import type { CSSProperties, ReactNode } from "react";

interface GlassCardProps {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  /** Extra padding preset: "sm" | "md" | "lg" */
  padding?: "sm" | "md" | "lg" | "none";
  /** Stronger glass effect */
  elevated?: boolean;
  onClick?: () => void;
}

const padMap = { none: "0", sm: "16px 20px", md: "24px 28px", lg: "32px 36px" };

export default function GlassCard({
  children, className = "", style, padding = "md", elevated = false, onClick,
}: GlassCardProps) {
  return (
    <div
      className={className}
      onClick={onClick}
      style={{
        background: elevated
          ? "rgba(255,255,255,0.92)"
          : "rgba(255,255,255,0.75)",
        backdropFilter: "blur(16px) saturate(180%)",
        WebkitBackdropFilter: "blur(16px) saturate(180%)",
        border: "1px solid rgba(184,157,255,0.22)",
        borderRadius: "var(--lg-r-lg, 24px)",
        boxShadow: elevated
          ? "0 8px 40px rgba(155,127,232,0.18), 0 2px 8px rgba(0,0,0,0.05)"
          : "0 4px 24px rgba(155,127,232,0.12), 0 1px 4px rgba(0,0,0,0.04)",
        padding: padMap[padding],
        cursor: onClick ? "pointer" : undefined,
        transition: onClick ? "box-shadow 0.2s, transform 0.2s" : undefined,
        ...style,
      }}
    >
      {children}
    </div>
  );
}
