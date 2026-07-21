import { labelComparisonGroup } from "./marketComparisonLabels";
import type { MarketComparisonGroupDTO } from "../../api/marketComparison.api";

type Props = {
  groups: MarketComparisonGroupDTO[];
  value: string | null;
  onChange: (groupId: string) => void;
  accent: string;
  accentSoft: string;
};

export default function ComparisonGroupSelector({ groups, value, onChange, accent, accentSoft }: Props) {
  if (groups.length === 0) return null;

  const useDropdown = groups.length > 5;

  return (
    <div>
      <div style={{ fontSize: 13, fontWeight: 800, color: "var(--text-muted)", marginBottom: 8 }}>סוג מסלול</div>
      {useDropdown ? (
        <select
          aria-label="קבוצת השוואה"
          value={value ?? groups[0]?.comparisonGroup ?? ""}
          onChange={(e) => onChange(e.target.value)}
          style={{
            width: "100%",
            maxWidth: 360,
            padding: "10px 12px",
            borderRadius: 12,
            border: "1.5px solid var(--hair)",
            background: "var(--surface)",
            fontWeight: 700,
            fontSize: 14,
          }}
        >
          {groups.map((g) => (
            <option key={g.comparisonGroup} value={g.comparisonGroup}>
              {labelComparisonGroup(g.comparisonGroup)} ({g.rankedRecords})
            </option>
          ))}
        </select>
      ) : (
        <div role="tablist" aria-label="קבוצת השוואה" style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {groups.map((g) => {
            const active = g.comparisonGroup === value;
            return (
              <button
                key={g.comparisonGroup}
                role="tab"
                aria-selected={active}
                type="button"
                onClick={() => onChange(g.comparisonGroup)}
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
                {labelComparisonGroup(g.comparisonGroup)}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
