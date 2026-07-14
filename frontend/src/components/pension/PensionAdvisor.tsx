/**
 * PensionAdvisor — flagship pension agent analysis screen.
 *
 * Design: ui_kits/app/PensionAdvisor.jsx. Green primary. Signature 3D
 * isometric "pension growth" centerpiece (extruded pillars rising toward
 * retirement) that tilts with the mouse, a health gauge, impact-ranked
 * recommendations, a live simulation panel, funds and a chat CTA.
 *
 * Fully wired to /api/pension/* via props from PensionPage — no mock data.
 */
import { useEffect, useState } from "react";
import {
  PiggyBank, TrendingUp, Upload, Plus, X, Check, AlertTriangle,
  Sparkles, Loader2, Trash2, type LucideIcon,
} from "lucide-react";
import PensionLeadingFundsTable from "./PensionLeadingFundsTable";
import { formatCurrencyOrDash } from "../../utils/formatters";
import { FUND_TYPE_LABELS, RANK_BADGE, isPensionFundActive } from "../../utils/pensionDisplay";
import type {
  PensionAnalysisData, PensionFundDTO, UploadPensionBody,
  PensionBenchmarkFundDTO, PensionRecommendationDTO, PensionHealthCategoryDTO,
} from "../../api/pension.api";

const fmt = formatCurrencyOrDash;

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
const HSTATE: Record<string, { c: string; bg: string; Icon: LucideIcon }> = {
  good: { c: "var(--mint-ink)", bg: "var(--mint-soft)", Icon: Check },
  warning: { c: "var(--butter-ink)", bg: "var(--butter-soft)", Icon: AlertTriangle },
  poor: { c: "#C23B3B", bg: "rgba(214,69,69,.08)", Icon: X },
};

/* decorative isometric growth pillars (heights stylized; values are real) */
const PILLARS = [44, 64, 92, 124, 158, 196, 234];
const ISO = { baseY: 272, x0: 44, w: 38, gap: 20, dx: 17, dy: 9.5 };

function RadialGauge({ value, sub }: { value: number; sub: string }) {
  const size = 150, sw = 13, r = (size - sw) / 2, circ = 2 * Math.PI * r;
  const dash = (Math.min(Math.max(value, 0), 100) / 100) * circ;
  return (
    <div style={{ position: "relative", width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: "rotate(-90deg)", display: "block" }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--hair)" strokeWidth={sw} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--mint-ink)" strokeWidth={sw} strokeLinecap="round" strokeDasharray={`${dash} ${circ}`} style={{ transition: "stroke-dasharray 1.1s var(--ease)" }} />
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", textAlign: "center" }}>
        <div>
          <div style={{ fontSize: 34, fontWeight: 900, letterSpacing: "-.04em", lineHeight: 1, color: "var(--ink)" }}>{value}</div>
          <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-faint)", marginTop: 3 }}>{sub}</div>
        </div>
      </div>
    </div>
  );
}

type Props = {
  data: PensionAnalysisData | null;
  funds: PensionFundDTO[];
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
  onOpenChat: () => void;
};

