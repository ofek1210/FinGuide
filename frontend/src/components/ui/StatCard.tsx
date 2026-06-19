import type { ReactNode } from "react";
import GlassCard from "./GlassCard";

interface StatCardProps {
  icon: ReactNode;
  label: string;
  value: string | number;
  sub?: string;
  trend?: "up" | "down" | "flat";
  trendValue?: string;
  accent?: string;
}

const trendColors = { up: "#059669", down: "#DC2626", flat: "#7C6FA0" };
const trendArrow = { up: "↑", down: "↓", flat: "→" };

export default function StatCard({ icon, label, value, sub, trend, trendValue, accent = "var(--lg-primary, #9B7FE8)" }: StatCardProps) {
  return (
    <GlassCard padding="md" style={{ display: "flex", flexDirection: "column", gap: 8, minWidth: 0 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{
          width: 40, height: 40, borderRadius: 12,
          background: `${accent}18`,
          display: "flex", alignItems: "center", justifyContent: "center",
          color: accent, fontSize: 18,
        }}>
          {icon}
        </div>
        {trend && trendValue && (
          <span style={{
            fontSize: 12, fontWeight: 700,
            color: trendColors[trend],
            background: `${trendColors[trend]}12`,
            padding: "3px 8px", borderRadius: 999,
          }}>
            {trendArrow[trend]} {trendValue}
          </span>
        )}
      </div>
      <div>
        <div style={{
          fontSize: 26, fontWeight: 800, letterSpacing: "-0.03em",
          color: "var(--lg-text, #1F1F1F)",
          fontFamily: "var(--lg-font-display, Georgia, serif)",
          lineHeight: 1.1,
        }}>
          {value}
        </div>
        <div style={{ fontSize: 12.5, fontWeight: 500, color: "var(--lg-muted, #7C6FA0)", marginTop: 3 }}>
          {label}
        </div>
        {sub && (
          <div style={{ fontSize: 11.5, color: "var(--lg-muted-light, #A89CC8)", marginTop: 2 }}>
            {sub}
          </div>
        )}
      </div>
    </GlassCard>
  );
}
