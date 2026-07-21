/**
 * PensionLeadingFundsTable — Finq leading comprehensive funds by risk cohort.
 * Tab switcher + RTL table wired to GET /api/pension/leading-funds?risk=
 */
import { useCallback, useEffect, useState } from "react";
import { AlertCircle, Info, Loader2, Sparkles, TrendingUp, UserCheck } from "lucide-react";
import {
  getPensionLeadingFunds,
  type PensionLeadingFundDTO,
  type PensionRiskLevel,
} from "../../api/pension.api";
import { bodyToken, feeLabelHe, rankLabelHe, type LeadingFundsInsights } from "./leadingFundsInsights";

const RISK_TABS: { id: PensionRiskLevel; label: string }[] = [
  { id: "LOW", label: "סיכון נמוך" },
  { id: "MEDIUM", label: "סיכון בינוני" },
  { id: "HIGH", label: "סיכון גבוה" },
  { id: "INCREASED", label: "סיכון מוגבר" },
];

const card: React.CSSProperties = {
  background: "var(--card)",
  border: "1px solid var(--border-hair)",
  borderRadius: "var(--radius)",
  boxShadow: "var(--shadow-soft)",
};

/** Values arrive already in percent units (0.15 = 0.15%) — never rescale. */
function fmtPct(val: number | null | undefined, digits = 2): string {
  if (val == null || Number.isNaN(val)) return "—";
  return `${val.toFixed(digits)}%`;
}

const nis = (n: number) => "₪" + Math.round(n).toLocaleString("en-US");

/* ── glass thought-bubble rail — the agent's notes beside the table ── */

function ThoughtBubble({
  tone,
  icon,
  title,
  children,
  delay = 0,
}: {
  tone: string;
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
  delay?: number;
}) {
  const tail: React.CSSProperties = {
    position: "absolute",
    borderRadius: "50%",
    background: "var(--glass-bg)",
    border: "1px solid var(--glass-border)",
    boxShadow: "var(--shadow-soft)",
  };
  return (
    <div
      className="plf-bubble"
      style={{
        position: "relative",
        background: "var(--glass-bg)",
        backdropFilter: "blur(var(--blur-glass)) saturate(160%)",
        WebkitBackdropFilter: "blur(var(--blur-glass)) saturate(160%)",
        border: "1px solid var(--glass-border)",
        borderRadius: 18,
        boxShadow: "var(--shadow-card)",
        padding: "15px 17px",
        animation: `plfBob 5.2s ease-in-out ${delay}s infinite`,
      }}
    >
      {/* thought tail — two shrinking circles drifting toward the table */}
      <span style={{ ...tail, width: 11, height: 11, top: 26, insetInlineEnd: -15 }} />
      <span style={{ ...tail, width: 6, height: 6, top: 42, insetInlineEnd: -24 }} />
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <span style={{ width: 26, height: 26, borderRadius: 8, flex: "none", display: "grid", placeItems: "center", background: `color-mix(in srgb, ${tone} 16%, transparent)`, color: tone }}>
          {icon}
        </span>
        <span style={{ fontSize: 13, fontWeight: 900, letterSpacing: "-.01em", color: "var(--text-strong)" }}>{title}</span>
      </div>
      <div style={{ fontSize: 12.5, lineHeight: 1.6, color: "var(--text-body)", fontWeight: 500, display: "flex", flexDirection: "column", gap: 6 }}>
        {children}
      </div>
    </div>
  );
}

