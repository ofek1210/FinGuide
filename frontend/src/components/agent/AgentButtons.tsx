import type { ButtonHTMLAttributes, CSSProperties, ReactNode } from "react";
import "./agent-onboarding.css";

const base: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 9,
  padding: "15px 28px",
  borderRadius: "var(--r-btn)",
  fontFamily: "inherit",
  fontWeight: 800,
  fontSize: 15.5,
  cursor: "pointer",
  transition: "transform .25s var(--ease), box-shadow .25s var(--ease), opacity .16s var(--ease), border-color .25s var(--ease)",
};

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  size?: "md" | "sm";
};

export function AgentPrimaryButton({
  children,
  size = "md",
  style,
  disabled,
  className,
  onMouseEnter,
  onMouseLeave,
  ...rest
}: BtnProps) {
  return (
    <button
      type="button"
      disabled={disabled}
      className={`agent-onboarding-button agent-onboarding-button--primary${className ? ` ${className}` : ""}`}
      {...rest}
      style={{
        ...base,
        padding: size === "sm" ? "11px 20px" : base.padding,
        fontSize: size === "sm" ? 14 : 15.5,
        border: "1px solid transparent",
        color: "#fff",
        background: "var(--ink)",
        boxShadow: disabled ? "none" : "var(--shadow-ink)",
        opacity: disabled ? 0.7 : 1,
        cursor: disabled ? "not-allowed" : "pointer",
        minHeight: size === "sm" ? 42 : 50,
        ...style,
      }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      {children}
    </button>
  );
}

export function AgentGhostButton({
  children,
  size = "md",
  style,
  disabled,
  className,
  onMouseEnter,
  onMouseLeave,
  ...rest
}: BtnProps) {
  return (
    <button
      type="button"
      disabled={disabled}
      className={`agent-onboarding-button agent-onboarding-button--ghost${className ? ` ${className}` : ""}`}
      {...rest}
      style={{
        ...base,
        padding: size === "sm" ? "11px 20px" : base.padding,
        fontSize: size === "sm" ? 14 : 15,
        border: "1px solid var(--border-soft)",
        background: "var(--card)",
        color: "var(--text-body)",
        boxShadow: "var(--shadow-soft)",
        opacity: disabled ? 0.7 : 1,
        cursor: disabled ? "not-allowed" : "pointer",
        minHeight: size === "sm" ? 42 : 50,
        ...style,
      }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      {children}
    </button>
  );
}
