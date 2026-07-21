/**
 * GemelAdvisor — flagship gemel agent analysis screen (קופות גמל והשתלמות).
 *
 * Follows the PensionAdvisor design language with the gemel butter/gold
 * accent: dark-gold hero with isometric growth pillars, market comparison
 * verdict cards vs Gemel-Net, impact-ranked recommendations, payslip
 * findings, funds list and a chat CTA.
 *
 * Fully wired to /api/gemel/* via props from GemelPage — no mock data.
 */
import { useEffect, useState } from "react";
import {
  PiggyBank, TrendingUp, Upload, Plus, X, Check, AlertTriangle, Scale,
  Loader2, Trash2, Landmark, Percent, CalendarClock, type LucideIcon,
} from "lucide-react";
import GemelLeadingFundsTable from "./GemelLeadingFundsTable";
import AgentInsightCta from "../ai/AgentInsightCta";
import { formatCurrencyOrDash } from "../../utils/formatters";
import { insightTeaser } from "../../utils/insightDisplay";
import type {
  GemelAnalysisData, GemelFundDTO, GemelMarketFundDTO,
  GemelRecommendationDTO, GemelFindingDTO, UploadGemelFundBody, GemelFundType,
} from "../../api/gemel.api";

const fmt = formatCurrencyOrDash;

export const GEMEL_FUND_TYPE_LABELS: Record<GemelFundType, string> = {
  study_fund: "קרן השתלמות",
  provident_fund: "קופת גמל",
};

const URGENCY: Record<string, { tag: string; tone: "peach" | "mint" | "lavender" }> = {
  high: { tag: "דחוף", tone: "peach" },
  medium: { tag: "מומלץ", tone: "mint" },
  low: { tag: "לבדיקה", tone: "lavender" },
};
const REC_TONE: Record<string, [string, string]> = {
  peach: ["var(--peach-soft)", "var(--peach-ink)"],
  mint: ["var(--mint-soft)", "var(--mint-ink)"],
  lavender: ["var(--lav-100)", "var(--lav-600)"],
};
const VERDICT_BADGE: Record<string, { bg: string; fg: string }> = {
  LEAVE: { bg: "var(--mint-soft)", fg: "var(--mint-ink)" },
  NEGOTIATE: { bg: "var(--butter-soft)", fg: "var(--butter-ink)" },
  SWITCH: { bg: "var(--peach-soft)", fg: "var(--peach-ink)" },
  REVIEW: { bg: "var(--lav-100)", fg: "var(--lav-600)" },
};
const SEVERITY_TONE: Record<string, { bg: string; fg: string; Icon: LucideIcon }> = {
  critical: { bg: "rgba(214,69,69,.08)", fg: "#C23B3B", Icon: X },
  warning: { bg: "var(--butter-soft)", fg: "var(--butter-ink)", Icon: AlertTriangle },
  info: { bg: "var(--lav-100)", fg: "var(--lav-600)", Icon: Check },
};

/* decorative isometric growth pillars — savings rising toward liquidity */
const PILLARS = [44, 64, 92, 124, 158, 196, 234];
const ISO = { baseY: 272, x0: 44, w: 38, gap: 20, dx: 17, dy: 9.5 };

type Props = {
  data: GemelAnalysisData | null;
  funds: GemelFundDTO[];
  showAddForm: boolean;
  setShowAddForm: React.Dispatch<React.SetStateAction<boolean>>;
  form: UploadGemelFundBody;
  setForm: React.Dispatch<React.SetStateAction<UploadGemelFundBody>>;
  saving: boolean;
  saveMsg: { type: "success" | "error"; text: string } | null;
  deletingId: string | null;
  onSaveFund: () => void;
  onDeleteFund: (id: string) => void;
  onImport: () => void;
};

