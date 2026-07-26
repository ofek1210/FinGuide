import { ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";
import { AGENT_INSIGHT_CTA, type InsightAgentKind } from "../../utils/insightDisplay";

type Props = {
  agent: InsightAgentKind;
  style?: React.CSSProperties;
};

export default function AgentInsightCta({ agent, style }: Props) {
  const cta = AGENT_INSIGHT_CTA[agent];

  return (
    <Link
      to={cta.href}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        marginTop: 8,
        fontSize: 12.5,
        fontWeight: 800,
        color: "var(--lav-600, #7c3aed)",
        textDecoration: "none",
        ...style,
      }}
    >
      {cta.label}
      <ArrowLeft size={14} strokeWidth={2.4} />
    </Link>
  );
}
