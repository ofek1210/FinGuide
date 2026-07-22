/**
 * AgentOnboardingStep — full-page onboarding gate inside an agent flow.
 * Replaces the floating modal: document → short Q&A → analysis unlocks after.
 */
import { Check } from "lucide-react";
import type { AgentId } from "../../api/smartOnboarding.api";
import AgentOnboardingFlow from "./AgentOnboardingFlow";
import { getAgentOnboardingTheme } from "./agentOnboardingTheme";

type FlowPhase = "document" | "questions" | "analysis";

type Props = {
  agentId: AgentId;
  agentLabel?: string;
  estimatedMinutes?: number;
  questions: Parameters<typeof AgentOnboardingFlow>[0]["questions"];
  /** Which phases to show in the step rail (default: all three, document marked done). */
  phases?: FlowPhase[];
  activePhase?: FlowPhase;
  onSkip: () => void | Promise<void>;
  onSubmit: (answers: Record<string, unknown>) => Promise<boolean>;
  headline?: string;
  subhead?: string;
};

const PHASE_LABELS: Record<FlowPhase, string> = {
  document: "מסמך",
  questions: "שאלון קצר",
  analysis: "ניתוח והמלצות",
};

export default function AgentOnboardingStep({
  agentId,
  agentLabel,
  estimatedMinutes,
  questions,
  phases = ["document", "questions", "analysis"],
  activePhase = "questions",
  onSkip,
  onSubmit,
  headline,
  subhead,
  compactTop = false,
}: Props & { compactTop?: boolean }) {
  const theme = getAgentOnboardingTheme(agentId);
  const label = agentLabel ?? theme.label;

  return (
    <main style={{ maxWidth: 680, margin: "0 auto", padding: compactTop ? "0 24px 88px" : "44px 24px 88px", direction: "rtl", fontFamily: "var(--font-body)" }}>
      {!compactTop && <FlowStepper phases={phases} active={activePhase} accent={theme.accent} soft={theme.soft} />}

      <div style={{ textAlign: "center", marginBottom: 32 }}>
        <span style={{
          display: "inline-flex", alignItems: "center", gap: 8,
          padding: "6px 14px", borderRadius: 999,
          background: theme.soft, border: `1px solid ${theme.ring}`,
          color: theme.accent, fontSize: 12.5, fontWeight: 800, marginBottom: 16,
        }}>
          {theme.emoji} סוכן {label}
        </span>
        <h1 style={{
          margin: "0 0 12px", fontSize: "clamp(26px,3.2vw,38px)", fontWeight: 900,
          letterSpacing: "-.035em", lineHeight: 1.1, color: "var(--text-strong)",
        }}>
          {headline ?? "עוד רגע — כמה שאלות קצרות"}
        </h1>
        <p style={{
          margin: 0, fontSize: 16, color: "var(--text-muted)", lineHeight: 1.6,
          fontWeight: 500, maxWidth: 460, marginInline: "auto",
        }}>
          {subhead ?? "נשאל רק מה שחסר כדי שהסוכן יוכל לנתח ולהציג לך תוצאות מדויקות. אחרי השאלון — ייפתח הניתוח המלא."}
        </p>
      </div>

      <AgentOnboardingFlow
        agentId={agentId}
        agentLabel={label}
        estimatedMinutes={estimatedMinutes}
        questions={questions}
        onSkip={onSkip}
        onSubmit={onSubmit}
      />
    </main>
  );
}

function FlowStepper({
  phases,
  active,
  accent,
  soft,
}: {
  phases: FlowPhase[];
  active: FlowPhase;
  accent: string;
  soft: string;
}) {
  const activeIdx = phases.indexOf(active);

  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 40, flexWrap: "wrap", gap: 4 }}>
      {phases.map((phase, i) => {
        const done = i < activeIdx;
        const isActive = phase === active;
        return (
          <div key={phase} style={{ display: "flex", alignItems: "center" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
              <span style={{
                width: 30, height: 30, borderRadius: "50%", display: "grid", placeItems: "center",
                fontWeight: 800, fontSize: 13, flex: "none",
                background: isActive ? "var(--ink)" : done ? soft : "transparent",
                color: isActive ? "#fff" : done ? accent : "var(--text-faint)",
                border: !isActive && !done ? "1.5px solid var(--border-soft)" : "none",
              }}>
                {done ? <Check size={15} strokeWidth={3} /> : i + 1}
              </span>
              <span style={{
                fontSize: 13, fontWeight: 700,
                color: isActive ? "var(--ink)" : done ? accent : "var(--text-faint)",
              }}>
                {PHASE_LABELS[phase]}
              </span>
            </div>
            {i < phases.length - 1 && (
              <div style={{
                width: 36, height: 1.5, margin: "0 12px",
                background: done ? accent : "var(--hair)",
              }} />
            )}
          </div>
        );
      })}
    </div>
  );
}
