/**
 * PensionAdvisor — flagship pension agent analysis screen.
 * Wired to three_card_v5 via /api/pension/analysis.
 */
import { useEffect, useMemo, useState } from "react";
import {
  PiggyBank, TrendingUp, Upload, Plus, X, Check,
  Loader2, Trash2,
} from "lucide-react";
import PensionMarketComparisonTable from "./PensionMarketComparisonTable";
import PensionLeadingFundsTable from "./PensionLeadingFundsTable";
import ThreeCardSummary from "../financialAdvisory/ThreeCardSummary";
import { SHOW_FINQ_LEADING_FUNDS } from "../../config/featureFlags";
import { formatCurrencyOrDash } from "../../utils/formatters";
import { FUND_TYPE_LABELS, isPensionFundActive } from "../../utils/pensionDisplay";
import { isThreeCardAdvisory } from "../../api/financialAdvisory.types";
import { sumAnnualSavings } from "../../utils/financialAdvisoryDisplay";
import type {
  PensionAnalysisData, PensionFundDTO, UploadPensionBody,
} from "../../api/pension.api";

const fmt = formatCurrencyOrDash;

const PILLARS = [44, 64, 92, 124, 158, 196, 234];
const ISO = { baseY: 272, x0: 44, w: 38, gap: 20, dx: 17, dy: 9.5 };

type Props = {
  data: PensionAnalysisData | null;
  funds: PensionFundDTO[];
  analysisLoading?: boolean;
  analysisError?: string | null;
  onRetryAnalysis?: () => void;
  showAddForm: boolean;
  setShowAddForm: React.Dispatch<React.SetStateAction<boolean>>;
  form: UploadPensionBody;
  setForm: React.Dispatch<React.SetStateAction<UploadPensionBody>>;
  saving: boolean;
  saveMsg: { type: "success" | "error"; text: string } | null;
  deletingId: string | null;
  onSaveFund: () => void;
  onDeleteFund: (id: string) => void;
  onReimport: () => void;
};

