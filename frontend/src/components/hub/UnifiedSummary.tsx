import { useMemo } from "react";
import { Sparkles, TrendingUp, Wallet } from "lucide-react";
import type { FullAnalysisResponse, FullAnalysisRecommendation } from "../../api/fullAnalysis.api";
import { AGENTS, type AgentId, type AgentTone } from "../../theme/agents";
import { PRIORITY_STYLE } from "./agentDisplay";
import { compareByValue, effortFor, parseYearlyImpact, totalYearlyValue } from "./recValue";

/* ============================================================
   UnifiedSummary — THE deliverable of the master agent: every
   recommendation the four domain agents produced, cross-referenced
   and gathered onto one readable surface. Reads like an advisor's
   work plan, not a report: one "worth handling it all" ₪/year
   headline, and inside each agent group the money×effort ordering
   puts the 10-minute call worth thousands first.
   Everything lives here — no jumping to other pages.
   Rendered only after a full analysis returned recommendations.
   ============================================================ */

/** Blended accent of all four agents (lavender → peach → mint → gold). */
const AGENT_GRADIENT = "linear-gradient(96deg,#9B7FE8 0%,#F4A87E 40%,#48C98B 72%,#E5C35C 100%)";

/** Backend recommendation.agentId → the display agent. */
const BACKEND_TO_AGENT: Record<string, AgentId> = {
  payslip: "payslips",
  insurance: "insurance",
  pension: "pension",
  gemel: "gemel",
};

/** Neutral tone for cross-domain ("profile"/general) recommendations. */
const GENERAL_TONE: AgentTone = {
  accent: "var(--lav-600)",
  strong: "var(--lav-700)",
  soft: "var(--lav-100)",
  ring: "var(--lav-200)",
  bg: "var(--lav-50)",
};

type Group = {
  key: string;
  label: string;
  Icon: typeof Wallet;
  tone: AgentTone;
  recs: FullAnalysisRecommendation[];
  /** Summed ₪/year of this group's parseable impacts (0 = none parsed). */
  value: number;
};

const nisRound = (n: number) => "₪" + Math.round(n).toLocaleString("en-US");

type UnifiedSummaryProps = {
  result: FullAnalysisResponse;
};

