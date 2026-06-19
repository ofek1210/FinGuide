import type { ReactNode } from "react";

interface AgentHeroProps {
  icon: ReactNode;
  title: string;
  subtitle: string;
  accentColor?: string;
  children?: ReactNode;
}

export default function AgentHero({ icon, title, subtitle, accentColor = "#9B7FE8", children }: AgentHeroProps) {
  return (
    <div style={{
      position: "relative",
      overflow: "hidden",
      borderRadius: "var(--lg-r-xl, 32px)",
      padding: "48px 48px 40px",
      background: `linear-gradient(135deg, #FAF7FF 0%, ${accentColor}10 50%, ${accentColor}18 100%)`,
      border: "1px solid rgba(184,157,255,0.25)",
      boxShadow: "0 4px 32px rgba(155,127,232,0.10)",
      marginBottom: 32,
      direction: "rtl",
    }}>
      {/* Background decoration */}
      <div style={{
        position: "absolute", inset: 0, pointerEvents: "none",
        background: `radial-gradient(circle at 90% 50%, ${accentColor}14 0%, transparent 60%)`,
      }} />
      <div style={{
        position: "absolute", top: -40, left: -40,
        width: 180, height: 180,
        borderRadius: "50%",
        background: `${accentColor}08`,
        pointerEvents: "none",
      }} />

      <div style={{ position: "relative", display: "flex", alignItems: "flex-start", gap: 20 }}>
        <div style={{
          width: 60, height: 60, borderRadius: 18, flexShrink: 0,
          background: `linear-gradient(135deg, ${accentColor}22, ${accentColor}38)`,
          border: `1px solid ${accentColor}30`,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 26, boxShadow: `0 4px 16px ${accentColor}25`,
        }}>
          {icon}
        </div>
        <div style={{ flex: 1 }}>
          <h1 style={{
            fontFamily: "var(--lg-font-display, Georgia, serif)",
            fontSize: "clamp(22px, 3.5vw, 32px)",
            fontWeight: 700,
            color: "#1F1F1F",
            margin: "0 0 8px",
            letterSpacing: "-0.03em",
            lineHeight: 1.15,
          }}>
            {title}
          </h1>
          <p style={{
            fontSize: 15,
            color: "#7C6FA0",
            margin: 0,
            lineHeight: 1.6,
            maxWidth: 560,
          }}>
            {subtitle}
          </p>
          {children && <div style={{ marginTop: 20 }}>{children}</div>}
        </div>
      </div>
    </div>
  );
}
