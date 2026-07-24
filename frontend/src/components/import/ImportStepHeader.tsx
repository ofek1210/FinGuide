import { ChevronRight } from "lucide-react";
import type { ReactNode } from "react";
import "../agent/agent-onboarding.css";

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
          className="agent-onboarding-button"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            background: "none",
            border: "none",
            color: "var(--text-muted)",
            cursor: "pointer",
            fontFamily: "inherit",
            fontWeight: 600,
            fontSize: 14,
            marginBottom: 20,
            padding: "4px 2px",
            borderRadius: "var(--r-btn)",
          }}
        >
          <ChevronRight size={14} /> חזרה
        </button>
      ) : null}
      <div
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          background: "var(--agent-soft, var(--lav-100))",
          border: "1px solid var(--agent-ring, var(--lav-200))",
          borderRadius: 999,
          padding: "4px 14px",
          marginBottom: 14,
        }}
      >
        <span style={{ fontSize: 13, fontWeight: 700, color: accentColor || "var(--agent, var(--lav-600))" }}>
          {stepBadge}
        </span>
      </div>
      <h1
        style={{
          fontFamily: "var(--font-display)",
          fontSize: "clamp(22px, 3.5vw, 30px)",
          fontWeight: 900,
          color: "var(--text-strong)",
          margin: "0 0 10px",
          letterSpacing: "-0.03em",
        }}
      >
        {title}
      </h1>
      {subtitle ? (
        <p
          style={{
            fontSize: 15,
            color: "var(--text-muted)",
            margin: children ? "0 0 16px" : 0,
            lineHeight: 1.6,
            fontWeight: 500,
          }}
        >
          {subtitle}
        </p>
      ) : null}
      {children}
    </div>
  );
}
