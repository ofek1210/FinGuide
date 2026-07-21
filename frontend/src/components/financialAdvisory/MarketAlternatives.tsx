import type { MarketAlternative } from "../../api/financialAdvisory.types";
import { hasDisplayValue } from "../../utils/financialAdvisoryDisplay";

type Props = {
  alternatives: MarketAlternative[];
  label?: string;
};

export default function MarketAlternatives({ alternatives, label = "אפשרויות שכדאי להשוות" }: Props) {
  if (!alternatives?.length) return null;

  return (
    <div style={{ marginTop: 14 }}>
      <div style={{ fontSize: 12.5, fontWeight: 800, color: "var(--text-strong)", marginBottom: 8 }}>
        {label}
      </div>
      <p style={{ margin: "0 0 10px", fontSize: 11.5, color: "var(--text-faint)", lineHeight: 1.45 }}>
        אלה מסלולים דומים לצורך השוואה — לא מוצרים מובטחים כטובים יותר.
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {alternatives.map(alt => (
          <div
            key={`${alt.fundId}-${alt.rank}`}
            style={{
              padding: "10px 12px",
              borderRadius: "var(--r-sm)",
              background: "var(--surface-sunken)",
              border: "1px solid var(--border-hair)",
            }}
          >
            <div style={{ fontWeight: 800, fontSize: 13.5, color: "var(--text-strong)" }}>
              #{alt.rank} · {alt.fundName}
              {alt.managingCompany ? ` · ${alt.managingCompany}` : ""}
            </div>
            {hasDisplayValue(alt.combinedScore) && (
              <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
                ציון משולב: {Math.round(alt.combinedScore!)}
              </div>
            )}
            {alt.reasons?.length > 0 && (
              <ul style={{ margin: "6px 0 0", paddingInlineStart: 16, fontSize: 12, color: "var(--text-muted)", lineHeight: 1.45 }}>
                {alt.reasons.map((r, i) => <li key={i}>{r}</li>)}
              </ul>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
