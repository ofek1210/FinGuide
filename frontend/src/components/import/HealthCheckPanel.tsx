import { HEALTH_STATUS_ICON, type HealthCheckData } from "../../utils/healthDisplay";

type HealthCheckPanelProps = {
  title: string;
  healthCheck: HealthCheckData;
  accentColor?: string;
};

export function HealthCheckPanel({
  title,
  healthCheck,
  accentColor = "#6B4FA0",
}: HealthCheckPanelProps) {
  return (
    <section style={{ marginBottom: 32 }}>
      <div style={{
        borderRadius: 16,
        padding: 20,
        background: "rgba(255,255,255,0.85)",
        border: "1px solid rgba(184,157,255,0.25)",
        boxShadow: "0 4px 20px rgba(155,127,232,0.08)",
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, flexWrap: "wrap", gap: 12 }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: 16, color: "#1F1F1F" }}>{title}</div>
            <div style={{ fontSize: 13, color: "#7C6FA0", marginTop: 4 }}>{healthCheck.level.label}</div>
          </div>
          <div style={{
            width: 72, height: 72, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
            background: `conic-gradient(${accentColor} ${healthCheck.score * 3.6}deg, rgba(184,157,255,0.2) 0)`,
            fontFamily: "'Fraunces', Georgia, serif", fontWeight: 800, fontSize: 22, color: accentColor,
          }}>
            {healthCheck.score}
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {healthCheck.categories.map(cat => (
            <div key={cat.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 12px", borderRadius: 10, background: "rgba(250,247,255,0.8)" }}>
              <span style={{ fontSize: 16, width: 24, textAlign: "center", color: cat.status === "good" ? "#059669" : cat.status === "warning" ? "#D97706" : "#DC2626" }}>
                {HEALTH_STATUS_ICON[cat.status] ?? "•"}
              </span>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 14 }}>{cat.label}</div>
                {cat.detail ? <div style={{ fontSize: 12, color: "#7C6FA0", marginTop: 2 }}>{cat.detail}</div> : null}
              </div>
              <div style={{ fontWeight: 800, fontSize: 14, color: accentColor }}>
                {cat.maxScore != null ? `${cat.score}/${cat.maxScore}` : cat.score}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

type SavingsDeltaCardProps = {
  delta: number;
  label?: string;
  formatValue?: (n: number) => string;
};

export function SavingsDeltaCard({
  delta,
  label = "שינוי מאז ייבוא קודם",
  formatValue = n => `₪${Math.abs(n).toLocaleString("he-IL")}`,
}: SavingsDeltaCardProps) {
  if (delta === 0) return null;
  return (
    <div style={{
      marginBottom: 14, padding: 16, borderRadius: 12,
      borderRight: `4px solid ${delta > 0 ? "#059669" : "#D97706"}`,
      background: "rgba(255,255,255,0.85)",
    }}>
      <div style={{ fontSize: 13, color: "#7C6FA0" }}>{label}</div>
      <div style={{ fontWeight: 800, fontSize: 16, color: delta > 0 ? "#059669" : "#D97706" }}>
        {delta > 0 ? "↑" : "↓"} {formatValue(delta)}
      </div>
    </div>
  );
}
