import type { ReactNode } from "react";

type Variant = "high" | "medium" | "low" | "success" | "info" | "neutral";

interface BadgeProps {
  variant?: Variant;
  children: ReactNode;
  size?: "sm" | "md";
}

const styles: Record<Variant, { bg: string; color: string; border: string }> = {
  high:    { bg: "#FEF2F2", color: "#DC2626", border: "rgba(220,38,38,0.2)" },
  medium:  { bg: "#FFFBEB", color: "#D97706", border: "rgba(217,119,6,0.2)" },
  low:     { bg: "#ECFDF5", color: "#059669", border: "rgba(5,150,105,0.2)" },
  success: { bg: "#ECFDF5", color: "#059669", border: "rgba(5,150,105,0.2)" },
  info:    { bg: "#F3EEFF", color: "#9B7FE8", border: "rgba(155,127,232,0.25)" },
  neutral: { bg: "rgba(184,157,255,0.12)", color: "#7C6FA0", border: "rgba(184,157,255,0.25)" },
};

export default function Badge({ variant = "neutral", children, size = "sm" }: BadgeProps) {
  const s = styles[variant];
  return (
    <span style={{
      display: "inline-flex", alignItems: "center",
      padding: size === "sm" ? "3px 9px" : "5px 13px",
      fontSize: size === "sm" ? 11.5 : 13,
      fontWeight: 700,
      borderRadius: 999,
      background: s.bg,
      color: s.color,
      border: `1px solid ${s.border}`,
      whiteSpace: "nowrap" as const,
      letterSpacing: "0.01em",
    }}>
      {children}
    </span>
  );
}
