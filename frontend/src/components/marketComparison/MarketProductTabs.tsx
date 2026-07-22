import { GEMEL_PRODUCT_TABS } from "./marketComparisonLabels";
import type { GemelMarketProduct } from "../../api/marketComparison.api";

type Props = {
  value: GemelMarketProduct;
  onChange: (product: GemelMarketProduct) => void;
  accent: string;
  accentSoft: string;
};

export default function MarketProductTabs({ value, onChange, accent, accentSoft }: Props) {
  return (
    <div role="tablist" aria-label="סוג מוצר" style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
      {GEMEL_PRODUCT_TABS.map((tab) => {
        const active = tab.id === value;
        return (
          <button
            key={tab.id}
            role="tab"
            aria-selected={active}
            type="button"
            onClick={() => onChange(tab.id)}
            style={{
              padding: "10px 16px",
              borderRadius: 12,
              border: active ? `2px solid ${accent}` : "1.5px solid var(--hair)",
              background: active ? accentSoft : "var(--surface)",
              color: active ? accent : "var(--text-muted)",
              fontWeight: 900,
              fontSize: 14,
              cursor: "pointer",
            }}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
