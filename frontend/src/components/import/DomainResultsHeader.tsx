import { RefreshCw } from "lucide-react";
import type { ReactNode } from "react";

type DomainResultsHeaderProps = {
  emoji: string;
  title: string;
  subtitle: ReactNode;
  accentColor: string;
  onReimport: () => void;
  reimportLabel?: string;
  actions?: ReactNode;
};

export function DomainResultsHeader({
  emoji,
  title,
  subtitle,
  accentColor,
  onReimport,
  reimportLabel = "עדכן דוח",
  actions,
}: DomainResultsHeaderProps) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 32, flexWrap: "wrap", gap: 12 }}>
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
          <span style={{ fontSize: 22 }}>{emoji}</span>
          <h1 style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: "clamp(20px, 3vw, 26px)", fontWeight: 700, color: "#1F1F1F", margin: 0, letterSpacing: "-0.03em" }}>
            {title}
          </h1>
        </div>
        <div style={{ fontSize: 14, color: "#7C6FA0" }}>{subtitle}</div>
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button
          type="button"
          onClick={onReimport}
          style={{
            display: "flex", alignItems: "center", gap: 7, padding: "10px 18px", borderRadius: 12,
            background: "rgba(255,255,255,0.8)", color: accentColor,
            border: `1px solid ${accentColor}4D`, cursor: "pointer", fontFamily: "inherit", fontWeight: 700, fontSize: 13.5,
          }}
        >
          <RefreshCw size={13} /> {reimportLabel}
        </button>
        {actions}
      </div>
    </div>
  );
}