export default function PensionAdvisor({
  data, funds, analysisLoading = false, analysisError = null, onRetryAnalysis,
  showAddForm, setShowAddForm, form, setForm, saving, saveMsg, deletingId,
  onSaveFund, onDeleteFund, onReimport,
}: Props) {
  const [tilt, setTilt] = useState({ x: 0, y: 0 });

  useEffect(() => {
    if (document.getElementById("pa-anim")) return;
    const st = document.createElement("style");
    st.id = "pa-anim";
    st.textContent =
      "@keyframes paRise{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:none}}" +
      "@keyframes paBar{from{opacity:0;transform:translateY(26px)}to{opacity:1;transform:translateY(0)}}" +
      "@keyframes paFloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-7px)}}" +
      "@keyframes paGlow{0%,100%{opacity:.5}50%{opacity:1}}" +
      "@media (prefers-reduced-motion:reduce){.pa-bar,.pa-float,.pa-glow{animation:none!important;opacity:1!important}}";
    document.head.appendChild(st);
  }, []);

  const summary = data?.summary;
  const projection = data?.projection;
  const hasData = !!summary?.hasData;

  const advisoryData = useMemo(() => {
    if (!isThreeCardAdvisory(data)) return data;
    const byId = new Map(funds.map(f => [f.id, f]));
    return {
      ...data,
      accountAnalyses: (data.accountAnalyses ?? []).map(a => ({
        ...a,
        currentBalance: byId.get(a.accountId)?.currentBalance ?? a.currentBalance,
      })),
    };
  }, [data, funds]);

  const base = projection?.projectedAccumulation ?? summary?.currentAccumulation ?? 0;
  const annualSavings = isThreeCardAdvisory(advisoryData) ? sumAnnualSavings(advisoryData) : 0;
  const projectionSavings = projection?.mgmtFeeSavings?.savingsByRetirement ?? 0;
  const optimistic = projection?.scenarios?.optimistic.accumulation ?? 0;
  const potential = annualSavings > 0
    ? annualSavings * Math.max(1, Math.round((projection?.monthsToRetirement ?? 120) / 12))
    : projectionSavings || (optimistic > base ? optimistic - base : 0);
  const target = base + (potential > 0 ? potential : 0);

  const activeFunds = funds.filter(isPensionFundActive);
  const inactiveFunds = funds.filter(f => !isPensionFundActive(f));

  if (!hasData && funds.length === 0 && !showAddForm) {
    return (
      <main style={{ maxWidth: 1080, margin: "0 auto", padding: "8px 0 40px" }}>
        <PensionMarketComparisonTable />
        {SHOW_FINQ_LEADING_FUNDS && <PensionLeadingFundsTable />}
        <div style={{ maxWidth: 720, margin: "32px auto 0", padding: "0 24px", textAlign: "center" }}>
          <span style={{ width: 64, height: 64, borderRadius: 18, margin: "0 auto 18px", background: "var(--mint-soft)", color: "var(--mint-ink)", display: "grid", placeItems: "center" }}><PiggyBank size={30} /></span>
          <h1 style={{ margin: 0, fontSize: 26, fontWeight: 900, letterSpacing: "-.03em", color: "var(--text-strong)" }}>אין עדיין נתוני פנסיה</h1>
          <p style={{ margin: "10px 0 22px", fontSize: 15, color: "var(--text-muted)", lineHeight: 1.6 }}>ייבא דוח מהר הכסף או הוסף קרן ידנית כדי לקבל ניתוח, תחזית והמלצות מותאמות.</p>
          <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
            <button onClick={onReimport} style={btnPrimary}><Upload size={16} /> ייבוא מהר הכסף</button>
            <button onClick={() => setShowAddForm(true)} style={btnGhost}><Plus size={16} /> הוסף קרן ידנית</button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main data-agent="pension" style={{ maxWidth: 1080, margin: "0 auto", padding: "8px 0 40px" }}>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 18, flexWrap: "wrap", marginBottom: 24, animation: "paRise .5s var(--ease) both" }}>
        <div>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "5px 12px", borderRadius: 999, background: "var(--mint-soft)", color: "var(--mint-ink)", fontSize: 12.5, fontWeight: 800, marginBottom: 13 }}>
            <PiggyBank size={14} /> סוכן עוזר פנסיוני
          </span>
          <h1 style={{ margin: 0, fontSize: "clamp(28px,3.6vw,42px)", fontWeight: 900, letterSpacing: "-.035em", lineHeight: 1.04, color: "var(--text-strong)" }}>ניתוח הפנסיה שלך</h1>
          <p style={{ margin: "8px 0 0", fontSize: 15.5, color: "var(--text-muted)", fontWeight: 500 }}>
            {activeFunds.length} פעילות
            {inactiveFunds.length > 0 ? ` · ${inactiveFunds.length} לא פעילות` : ""}
            {funds.length > 0 ? ` · ${funds.length} סה"כ` : ""}
            {" · "}גיל פרישה {summary?.retirementAge ?? 67}
          </p>
        </div>
        <div style={{ display: "flex", gap: 9 }}>
          <button onClick={() => setShowAddForm(v => !v)} style={btnGhost}><Upload size={16} /> הוסף קרן</button>
          <button onClick={onReimport} style={btnPrimary}><TrendingUp size={16} /> עדכן דוח</button>
        </div>
      </div>

      <div style={{ position: "relative", overflow: "hidden", borderRadius: 16, padding: "34px 36px", marginBottom: 18, background: "linear-gradient(150deg,#0E3D27 0%,#13301F 55%,#0B2418 100%)", boxShadow: "var(--shadow-card)", animation: "paRise .55s var(--ease) .05s both" }}>
        <div style={{ position: "relative", display: "grid", gridTemplateColumns: "1fr 1.15fr", gap: 24, alignItems: "center" }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 800, color: "#8FD6A8", letterSpacing: ".02em", marginBottom: 10 }}>צבירה צפויה בגיל פרישה</div>
            <div style={{ fontSize: "clamp(34px,5vw,58px)", fontWeight: 900, letterSpacing: "-.045em", lineHeight: 1, color: "#fff" }}>{fmt(target)}</div>
            {potential > 0 && (
              <div style={{ display: "inline-flex", alignItems: "center", gap: 8, marginTop: 16, padding: "8px 14px", borderRadius: 999, background: "rgba(95,184,127,.18)", border: "1px solid rgba(143,214,168,.3)", color: "#A6E5BC", fontSize: 13.5, fontWeight: 800 }}>
                <TrendingUp size={15} /> פוטנציאל חיסכון משוער: {fmt(potential)}
              </div>
            )}
          </div>
          <div
            onMouseMove={e => { const r = e.currentTarget.getBoundingClientRect(); setTilt({ x: ((e.clientX - r.left) / r.width - 0.5) * 12, y: ((e.clientY - r.top) / r.height - 0.5) * -8 }); }}
            onMouseLeave={() => setTilt({ x: 0, y: 0 })}
            style={{ perspective: 900 }}
          >
            <svg viewBox="0 0 360 300" style={{ width: "100%", display: "block", overflow: "visible", transform: `rotateY(${tilt.x}deg) rotateX(${tilt.y}deg)`, transition: "transform .25s var(--ease)" }}>
              <defs>
                <linearGradient id="paFront" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#4FB877" /><stop offset="1" stopColor="#2F9C62" /></linearGradient>
                <linearGradient id="paFrontPeak" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#7BE6A3" /><stop offset="1" stopColor="#3FBE7C" /></linearGradient>
              </defs>
              {PILLARS.map((h, i) => {
                const x = ISO.x0 + i * (ISO.w + ISO.gap);
                const top = ISO.baseY - h;
                const peak = i === PILLARS.length - 1;
                return (
                  <g key={i} className="pa-bar">
                    <rect x={x} y={top} width={ISO.w} height={h} fill={peak ? "url(#paFrontPeak)" : "url(#paFront)"} />
                  </g>
                );
              })}
            </svg>
          </div>
        </div>
      </div>

      <ThreeCardSummary
        data={isThreeCardAdvisory(advisoryData) ? advisoryData : null}
        loading={analysisLoading}
        error={analysisError}
        onRetry={onRetryAnalysis}
        hasAccounts={funds.length > 0}
        accent="mint"
      />

      <div style={{ ...cardBox, marginBottom: 18, marginTop: 18 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <span style={{ fontSize: 15.5, fontWeight: 800, color: "var(--text-strong)" }}>
            קרנות ומוצרים{" "}
            <span style={{ color: "var(--text-faint)", fontWeight: 700 }}>
              {activeFunds.length} פעילות{inactiveFunds.length > 0 ? ` · ${inactiveFunds.length} ארכיון` : ""}
            </span>
          </span>
          <button onClick={() => setShowAddForm(v => !v)} style={{ ...btnGhost, padding: "7px 13px", fontSize: 13 }}>{showAddForm ? <X size={15} /> : <Upload size={15} />}{showAddForm ? "ביטול" : "הוסף קרן"}</button>
        </div>

        {showAddForm && (
          <div style={{ padding: "14px", borderRadius: "var(--r-md)", background: "var(--surface-sunken)", border: "1px dashed var(--border-soft)", marginBottom: 12 }}>
            <input value={form.fundName} onChange={e => setForm(s => ({ ...s, fundName: e.target.value }))} placeholder="שם הקרן" style={addInput} />
            <select value={form.fundType} onChange={e => setForm(s => ({ ...s, fundType: e.target.value }))} style={{ ...addInput, cursor: "pointer" }}>
              {Object.entries(FUND_TYPE_LABELS).filter(([v]) => v !== "study_fund" && v !== "provident_fund").map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
            <input value={form.currentBalance || ""} onChange={e => setForm(s => ({ ...s, currentBalance: Number(e.target.value.replace(/[^\d.]/g, "")) || 0 }))} placeholder="יתרה נוכחית (₪)" style={addInput} />
            {saveMsg && <div style={{ fontSize: 12.5, fontWeight: 700, marginBottom: 8, color: saveMsg.type === "error" ? "var(--danger)" : "var(--mint-ink)" }}>{saveMsg.text}</div>}
            <button onClick={onSaveFund} disabled={saving || !form.fundName?.trim()} style={{ ...btnPrimary, width: "100%", justifyContent: "center" }}>
              {saving ? <Loader2 size={15} style={{ animation: "spin .8s linear infinite" }} /> : <Check size={15} />} הוסף קרן
            </button>
          </div>
        )}

        <FundList funds={activeFunds.length ? activeFunds : funds} deletingId={deletingId} onDeleteFund={onDeleteFund} />
        {inactiveFunds.length > 0 && <FundList funds={inactiveFunds} deletingId={deletingId} onDeleteFund={onDeleteFund} archived />}
      </div>

      <PensionMarketComparisonTable />
      {SHOW_FINQ_LEADING_FUNDS && <PensionLeadingFundsTable />}
    </main>
  );
}

function FundList({
  funds, deletingId, onDeleteFund, archived = false,
}: {
  funds: PensionFundDTO[];
  deletingId: string | null;
  onDeleteFund: (id: string) => void;
  archived?: boolean;
}) {
  if (!funds.length) {
    return (
      <div style={{ textAlign: "center", padding: "24px", color: "var(--text-faint)" }}>
        אין קרנות עדיין.
      </div>
    );
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {funds.map(f => (
        <div key={f.id} style={{ padding: "14px 15px", borderRadius: "var(--r-md)", background: archived ? "var(--surface-page)" : "var(--surface-sunken)", opacity: archived ? 0.85 : 1 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
            <div>
              <div style={{ fontWeight: 800, fontSize: 14.5 }}>{f.fundName}</div>
              <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{FUND_TYPE_LABELS[f.fundType] ?? f.fundType}{f.provider ? ` · ${f.provider}` : ""}</div>
            </div>
            <button onClick={() => onDeleteFund(f.id)} disabled={deletingId === f.id} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--danger)" }}>
              {deletingId === f.id ? <Loader2 size={14} style={{ animation: "spin .8s linear infinite" }} /> : <Trash2 size={14} />}
            </button>
          </div>
          <div style={{ fontWeight: 900, fontSize: 17, marginTop: 8 }}>{fmt(f.currentBalance)}</div>
        </div>
      ))}
    </div>
  );
}

const cardBox: React.CSSProperties = { background: "var(--card)", border: "1px solid var(--border-hair)", borderRadius: "var(--radius)", padding: "22px 24px", boxShadow: "var(--shadow-soft)" };
const btnPrimary: React.CSSProperties = { display: "inline-flex", alignItems: "center", gap: 8, padding: "11px 18px", borderRadius: "var(--r-pill)", border: "none", cursor: "pointer", fontFamily: "var(--font-body)", fontWeight: 800, fontSize: 14, color: "#fff", background: "var(--mint-ink)" };
const btnGhost: React.CSSProperties = { display: "inline-flex", alignItems: "center", gap: 8, padding: "11px 18px", borderRadius: "var(--r-pill)", border: "1px solid var(--border-soft)", cursor: "pointer", fontFamily: "var(--font-body)", fontWeight: 800, fontSize: 14, color: "var(--ink)", background: "var(--card)" };
const addInput: React.CSSProperties = { width: "100%", boxSizing: "border-box", padding: "10px 12px", borderRadius: "var(--r-sm)", border: "1px solid var(--border-soft)", background: "var(--card)", fontFamily: "var(--font-body)", fontSize: 13.5, marginBottom: 8 };
