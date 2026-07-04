/**
 * PensionLeadingFundsTable — Finq leading comprehensive funds by risk cohort.
 * Tab switcher + RTL table wired to GET /api/pension/leading-funds?risk=
 */
import { useCallback, useEffect, useState } from "react";
import { AlertCircle, Loader2, TrendingUp } from "lucide-react";
import {
  getPensionLeadingFunds,
  type PensionLeadingFundDTO,
  type PensionRiskLevel,
} from "../../api/pension.api";

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

function fmtPct(val: number | null | undefined, digits = 2): string {
  if (val == null || Number.isNaN(val)) return "—";
  const n = val > 0 && val < 1 ? val * 100 : val;
  return `${n.toFixed(digits)}%`;
}

function fmtNum(val: number | null | undefined, digits = 2): string {
  if (val == null || Number.isNaN(val)) return "—";
  return val.toFixed(digits);
}

function SkeletonRows() {
  return (
    <>
      {Array.from({ length: 5 }).map((_, i) => (
        <tr key={i}>
          {Array.from({ length: 6 }).map((__, j) => (
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

export default function PensionLeadingFundsTable() {
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
      setError(!res.ok ? res.error.message : "לא הצלחנו לטעון את קרנות המובילות");
    }
  }, []);

  useEffect(() => {
    if (document.getElementById("plf-anim")) return;
    const st = document.createElement("style");
    st.id = "plf-anim";
    st.textContent =
      "@keyframes plfShimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}" +
      "@keyframes plfIn{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}";
    document.head.appendChild(st);
  }, []);

  useEffect(() => {
    void load(risk);
  }, [risk, load]);

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
        <div style={{ overflowX: "auto", borderRadius: "var(--r-md)", border: "1px solid var(--border-hair)" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 720, fontSize: 13.5 }}>
            <thead>
              <tr style={{ background: "linear-gradient(180deg, var(--surface-sunken), var(--card))" }}>
                {["שם הקרן", "גוף מנהל", "תשואה 3 שנים", "דמי ניהול מצבירה", "דמי ניהול מהפקדה", "מדד שארפ"].map(h => (
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
                  <td colSpan={6} style={{ padding: "36px 16px", textAlign: "center", color: "var(--text-muted)", fontWeight: 600 }}>
                    אין קרנות להצגה ברמת הסיכון הזו
                  </td>
                </tr>
              ) : (
                funds.map((f, i) => {
                  const positive = (f.yield3Years ?? 0) > 0;
                  return (
                    <tr
                      key={f.id}
                      style={{
                        background: i % 2 === 0 ? "var(--card)" : "rgba(246,244,250,.55)",
                        transition: "background .15s ease",
                      }}
                      onMouseEnter={e => { e.currentTarget.style.background = "var(--mint-soft)"; }}
                      onMouseLeave={e => { e.currentTarget.style.background = i % 2 === 0 ? "var(--card)" : "rgba(246,244,250,.55)"; }}
                    >
                      <td style={{ padding: "14px 16px", fontWeight: 800, color: "var(--text-strong)", maxWidth: 220 }}>{f.fundName || "—"}</td>
                      <td style={{ padding: "14px 16px", color: "var(--text-body)", fontWeight: 600 }}>{f.managingBody || "—"}</td>
                      <td style={{ padding: "14px 16px", fontWeight: 900, fontVariantNumeric: "tabular-nums", color: positive ? "var(--mint-ink)" : "var(--text-muted)" }}>
                        {fmtPct(f.yield3Years)}
                      </td>
                      <td style={{ padding: "14px 16px", fontVariantNumeric: "tabular-nums", color: "var(--text-body)" }}>{fmtPct(f.managementFeeAccumulation)}</td>
                      <td style={{ padding: "14px 16px", fontVariantNumeric: "tabular-nums", color: "var(--text-body)" }}>{fmtPct(f.managementFeeDeposit)}</td>
                      <td style={{ padding: "14px 16px", fontVariantNumeric: "tabular-nums", fontWeight: 700, color: "var(--ink-soft)" }}>{fmtNum(f.sharpeRatio)}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
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
