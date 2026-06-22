import { Sparkles } from "lucide-react";
import GlassCard from "../ui/GlassCard";
import { APP_ROUTES } from "../../types/navigation";
import type { AppRoute } from "../../types/navigation";

type DomainCopilotCTAProps = {
  emoji?: string;
  title: string;
  description: string;
  buttonLabel: string;
  gradientFrom: string;
  gradientTo: string;
  onNavigate: (route: AppRoute) => void;
  route?: AppRoute;
};

export function DomainCopilotCTA({
  emoji = "🤖",
  title,
  description,
  buttonLabel,
  gradientFrom,
  gradientTo,
  onNavigate,
  route = APP_ROUTES.copilot,
}: DomainCopilotCTAProps) {
  return (
    <GlassCard padding="lg" style={{ background: `linear-gradient(135deg, ${gradientFrom}14, rgba(155,127,232,0.14))`, border: "1px solid rgba(184,157,255,0.35)", textAlign: "center" }}>
      <div style={{ fontSize: 28, marginBottom: 10 }}>{emoji}</div>
      <h3 style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 22, fontWeight: 700, color: "#1F1F1F", margin: "0 0 8px" }}>
        {title}
      </h3>
      <p style={{ fontSize: 14.5, color: "#7C6FA0", margin: "0 0 20px", lineHeight: 1.65 }}>
        {description}
      </p>
      <button
        type="button"
        onClick={() => onNavigate(route)}
        style={{
          display: "inline-flex", alignItems: "center", gap: 8, padding: "12px 28px", borderRadius: 14,
          background: `linear-gradient(135deg, ${gradientFrom}, ${gradientTo})`,
          color: "#fff", border: "none", cursor: "pointer", fontFamily: "inherit", fontWeight: 700, fontSize: 15,
          boxShadow: `0 4px 20px ${gradientFrom}59`,
        }}
      >
        <Sparkles size={16} /> {buttonLabel}
      </button>
    </GlassCard>
  );
}
