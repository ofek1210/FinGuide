import type { ReactNode } from "react";
import { Lock } from "lucide-react";
import { agentById, type AgentId } from "../../theme/agents";
import { AgentGhostButton, AgentPrimaryButton } from "./AgentButtons";
import "./agent-onboarding.css";

type AgentLandingHeroProps = {
  agentId: AgentId;
  /** Override pill label (defaults to hubTitle). */
  pill?: string;
  title: ReactNode;
  subtitle: ReactNode;
  primaryLabel: string;
  primaryIcon?: ReactNode;
  onPrimary: () => void;
  secondaryLabel?: string;
  secondaryIcon?: ReactNode;
  onSecondary?: () => void;
  trustNote?: ReactNode;
  /** Optional right-side visual (preview card, illustration). */
  visual?: ReactNode;
};

/**
 * First-run agent landing — asymmetric hero matching InsuranceLandingScreen.
 * Colors come from agents.ts via agentId; page should set data-agent too.
 */
export default function AgentLandingHero({
  agentId,
  pill,
  title,
  subtitle,
  primaryLabel,
  primaryIcon,
  onPrimary,
  secondaryLabel,
  secondaryIcon,
  onSecondary,
  trustNote,
  visual,
}: AgentLandingHeroProps) {
  const agent = agentById(agentId);
  const pillLabel = pill ?? agent.hubTitle;

  return (
    <main className="agent-landing" aria-labelledby={`${agentId}-landing-title`}>
      <div
        className={`agent-landing__grid${visual ? "" : " agent-landing__grid--single"}`}
        style={{
          background: `radial-gradient(circle at 12% 18%, color-mix(in srgb, ${agent.tone.soft} 72%, transparent), transparent 34%)`,
        }}
      >
        <div className="agent-landing__copy">
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "6px 13px 6px 10px",
              borderRadius: 999,
              background: agent.tone.soft,
              border: `1px solid color-mix(in srgb, ${agent.tone.ring} 35%, transparent)`,
              fontSize: 13,
              fontWeight: 800,
              color: agent.tone.accent,
              letterSpacing: "-.01em",
            }}
          >
            <span style={{ width: 7, height: 7, borderRadius: "50%", background: agent.tone.accent }} />
            {pillLabel}
          </span>
          <h1
            id={`${agentId}-landing-title`}
            className="agent-landing__title"
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "clamp(34px,4.4vw,54px)",
              fontWeight: 900,
              letterSpacing: "-.04em",
              lineHeight: 1.02,
              margin: "20px 0 18px",
              color: "var(--text-strong)",
            }}
          >
            {title}
          </h1>
          <p
            className="agent-landing__subtitle"
            style={{
              fontSize: 18,
              color: "var(--text-muted)",
              lineHeight: 1.6,
              fontWeight: 500,
              margin: "0 0 30px",
              maxWidth: 440,
            }}
          >
            {subtitle}
          </p>
          <div className="agent-landing__actions">
            <AgentPrimaryButton onClick={onPrimary}>
              {primaryIcon}
              {primaryLabel}
            </AgentPrimaryButton>
            {secondaryLabel && onSecondary && (
              <AgentGhostButton onClick={onSecondary}>
                {secondaryIcon}
                {secondaryLabel}
              </AgentGhostButton>
            )}
          </div>
          {trustNote && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 9,
                marginTop: 22,
                fontSize: 13,
                color: "var(--text-faint)",
                fontWeight: 600,
              }}
            >
              <Lock size={15} color={agent.tone.accent} aria-hidden="true" />
              <span>{trustNote}</span>
            </div>
          )}
        </div>

        {visual && (
          <div
            className="agent-landing__visual"
            style={{
              position: "relative",
              background: "var(--card)",
              border: "1px solid var(--border-hair)",
              borderRadius: "var(--r-card)",
              boxShadow: "var(--shadow-card)",
              padding: "20px 20px 18px",
              backgroundImage: "radial-gradient(color-mix(in srgb, var(--agent, var(--lav-600)) 5%, transparent) 1px, transparent 1px)",
              backgroundSize: "18px 18px",
            }}
          >
            {visual}
          </div>
        )}
      </div>
    </main>
  );
}
