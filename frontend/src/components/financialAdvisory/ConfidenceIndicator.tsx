import type { ConfidenceLevel } from "../../api/financialAdvisory.types";
import { CONFIDENCE_TONE } from "../../utils/financialAdvisoryDisplay";

type Props = {
  level: ConfidenceLevel;
  label: string;
  score?: number;
};

export default function ConfidenceIndicator({ level, label, score }: Props) {
  const color = CONFIDENCE_TONE[level] ?? "var(--text-muted)";
  const pct = typeof score === "number" && Number.isFinite(score)
    ? Math.round(score <= 1 ? score * 100 : score)
    : null;

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        fontSize: 11.5,
        fontWeight: 800,
        color,
        background: "var(--surface-sunken)",
        borderRadius: 999,
        padding: "4px 10px",
      }}
    >
      <span
        style={{
          width: 7,
          height: 7,
          borderRadius: "50%",
          background: color,
          flex: "none",
        }}
      />
      {label}
      {pct != null ? ` · ${pct}%` : ""}
    </span>
  );
}
