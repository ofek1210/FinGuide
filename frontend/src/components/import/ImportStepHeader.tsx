import { ArrowLeft } from "lucide-react";
import type { ReactNode } from "react";

type ImportStepHeaderProps = {
  stepBadge: string;
  title: string;
  subtitle?: ReactNode;
  accentColor: string;
  onBack?: () => void;
  children?: ReactNode;
};

export function ImportStepHeader({
  stepBadge,
  title,
  subtitle,
  accentColor,
  onBack,
  children,
}: ImportStepHeaderProps) {
  return (
    <div style={{ marginBottom: onBack ? 32 : 36 }}>
      {onBack ? (
        <button
          type="button"
          onClick={onBack}
          style={{
            display: "flex", alignItems: "center", gap: 6,
            background: "none", border: "none", color: "#7C6FA0",
            cursor: "pointer", fontFamily: "inherit", fontWeight: 600, fontSize: 14, marginBottom: 20,
          }}
        >
          <ArrowLeft size={14} /> חזרה
        </button>
      ) : null}
      <div style={{
        display: "inline-flex", alignItems: "center", gap: 6,
        background: `${accentColor}1A`, border: `1px solid ${accentColor}38`,
        borderRadius: 20, padding: "4px 14px", marginBottom: 14,
      }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: accentColor }}>{stepBadge}</span>
      </div>
      <h1 style={{
        fontFamily: "'Fraunces', Georgia, serif",
        fontSize: "clamp(22px, 3.5vw, 30px)",
        fontWeight: 700, color: "#1F1F1F", margin: "0 0 10px", letterSpacing: "-0.03em",
      }}>
        {title}
      </h1>
      {subtitle ? (
        <p style={{ fontSize: 15, color: "#7C6FA0", margin: children ? "0 0 16px" : 0, lineHeight: 1.6 }}>
          {subtitle}
        </p>
      ) : null}
      {children}
    </div>
  );
}
