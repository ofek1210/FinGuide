import { RefreshCw, Shield, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

type DomainResultsHeaderProps = {
  badge: string;
  badgeIcon?: LucideIcon;
  title: string;
  subtitle: ReactNode;
  accentColor: string;
  onReimport: () => void;
  reimportLabel?: string;
  actions?: ReactNode;
};

export function DomainResultsHeader({
  badge,
  badgeIcon: BadgeIcon = Shield,
  title,
  subtitle,
  accentColor,
  onReimport,
  reimportLabel = "עדכן דוח",
  actions,
}: DomainResultsHeaderProps) {
  return (
    <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 28, flexWrap: "wrap", gap: 16 }}>
      <div>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "5px 12px", borderRadius: 999, background: "var(--peach-soft)", color: accentColor, fontSize: 12.5, fontWeight: 800, marginBottom: 13 }}>
          <BadgeIcon size={14} /> {badge}
        </span>
        <h1 style={{ margin: 0, fontSize: "clamp(28px,3.6vw,42px)", fontWeight: 900, letterSpacing: "-.035em", lineHeight: 1.04, color: "var(--text-strong)" }}>
          {title}
        </h1>
        <p style={{ margin: "8px 0 0", fontSize: 15.5, color: "var(--text-muted)", fontWeight: 500 }}>{subtitle}</p>
      </div>
      <div style={{ display: "flex", gap: 9, flexWrap: "wrap" }}>
        <button
          type="button"
          onClick={onReimport}
          style={{
            display: "inline-flex", alignItems: "center", gap: 8, padding: "11px 18px", borderRadius: "var(--r-pill)",
            background: "var(--ink)", color: "#fff", border: "none", cursor: "pointer",
            fontFamily: "inherit", fontWeight: 800, fontSize: 14, boxShadow: "var(--shadow-ink)",
          }}
        >
          <RefreshCw size={15} /> {reimportLabel}
        </button>
        {actions}
      </div>
    </div>
  );
}