export default function UnifiedSummary({ result }: UnifiedSummaryProps) {
  const total = result.recommendations?.length ?? 0;

  const { groups, worth } = useMemo(() => {
    const recs = result.recommendations ?? [];
    const out: Group[] = [];
    // One card per domain agent; money×effort ordering inside each.
    for (const a of AGENTS) {
      const mine = recs.filter(r => BACKEND_TO_AGENT[r.agentId] === a.id).sort(compareByValue);
      if (mine.length) {
        out.push({ key: a.id, label: a.label, Icon: a.Icon, tone: a.tone, recs: mine, value: totalYearlyValue(mine).total });
      }
    }
    // Anything cross-domain (profile / unknown) → one "general" card.
    const general = recs.filter(r => !BACKEND_TO_AGENT[r.agentId]).sort(compareByValue);
    if (general.length) {
      out.push({ key: "general", label: "המלצות כלליות", Icon: Wallet, tone: GENERAL_TONE, recs: general, value: totalYearlyValue(general).total });
    }
    // Groups with the most money at stake first; "general" stays last.
    const domains = out.filter(g => g.key !== "general").sort((x, y) => y.value - x.value);
    const rest = out.filter(g => g.key === "general");
    return { groups: [...domains, ...rest], worth: totalYearlyValue(recs) };
  }, [result.recommendations]);

  if (!total) return null;

  const score = result.globalScore ?? null;

  return (
    <section style={{ marginBottom: 46, animation: "fgRise .6s var(--ease) both" }}>
      {/* gradient frame — signals "all four agents, one answer" */}
      <div style={{ background: AGENT_GRADIENT, borderRadius: "calc(var(--radius) + 2px)", padding: 2, boxShadow: "0 24px 60px -30px rgba(124,95,214,.5)" }}>
        <div style={{ background: "var(--card)", borderRadius: "var(--radius)", padding: "30px 32px" }}>
          {/* eyebrow */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18, flexWrap: "wrap" }}>
            <span style={{ width: 34, height: 34, borderRadius: 10, flex: "none", background: AGENT_GRADIENT, display: "grid", placeItems: "center", color: "#fff" }}>
              <Sparkles size={18} strokeWidth={2.2} />
            </span>
            <div style={{ flex: 1, minWidth: 180 }}>
              <div style={{ fontSize: 11.5, fontWeight: 800, letterSpacing: ".12em", color: "var(--lav-600)" }}>הסיכום המאוחד · הסוכן הראשי</div>
              <div style={{ fontSize: 13, color: "var(--text-muted)", fontWeight: 600, marginTop: 2 }}>
                כל ההמלצות מכל הסוכנים — מאוחדות למקום אחד
              </div>
            </div>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "var(--surface-sunken)", color: "var(--text-body)", borderRadius: 999, padding: "6px 13px", fontWeight: 800, fontSize: 13 }}>
              {total} המלצות
            </span>
            {score?.score != null && (
              <span style={{ display: "inline-flex", alignItems: "baseline", gap: 4, background: "var(--lav-100)", color: "var(--lav-700)", borderRadius: 999, padding: "6px 14px", fontWeight: 900, fontSize: 15, fontVariantNumeric: "tabular-nums" }}>
                {score.score}<span style={{ fontSize: 11, fontWeight: 700 }}>/100</span>
              </span>
            )}
          </div>

          {/* THE number — what handling everything is worth, per year */}
          {worth.total > 0 && (
            <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap", background: "var(--mint-soft)", border: "1px solid var(--mint)", borderRadius: "var(--r-md)", padding: "16px 20px", marginBottom: 22 }}>
              <span style={{ width: 38, height: 38, borderRadius: 10, flex: "none", background: "var(--mint)", color: "var(--mint-ink)", display: "grid", placeItems: "center" }}>
                <TrendingUp size={20} strokeWidth={2.3} />
              </span>
              <div style={{ flex: 1, minWidth: 200 }}>
                <div style={{ fontSize: 12.5, fontWeight: 700, color: "var(--mint-ink)", opacity: .85 }}>שווי מוערך של טיפול בהכל</div>
                <div style={{ fontSize: "clamp(24px,2.6vw,32px)", fontWeight: 900, letterSpacing: "-.02em", color: "var(--mint-ink)", lineHeight: 1.1, fontVariantNumeric: "tabular-nums" }}>
                  ~{nisRound(worth.total)}<span style={{ fontSize: 15, fontWeight: 800 }}> בשנה</span>
                </div>
              </div>
              <span style={{ fontSize: 11.5, fontWeight: 600, color: "var(--mint-ink)", opacity: .75, maxWidth: 190, textAlign: "end" }}>
                לפי {worth.counted} המלצות עם אומדן כספי · ממוין לפי שווי ומאמץ
              </span>
            </div>
          )}

          {/* short narrative lead (kept compact — the recommendations are the star) */}
          {result.summary && (
            <p style={{ margin: "0 0 22px", fontSize: 15.5, lineHeight: 1.7, fontWeight: 500, color: "var(--text-body)", whiteSpace: "pre-line", textWrap: "pretty", display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
              {result.summary}
            </p>
          )}

          {/* the collected recommendations, one clean card per agent */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(300px,1fr))", gap: 14, alignItems: "start" }}>
            {groups.map(g => (
              <div key={g.key} style={{ background: g.tone.bg, border: `1px solid ${g.tone.ring}`, borderRadius: "var(--r-md)", overflow: "hidden" }}>
                {/* agent header */}
                <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "13px 15px", borderBottom: `1px solid ${g.tone.ring}` }}>
                  <span style={{ width: 30, height: 30, borderRadius: 8, flex: "none", background: g.tone.soft, color: g.tone.accent, display: "grid", placeItems: "center" }}>
                    <g.Icon size={16} strokeWidth={2.2} />
                  </span>
                  <span style={{ fontSize: 14, fontWeight: 800, color: g.tone.strong, flex: 1, minWidth: 0 }}>{g.label}</span>
                  {g.value > 0 && (
                    <span style={{ fontSize: 11.5, fontWeight: 800, color: "var(--mint-ink)", fontVariantNumeric: "tabular-nums" }}>≈{nisRound(g.value)}/שנה</span>
                  )}
                  <span style={{ fontSize: 12, fontWeight: 800, color: g.tone.accent, background: g.tone.soft, borderRadius: 999, minWidth: 22, height: 22, display: "grid", placeItems: "center", padding: "0 7px" }}>{g.recs.length}</span>
                </div>

                {/* recommendation rows — biggest money, least effort first */}
                <div style={{ background: "var(--card)" }}>
                  {g.recs.map((r, i) => {
                    const pr = PRIORITY_STYLE[r.urgency] ?? PRIORITY_STYLE.medium;
                    const effort = effortFor(r.type);
                    const yearly = parseYearlyImpact(r.financialImpact);
                    return (
                      <div key={r.type + i} style={{ padding: "12px 15px", borderTop: i === 0 ? "none" : "1px solid var(--border-hair)" }}>
                        <div style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 5 }}>
                          <span style={{ flex: "none", marginTop: 2, fontSize: 10.5, fontWeight: 800, background: pr.bg, color: pr.color, borderRadius: 6, padding: "2px 7px" }}>{pr.label}</span>
                          <span style={{ flex: "none", marginTop: 2, fontSize: 10.5, fontWeight: 700, background: "var(--surface-sunken)", color: "var(--text-muted)", borderRadius: 6, padding: "2px 7px" }}>{effort.label}</span>
                          <span style={{ fontSize: 14, fontWeight: 800, color: "var(--text-strong)", lineHeight: 1.35 }}>{r.title}</span>
                        </div>
                        {/* the "how to fix / why" line — a few quiet words */}
                        <p style={{ margin: 0, fontSize: 12.5, lineHeight: 1.55, color: "var(--text-muted)", fontWeight: 500, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{r.reason}</p>
                        {r.financialImpact && (
                          <div style={{ marginTop: 7, display: "inline-flex", alignItems: "center", gap: 6, background: "var(--mint-soft)", color: "var(--mint-ink)", borderRadius: 6, padding: "3px 9px", fontSize: 12, fontWeight: 800, fontVariantNumeric: "tabular-nums" }}>
                            {r.financialImpact}
                            {yearly != null && !/שנה/.test(r.financialImpact) && (
                              <span style={{ fontWeight: 700, opacity: .75 }}>· ≈{nisRound(yearly)}/שנה</span>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
