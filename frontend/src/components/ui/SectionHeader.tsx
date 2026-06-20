import type { ReactNode } from "react";

interface SectionHeaderProps {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  align?: "right" | "center" | "left";
}

export default function SectionHeader({ title, subtitle, action, align = "right" }: SectionHeaderProps) {
  return (
    <div style={{
      display: "flex",
      alignItems: align === "center" ? "center" : "flex-end",
      justifyContent: "space-between",
      flexDirection: align === "center" ? "column" : "row",
      gap: 8,
      marginBottom: 24,
    }}>
      <div style={{ textAlign: align === "center" ? "center" : undefined }}>
        <h2 style={{
          fontFamily: "var(--lg-font-display, Georgia, serif)",
          fontSize: "clamp(20px, 3vw, 26px)",
          fontWeight: 700,
          color: "var(--lg-text, #1F1F1F)",
          margin: 0,
          letterSpacing: "-0.025em",
          lineHeight: 1.2,
        }}>
          {title}
        </h2>
        {subtitle && (
          <p style={{
            fontSize: 14,
            color: "var(--lg-muted, #7C6FA0)",
            margin: "6px 0 0",
            lineHeight: 1.5,
          }}>
            {subtitle}
          </p>
        )}
      </div>
      {action && <div style={{ flexShrink: 0 }}>{action}</div>}
    </div>
  );
}
