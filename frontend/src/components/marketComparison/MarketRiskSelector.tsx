import { Info } from "lucide-react";
import { RISK_TABS, RISK_TOOLTIP } from "./marketComparisonLabels";
import type { MarketRiskLevel } from "../../api/marketComparison.api";

type Props = {
  value: MarketRiskLevel;
  onChange: (risk: MarketRiskLevel) => void;
  accent: string;
  accentSoft: string;
};

export default function MarketRiskSelector({ value, onChange, accent, accentSoft }: Props) {
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
        <span style={{ fontSize: 13, fontWeight: 800, color: "var(--text-muted)" }}>רמת סיכון</span>
        <span title={RISK_TOOLTIP} aria-label={RISK_TOOLTIP} style={{ color: "var(--text-faint)", display: "inline-flex" }}>
          <Info size={14} />
        </span>
      </div>
      <div role="tablist" aria-label="רמת סיכון" style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {RISK_TABS.map((tab) => {
          const active = tab.id === value;
          return (
            <button
              key={tab.id}
              role="tab"
              aria-selected={active}
              type="button"
              onClick={() => onChange(tab.id)}
              style={{
                padding: "8px 14px",
                borderRadius: 999,
                border: active ? `2px solid ${accent}` : "1.5px solid var(--hair)",
                background: active ? accentSoft : "var(--surface)",
                color: active ? accent : "var(--text-muted)",
                fontWeight: 800,
                fontSize: 13,
                cursor: "pointer",
              }}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