function InsightsRail({
  insights,
  currentInTable,
}: {
  insights: LeadingFundsInsights;
  currentInTable: boolean;
}) {
  const cur = insights.current;
  const adv = insights.advice;
  return (
    <aside style={{ flex: "0 1 252px", minWidth: 228, display: "flex", flexDirection: "column", gap: 20, paddingTop: 4 }}>
      {cur && (
        <ThoughtBubble tone="var(--lav-600)" icon={<UserCheck size={14} strokeWidth={2.4} />} title="הקרן הנוכחית שלך">
          <span style={{ fontWeight: 800, color: "var(--text-strong)" }}>{cur.fundName}</span>
          {cur.userFee != null && (
            <span>
              דמי ניהול מצבירה: <b style={{ fontVariantNumeric: "tabular-nums" }}>{cur.userFee}%</b>
              {cur.marketAvgFee != null && <> · ממוצע השוק {cur.marketAvgFee}%</>} — {feeLabelHe(cur.feeVsMarket)}
            </span>
          )}
          <span>ביצועי המסלול: {rankLabelHe(cur.rankLabel)}</span>
          {currentInTable
            ? <span style={{ color: "var(--lav-600)", fontWeight: 700 }}>השורה הסגולה בטבלה — המסלול שלך.</span>
            : <span style={{ color: "var(--text-muted)" }}>המסלול שלך לא מדורג בין המובילים בטאב הזה.</span>}
        </ThoughtBubble>
      )}

      {adv?.shouldSwitch && (
        <ThoughtBubble tone="var(--mint-ink)" icon={<Sparkles size={14} strokeWidth={2.4} />} title="המלצת הסוכן — לשקול מעבר" delay={0.7}>
          <span>
            מעבר למסלול מוביל בדירוג יכול לחסוך לך עד{" "}
            <b style={{ color: "var(--mint-ink)", fontVariantNumeric: "tabular-nums" }}>{nis(adv.savingsByRetirement)}</b> עד הפרישה.
          </span>
          {adv.additionalMonthlyPension > 0 && (
            <span>
              המשמעות: תוספת של{" "}
              <b style={{ color: "var(--mint-ink)", fontVariantNumeric: "tabular-nums" }}>{nis(adv.additionalMonthlyPension)}</b> לקצבה החודשית.
            </span>
          )}
          <span style={{ color: "var(--mint-ink)", fontWeight: 700 }}>השורה הירוקה — החלופה המובילה ברמת הסיכון שבחרת.</span>
        </ThoughtBubble>
      )}

      <ThoughtBubble tone="var(--text-faint)" icon={<Info size={14} strokeWidth={2.4} />} title="איך לקרוא את הטבלה" delay={1.3}>
        <span>הדירוג של Finq משקלל תשואה, עקביות וסיכון — לא רק את המספר הגבוה ביותר.</span>
        <span>דמי הניהול הם הפער העיקרי שבשליטתך — אחוז קטן היום שווה הרבה בפרישה.</span>
        <span style={{ color: "var(--text-faint)", fontSize: 11.5 }}>תשואות עבר אינן מבטיחות תשואות עתידיות.</span>
      </ThoughtBubble>
    </aside>
  );
}

