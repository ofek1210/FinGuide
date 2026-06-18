import { useCallback, useEffect, useState } from "react";
import { PiggyBank, TrendingUp, AlertCircle, Loader2, Sparkles } from "lucide-react";
import PrivateTopbar from "../components/PrivateTopbar";
import AppFooter from "../components/AppFooter";
import {
  getPensionAnalysis,
  simulatePensionScenario,
  type PensionAnalysisResponse,
  type SimulationResponse,
} from "../api/pension.api";

const urgencyColor = (u: string) =>
  u === "high" ? "var(--figma-error)" : u === "medium" ? "var(--figma-warning)" : "var(--figma-success)";

const urgencyLabel = (u: string) =>
  u === "high" ? "דחוף" : u === "medium" ? "מומלץ" : "לידיעה";

const fmt = (n: number | null | undefined) =>
  n != null ? `₪${Number(n).toLocaleString("he-IL")}` : "—";

export default function PensionPage() {
  const [data, setData] = useState<PensionAnalysisResponse["data"] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Simulation state
  const [simAge, setSimAge] = useState<string>("");
  const [simExtra, setSimExtra] = useState<string>("");
  const [simFee, setSimFee] = useState<string>("");
  const [simResult, setSimResult] = useState<SimulationResponse["data"] | null>(null);
  const [simLoading, setSimLoading] = useState(false);

  useEffect(() => {
    void getPensionAnalysis().then((res) => {
      setLoading(false);
      if (res.ok && res.data?.success && res.data.data) setData(res.data.data);
      else setError("לא הצלחנו לטעון נתוני פנסיה");
    });
  }, []);

  const handleSimulate = useCallback(async () => {
    setSimLoading(true);
    setSimResult(null);
    const res = await simulatePensionScenario({
      retirementAge: simAge ? Number(simAge) : undefined,
      additionalMonthlyContribution: simExtra ? Number(simExtra) : undefined,
      targetMgmtFee: simFee ? Number(simFee) / 100 : undefined,
    });
    setSimLoading(false);
    if (res.ok && res.data?.success && res.data.data) setSimResult(res.data.data);
  }, [simAge, simExtra, simFee]);

  return (
    <div style={{ minHeight: "100vh", background: "var(--rapyd-bg)", direction: "rtl" }}>
      <PrivateTopbar />

      <main style={{ maxWidth: 960, margin: "0 auto", padding: "40px 24px 80px" }}>

        {/* Header */}
        <div style={{ marginBottom: 32 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
            <span style={{
              width: 44, height: 44, background: "rgba(91,79,245,0.15)",
              borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center",
              color: "#818CF8",
            }}>
              <PiggyBank size={22} />
            </span>
            <h1 style={{ fontSize: 28, fontWeight: 800, margin: 0, color: "var(--rapyd-text)" }}>
              ניהול פנסיה AI
            </h1>
          </div>
          <p style={{ color: "var(--rapyd-text-muted)", margin: 0, fontSize: 15 }}>
            תחזיות פרישה, ניתוח דמי ניהול וסימולציות — מבוסס על נתוני התלושים שלך
          </p>
          <div style={{
            marginTop: 14, padding: "12px 16px", borderRadius: 10,
            background: "rgba(129,140,248,0.06)", borderRight: "3px solid #818CF8",
            fontSize: 13, color: "var(--rapyd-text-muted)", lineHeight: 1.7,
          }}>
            <strong style={{ color: "var(--rapyd-text)" }}>💡 מילון מונחים:</strong><br/>
            <strong>פנסיה</strong> — חיסכון חודשי מהשכר שנצבר לטובת קצבה בגיל פרישה (67).<br/>
            <strong>הפרשת עובד</strong> — 6% מהברוטו שמנוכים מהשכר שלך.<br/>
            <strong>הפרשת מעסיק</strong> — 6.5% נוספים שהמעסיק מוסיף מעבר לשכר.<br/>
            <strong>דמי ניהול</strong> — עמלה שחברת הפנסיה גובה מהכסף שלך. ככל שנמוך יותר — חוסכים יותר.<br/>
            <strong>צבירה</strong> — סך הכסף שיהיה בקרן בגיל פרישה.<br/>
            <strong>קצבה חודשית</strong> — הסכום שתקבל/י מדי חודש אחרי פרישה.
          </div>
        </div>

        {loading && (
          <div style={{ display: "flex", alignItems: "center", gap: 12, color: "var(--rapyd-text-muted)", padding: "40px 0" }}>
            <Loader2 size={20} className="spin" />
            <span>טוען נתוני פנסיה...</span>
          </div>
        )}

        {error && (
          <div style={{
            background: "rgba(220,38,38,0.1)", border: "1px solid rgba(220,38,38,0.3)",
            borderRadius: 12, padding: "16px 20px", color: "#FCA5A5",
            display: "flex", alignItems: "center", gap: 10,
          }}>
            <AlertCircle size={18} />
            {error}
          </div>
        )}

        {data && (
          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>

            {/* No data state */}
            {!data.summary.hasData && (
              <div className="dashboard-card" style={{ textAlign: "center", padding: "48px 24px" }}>
                <PiggyBank size={40} style={{ color: "var(--rapyd-text-muted)", marginBottom: 16 }} />
                <h3 style={{ color: "var(--rapyd-text)", marginBottom: 8 }}>אין עדיין נתוני פנסיה</h3>
                <p style={{ color: "var(--rapyd-text-muted)", fontSize: 14 }}>
                  העלה תלוש שכר עם נתוני הפרשות פנסיה כדי לקבל תחזית אישית
                </p>
              </div>
            )}

            {/* Summary cards */}
            {data.summary.hasData && (
              <>
                {data.summary.hasMissingPension && (
                  <div style={{
                    background: "rgba(234,179,8,0.1)", border: "1px solid rgba(234,179,8,0.3)",
                    borderRadius: 12, padding: "14px 20px", color: "#FDE047",
                    display: "flex", alignItems: "center", gap: 10, fontSize: 14,
                  }}>
                    <AlertCircle size={18} />
                    <span>לא זוהו הפרשות פנסיה בתלוש. הנתונים מבוססים על הפרשה מינימלית חוקית (6% עובד + 6.5% מעסיק מברוטו ₪{data.summary.grossSalary?.toLocaleString("he-IL")}).</span>
                  </div>
                )}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16 }}>
                  {[
                    { label: "הפרשה חודשית (עובד)", value: fmt(data.summary.pensionEmployee ?? data.summary.expectedMinEmployee), sub: !data.summary.pensionEmployee ? "מינימום חוקי" : undefined },
                    { label: "הפרשה חודשית (מעסיק)", value: fmt(data.summary.pensionEmployer ?? data.summary.expectedMinEmployer), sub: !data.summary.pensionEmployer ? "מינימום חוקי" : undefined },
                    { label: "סה\"כ חודשי", value: fmt(data.summary.totalMonthlyContribution) },
                    { label: "גיל פרישה מתוכנן", value: data.summary.retirementAge ? `${data.summary.retirementAge}` : "67" },
                  ].map((card) => (
                    <div key={card.label} className="dashboard-card" style={{ padding: "20px 24px" }}>
                      <div style={{ fontSize: 12, color: "var(--rapyd-text-muted)", marginBottom: 8, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                        {card.label}
                      </div>
                      <div style={{ fontSize: 26, fontWeight: 800, color: "var(--rapyd-text)" }}>
                        {card.value}
                      </div>
                      {card.sub && (
                        <div style={{ fontSize: 11, color: "#FDE047", marginTop: 4 }}>⚠️ {card.sub}</div>
                      )}
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* Projection */}
            {data.projection?.available && (
              <div className="dashboard-card" style={{ padding: "28px 32px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
                  <TrendingUp size={18} style={{ color: "#818CF8" }} />
                  <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: "var(--rapyd-text)" }}>
                    תחזית לפרישה
                  </h2>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 24 }}>
                  <div>
                    <div style={{ fontSize: 13, color: "var(--rapyd-text-muted)", marginBottom: 6 }}>צבירה צפויה</div>
                    <div style={{ fontSize: 32, fontWeight: 900, color: "#818CF8" }}>
                      {fmt(data.projection.projectedAccumulation)}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 13, color: "var(--rapyd-text-muted)", marginBottom: 6 }}>קצבה חודשית צפויה</div>
                    <div style={{ fontSize: 32, fontWeight: 900, color: "var(--rapyd-text)" }}>
                      {fmt(data.projection.monthlyPensionEstimate)}
                    </div>
                    {data.projection.replacementRatio != null && (
                      <div style={{ fontSize: 13, color: "var(--rapyd-text-muted)", marginTop: 4 }}>
                        {data.projection.replacementRatio}% מהשכר הנוכחי
                      </div>
                    )}
                  </div>
                </div>

                {/* Scenarios */}
                {data.projection.scenarios && (
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                    {Object.values(data.projection.scenarios).map((s) => (
                      <div key={s.label} style={{
                        background: "rgba(255,255,255,0.04)", borderRadius: 10,
                        padding: "16px", border: "1px solid rgba(255,255,255,0.08)",
                      }}>
                        <div style={{ fontSize: 12, color: "var(--rapyd-text-muted)", marginBottom: 8 }}>{s.label}</div>
                        <div style={{ fontSize: 20, fontWeight: 800, color: "var(--rapyd-text)" }}>
                          {fmt(s.monthlyPension)}<span style={{ fontSize: 13, fontWeight: 400 }}>/חודש</span>
                        </div>
                        <div style={{ fontSize: 13, color: "var(--rapyd-text-muted)", marginTop: 4 }}>
                          צבירה: {fmt(s.accumulation)}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Mgmt fee savings */}
                {data.projection.mgmtFeeSavings && data.projection.mgmtFeeSavings.additionalMonthlyPension > 0 && (
                  <div style={{
                    marginTop: 20, background: "rgba(5,150,105,0.1)", border: "1px solid rgba(5,150,105,0.25)",
                    borderRadius: 10, padding: "14px 18px", display: "flex", alignItems: "center", gap: 12,
                  }}>
                    <span style={{ fontSize: 20 }}>💡</span>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: "#34D399", marginBottom: 2 }}>
                        הזדמנות: הפחתת דמי ניהול
                      </div>
                      <div style={{ fontSize: 13, color: "rgba(255,255,255,0.65)" }}>
                        מעבר לקרן עם דמי ניהול נמוכים יכול להוסיף{" "}
                        <strong style={{ color: "#34D399" }}>
                          {fmt(data.projection.mgmtFeeSavings.additionalMonthlyPension)}/חודש
                        </strong>{" "}
                        לקצבה
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Simulation */}
            {data.summary.hasData && (
              <div className="dashboard-card" style={{ padding: "28px 32px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
                  <Sparkles size={18} style={{ color: "#818CF8" }} />
                  <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: "var(--rapyd-text)" }}>
                    סימולציה — מה יקרה אם...
                  </h2>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginBottom: 20 }}>
                  <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    <span style={{ fontSize: 13, color: "var(--rapyd-text-muted)", fontWeight: 600 }}>גיל פרישה</span>
                    <input
                      type="number" min={50} max={75}
                      placeholder={`${data.summary.retirementAge || 67}`}
                      value={simAge}
                      onChange={(e) => setSimAge(e.target.value)}
                      style={{
                        background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)",
                        borderRadius: 8, padding: "10px 14px", color: "var(--rapyd-text)",
                        fontSize: 15, fontFamily: "inherit", outline: "none",
                      }}
                    />
                  </label>
                  <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    <span style={{ fontSize: 13, color: "var(--rapyd-text-muted)", fontWeight: 600 }}>הפרשה נוספת (₪/חודש)</span>
                    <input
                      type="number" min={0}
                      placeholder="0"
                      value={simExtra}
                      onChange={(e) => setSimExtra(e.target.value)}
                      style={{
                        background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)",
                        borderRadius: 8, padding: "10px 14px", color: "var(--rapyd-text)",
                        fontSize: 15, fontFamily: "inherit", outline: "none",
                      }}
                    />
                  </label>
                  <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    <span style={{ fontSize: 13, color: "var(--rapyd-text-muted)", fontWeight: 600 }}>דמי ניהול יעד (%)</span>
                    <input
                      type="number" min={0} max={2} step={0.1}
                      placeholder="0.3"
                      value={simFee}
                      onChange={(e) => setSimFee(e.target.value)}
                      style={{
                        background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)",
                        borderRadius: 8, padding: "10px 14px", color: "var(--rapyd-text)",
                        fontSize: 15, fontFamily: "inherit", outline: "none",
                      }}
                    />
                  </label>
                </div>

                <button
                  onClick={handleSimulate}
                  disabled={simLoading}
                  style={{
                    background: "#5B4FF5", color: "#fff", border: "none", borderRadius: 10,
                    padding: "12px 28px", fontSize: 15, fontWeight: 700, cursor: "pointer",
                    fontFamily: "inherit", display: "flex", alignItems: "center", gap: 8,
                    opacity: simLoading ? 0.7 : 1,
                  }}
                >
                  {simLoading ? <Loader2 size={16} className="spin" /> : <Sparkles size={16} />}
                  הרץ סימולציה
                </button>

                {simResult && (
                  <div style={{ marginTop: 20, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                    <div style={{
                      background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
                      borderRadius: 10, padding: "16px 20px",
                    }}>
                      <div style={{ fontSize: 12, color: "var(--rapyd-text-muted)", marginBottom: 8, fontWeight: 600 }}>
                        📊 תרחיש נוכחי
                      </div>
                      <div style={{ fontSize: 22, fontWeight: 800, color: "var(--rapyd-text)" }}>
                        {fmt(simResult.baseline.monthlyPensionEstimate)}/חודש
                      </div>
                      <div style={{ fontSize: 13, color: "var(--rapyd-text-muted)", marginTop: 4 }}>
                        גיל {simResult.baseline.retirementAge}
                      </div>
                    </div>
                    <div style={{
                      background: "rgba(91,79,245,0.12)", border: "1px solid rgba(91,79,245,0.3)",
                      borderRadius: 10, padding: "16px 20px",
                    }}>
                      <div style={{ fontSize: 12, color: "#A5B4FC", marginBottom: 8, fontWeight: 600 }}>
                        ✦ תרחיש חדש
                      </div>
                      <div style={{ fontSize: 22, fontWeight: 800, color: "#A5B4FC" }}>
                        {fmt(simResult.simulation.monthlyPensionEstimate)}/חודש
                      </div>
                      <div style={{ fontSize: 13, color: "rgba(165,180,252,0.7)", marginTop: 4 }}>
                        {simResult.delta.monthlyPensionDiff > 0
                          ? `+${fmt(simResult.delta.monthlyPensionDiff)} לחודש`
                          : fmt(simResult.delta.monthlyPensionDiff)}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Recommendations */}
            {data.recommendations.length > 0 && (
              <div className="dashboard-card" style={{ padding: "28px 32px" }}>
                <h2 style={{ fontSize: 18, fontWeight: 700, margin: "0 0 20px", color: "var(--rapyd-text)" }}>
                  המלצות
                </h2>
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {data.recommendations.map((rec) => (
                    <div key={rec.type} style={{
                      background: "rgba(255,255,255,0.04)", borderRadius: 10,
                      padding: "16px 20px", border: "1px solid rgba(255,255,255,0.07)",
                      display: "flex", gap: 16, alignItems: "flex-start",
                    }}>
                      <span style={{
                        background: `${urgencyColor(rec.urgency)}22`,
                        color: urgencyColor(rec.urgency),
                        borderRadius: 6, padding: "3px 10px", fontSize: 12, fontWeight: 700,
                        whiteSpace: "nowrap", marginTop: 2,
                      }}>
                        {urgencyLabel(rec.urgency)}
                      </span>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 700, color: "var(--rapyd-text)", marginBottom: 4 }}>
                          {rec.title}
                        </div>
                        <div style={{ fontSize: 14, color: "var(--rapyd-text-muted)" }}>
                          {rec.reason}
                        </div>
                        {rec.financialImpact && (
                          <div style={{ fontSize: 13, color: "#34D399", marginTop: 6, fontWeight: 600 }}>
                            💰 {rec.financialImpact}
                          </div>
                        )}
                      </div>
                      <div style={{ fontSize: 12, color: "var(--rapyd-text-muted)", whiteSpace: "nowrap" }}>
                        ביטחון {rec.confidenceScore}%
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

          </div>
        )}

        <p style={{ fontSize: 12, color: "var(--rapyd-text-muted)", textAlign: "center", margin: "24px 0 0", lineHeight: 1.6 }}>
          ⚠️ התחזיות מבוססות על הנתונים שהעלית ועל הנחות ממוצעות (תשואה, אינפלציה). אינן מהווות ייעוץ פנסיוני מקצועי. לפני כל שינוי בפנסיה, התייעצ/י עם יועץ פנסיוני מורשה.
        </p>
      </main>

      <AppFooter variant="private" />
    </div>
  );
}