export default function GemelAdvisor({
  data, funds, showAddForm, setShowAddForm, form, setForm, saving, saveMsg, deletingId,
  onSaveFund, onDeleteFund, onImport,
}: Props) {
  const [tilt, setTilt] = useState({ x: 0, y: 0 });

  useEffect(() => {
    if (document.getElementById("ga-anim")) return;
    const st = document.createElement("style");
    st.id = "ga-anim";
    st.textContent =
      "@keyframes gaRise{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:none}}" +
      "@keyframes gaBar{from{opacity:0;transform:translateY(26px)}to{opacity:1;transform:translateY(0)}}" +
      "@keyframes gaFloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-7px)}}" +
      "@keyframes gaGlow{0%,100%{opacity:.5}50%{opacity:1}}" +
      "@media (prefers-reduced-motion:reduce){.ga-bar,.ga-float,.ga-glow{animation:none!important;opacity:1!important}}";
    document.head.appendChild(st);
  }, []);

  const summary = data?.summary;
  const marketAdvice = data?.marketAdvice;
  const recs: GemelRecommendationDTO[] = data?.recommendations ?? [];
  const findings: GemelFindingDTO[] = data?.payslipFindings ?? [];
  const marketFunds: GemelMarketFundDTO[] = marketAdvice?.hasData ? marketAdvice.funds ?? [] : [];

  const hasData = !!summary?.hasData;
  const totalBalance = summary?.totalBalance ?? 0;
  const annualSavings = marketFunds.reduce((s, f) => s + (f.annualSavingsEstimate ?? 0), 0);

  const activeFunds = funds.filter(f => f.isActive);
  const archivedFunds = funds.filter(f => !f.isActive);

  // empty state — no gemel data yet
  if (!hasData && funds.length === 0 && !showAddForm) {
    return (
      <main style={{ maxWidth: 1080, margin: "0 auto", padding: "8px 0 40px" }}>
        <GemelLeadingFundsTable />
        <div style={{ maxWidth: 720, margin: "32px auto 0", padding: "0 24px", textAlign: "center" }}>
          <span style={{ width: 64, height: 64, borderRadius: 18, margin: "0 auto 18px", background: "var(--butter-soft)", color: "var(--butter-ink)", display: "grid", placeItems: "center" }}><PiggyBank size={30} /></span>
          <h1 style={{ margin: 0, fontSize: 26, fontWeight: 900, letterSpacing: "-.03em", color: "var(--text-strong)" }}>אין עדיין נתוני גמל והשתלמות</h1>
          <p style={{ margin: "10px 0 22px", fontSize: 15, color: "var(--text-muted)", lineHeight: 1.6 }}>ייבא דוח מהר הכסף או הוסף קופה ידנית כדי לקבל השוואה מול גמל-נט, זיהוי דמי ניהול גבוהים והמלצות מותאמות.</p>
          <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
            <button onClick={onImport} style={btnPrimary}><Upload size={16} /> ייבוא מהר הכסף</button>
            <button onClick={() => setShowAddForm(true)} style={btnGhost}><Plus size={16} /> הוסף קופה ידנית</button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main data-agent="gemel" style={{ maxWidth: 1080, margin: "0 auto", padding: "8px 0 40px" }}>
      {/* header */}
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 18, flexWrap: "wrap", marginBottom: 24, animation: "gaRise .5s var(--ease) both" }}>
        <div>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "5px 12px", borderRadius: 999, background: "var(--butter-soft)", color: "var(--butter-ink)", fontSize: 12.5, fontWeight: 800, marginBottom: 13 }}>
            <PiggyBank size={14} /> סוכן קופות גמל והשתלמות
          </span>
          <h1 style={{ margin: 0, fontSize: "clamp(28px,3.6vw,42px)", fontWeight: 900, letterSpacing: "-.035em", lineHeight: 1.04, color: "var(--text-strong)" }}>ניתוח הגמל וההשתלמות שלך</h1>
          <p style={{ margin: "8px 0 0", fontSize: 15.5, color: "var(--text-muted)", fontWeight: 500 }}>
            {summary?.studyFundCount ? `${summary.studyFundCount} קרנות השתלמות` : ""}
            {summary?.providentFundCount ? ` · ${summary.providentFundCount} קופות גמל` : ""}
            {!summary?.fundCount && summary?.hasStudyFund ? "קרן השתלמות מזוהה מהתלוש" : ""}
            {" · "}מקור השוואה: גמל-נט · עודכן היום
          </p>
        </div>
        <div style={{ display: "flex", gap: 9 }}>
          <button onClick={() => setShowAddForm(v => !v)} style={btnGhost}><Plus size={16} /> הוסף קופה</button>
          <button onClick={onImport} style={btnPrimary}><Upload size={16} /> ייבוא דוח</button>
        </div>
      </div>

      {/* dark-gold hero with isometric pillars */}
      <div style={{ position: "relative", overflow: "hidden", borderRadius: 16, padding: "34px 36px", marginBottom: 18, background: "linear-gradient(150deg,#3D3007 0%,#302606 55%,#241C04 100%)", boxShadow: "var(--shadow-card)", animation: "gaRise .55s var(--ease) .05s both" }}>
        <div style={{ position: "absolute", top: "-30%", insetInlineStart: "8%", width: 360, height: 360, borderRadius: "50%", background: "radial-gradient(circle,rgba(229,195,92,.30),transparent 65%)", pointerEvents: "none" }} />
        <div style={{ position: "relative", display: "grid", gridTemplateColumns: "1fr 1.15fr", gap: 24, alignItems: "center" }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 800, color: "#E5C35C", letterSpacing: ".02em", marginBottom: 10 }}>
              {totalBalance > 0 ? "צבירה כוללת בגמל והשתלמות" : "הפקדה חודשית מזוהה"}
            </div>
            <div style={{ fontSize: "clamp(34px,5vw,58px)", fontWeight: 900, letterSpacing: "-.045em", lineHeight: 1, color: "#fff" }}>
              {totalBalance > 0 ? fmt(totalBalance) : fmt(summary?.totalMonthlyContribution ?? 0)}
            </div>
            {annualSavings > 0 && (
              <div style={{ display: "inline-flex", alignItems: "center", gap: 8, marginTop: 16, padding: "8px 14px", borderRadius: 999, background: "rgba(229,195,92,.16)", border: "1px solid rgba(229,195,92,.32)", color: "#F0D98A", fontSize: 13.5, fontWeight: 800 }}>
                <TrendingUp size={15} /> עד {fmt(annualSavings)}/שנה חיסכון בדמי ניהול
              </div>
            )}
            <p style={{ margin: "18px 0 0", fontSize: 14.5, color: "rgba(255,255,255,.62)", lineHeight: 1.6, maxWidth: 340 }}>
              {summary?.hasStudyFund
                ? <>קרן השתלמות היא האפיק היחיד שפטור ממס רווחי הון — עד {fmt(summary?.annualTaxFreeDeposit ?? 20520)} בשנה. ניוד בין קופות לא מאפס ותק.</>
                : <>קרן השתלמות פטורה ממס רווחי הון עד {fmt(summary?.annualTaxFreeDeposit ?? 20520)} בשנה — שווה לבדוק זכאות מול המעסיק.</>}
            </p>
          </div>
          {/* iso chart — tilts with the mouse */}
          <div
            onMouseMove={e => { const r = e.currentTarget.getBoundingClientRect(); setTilt({ x: ((e.clientX - r.left) / r.width - 0.5) * 12, y: ((e.clientY - r.top) / r.height - 0.5) * -8 }); }}
            onMouseLeave={() => setTilt({ x: 0, y: 0 })}
            style={{ perspective: 900 }}
          >
            <svg viewBox="0 0 360 300" style={{ width: "100%", display: "block", overflow: "visible", transform: `rotateY(${tilt.x}deg) rotateX(${tilt.y}deg)`, transition: "transform .25s var(--ease)" }}>
              <defs>
                <linearGradient id="gaFront" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#D4AF37" /><stop offset="1" stopColor="#B98B16" /></linearGradient>
                <linearGradient id="gaFrontPeak" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#F5DC8B" /><stop offset="1" stopColor="#D9B33F" /></linearGradient>
              </defs>
              {[0, 1, 2, 3].map(g => (
                <line key={g} x1={ISO.x0 - 14 + g * 6} y1={ISO.baseY + 8 + g * 4} x2={330 + g * 6} y2={ISO.baseY - 30 + g * 4} stroke="rgba(229,195,92,.12)" strokeWidth="1" />
              ))}
              {PILLARS.map((h, i) => {
                const x = ISO.x0 + i * (ISO.w + ISO.gap);
                const top = ISO.baseY - h;
                const peak = i === PILLARS.length - 1;
                const front = peak ? "url(#gaFrontPeak)" : "url(#gaFront)";
                const topFill = peak ? "#FAEBB4" : "#E8CA6B";
                const sideFill = peak ? "#C29A28" : "#96700F";
                return (
                  <g key={i} className="ga-bar" style={{ animation: `gaBar .6s var(--ease) ${0.15 + i * 0.08}s both` }}>
                    <polygon points={`${x + ISO.w},${top} ${x + ISO.w + ISO.dx},${top - ISO.dy} ${x + ISO.w + ISO.dx},${ISO.baseY - ISO.dy} ${x + ISO.w},${ISO.baseY}`} fill={sideFill} />
                    <rect x={x} y={top} width={ISO.w} height={h} fill={front} />
                    <polygon points={`${x},${top} ${x + ISO.w},${top} ${x + ISO.w + ISO.dx},${top - ISO.dy} ${x + ISO.dx},${top - ISO.dy}`} fill={topFill} />
                    {i === 0 && <text x={x + ISO.w / 2} y={ISO.baseY + 20} textAnchor="middle" fontSize="11" fontWeight="700" fill="rgba(255,255,255,.5)">היום</text>}
                    {peak && <text x={x + ISO.w / 2} y={ISO.baseY + 20} textAnchor="middle" fontSize="11" fontWeight="700" fill="rgba(255,255,255,.5)">נזילות</text>}
                    {peak && (
                      <g style={{ animation: "gaFloat 3s ease-in-out infinite" }}>
                        <circle className="ga-glow" cx={x + ISO.w / 2 + ISO.dx / 2} cy={top - ISO.dy - 4} r="14" fill="#F5DC8B" opacity=".5" style={{ animation: "gaGlow 2.2s ease-in-out infinite" }} />
                        <circle cx={x + ISO.w / 2 + ISO.dx / 2} cy={top - ISO.dy - 4} r="5.5" fill="#fff" />
                      </g>
                    )}
                  </g>
                );
              })}
            </svg>
          </div>
        </div>
      </div>

      {/* stats row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(190px,1fr))", gap: 12, marginBottom: 18 }}>
        <StatCard Icon={Landmark} label="צבירה כוללת" value={fmt(totalBalance)} />
        <StatCard Icon={TrendingUp} label="הפקדה חודשית" value={fmt(summary?.totalMonthlyContribution ?? 0)} />
        <StatCard
          Icon={Percent}
          label="דמי ניהול ממוצעים"
          value={summary?.currentMgmtFee != null ? `${(summary.currentMgmtFee > 0.05 ? summary.currentMgmtFee : summary.currentMgmtFee * 100).toFixed(2)}%` : "—"}
        />
        <StatCard Icon={CalendarClock} label="תקרת הטבת מס שנתית" value={fmt(summary?.annualTaxFreeDeposit ?? 20520)} />
      </div>

      {/* market comparison — the gemel differentiator */}
      {marketFunds.length > 0 && (
        <div style={{ marginBottom: 18 }}>
          <h2 style={sectionTitle}>
            השוואה מול השוק — {marketAdvice?.sourceName ?? "גמל-נט"}
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {marketFunds.map((f, i) => {
              const badge = VERDICT_BADGE[f.verdict] ?? VERDICT_BADGE.REVIEW;
              return (
                <div key={i} style={{ ...cardBox, padding: "18px 20px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 10 }}>
                    <span style={{ width: 38, height: 38, borderRadius: 11, flex: "none", background: badge.bg, color: badge.fg, display: "grid", placeItems: "center" }}><Scale size={18} /></span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 800, fontSize: 15.5, color: "var(--text-strong)" }}>{f.productName}</div>
                      {f.companyName && <div style={{ fontSize: 12.5, color: "var(--text-muted)" }}>{f.companyName}</div>}
                    </div>
                    <span style={{ fontSize: 12, fontWeight: 900, color: badge.fg, background: badge.bg, borderRadius: 999, padding: "5px 13px" }}>{f.verdictLabelHe}</span>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(130px,1fr))", gap: 10, marginBottom: 10 }}>
                    <MiniStat label="אחוזון תשואה" value={f.returnPercentile != null ? `${f.returnPercentile}` : "—"} />
                    <MiniStat label="דמי ניהול שלך" value={f.userFee != null ? `${f.userFee.toFixed(2)}%` : "—"} />
                    <MiniStat label="ממוצע שוק" value={f.marketFee != null ? `${f.marketFee.toFixed(2)}%` : "—"} />
                    <MiniStat label="חיסכון שנתי אפשרי" value={f.annualSavingsEstimate ? fmt(f.annualSavingsEstimate) : "—"} highlight={!!f.annualSavingsEstimate} />
                  </div>
                  <p style={{ margin: 0, fontSize: 13.5, color: "var(--text-muted)", lineHeight: 1.5 }}>
                    {insightTeaser(f.summaryHe, 110)}
                  </p>
                  <AgentInsightCta agent="gemel" style={{ marginTop: 6 }} />
                  {f.alternatives.length > 0 && (
                    <div style={{ marginTop: 10, padding: "10px 12px", borderRadius: "var(--r-sm)", background: "var(--surface-sunken)", fontSize: 12.5, color: "var(--text-body)", fontWeight: 600 }}>
                      חלופות מובילות:{" "}
                      {f.alternatives.slice(0, 3).map(a => `${a.fundName} (${a.return5Years?.toFixed(1) ?? "—"}%)`).join(" · ")}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          {marketAdvice?.disclaimer && (
            <p style={{ margin: "10px 2px 0", fontSize: 11.5, color: "var(--text-faint)" }}>{marketAdvice.disclaimer}</p>
          )}
        </div>
      )}

      {/* recommendations by impact */}
      {recs.length > 0 && (
        <div style={{ marginBottom: 18 }}>
          <h2 style={sectionTitle}>המלצות — מדורגות לפי השפעה כספית</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {recs.map((r, i) => {
              const u = URGENCY[r.urgency] ?? URGENCY.low;
              const [bg, fg] = REC_TONE[u.tone];
              return (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 16, padding: "16px 18px", background: "var(--card)", border: "1px solid var(--border-hair)", borderRadius: "var(--r-md)", boxShadow: "var(--shadow-soft)" }}>
                  <span style={{ width: 40, height: 40, borderRadius: "50%", flex: "none", background: bg, color: fg, display: "grid", placeItems: "center", fontWeight: 900, fontSize: 16 }}>{i + 1}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 4, flexWrap: "wrap" }}>
                      <span style={{ fontWeight: 800, fontSize: 15.5, color: "var(--text-strong)" }}>{r.title}</span>
                      <span style={{ fontSize: 10.5, fontWeight: 800, color: fg, background: bg, borderRadius: 999, padding: "2px 9px" }}>{u.tag}</span>
                    </div>
                    <div style={{ fontSize: 13.5, color: "var(--text-muted)", lineHeight: 1.5 }}>
                      {insightTeaser(r.reason, 100)}
                    </div>
                    <AgentInsightCta agent="gemel" style={{ marginTop: 4 }} />
                  </div>
                  {r.financialImpact && (
                    <div style={{ textAlign: "center", flex: "none" }}>
                      <div style={{ fontSize: 17, fontWeight: 900, letterSpacing: "-.02em", color: "var(--butter-ink)", whiteSpace: "nowrap" }}>{r.financialImpact}</div>
                      <div style={{ fontSize: 11, color: "var(--text-faint)", fontWeight: 700 }}>פוטנציאל</div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* payslip findings */}
      {findings.length > 0 && (
        <div style={{ ...cardBox, marginBottom: 18 }}>
          <h2 style={{ ...sectionTitle, margin: "0 0 12px" }}>ממצאים מהתלושים</h2>
          <div style={{ display: "flex", flexDirection: "column" }}>
            {findings.map((f, i) => {
              const s = SEVERITY_TONE[f.severity] ?? SEVERITY_TONE.info;
              const Icon = s.Icon;
              return (
                <div key={f.id + i} style={{ display: "flex", alignItems: "flex-start", gap: 13, padding: "13px 4px", borderBottom: i < findings.length - 1 ? "1px solid var(--hair)" : "none" }}>
                  <span style={{ width: 32, height: 32, borderRadius: 9, flex: "none", background: s.bg, color: s.fg, display: "grid", placeItems: "center" }}><Icon size={16} strokeWidth={2.4} /></span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 800, fontSize: 14, color: "var(--text-strong)" }}>{f.title}</div>
                    <div style={{ fontSize: 12.5, color: "var(--text-muted)", lineHeight: 1.5 }}>
                      {insightTeaser(f.details, 96)}
                    </div>
                    <AgentInsightCta agent="gemel" style={{ marginTop: 4 }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* funds */}
      <div style={{ ...cardBox, marginBottom: 18 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <span style={{ fontSize: 15.5, fontWeight: 800, color: "var(--text-strong)" }}>
            קופות במעקב{" "}
            <span style={{ color: "var(--text-faint)", fontWeight: 700 }}>
              {activeFunds.length} פעילות{archivedFunds.length > 0 ? ` · ${archivedFunds.length} ארכיון` : ""}
            </span>
          </span>
          <button onClick={() => setShowAddForm(v => !v)} style={{ ...btnGhost, padding: "7px 13px", fontSize: 13 }}>{showAddForm ? <X size={15} /> : <Plus size={15} />}{showAddForm ? "ביטול" : "הוסף קופה"}</button>
        </div>

        {showAddForm && (
          <div style={{ padding: "14px 14px 12px", borderRadius: "var(--r-md)", background: "var(--surface-sunken)", border: "1px dashed var(--border-soft)", marginBottom: 12, animation: "gaRise .3s var(--ease)" }}>
            <input value={form.fundName} onChange={e => setForm(s => ({ ...s, fundName: e.target.value }))} placeholder="שם הקופה (למשל: אלטשולר שחם השתלמות כללי)" style={addInput} />
            <select value={form.fundType} onChange={e => setForm(s => ({ ...s, fundType: e.target.value as GemelFundType }))} style={{ ...addInput, cursor: "pointer" }}>
              {Object.entries(GEMEL_FUND_TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
            <input value={form.currentBalance || ""} onChange={e => setForm(s => ({ ...s, currentBalance: Number(e.target.value.replace(/[^\d.]/g, "")) || 0 }))} inputMode="numeric" placeholder="יתרה נוכחית (₪)" style={addInput} />
            <input value={form.managementFeeAccumulation || ""} onChange={e => setForm(s => ({ ...s, managementFeeAccumulation: Number(e.target.value.replace(/[^\d.]/g, "")) || 0 }))} inputMode="decimal" placeholder="דמי ניהול מצבירה (% לשנה, למשל 0.6)" style={addInput} />
            {saveMsg && <div style={{ fontSize: 12.5, fontWeight: 700, marginBottom: 8, color: saveMsg.type === "error" ? "var(--danger)" : "var(--butter-ink)" }}>{saveMsg.text}</div>}
            <button onClick={onSaveFund} disabled={saving || !form.fundName?.trim()} style={{ ...btnPrimary, width: "100%", justifyContent: "center", opacity: saving || !form.fundName?.trim() ? 0.6 : 1 }}>
              {saving ? <Loader2 size={15} style={{ animation: "spin .8s linear infinite" }} /> : <Check size={15} strokeWidth={2.6} />} הוסף קופה
            </button>
          </div>
        )}

        {funds.length === 0 && !showAddForm ? (
          <div style={{ textAlign: "center", padding: "34px 16px", color: "var(--text-faint)" }}>
            <PiggyBank size={28} style={{ marginBottom: 10 }} />
            <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text-muted)" }}>
              {summary?.hasStudyFund
                ? "זוהתה הפקדה לקרן השתלמות בתלוש — הוסף את הקופה כדי להשוות מול השוק."
                : "אין קופות עדיין. הוסף קופה ראשונה."}
            </div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {funds.map(f => (
              <div key={f.id} style={{ padding: "14px 15px", borderRadius: "var(--r-md)", background: f.isActive ? "var(--surface-sunken)" : "var(--surface-page)", border: "1px solid var(--border-hair)", opacity: f.isActive ? 1 : 0.82 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 3 }}>
                      <div style={{ fontWeight: 800, fontSize: 14.5, color: "var(--text-strong)" }}>{f.fundName}</div>
                      <span style={{ padding: "2px 8px", borderRadius: 999, fontSize: 10.5, fontWeight: 800, background: "var(--butter-soft)", color: "var(--butter-ink)" }}>
                        {GEMEL_FUND_TYPE_LABELS[f.fundType] ?? f.fundType}
                      </span>
                    </div>
                    <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                      {f.provider ? `${f.provider}` : ""}
                      {f.managementFeeAccumulation != null ? ` · דמ"נ ${(f.managementFeeAccumulation > 0.05 ? f.managementFeeAccumulation : f.managementFeeAccumulation * 100).toFixed(2)}%` : ""}
                      {f.ytdReturn != null ? ` · YTD ${f.ytdReturn.toFixed(2)}%` : ""}
                    </div>
                  </div>
                  <button onClick={() => onDeleteFund(f.id)} disabled={deletingId === f.id} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--danger)", padding: 4, display: "flex", flex: "none" }}>
                    {deletingId === f.id ? <Loader2 size={14} style={{ animation: "spin .8s linear infinite" }} /> : <Trash2 size={14} />}
                  </button>
                </div>
                <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginTop: 10, flexWrap: "wrap", gap: 8 }}>
                  <span style={{ fontWeight: 900, fontSize: 17, color: "var(--ink)" }}>{fmt(f.currentBalance)}</span>
                  {(f.monthlyEmployeeDeposit ?? 0) > 0 || (f.monthlyEmployerDeposit ?? 0) > 0 ? (
                    <span style={{ fontSize: 11.5, color: "var(--text-faint)", fontWeight: 600 }}>
                      הפקדות: עובד {fmt(f.monthlyEmployeeDeposit)} · מעסיק {fmt(f.monthlyEmployerDeposit)}
                    </span>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <GemelLeadingFundsTable />
    </main>
  );
}

function StatCard({ Icon, label, value }: { Icon: LucideIcon; label: string; value: string }) {
  return (
    <div style={{ ...cardBox, padding: "16px 18px", display: "flex", alignItems: "center", gap: 13 }}>
      <span style={{ width: 40, height: 40, borderRadius: 11, flex: "none", background: "var(--butter-soft)", color: "var(--butter-ink)", display: "grid", placeItems: "center" }}><Icon size={19} /></span>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-faint)" }}>{label}</div>
        <div style={{ fontSize: 18, fontWeight: 900, letterSpacing: "-.02em", color: "var(--text-strong)", fontVariantNumeric: "tabular-nums" }}>{value}</div>
      </div>
    </div>
  );
}

function MiniStat({ label, value, highlight = false }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div style={{ padding: "9px 12px", borderRadius: "var(--r-sm)", background: "var(--surface-sunken)", textAlign: "center" }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-faint)", marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 15, fontWeight: 900, fontVariantNumeric: "tabular-nums", color: highlight ? "var(--butter-ink)" : "var(--text-strong)" }}>{value}</div>
    </div>
  );
}

const sectionTitle: React.CSSProperties = { fontSize: 13, fontWeight: 800, color: "var(--text-faint)", letterSpacing: ".06em", margin: "0 2px 14px" };
const cardBox: React.CSSProperties = { background: "var(--card)", border: "1px solid var(--border-hair)", borderRadius: "var(--radius)", padding: "22px 24px", boxShadow: "var(--shadow-soft)" };
const btnPrimary: React.CSSProperties = { display: "inline-flex", alignItems: "center", gap: 8, padding: "11px 18px", borderRadius: "var(--r-pill)", border: "none", cursor: "pointer", fontFamily: "var(--font-body)", fontWeight: 800, fontSize: 14, color: "#fff", background: "var(--butter-ink)", boxShadow: "var(--shadow-soft)" };
const btnGhost: React.CSSProperties = { display: "inline-flex", alignItems: "center", gap: 8, padding: "11px 18px", borderRadius: "var(--r-pill)", border: "1px solid var(--border-soft)", cursor: "pointer", fontFamily: "var(--font-body)", fontWeight: 800, fontSize: 14, color: "var(--ink)", background: "var(--card)" };
const addInput: React.CSSProperties = { width: "100%", boxSizing: "border-box", padding: "10px 12px", borderRadius: "var(--r-sm)", border: "1px solid var(--border-soft)", background: "var(--card)", fontFamily: "var(--font-body)", fontSize: 13.5, fontWeight: 600, color: "var(--ink)", outline: "none", marginBottom: 8 };
