import { useState, useEffect } from "react";
import { InsightCard } from "./InsightCard";
import type {
  PayslipInsightsData,
  InsuranceInsightsData,
  PensionInsightsData,
  AIInsight,
} from "../../api/aiInsights.api";
import {
  getPayslipAIInsights,
  getInsuranceProfileInsights,
  getPensionRiskAdvice,
  sendSummaryEmail,
  getWhatsAppShareUrl,
} from "../../api/aiInsights.api";

type AgentType = "payslip" | "insurance" | "pension";

interface Props {
  agent: AgentType;
  /** After upload / data load — trigger a fresh analysis fetch */
  trigger?: number;
}

export function InsightsPanel({ agent, trigger = 0 }: Props) {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<
    PayslipInsightsData | InsuranceInsightsData | PensionInsightsData | null
  >(null);
  const [error, setError] = useState<string | null>(null);

  // Email summary state
  const [emailConsent, setEmailConsent] = useState(false);
  const [emailLoading, setEmailLoading] = useState(false);
  const [emailMsg, setEmailMsg] = useState<string | null>(null);
  const [waUrl, setWaUrl] = useState<string | null>(null);

  useEffect(() => {
    void fetchInsights();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trigger, agent]);

  async function fetchInsights() {
    setLoading(true);
    setError(null);
    try {
      let res;
      if (agent === "payslip") res = await getPayslipAIInsights();
      else if (agent === "insurance") res = await getInsuranceProfileInsights();
      else res = await getPensionRiskAdvice();

      if (res.ok) setData(res.data.data);
      else setError(res.error.message || "שגיאה בטעינת תובנות");
    } catch {
      setError("שגיאה לא צפויה");
    } finally {
      setLoading(false);
    }
  }

  async function handleSendEmail() {
    if (!emailConsent) return;
    setEmailLoading(true);
    setEmailMsg(null);
    const res = await sendSummaryEmail(true);
    setEmailLoading(false);
    if (res.ok) {
      setEmailMsg(`✓ מייל נשלח בהצלחה ל-${res.data.data.sentTo}`);
    } else {
      setEmailMsg(`שגיאה: ${res.error.message}`);
    }
  }

  async function handleWhatsApp() {
    const res = await getWhatsAppShareUrl();
    if (res.ok) {
      const url = res.data.data.url;
      setWaUrl(url);
      window.open(url, "_blank", "noopener,noreferrer");
    }
  }

  const insights: AIInsight[] = (data as any)?.insights || [];
  const narrative: string = (data as any)?.narrative || "";

  const totalSavings = insights.reduce(
    (sum, i) => sum + (i.financialImpact || 0),
    0
  );

  if (loading) {
    return (
      <div style={{ padding: "32px 0", textAlign: "center", color: "#9b8cff" }}>
        <div className="spinner" style={{ margin: "0 auto 10px" }} />
        מנתח נתונים עם AI...
      </div>
    );
  }

  if (error) {
    return (
      <div
        style={{
          padding: "20px 16px",
          background: "#fff5f5",
          borderRadius: 10,
          color: "#e53e3e",
          fontSize: 14,
        }}
      >
        {error}
        <button
          onClick={fetchInsights}
          style={{
            marginRight: 12,
            background: "none",
            border: "1px solid #e53e3e",
            borderRadius: 6,
            padding: "4px 10px",
            color: "#e53e3e",
            cursor: "pointer",
            fontSize: 13,
          }}
        >
          נסה שוב
        </button>
      </div>
    );
  }

  if (!data) {
    return (
      <div
        style={{
          textAlign: "center",
          padding: "28px 16px",
          color: "#9b8cff",
        }}
      >
        <button
          onClick={fetchInsights}
          style={{
            background: "linear-gradient(135deg,#9b8cff,#7c3aed)",
            color: "#fff",
            border: "none",
            borderRadius: 10,
            padding: "12px 24px",
            fontSize: 15,
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          הפעל ניתוח AI
        </button>
      </div>
    );
  }

  return (
    <div style={{ direction: "rtl" }}>
      {/* Summary bar */}
      {insights.length > 0 && (
        <div
          style={{
            display: "flex",
            gap: 16,
            marginBottom: 16,
            flexWrap: "wrap",
          }}
        >
          <StatBadge
            label="תובנות"
            value={String(insights.length)}
            color="#7c3aed"
          />
          {totalSavings > 0 && (
            <StatBadge
              label="פוטנציאל חיסכון"
              value={`₪${totalSavings.toLocaleString("he-IL")}`}
              color="#2d7d46"
            />
          )}
          <StatBadge
            label="קריטיות"
            value={String(insights.filter((i) => i.severity === "error").length)}
            color="#e53e3e"
          />
        </div>
      )}

      {/* Insights list */}
      {insights.length === 0 && (
        <div
          style={{
            padding: "20px 16px",
            background: "#f0fdf4",
            borderRadius: 10,
            color: "#2d7d46",
            fontSize: 14,
          }}
        >
          לא זוהו חריגות מהותיות. הנתונים שלך נראים תקינים.
        </div>
      )}
      {insights.map((ins) => (
        <InsightCard key={ins.id} insight={ins} />
      ))}

      {/* Narrative */}
      {narrative && (
        <div
          style={{
            marginTop: 16,
            padding: "16px",
            background: "#f8f4ff",
            borderRadius: 10,
            fontSize: 14,
            color: "#4a5568",
            lineHeight: 1.7,
            whiteSpace: "pre-line",
            borderRight: "3px solid #9b8cff",
          }}
        >
          <div
            style={{
              fontWeight: 700,
              marginBottom: 8,
              color: "#7c3aed",
              fontSize: 13,
            }}
          >
            ניתוח אישי
          </div>
          {narrative}
        </div>
      )}

      {/* Share section */}
      <div
        style={{
          marginTop: 20,
          padding: "16px",
          background: "#faf5ff",
          borderRadius: 10,
          border: "1px solid #e9d8fd",
        }}
      >
        <div
          style={{ fontWeight: 700, fontSize: 14, color: "#1a202c", marginBottom: 12 }}
        >
          שלח את הסיכום שלך
        </div>

        {/* Email consent */}
        <label
          style={{
            display: "flex",
            gap: 10,
            alignItems: "flex-start",
            cursor: "pointer",
            marginBottom: 12,
            fontSize: 13,
            color: "#4a5568",
          }}
        >
          <input
            type="checkbox"
            checked={emailConsent}
            onChange={(e) => setEmailConsent(e.target.checked)}
            style={{ marginTop: 2, accentColor: "#7c3aed" }}
          />
          <span>
            אני מאשר/ת לשלוח לי את סיכום הניתוח למייל הרשום שלי
          </span>
        </label>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button
            onClick={handleSendEmail}
            disabled={!emailConsent || emailLoading}
            style={{
              background:
                emailConsent && !emailLoading ? "#7c3aed" : "#c4b5fd",
              color: "#fff",
              border: "none",
              borderRadius: 8,
              padding: "10px 18px",
              fontSize: 13,
              fontWeight: 600,
              cursor: emailConsent && !emailLoading ? "pointer" : "not-allowed",
              transition: "background 0.2s",
            }}
          >
            {emailLoading ? "שולח..." : "שלח סיכום למייל"}
          </button>

          <button
            onClick={handleWhatsApp}
            style={{
              background: "#25d366",
              color: "#fff",
              border: "none",
              borderRadius: 8,
              padding: "10px 18px",
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            שתף ב-WhatsApp
          </button>
        </div>

        {emailMsg && (
          <div
            style={{
              marginTop: 10,
              fontSize: 13,
              color: emailMsg.startsWith("✓") ? "#2d7d46" : "#e53e3e",
              fontWeight: 600,
            }}
          >
            {emailMsg}
          </div>
        )}

        {/* Accountant CTA */}
        <div
          style={{
            marginTop: 14,
            paddingTop: 14,
            borderTop: "1px solid #e9d8fd",
            fontSize: 13,
            color: "#4a5568",
          }}
        >
          <span style={{ fontWeight: 600 }}>לביצוע ההמלצות: </span>
          <a
            href="https://calendly.com/daniel-levi-cpa/consultation"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              color: "#7c3aed",
              textDecoration: "none",
              fontWeight: 600,
            }}
          >
            קבע פגישה עם רו&quot;ח דניאל לוי ←
          </a>
          <span style={{ marginRight: 8, color: "#a0aec0" }}>| 050-1234567</span>
        </div>
      </div>
    </div>
  );
}

function StatBadge({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color: string;
}) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: "10px 16px",
        background: `${color}12`,
        borderRadius: 10,
        border: `1px solid ${color}30`,
        minWidth: 80,
      }}
    >
      <span style={{ fontSize: 18, fontWeight: 800, color }}>{value}</span>
      <span style={{ fontSize: 11, color: "#718096", marginTop: 2 }}>{label}</span>
    </div>
  );
}
