import type { ReactNode } from "react";
import { Check } from "lucide-react";
import "./agent-onboarding.css";

type AgentOptionCardProps = {
  label: string;
  hint?: string;
  selected?: boolean;
  multi?: boolean;
  disabled?: boolean;
  icon?: ReactNode;
  onClick: () => void;
};

/**
 * Choice row matching OnboardingPage OptionRow — agent-accent selection ring.
 */
export default function AgentOptionCard({
  label,
  hint,
  selected,
  multi = false,
  disabled = false,
  icon,
  onClick,
}: AgentOptionCardProps) {
  const isSelected = selected === true;

  return (
    <button
      type="button"
      className="agent-option-card"
      disabled={disabled}
      aria-pressed={multi || selected != null ? isSelected : undefined}
      onClick={onClick}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 14,
        width: "100%",
        textAlign: "start",
        padding: "17px 18px",
        borderRadius: "var(--r-btn)",
        cursor: disabled ? "not-allowed" : "pointer",
        fontFamily: "inherit",
        background: isSelected ? "var(--agent-soft, var(--accent-soft))" : "var(--card)",
        border: "1.5px solid " + (isSelected ? "var(--agent, var(--lav-500))" : "var(--border-soft)"),
        boxShadow: isSelected ? "0 0 0 4px var(--agent-bg, rgba(155,127,232,.12))" : "none",
        transition: "all .16s var(--ease)",
        opacity: disabled ? 0.65 : 1,
      }}
    >
      {icon && (
        <span
          style={{
            width: 38,
            height: 38,
            borderRadius: 9,
            flex: "none",
            display: "grid",
            placeItems: "center",
            background: isSelected ? "#fff" : "var(--surface-sunken)",
            color: "var(--agent, var(--lav-600))",
          }}
        >
          {icon}
        </span>
      )}
      <span style={{ flex: 1 }}>
        <span style={{ display: "block", fontSize: 15.5, fontWeight: 700, color: "var(--ink)" }}>{label}</span>
        {hint && (
          <span style={{ display: "block", fontSize: 12.5, color: "var(--text-muted)", marginTop: 2 }}>{hint}</span>
        )}
      </span>
      <span
        aria-hidden="true"
        style={{
          width: 24,
          height: 24,
          flex: "none",
          borderRadius: multi ? 7 : "50%",
          border: "2px solid " + (isSelected ? "var(--agent, var(--lav-600))" : "var(--border-soft)"),
          background: isSelected ? "var(--agent, var(--lav-600))" : "transparent",
          color: "#fff",
          display: "grid",
          placeItems: "center",
          transition: "all .16s var(--ease)",
        }}
      >
        {isSelected && <Check size={14} strokeWidth={3} />}
      </span>
    </button>
  );
}
