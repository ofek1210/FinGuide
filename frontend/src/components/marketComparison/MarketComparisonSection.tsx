import type { ReactNode } from "react";

type Props = {
  title?: string;
  children: ReactNode;
  accentSoft?: string;
};

export default function MarketComparisonSection({
  title = "השוואת שוק",
  children,
  accentSoft = "var(--surface)",
}: Props) {
  return (
    <details
      style={{
        marginTop: 24,
        border: "1.5px solid var(--hair)",
        borderRadius: 18,
        background: accentSoft,
        padding: "4px 16px 16px",
      }}
    >
      <summary
        style={{
          cursor: "pointer",
          fontWeight: 900,
          fontSize: 16,
          padding: "14px 0",
          color: "var(--text-strong)",
          listStyle: "none",
        }}
      >
        {title}
      </summary>
      {children}
    </details>
  );
}
