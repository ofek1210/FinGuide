import type { ReactNode } from "react";
import GlassCard from "../ui/GlassCard";
import { InsightsPanel } from "../ai/InsightsPanel";

type DomainInsightsSectionProps = {
  title: string;
  subtitle: string;
  agent: "pension" | "insurance";
  trigger: number;
  children?: ReactNode;
};

export function DomainInsightsSection({ title, subtitle, agent, trigger, children }: DomainInsightsSectionProps) {
  return (
    <section style={{ marginBottom: 36 }}>
      <div style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 18, fontWeight: 700, color: "#1F1F1F", marginBottom: 4 }}>{title}</div>
      <div style={{ fontSize: 13, color: "#7C6FA0", marginBottom: 14 }}>{subtitle}</div>
      <GlassCard padding="lg">
        {children ?? <InsightsPanel agent={agent} trigger={trigger} />}
      </GlassCard>
    </section>
  );
}
