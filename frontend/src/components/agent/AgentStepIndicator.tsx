import { Check } from "lucide-react";
import "./agent-onboarding.css";

export type AgentStepState = "done" | "active" | "todo";

export type AgentStepItem = {
  label: string;
  state: AgentStepState;
};

/**
 * Horizontal step pills — extracted from PayslipsAgentPage StepIndicator.
 * Uses --agent tokens when data-agent is set on the page.
 */
export default function AgentStepIndicator({ steps }: { steps: AgentStepItem[] }) {
  return (
    <ol className="agent-step-indicator" aria-label="התקדמות בתהליך">
      {steps.map((s, i) => (
        <li
          key={s.label}
          className="agent-step-indicator__item"
          aria-current={s.state === "active" ? "step" : undefined}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
            <span
              style={{
                width: 30,
                height: 30,
                borderRadius: "50%",
                display: "grid",
                placeItems: "center",
                fontWeight: 800,
                fontSize: 13,
                flex: "none",
                background:
                  s.state === "active"
                    ? "var(--ink)"
                    : s.state === "done"
                      ? "var(--agent-soft, var(--lav-100))"
                      : "transparent",
                color:
                  s.state === "active"
                    ? "#fff"
                    : s.state === "done"
                      ? "var(--agent, var(--lav-600))"
                      : "var(--text-faint)",
                border: s.state === "todo" ? "1.5px solid var(--border-soft)" : "none",
              }}
            >
              {s.state === "done" ? <Check size={15} strokeWidth={3} /> : i + 1}
            </span>
            <span
              style={{
                fontSize: 13,
                fontWeight: 700,
                color: s.state === "active" ? "var(--ink)" : "var(--text-faint)",
              }}
            >
              {s.label}
            </span>
          </div>
          {i < steps.length - 1 && (
            <div
              className="agent-step-indicator__connector"
              aria-hidden="true"
              style={{
                background: s.state === "done" ? "var(--agent-ring, var(--lav-300))" : "var(--hair)",
              }}
            />
          )}
        </li>
      ))}
    </ol>
  );
}
