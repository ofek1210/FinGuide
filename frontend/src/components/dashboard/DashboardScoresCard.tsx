import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Shield, PiggyBank, FileText, Activity, AlertTriangle } from "lucide-react";
import { getDashboardSummary, type DashboardSummaryData } from "../../api/dashboard.api";
import { APP_ROUTES } from "../../types/navigation";

type ScoreTier = "great" | "ok" | "poor" | "none";

function scoreTier(s: number | null): ScoreTier {
  if (s == null) return "none";
  if (s >= 75) return "great";
  if (s >= 45) return "ok";
  return "poor";
}

const TIER_COLOR: Record<ScoreTier, string> = {
  great: "#34D399",
  ok:    "#FBBF24",
  poor:  "#F87171",
  none:  "rgba(255,255,255,0.2)",
};

const TIER_BG: Record<ScoreTier, string> = {
  great: "rgba(52,211,153,0.12)",
  ok:    "rgba(251,191,36,0.1)",
  poor:  "rgba(248,113,113,0.1)",
  none:  "rgba(255,255,255,0.04)",
};

function ScoreRing({ score }: { score: number | null }) {
  const tier = scoreTier(score);
  const color = TIER_COLOR[tier];
  const size = 64;
  const r = 26;
  const circ = 2 * Math.PI * r;
  const pct = score != null ? score / 100 : 0;

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: "rotate(-90deg)" }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={6} />
      <circle
        cx={size / 2} cy={size / 2} r={r}
        fill="none" stroke={color} strokeWidth={6}
        strokeDasharray={circ}
        strokeDashoffset={circ * (1 - pct)}
        strokeLinecap="round"
        style={{ transition: "stroke-dashoffset 0.8s ease" }}
      />
    </svg>
  );
}

function ScoreItem({
  icon, label, score, route, onNavigate,
}: {
  icon: React.ReactNode;
  label: string;
  score: number | null;
  route: string;
  onNavigate: (r: string) => void;
}) {
  const tier = scoreTier(score);
  const color = TIER_COLOR[tier];

  return (
    <button
      onClick={() => onNavigate(route)}
      style={{
        background: TIER_BG[tier],
        border: `1px solid ${color}33`,
        borderRadius: 14, padding: "18px 16px",
        display: "flex", flexDirection: "column", alignItems: "center", gap: 10,
        cursor: "pointer", width: "100%", fontFamily: "inherit",
        transition: "background 0.2s, transform 0.15s",
      }}
      onMouseEnter={e => (e.currentTarget.style.transform = "translateY(-2px)")}
      onMouseLeave={e => (e.currentTarget.style.transform = "translateY(0)")}
    >
      <div style={{ position: "relative" }}>
        <ScoreRing score={score} />
        <div style={{
          position: "absolute", inset: 0,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 11, fontWeight: 800, color: score != null ? color : "rgba(255,255,255,0.2)",
        }}>
          {score != null ? score : "—"}
        </div>
      </div>
      <div style={{ textAlign: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 5, justifyContent: "center", marginBottom: 3 }}>
          <span style={{ color: "var(--rapyd-text-muted)", opacity: 0.7 }}>{icon}</span>
          <span style={{ fontSize: 12, fontWeight: 700, color: "var(--rapyd-text)" }}>{label}</span>
        </div>
        <span style={{ fontSize: 11, color: color, fontWeight: 600 }}>
          {tier === "great" ? "מצוין" : tier === "ok" ? "בסדר" : tier === "poor" ? "לשיפור" : "אין נתונים"}
        </span>
      </div>
    </button>
  );
}

export default function DashboardScoresCard() {
  const navigate = useNavigate();
  const [data, setData] = useState<DashboardSummaryData | null>(null);

  useEffect(() => {
    getDashboardSummary().then(res => {
      if (res.ok && res.data.success && res.data.data) setData(res.data.data);
    });
  }, []);

  if (!data) return null;

  const { scores, warnings } = data;

  return (
    <div className="dashboard-card" style={{ padding: "22px 24px" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18 }}>
        <Activity size={16} style={{ color: "#818CF8" }} />
        <span style={{ fontWeight: 700, fontSize: 15, color: "var(--rapyd-text)" }}>
          ציוני AI
        </span>
        {scores.overall != null && (
          <span style={{
            marginRight: "auto", fontSize: 12, fontWeight: 700,
            color: TIER_COLOR[scoreTier(scores.overall)],
          }}>
            ממוצע {scores.overall}
          </span>
        )}
      </div>

      {/* Score grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginBottom: warnings.length > 0 ? 16 : 0 }}>
        <ScoreItem icon={<FileText size={13} />} label="תלושים" score={scores.payslip}
          route={APP_ROUTES.payslipHistory} onNavigate={navigate} />
        <ScoreItem icon={<Shield size={13} />} label="ביטוח" score={scores.insurance}
          route={APP_ROUTES.insurance} onNavigate={navigate} />
        <ScoreItem icon={<PiggyBank size={13} />} label="פנסיה" score={scores.pension}
          route={APP_ROUTES.pension} onNavigate={navigate} />
      </div>

      {/* Warnings */}
      {warnings.length > 0 && (
        <div style={{
          background: "rgba(251,191,36,0.08)", border: "1px solid rgba(251,191,36,0.2)",
          borderRadius: 10, padding: "10px 14px", display: "flex", flexDirection: "column", gap: 6,
        }}>
          {warnings.slice(0, 3).map((w, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "#FDE68A" }}>
              <AlertTriangle size={12} style={{ flexShrink: 0 }} />
              {w}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