export default function PensionAdvisor({
  data, funds, showAddForm, setShowAddForm, form, setForm, saving, saveMsg, deletingId,
  onSaveFund, onDeleteFund, onReimport, onOpenChat,
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
  const benchmark = data?.benchmark;
  const healthCheck = data?.healthCheck;
  const recs: PensionRecommendationDTO[] = data?.recommendations ?? [];

  const base = projection?.projectedAccumulation ?? summary?.currentAccumulation ?? 0;
  const optimistic = projection?.scenarios?.optimistic.accumulation ?? 0;
  const potential = benchmark?.summary?.totalPotentialSavings
    ?? projection?.mgmtFeeSavings?.savingsByRetirement
    ?? (optimistic > base ? optimistic - base : 0);
  const target = base + potential;
  const hasData = !!summary?.hasData;

  const benchByFund = new Map<string | undefined, PensionBenchmarkFundDTO>();
  (benchmark?.funds ?? []).forEach(b => { benchByFund.set(b.fundId, b); benchByFund.set(b.fundName, b); });
  const fundBench = (f: PensionFundDTO) => benchByFund.get(f.id) ?? benchByFund.get(f.fundName);

  const activeFunds = funds.filter(isPensionFundActive);
  const inactiveFunds = funds.filter(f => !isPensionFundActive(f));

  // empty state — no pension data yet
  if (!hasData && funds.length === 0 && !showAddForm) {
    return (
      <main style={{ maxWidth: 1080, margin: "0 auto", padding: "8px 0 40px" }}>
        <PensionLeadingFundsTable />
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
      {/* header */}
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
            {" · "}גיל פרישה {summary?.retirementAge ?? 67} · עודכן היום
          </p>
        </div>
        <div style={{ display: "flex", gap: 9 }}>
          <button onClick={() => setShowAddForm(v => !v)} style={btnGhost}><Upload size={16} /> הוסף קרן</button>
          <button onClick={onReimport} style={btnPrimary}><TrendingUp size={16} /> עדכן דוח</button>
        </div>
      </div>

      {/* 3D isometric growth hero */}
      <div style={{ position: "relative", overflow: "hidden", borderRadius: 16, padding: "34px 36px", marginBottom: 18, background: "linear-gradient(150deg,#0E3D27 0%,#13301F 55%,#0B2418 100%)", boxShadow: "var(--shadow-card)", animation: "paRise .55s var(--ease) .05s both" }}>
        <div style={{ position: "absolute", top: "-30%", insetInlineStart: "8%", width: 360, height: 360, borderRadius: "50%", background: "radial-gradient(circle,rgba(95,184,127,.34),transparent 65%)", pointerEvents: "none" }} />
        <div style={{ position: "relative", display: "grid", gridTemplateColumns: "1fr 1.15fr", gap: 24, alignItems: "center" }}>
          {/* copy */}
          <div>
            <div style={{ fontSize: 13, fontWeight: 800, color: "#8FD6A8", letterSpacing: ".02em", marginBottom: 10 }}>צבירה צפויה בגיל פרישה</div>
            <div style={{ fontSize: "clamp(34px,5vw,58px)", fontWeight: 900, letterSpacing: "-.045em", lineHeight: 1, color: "#fff" }}>{fmt(target)}</div>
            {potential > 0 && (
              <div style={{ display: "inline-flex", alignItems: "center", gap: 8, marginTop: 16, padding: "8px 14px", borderRadius: 999, background: "rgba(95,184,127,.18)", border: "1px solid rgba(143,214,168,.3)", color: "#A6E5BC", fontSize: 13.5, fontWeight: 800 }}>
                <TrendingUp size={15} /> + {fmt(potential)} פוטנציאל לא מנוצל
              </div>
            )}
            <p style={{ margin: "18px 0 0", fontSize: 14.5, color: "rgba(255,255,255,.62)", lineHeight: 1.6, maxWidth: 320 }}>
              {potential > 0
                ? <>מול {fmt(base)} בתרחיש הנוכחי. שינוי דמי הניהול והמסלול יכול לסגור את הפער.</>
                : <>על בסיס ההפקדות והמסלול הנוכחיים שלך עד גיל הפרישה.</>}
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
                <linearGradient id="paFront" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#4FB877" /><stop offset="1" stopColor="#2F9C62" /></linearGradient>
                <linearGradient id="paFrontPeak" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#7BE6A3" /><stop offset="1" stopColor="#3FBE7C" /></linearGradient>
              </defs>
              {[0, 1, 2, 3].map(g => (
                <line key={g} x1={ISO.x0 - 14 + g * 6} y1={ISO.baseY + 8 + g * 4} x2={330 + g * 6} y2={ISO.baseY - 30 + g * 4} stroke="rgba(143,214,168,.12)" strokeWidth="1" />
              ))}
              {PILLARS.map((h, i) => {
                const x = ISO.x0 + i * (ISO.w + ISO.gap);
                const top = ISO.baseY - h;
                const peak = i === PILLARS.length - 1;
                const front = peak ? "url(#paFrontPeak)" : "url(#paFront)";
                const topFill = peak ? "#A6F0C4" : "#6FD295";
                const sideFill = peak ? "#2E9E66" : "#247A4D";
                return (
                  <g key={i} className="pa-bar" style={{ animation: `paBar .6s var(--ease) ${0.15 + i * 0.08}s both` }}>
                    <polygon points={`${x + ISO.w},${top} ${x + ISO.w + ISO.dx},${top - ISO.dy} ${x + ISO.w + ISO.dx},${ISO.baseY - ISO.dy} ${x + ISO.w},${ISO.baseY}`} fill={sideFill} />
                    <rect x={x} y={top} width={ISO.w} height={h} fill={front} />
                    <polygon points={`${x},${top} ${x + ISO.w},${top} ${x + ISO.w + ISO.dx},${top - ISO.dy} ${x + ISO.dx},${top - ISO.dy}`} fill={topFill} />
                    {i === 0 && <text x={x + ISO.w / 2} y={ISO.baseY + 20} textAnchor="middle" fontSize="11" fontWeight="700" fill="rgba(255,255,255,.5)">היום</text>}
                    {peak && <text x={x + ISO.w / 2} y={ISO.baseY + 20} textAnchor="middle" fontSize="11" fontWeight="700" fill="rgba(255,255,255,.5)">פרישה</text>}
                    {peak && (
                      <g style={{ animation: "paFloat 3s ease-in-out infinite" }}>
                        <circle className="pa-glow" cx={x + ISO.w / 2 + ISO.dx / 2} cy={top - ISO.dy - 4} r="14" fill="#7BE6A3" opacity=".5" style={{ animation: "paGlow 2.2s ease-in-out infinite" }} />
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

      {/* health check */}
      {healthCheck && (
        <div style={{ display: "grid", gridTemplateColumns: "260px 1fr", gap: 18, marginBottom: 18 }}>
          <div style={{ background: "var(--card)", border: "1px solid var(--border-hair)", borderRadius: "var(--radius)", padding: "22px 20px", boxShadow: "var(--shadow-soft)", display: "flex", flexDirection: "column", alignItems: "center" }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: "var(--ink)", marginBottom: 14, alignSelf: "flex-start" }}>בריאות פנסיונית</div>
            <RadialGauge value={healthCheck.score} sub="מתוך 100" />
            <div style={{ fontSize: 12.5, color: "var(--text-muted)", fontWeight: 600, marginTop: 10 }}>{healthCheck.level.label}</div>
          </div>
          <div style={{ background: "var(--card)", border: "1px solid var(--border-hair)", borderRadius: "var(--radius)", padding: "10px 6px", boxShadow: "var(--shadow-soft)" }}>
            {healthCheck.categories.map((h: PensionHealthCategoryDTO, i) => {
              const s = HSTATE[h.status] ?? HSTATE.warning;
              const Icon = s.Icon;
              return (
                <div key={h.id} style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 16px", borderBottom: i < healthCheck.categories.length - 1 ? "1px solid var(--hair)" : "none" }}>
                  <span style={{ width: 34, height: 34, borderRadius: 9, flex: "none", background: s.bg, color: s.c, display: "grid", placeItems: "center" }}><Icon size={17} strokeWidth={2.4} /></span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 800, fontSize: 14.5, color: "var(--text-strong)" }}>{h.label}</div>
                    <div style={{ fontSize: 12.5, color: "var(--text-muted)" }}>{h.detail}</div>
                  </div>
                  <span style={{ fontWeight: 900, fontSize: 15, color: s.c, flex: "none" }}>{h.score}/{h.maxScore}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <PensionLeadingFundsTable />

      {/* recommendations by impact */}
      {recs.length > 0 && (
        <div style={{ marginBottom: 18 }}>
          <h2 style={{ fontSize: 13, fontWeight: 800, color: "var(--text-faint)", letterSpacing: ".06em", margin: "0 2px 14px" }}>המלצות — מדורגות לפי השפעה כספית</h2>
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
                    <div style={{ fontSize: 13.5, color: "var(--text-muted)", lineHeight: 1.5 }}>{r.reason}</div>
                  </div>
                  {r.financialImpact && (
                    <div style={{ textAlign: "center", flex: "none" }}>
                      <div style={{ fontSize: 17, fontWeight: 900, letterSpacing: "-.02em", color: "var(--mint-ink)", whiteSpace: "nowrap" }}>{r.financialImpact}</div>
                      <div style={{ fontSize: 11, color: "var(--text-faint)", fontWeight: 700 }}>עד הפרישה</div>
                    </div>
                  )}
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
              קרנות ומוצרים{" "}
              <span style={{ color: "var(--text-faint)", fontWeight: 700 }}>
                {activeFunds.length} פעילות{inactiveFunds.length > 0 ? ` · ${inactiveFunds.length} ארכיון` : ""}
              </span>
            </span>
            <button onClick={() => setShowAddForm(v => !v)} style={{ ...btnGhost, padding: "7px 13px", fontSize: 13 }}>{showAddForm ? <X size={15} /> : <Upload size={15} />}{showAddForm ? "ביטול" : "הוסף קרן"}</button>
          </div>

          {showAddForm && (
            <div style={{ padding: "14px 14px 12px", borderRadius: "var(--r-md)", background: "var(--surface-sunken)", border: "1px dashed var(--border-soft)", marginBottom: 12, animation: "paRise .3s var(--ease)" }}>
              <input value={form.fundName} onChange={e => setForm(s => ({ ...s, fundName: e.target.value }))} placeholder="שם הקרן (למשל: הפניקס פנסיה)" style={addInput} />
              <select value={form.fundType} onChange={e => setForm(s => ({ ...s, fundType: e.target.value }))} style={{ ...addInput, cursor: "pointer" }}>
                {Object.entries(FUND_TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
              <input value={form.currentBalance || ""} onChange={e => setForm(s => ({ ...s, currentBalance: Number(e.target.value.replace(/[^\d.]/g, "")) || 0 }))} inputMode="numeric" placeholder="יתרה נוכחית (₪)" style={addInput} />
              {saveMsg && <div style={{ fontSize: 12.5, fontWeight: 700, marginBottom: 8, color: saveMsg.type === "error" ? "var(--danger)" : "var(--mint-ink)" }}>{saveMsg.text}</div>}
              <button onClick={onSaveFund} disabled={saving || !form.fundName?.trim()} style={{ ...btnPrimary, width: "100%", justifyContent: "center", opacity: saving || !form.fundName?.trim() ? 0.6 : 1 }}>
                {saving ? <Loader2 size={15} style={{ animation: "spin .8s linear infinite" }} /> : <Check size={15} strokeWidth={2.6} />} הוסף קרן
              </button>
            </div>
          )}

          {funds.length === 0 && !showAddForm ? (
            <div style={{ textAlign: "center", padding: "34px 16px", color: "var(--text-faint)" }}>
              <PiggyBank size={28} style={{ marginBottom: 10 }} />
              <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text-muted)" }}>אין קרנות עדיין. הוסף קרן ראשונה.</div>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {activeFunds.length > 0 && (
                <FundGroup title="פעילות" funds={activeFunds} fundBench={fundBench} deletingId={deletingId} onDeleteFund={onDeleteFund} />
              )}
              {inactiveFunds.length > 0 && (
                <FundGroup title="לא פעילות (ארכיון)" funds={inactiveFunds} fundBench={fundBench} deletingId={deletingId} onDeleteFund={onDeleteFund} archived />
              )}
            </div>
          )}
      </div>

      {/* chat CTA */}
      <div style={{ position: "relative", overflow: "hidden", borderRadius: "var(--radius)", padding: "28px 30px", textAlign: "center", background: "var(--mint-soft)", border: "1px solid rgba(47,156,98,.18)" }}>
        <div style={{ width: 48, height: 48, borderRadius: 14, margin: "0 auto 14px", background: "var(--mint-ink)", color: "#fff", display: "grid", placeItems: "center", boxShadow: "var(--shadow-soft)" }}><Sparkles size={22} /></div>
        <div style={{ fontSize: 19, fontWeight: 900, letterSpacing: "-.02em", marginBottom: 6, color: "var(--text-strong)" }}>שאל את יועץ הפנסיה</div>
        <p style={{ margin: "0 auto 18px", fontSize: 14.5, color: "var(--text-muted)", maxWidth: 420, lineHeight: 1.5 }}>"מתי כדאי לפרוש?", "האם כדאי לאחד קרנות?", "כמה אני משלם בדמי ניהול?"</p>
        <button onClick={onOpenChat} style={{ ...btnPrimary, padding: "14px 26px", fontSize: 15.5 }}><Sparkles size={17} /> פתח שיחה עם יועץ הפנסיה</button>
      </div>
    </main>
  );
}

function FundGroup({
  title, funds, fundBench, deletingId, onDeleteFund, archived = false,
}: {
  title: string;
  funds: PensionFundDTO[];
  fundBench: (f: PensionFundDTO) => PensionBenchmarkFundDTO | undefined;
  deletingId: string | null;
  onDeleteFund: (id: string) => void;
  archived?: boolean;
}) {
  return (
    <div>
      <div style={{ fontSize: 12, fontWeight: 800, color: archived ? "var(--text-faint)" : "var(--mint-ink)", marginBottom: 8, letterSpacing: ".04em" }}>{title}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {funds.map(f => {
          const bf = fundBench(f);
          const rank = bf ? RANK_BADGE[bf.rankLabel] ?? RANK_BADGE.unknown : null;
          const active = isPensionFundActive(f);
          return (
            <div
              key={f.id}
              style={{
                padding: "14px 15px",
                borderRadius: "var(--r-md)",
                background: archived ? "var(--surface-page)" : "var(--surface-sunken)",
                border: `1px solid ${archived ? "var(--border-hair)" : "var(--border-hair)"}`,
                opacity: archived ? 0.82 : 1,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 3 }}>
                    <div style={{ fontWeight: 800, fontSize: 14.5, color: "var(--text-strong)" }}>{f.fundName}</div>
                    <span style={{
                      padding: "2px 8px", borderRadius: 999, fontSize: 10.5, fontWeight: 800,
                      background: active ? "rgba(47,156,98,0.12)" : "rgba(220,38,38,0.1)",
                      color: active ? "var(--mint-ink)" : "#DC2626",
                    }}>
                      {active ? "פעיל" : "לא פעיל"}
                    </span>
                  </div>
                  <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                    {FUND_TYPE_LABELS[f.fundType] ?? f.fundType}
                    {f.provider ? ` · ${f.provider}` : ""}
                    {f.managementFeeAccumulation != null ? ` · ${(f.managementFeeAccumulation * 100).toFixed(2)}%` : ""}
                    {f.ytdReturn != null ? ` · YTD ${f.ytdReturn.toFixed(2)}%` : ""}
                  </div>
                </div>
                <button onClick={() => onDeleteFund(f.id)} disabled={deletingId === f.id} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--danger)", padding: 4, display: "flex", flex: "none" }}>
                  {deletingId === f.id ? <Loader2 size={14} style={{ animation: "spin .8s linear infinite" }} /> : <Trash2 size={14} />}
                </button>
              </div>
              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginTop: 10, flexWrap: "wrap", gap: 8 }}>
                <span style={{ fontWeight: 900, fontSize: 17, color: archived ? "var(--text-muted)" : "var(--ink)" }}>{fmt(f.currentBalance)}</span>
                {active && rank && (
                  <span style={{ fontSize: 11.5, fontWeight: 800, color: rank.color, background: rank.bg, borderRadius: 999, padding: "2px 9px" }}>
                    {bf && bf.matchConfidence < 60 ? "לא מזוהה" : rank.label}
                  </span>
                )}
              </div>
              {active && (f.monthlyEmployeeDeposit > 0 || f.monthlyEmployerDeposit > 0) && (
                <div style={{ fontSize: 11.5, color: "var(--text-faint)", marginTop: 8, fontWeight: 600 }}>
                  הפקדות: עובד {fmt(f.monthlyEmployeeDeposit)} · מעסיק {fmt(f.monthlyEmployerDeposit)}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

const cardBox: React.CSSProperties = { background: "var(--card)", border: "1px solid var(--border-hair)", borderRadius: "var(--radius)", padding: "22px 24px", boxShadow: "var(--shadow-soft)" };
const btnPrimary: React.CSSProperties = { display: "inline-flex", alignItems: "center", gap: 8, padding: "11px 18px", borderRadius: "var(--r-pill)", border: "none", cursor: "pointer", fontFamily: "var(--font-body)", fontWeight: 800, fontSize: 14, color: "#fff", background: "var(--mint-ink)", boxShadow: "var(--shadow-soft)" };
const btnGhost: React.CSSProperties = { display: "inline-flex", alignItems: "center", gap: 8, padding: "11px 18px", borderRadius: "var(--r-pill)", border: "1px solid var(--border-soft)", cursor: "pointer", fontFamily: "var(--font-body)", fontWeight: 800, fontSize: 14, color: "var(--ink)", background: "var(--card)" };
const addInput: React.CSSProperties = { width: "100%", boxSizing: "border-box", padding: "10px 12px", borderRadius: "var(--r-sm)", border: "1px solid var(--border-soft)", background: "var(--card)", fontFamily: "var(--font-body)", fontSize: 13.5, fontWeight: 600, color: "var(--ink)", outline: "none", marginBottom: 8 };
