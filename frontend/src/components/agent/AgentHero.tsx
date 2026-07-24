import type { ReactNode } from "react";

interface AgentHeroProps {
  icon: ReactNode;
  title: string;
  subtitle: string;
  accentColor?: string;
  children?: ReactNode;
}

export default function AgentHero({
  icon,
  title,
  subtitle,
  accentColor = "var(--agent, var(--lav-600))",
  children,
}: AgentHeroProps) {
  return (
    <header
      style={{
        position: "relative",
        overflow: "hidden",
        borderRadius: "var(--r-card)",
        padding: "clamp(24px, 4vw, 40px)",
        background: "var(--card)",
        border: "1px solid var(--border-hair)",
        boxShadow: "var(--shadow-soft)",
        marginBottom: 32,
        direction: "rtl",
        backgroundImage:
          "radial-gradient(circle at 88% 18%, color-mix(in srgb, var(--agent-soft, var(--lav-100)) 80%, transparent), transparent 42%), radial-gradient(color-mix(in srgb, var(--agent, var(--lav-600)) 5%, transparent) 1px, transparent 1px)",
        backgroundSize: "auto, 18px 18px",
      }}
    >
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          background: `radial-gradient(circle at 90% 50%, color-mix(in srgb, ${accentColor} 10%, transparent) 0%, transparent 60%)`,
        }}
      />

      <div style={{ position: "relative", display: "flex", alignItems: "flex-start", gap: 20 }}>
        <div
          style={{
            width: 56,
            height: 56,
            borderRadius: 12,
            flexShrink: 0,
            background: "var(--agent-soft, var(--lav-100))",
            border: "1px solid var(--agent-ring, var(--lav-200))",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 24,
            color: accentColor,
          }}
        >
          {icon}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h1
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "clamp(22px, 3.5vw, 32px)",
              fontWeight: 900,
              color: "var(--text-strong)",
              margin: "0 0 8px",
              letterSpacing: "-0.03em",
              lineHeight: 1.15,
            }}
          >
            {title}
          </h1>
          <p
            style={{
              fontSize: 15,
              color: "var(--text-muted)",
              margin: 0,
              lineHeight: 1.6,
              maxWidth: 560,
              fontWeight: 500,
            }}
          >
            {subtitle}
          </p>
          {children && <div style={{ marginTop: 20 }}>{children}</div>}
        </div>
      </div>
    </header>
  );
}
