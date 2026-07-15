import { useState, useEffect } from "react";
import { InsightCard } from "./InsightCard";
import AIInsightsLoadingState from "./AIInsightsLoadingState";
import type {
  PayslipInsightsData,
  InsuranceInsightsData,
  PensionInsightsData,
  AIInsight,
  TaxCreditsSummary,
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
  const [loaderDone, setLoaderDone] = useState(false);
  const [data, setData] = useState<
    PayslipInsightsData | InsuranceInsightsData | PensionInsightsData | null
  >(null);
  const [error, setError] = useState<string | null>(null);

  // Email summary state
  const [emailConsent, setEmailConsent] = useState(false);
  const [emailLoading, setEmailLoading] = useState(false);
  const [emailMsg, setEmailMsg] = useState<string | null>(null);

  useEffect(() => {
    void fetchInsights();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trigger, agent]);

  async function fetchInsights() {
    setLoading(true);
    setLoaderDone(false);
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
      window.open(res.data.data.url, "_blank", "noopener,noreferrer");
    }
  }

  const insights: AIInsight[] = (data as PayslipInsightsData | InsuranceInsightsData | PensionInsightsData)?.insights || [];
  const narrative: string = (data as { narrative?: string })?.narrative || "";
  const payslipTaxCredits = agent === "payslip" ? (data as PayslipInsightsData)?.taxCredits : null;
  const payslipMeta = agent === "payslip" ? (data as PayslipInsightsData)?.meta : null;
  const pensionMeta = agent === "pension" ? (data as PensionInsightsData)?.meta : null;
  const insuranceMeta = agent === "insurance" ? (data as InsuranceInsightsData)?.meta : null;

  const totalSavings = (() => {
    if (pensionMeta?.totalPotentialSavings && pensionMeta.totalPotentialSavings > 0) {
      return pensionMeta.totalPotentialSavings;
    }
    if (insuranceMeta?.annualSavings && insuranceMeta.annualSavings > 0) {
      return insuranceMeta.annualSavings;
    }
    if (agent === "payslip") {
      const annual = payslipMeta?.recoverableSavingsAnnual;
      return annual != null && annual > 0 ? annual : 0;
    }
    return insights.reduce((sum, i) => sum + (i.financialImpact || 0), 0);
  })();

  // Keep the loading animation mounted through the real fetch, and let it
  // finish to 100% once the answer is in (data present) before revealing.
  if (loading || (data && !error && !loaderDone)) {
    return (
      <AIInsightsLoadingState
        agent={agent}
        ready={!loading}
        onComplete={() => setLoaderDone(true)}
      />
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
              label="פוטנציאל חיסכון שנתי (הערכה)"
              value={`₪${totalSavings.toLocaleString("he-IL")}`}
              color="#2d7d46"
            />
          )}
          {pensionMeta?.healthScore != null && (
            <StatBadge
              label="ציון בריאות פנסיונית"
              value={`${pensionMeta.healthScore}/100`}
              color={pensionMeta.healthScore >= 70 ? "#2d7d46" : pensionMeta.healthScore >= 50 ? "#D97706" : "#e53e3e"}
            />
          )}
          {insuranceMeta?.healthScore != null && (
            <StatBadge
              label="ציון בריאות ביטוח"
              value={`${insuranceMeta.healthScore}/100`}
              color={insuranceMeta.healthScore >= 70 ? "#2d7d46" : insuranceMeta.healthScore >= 50 ? "#D97706" : "#e53e3e"}
            />
          )}
          {insuranceMeta?.duplicateCount != null && insuranceMeta.duplicateCount > 0 && (
            <StatBadge
              label="כפילויות ביטוח"
              value={String(insuranceMeta.duplicateCount)}
              color="#e53e3e"
            />
          )}
          <StatBadge
            label="קריטיות"
            value={String(insights.filter((i) => i.severity === "error").length)}
            color="#e53e3e"
          />
        </div>
      )}

      {agent === "payslip" && payslipTaxCredits && (
        <TaxCreditsPanel taxCredits={payslipTaxCredits} />
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

function TaxCreditsPanel({ taxCredits }: { taxCredits: TaxCreditsSummary }) {
  const hasComparison = taxCredits.expectedPoints != null && taxCredits.actualPoints != null;
  const gap = taxCredits.gap;
  const gapPositive = gap != null && gap >= 0.25;

  return (
    <div
      style={{
        marginBottom: 16,
        padding: "16px",
        background: "var(--butter-50, #fffbeb)",
        borderRadius: 10,
        border: "1px solid var(--butter-200, #fde68a)",
      }}
    >
      <div style={{ fontWeight: 800, fontSize: 15, color: "var(--peach-ink, #c2410c)", marginBottom: 10 }}>
        נקודות זיכוי במס — ניתוח לפי הפרופיל שלך
      </div>

      {hasComparison && (
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 12 }}>
          <StatBadge label="צפוי בפרופיל" value={String(taxCredits.expectedPoints)} color="#7c3aed" />
          <StatBadge label="ממוצע בתלוש" value={String(taxCredits.actualPoints)} color="#4a5568" />
          {gap != null && Math.abs(gap) >= 0.25 && (
            <StatBadge
              label={gapPositive ? "חסר בתלוש" : "עודף בתלוש"}
              value={String(Math.abs(gap))}
              color={gapPositive ? "#e53e3e" : "#2d7d46"}
            />
          )}
          {taxCredits.estimatedAnnualRefund != null && taxCredits.estimatedAnnualRefund > 0 && (
            <StatBadge
              label="החזר שנתי משוער"
              value={`₪${taxCredits.estimatedAnnualRefund.toLocaleString("he-IL")}`}
              color="#2d7d46"
            />
          )}
        </div>
      )}

      {taxCredits.breakdown.length > 0 && (
        <div style={{ fontSize: 13, color: "#4a5568", lineHeight: 1.6 }}>
          <div style={{ fontWeight: 700, marginBottom: 6 }}>זכאויות לפי הפרופיל:</div>
          <ul style={{ margin: 0, paddingRight: 18 }}>
            {taxCredits.breakdown.map((item) => (
              <li key={item.id}>
                {item.label} — <strong>{item.points}</strong> נקודות
                {item.action ? ` · ${item.action}` : ""}
              </li>
            ))}
          </ul>
        </div>
      )}

      {gapPositive && taxCredits.monthlyValue != null && (
        <div style={{ marginTop: 10, fontSize: 13, fontWeight: 600, color: "#c2410c" }}>
          ייתכן שאתה משלם עד ₪{Math.round((gap ?? 0) * 242).toLocaleString("he-IL")} מס עודף בחודש —
          עדכן טופס 101 או בקש תיאום מס.
        </div>
      )}
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