function SkeletonRows() {
  return (
    <>
      {Array.from({ length: 5 }).map((_, i) => (
        <tr key={i}>
          {Array.from({ length: 7 }).map((__, j) => (
            <td key={j} style={{ padding: "14px 16px" }}>
              <div
                style={{
                  height: 14,
                  borderRadius: 6,
                  background: "linear-gradient(90deg, var(--surface-sunken) 25%, var(--hair) 50%, var(--surface-sunken) 75%)",
                  backgroundSize: "200% 100%",
                  animation: "plfShimmer 1.2s ease-in-out infinite",
                }}
              />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

type PensionLeadingFundsTableProps = {
  /** The pension agent's analysis, mapped onto the table (rows + side notes). */
  insights?: LeadingFundsInsights | null;
};

export default function PensionLeadingFundsTable({ insights = null }: PensionLeadingFundsTableProps) {
  const [risk, setRisk] = useState<PensionRiskLevel>("MEDIUM");
  const [funds, setFunds] = useState<PensionLeadingFundDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [source, setSource] = useState<string | null>(null);

  const load = useCallback(async (selected: PensionRiskLevel) => {
    setLoading(true);
    setError(null);
    setWarning(null);
    const res = await getPensionLeadingFunds(selected);
    setLoading(false);
    if (res.ok && res.data?.success && res.data.data) {
      setFunds(res.data.data.funds ?? []);
      setSource(res.data.data.source);
      setWarning(res.data.data.warning ?? null);
    } else {
      setFunds([]);
      setError(!res.ok ? res.error.message : "לא הצלחנו לטעון את הקרנות המובילות");
    }
  }, []);

  useEffect(() => {
    if (document.getElementById("plf-anim")) return;
    const st = document.createElement("style");
    st.id = "plf-anim";
    st.textContent =
      "@keyframes plfShimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}" +
      "@keyframes plfIn{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}" +
      "@keyframes plfBob{0%,100%{transform:translateY(0)}50%{transform:translateY(-5px)}}" +
      "@media (prefers-reduced-motion:reduce){.plf-bubble{animation:none!important}}";
    document.head.appendChild(st);
  }, []);

  useEffect(() => {
    void load(risk);
  }, [risk, load]);

  // Agent annotations → row indexes. The current fund matches by Finq track
  // id (exact) or managing-body token; the recommendation is the top-ranked
  // row of a different body (list is already rank-sorted).
  const cur = insights?.current ?? null;
  const currentIdx = cur
    ? funds.findIndex(
        f => (cur.matchedTrackId != null && f.id === cur.matchedTrackId) || bodyToken(f.managingBody) === cur.token,
      )
    : -1;
  const recommendIdx = insights?.advice?.shouldSwitch
    ? funds.findIndex((f, i) => i !== currentIdx && bodyToken(f.managingBody) !== cur?.token)
    : -1;

  return (
    <section style={{ ...card, padding: "22px 22px 18px", marginBottom: 18, animation: "plfIn .45s var(--ease) both" }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, flexWrap: "wrap", marginBottom: 18 }}>
        <div>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <span style={{ width: 32, height: 32, borderRadius: 9, background: "var(--mint-soft)", color: "var(--mint-ink)", display: "grid", placeItems: "center" }}>
              <TrendingUp size={17} />
            </span>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 900, letterSpacing: "-.02em", color: "var(--text-strong)" }}>
              קרנות מובילות בשוק
            </h2>
          </div>
          <p style={{ margin: 0, fontSize: 13.5, color: "var(--text-muted)", fontWeight: 500, maxWidth: 520, lineHeight: 1.55 }}>
            השוואת קרנות מקיפות לפי רמת סיכון — נתונים מ-Finq, ממוינות לפי תשואה ל-3 שנים.
          </p>
        </div>
        {source && !loading && (
          <span style={{ fontSize: 11.5, fontWeight: 700, color: "var(--text-faint)", background: "var(--surface-sunken)", borderRadius: 999, padding: "5px 11px" }}>
            {source === "finq" ? "Finq · live" : source === "cache" ? "Cache" : "Cache · fallback"}
          </span>
        )}
      </div>

      {/* risk tabs */}
      <div
        role="tablist"
        aria-label="רמת סיכון"
        style={{
          display: "inline-flex",
          flexWrap: "wrap",
          gap: 6,
          padding: 5,
          borderRadius: "var(--r-pill)",
          background: "var(--surface-sunken)",
          border: "1px solid var(--border-hair)",
          marginBottom: 16,
        }}
      >
        {RISK_TABS.map(tab => {
          const active = tab.id === risk;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={active}
              disabled={loading && active}
              onClick={() => setRisk(tab.id)}
              style={{
                padding: "9px 16px",
                borderRadius: "var(--r-pill)",
                border: "none",
                cursor: loading && active ? "wait" : "pointer",
                fontFamily: "inherit",
                fontWeight: 800,
                fontSize: 13,
                color: active ? "#fff" : "var(--text-muted)",
                background: active ? "var(--mint-ink)" : "transparent",
                boxShadow: active ? "0 4px 14px rgba(47,156,98,.28)" : "none",
                transition: "background .2s var(--ease), color .2s var(--ease), box-shadow .2s var(--ease)",
              }}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {warning && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", borderRadius: "var(--r-sm)", background: "var(--butter-soft)", border: "1px solid var(--butter)", marginBottom: 14, fontSize: 13, fontWeight: 600, color: "var(--butter-ink)" }}>
          <AlertCircle size={15} /> {warning}
        </div>
      )}

      {error && !loading && (
        <div style={{ textAlign: "center", padding: "28px 16px", color: "var(--danger)", fontWeight: 700, fontSize: 14 }}>
          {error}
          <div style={{ marginTop: 12 }}>
            <button
              type="button"
              onClick={() => void load(risk)}
              style={{ padding: "9px 18px", borderRadius: "var(--r-pill)", border: "none", background: "var(--ink)", color: "#fff", fontFamily: "inherit", fontWeight: 800, cursor: "pointer" }}
            >
              נסה שוב
            </button>
          </div>
        </div>
      )}

      {!error && (
        <div style={{ display: "flex", gap: 26, alignItems: "flex-start", flexWrap: "wrap" }}>
        <div style={{ flex: "1 1 460px", minWidth: 0, overflowX: "auto", borderRadius: "var(--r-md)", border: "1px solid var(--border-hair)" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 720, fontSize: 13.5 }}>
            <thead>
              <tr style={{ background: "linear-gradient(180deg, var(--surface-sunken), var(--card))" }}>
                {["קרן", "גוף מנהל", "תשואה שנה", "תשואה 3 שנים", "תשואה 5 שנים", "דמי ניהול מצבירה", "דמי ניהול מהפקדה"].map(h => (
                  <th
                    key={h}
                    style={{
                      padding: "12px 16px",
                      textAlign: "right",
                      fontWeight: 800,
                      color: "var(--text-faint)",
                      fontSize: 11.5,
                      letterSpacing: ".04em",
                      borderBottom: "1px solid var(--border-hair)",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <SkeletonRows />
              ) : funds.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ padding: "36px 16px", textAlign: "center", color: "var(--text-muted)", fontWeight: 600 }}>
                    אין קרנות להצגה ברמת הסיכון הזו
                  </td>
                </tr>
              ) : (
                funds.map((f, i) => {
                  const positive = (f.yield3Years ?? 0) > 0;
                  const isCurrent = i === currentIdx;
                  const isRecommended = i === recommendIdx;
                  const baseBg = isCurrent
                    ? "rgba(155,127,232,.12)"
                    : isRecommended
                      ? "rgba(47,156,98,.10)"
                      : i % 2 === 0 ? "var(--card)" : "rgba(246,244,250,.55)";
                  const ring = isCurrent
                    ? "inset 0 0 0 1.5px var(--lav-400)"
                    : isRecommended
                      ? "inset 0 0 0 1.5px rgba(47,156,98,.5)"
                      : "none";
                  return (
                    <tr
                      key={f.id}
                      style={{
                        background: baseBg,
                        boxShadow: ring,
                        transition: "background .15s ease",
                      }}
                      onMouseEnter={e => { if (!isCurrent && !isRecommended) e.currentTarget.style.background = "var(--mint-soft)"; }}
                      onMouseLeave={e => { e.currentTarget.style.background = baseBg; }}
                    >
                      <td style={{ padding: "14px 16px", fontWeight: 800, color: "var(--text-strong)", maxWidth: 260 }}>
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                          {f.finqRank != null && (
                            <span style={{ width: 24, height: 24, borderRadius: 7, flex: "none", display: "grid", placeItems: "center", fontSize: 11.5, fontWeight: 900, background: f.finqRank === 1 ? "var(--mint-ink)" : "var(--mint-soft)", color: f.finqRank === 1 ? "#fff" : "var(--mint-ink)" }}>
                              {f.finqRank}
                            </span>
                          )}
                          {f.logoPath ? (
                            <img src={f.logoPath} alt="" width={22} height={22} loading="lazy" style={{ borderRadius: 6, objectFit: "contain", background: "#fff", border: "1px solid var(--border-hair)", flex: "none" }} />
                          ) : null}
                          <span>{f.fundName || "—"}</span>
                          {isCurrent && (
                            <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 10.5, fontWeight: 800, background: "var(--lav-600)", color: "#fff", borderRadius: 999, padding: "3px 9px", whiteSpace: "nowrap" }}>
                              <UserCheck size={11} strokeWidth={2.6} /> הקרן שלך
                            </span>
                          )}
                          {isRecommended && (
                            <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 10.5, fontWeight: 800, background: "var(--mint-ink)", color: "#fff", borderRadius: 999, padding: "3px 9px", whiteSpace: "nowrap" }}>
                              <Sparkles size={11} strokeWidth={2.6} /> מומלץ ע״י הסוכן
                            </span>
                          )}
                        </span>
                      </td>
                      <td style={{ padding: "14px 16px", color: "var(--text-body)", fontWeight: 600 }}>{f.managingBody || "—"}</td>
                      <td style={{ padding: "14px 16px", fontVariantNumeric: "tabular-nums", color: "var(--text-body)", fontWeight: 600 }}>{fmtPct(f.yield12Months)}</td>
                      <td style={{ padding: "14px 16px", fontWeight: 900, fontVariantNumeric: "tabular-nums", color: positive ? "var(--mint-ink)" : "var(--text-muted)" }}>
                        {fmtPct(f.yield3Years)}
                      </td>
                      <td style={{ padding: "14px 16px", fontVariantNumeric: "tabular-nums", color: "var(--text-body)", fontWeight: 600 }}>{fmtPct(f.yield5Years)}</td>
                      <td style={{ padding: "14px 16px", fontVariantNumeric: "tabular-nums", color: "var(--text-body)" }}>{fmtPct(f.managementFeeAccumulation)}</td>
                      <td style={{ padding: "14px 16px", fontVariantNumeric: "tabular-nums", color: "var(--text-body)" }}>{fmtPct(f.managementFeeDeposit)}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        {insights && !loading && funds.length > 0 && (
          <InsightsRail insights={insights} currentInTable={currentIdx >= 0} />
        )}
        </div>
      )}

      {loading && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 12, color: "var(--mint-ink)", fontSize: 13, fontWeight: 700 }}>
          <Loader2 size={16} style={{ animation: "spin .8s linear infinite" }} />
          טוען קרנות…
        </div>
      )}
    </section>
  );
}
