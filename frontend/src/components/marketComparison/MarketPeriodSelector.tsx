import { PERIOD_TABS } from "./marketComparisonLabels";
import type { MarketPeriod } from "../../api/marketComparison.api";

type Props = {
  value: MarketPeriod;
  onChange: (period: MarketPeriod) => void;
  accent: string;
  accentSoft: string;
};

export default function MarketPeriodSelector({ value, onChange, accent, accentSoft }: Props) {
  return (
    <div>
      <div style={{ fontSize: 13, fontWeight: 800, color: "var(--text-muted)", marginBottom: 8 }}>תקופת תשואה</div>
      <div role="tablist" aria-label="תקופת תשואה" style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {PERIOD_TABS.map((tab) => {
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
