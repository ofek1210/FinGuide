/**
 * GemelAdvisor — flagship gemel agent analysis screen.
 * Wired to three_card_v5 via /api/gemel/analysis.
 */
import { useMemo } from "react";
import {
  PiggyBank, TrendingUp, Plus, X, Check, AlertTriangle,
  Trash2, Landmark, Percent, CalendarClock, type LucideIcon,
} from "lucide-react";
import GemelMarketComparisonTable from "./GemelMarketComparisonTable";
import GemelLeadingFundsTable from "./GemelLeadingFundsTable";
import ThreeCardSummary from "../financialAdvisory/ThreeCardSummary";
import AgentInsightCta from "../ai/AgentInsightCta";
import DocumentCenterCta from "../hub/DocumentCenterCta";
import { SHOW_LEGACY_GEMEL_LEADING_FUNDS } from "../../config/featureFlags";
import { isThreeCardAdvisory } from "../../api/financialAdvisory.types";
import { sumAnnualSavings } from "../../utils/financialAdvisoryDisplay";
import { formatCurrencyOrDash } from "../../utils/formatters";
import { insightTeaser } from "../../utils/insightDisplay";
import type {
  GemelAnalysisData, GemelFundDTO, GemelFindingDTO,
  UploadGemelFundBody, GemelFundType,
} from "../../api/gemel.api";

const fmt = formatCurrencyOrDash;

export const GEMEL_FUND_TYPE_LABELS: Record<GemelFundType, string> = {
  study_fund: "קרן השתלמות",
  provident_fund: "קופת גמל",
};

const SEVERITY_TONE: Record<string, { bg: string; fg: string; Icon: LucideIcon }> = {
  critical: { bg: "rgba(214,69,69,.08)", fg: "#C23B3B", Icon: X },
  warning: { bg: "var(--butter-soft)", fg: "var(--butter-ink)", Icon: AlertTriangle },
  info: { bg: "var(--lav-100)", fg: "var(--lav-600)", Icon: Check },
};

type Props = {
  data: GemelAnalysisData | null;
  funds: GemelFundDTO[];
  analysisLoading?: boolean;
  analysisError?: string | null;
  onRetryAnalysis?: () => void;
  hasPayslipGemelData?: boolean;
  showAddForm: boolean;
  setShowAddForm: React.Dispatch<React.SetStateAction<boolean>>;
  form: UploadGemelFundBody;
  setForm: React.Dispatch<React.SetStateAction<UploadGemelFundBody>>;
  saving: boolean;
  saveMsg: { type: "success" | "error"; text: string } | null;
  deletingId: string | null;
  onSaveFund: () => void;
  onDeleteFund: (id: string) => void;
};

export default function GemelAdvisor({
  data, funds, analysisLoading = false, analysisError = null, onRetryAnalysis,
  hasPayslipGemelData = false,
  showAddForm, setShowAddForm, form, setForm, saving, saveMsg: _saveMsg, deletingId: _deletingId,
  onSaveFund, onDeleteFund,
}: Props) {
  const summary = data?.summary;
  const findings: GemelFindingDTO[] = data?.payslipFindings ?? [];
  const hasData = !!summary?.hasData;
  const totalBalance = summary?.totalBalance ?? 0;

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

  const annualSavings = isThreeCardAdvisory(advisoryData) ? sumAnnualSavings(advisoryData) : 0;
  const showPayslipOnly = !hasData && funds.length === 0 && hasPayslipGemelData;

  if (!hasData && funds.length === 0 && !showAddForm) {
    return (
      <main style={{ maxWidth: 1080, margin: "0 auto", padding: "8px 0 40px" }}>
        <GemelMarketComparisonTable />
        {SHOW_LEGACY_GEMEL_LEADING_FUNDS && <GemelLeadingFundsTable />}
        <div style={{ maxWidth: 720, margin: "32px auto 0", padding: "0 24px", textAlign: "center" }}>
          <span style={{ width: 64, height: 64, borderRadius: 18, margin: "0 auto 18px", background: "var(--butter-soft)", color: "var(--butter-ink)", display: "grid", placeItems: "center" }}><PiggyBank size={30} /></span>
          <h1 style={{ margin: 0, fontSize: 26, fontWeight: 900, color: "var(--text-strong)" }}>אין עדיין נתוני גמל והשתלמות</h1>
          <p style={{ margin: "10px 0 22px", fontSize: 15, color: "var(--text-muted)", lineHeight: 1.6 }}>ייבאו דוח מסלקה במרכז המסמכים או הוסיפו קופה ידנית.</p>
          <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
            <DocumentCenterCta documentId="clearinghouse" />
            <button onClick={() => setShowAddForm(true)} style={btnGhost}><Plus size={16} /> הוסף קופה ידנית</button>
          </div>
          {showPayslipOnly && (
            <div style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: 16, marginTop: 20, borderRadius: "var(--radius)", background: "var(--butter-soft)", border: "1px solid var(--butter)", textAlign: "start" }}>
              <AlertTriangle size={20} style={{ flexShrink: 0, color: "var(--butter-ink)" }} />
              <div style={{ fontSize: 14, lineHeight: 1.6, color: "var(--text-strong)" }}>
                זוהו הפקדות גמל/השתלמות מהתלוש — להשוואה מול השוק וניתוח מלא, ייבאו דוח מסלקה במרכז המסמכים.
              </div>
            </div>
          )}
        </div>
      </main>
    );
  }

  return (
    <main data-agent="gemel" style={{ maxWidth: 1080, margin: "0 auto", padding: "8px 0 40px" }}>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 18, flexWrap: "wrap", marginBottom: 24 }}>
        <div>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "5px 12px", borderRadius: 999, background: "var(--butter-soft)", color: "var(--butter-ink)", fontSize: 12.5, fontWeight: 800, marginBottom: 13 }}>
            <PiggyBank size={14} /> סוכן קופות גמל והשתלמות
          </span>
          <h1 style={{ margin: 0, fontSize: "clamp(28px,3.6vw,42px)", fontWeight: 900, color: "var(--text-strong)" }}>ניתוח הגמל וההשתלמות שלך</h1>
        </div>
        <div style={{ display: "flex", gap: 9, flexWrap: "wrap" }}>
          <button onClick={() => setShowAddForm(v => !v)} style={btnGhost}><Plus size={16} /> הוסף קופה</button>
          <DocumentCenterCta documentId="clearinghouse" variant="ghost" label="למרכז המסמכים" />
        </div>
      </div>

      {showPayslipOnly && (
        <div style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: 16, marginBottom: 18, borderRadius: "var(--radius)", background: "var(--butter-soft)", border: "1px solid var(--butter)" }}>
          <AlertTriangle size={20} style={{ flexShrink: 0, color: "var(--butter-ink)" }} />
          <div style={{ fontSize: 14, lineHeight: 1.6, color: "var(--text-strong)" }}>
            זוהו הפקדות גמל/השתלמות מהתלוש — להשוואה מול השוק וניתוח מלא, ייבאו דוח מסלקה במרכז המסמכים.
            <div style={{ marginTop: 10 }}><DocumentCenterCta documentId="clearinghouse" /></div>
          </div>
        </div>
      )}

      <div style={{ borderRadius: 16, padding: "28px 32px", marginBottom: 18, background: "linear-gradient(150deg,#3D3007 0%,#302606 55%,#241C04 100%)", color: "#fff" }}>
        <div style={{ fontSize: 13, fontWeight: 800, color: "#E5C35C", marginBottom: 8 }}>צבירה כוללת</div>
        <div style={{ fontSize: "clamp(32px,4vw,52px)", fontWeight: 900 }}>{totalBalance > 0 ? fmt(totalBalance) : fmt(summary?.totalMonthlyContribution ?? 0)}</div>
        {annualSavings > 0 && (
          <div style={{ marginTop: 12, fontSize: 13.5, fontWeight: 800, color: "#F0D98A" }}>
            חיסכון שנתי משוער בדמי ניהול: {fmt(annualSavings)}
          </div>
        )}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(190px,1fr))", gap: 12, marginBottom: 18 }}>
        <StatCard Icon={Landmark} label="צבירה כוללת" value={fmt(totalBalance)} />
        <StatCard Icon={TrendingUp} label="הפקדה חודשית" value={fmt(summary?.totalMonthlyContribution ?? 0)} />
        <StatCard Icon={Percent} label="דמי ניהול ממוצעים" value={summary?.currentMgmtFee != null ? `${(summary.currentMgmtFee > 0.05 ? summary.currentMgmtFee : summary.currentMgmtFee * 100).toFixed(2)}%` : "—"} />
        <StatCard Icon={CalendarClock} label="תקרת הטבת מס שנתית" value={fmt(summary?.annualTaxFreeDeposit ?? 20520)} />
      </div>

      <ThreeCardSummary
        data={isThreeCardAdvisory(advisoryData) ? advisoryData : null}
        loading={analysisLoading}
        error={analysisError}
        onRetry={onRetryAnalysis}
        hasAccounts={funds.length > 0}
        accent="butter"
      />

      {findings.length > 0 && (
        <div style={{ ...cardBox, marginBottom: 18, marginTop: 18 }}>
          <h2 style={sectionTitle}>ממצאים מהתלושים</h2>
          {findings.map((f, i) => {
            const s = SEVERITY_TONE[f.severity] ?? SEVERITY_TONE.info;
            const Icon = s.Icon;
            return (
              <div key={f.id + i} style={{ display: "flex", gap: 13, padding: "12px 0", borderBottom: i < findings.length - 1 ? "1px solid var(--hair)" : "none" }}>
                <span style={{ width: 32, height: 32, borderRadius: 9, background: s.bg, color: s.fg, display: "grid", placeItems: "center" }}><Icon size={16} /></span>
                <div>
                  <div style={{ fontWeight: 800 }}>{f.title}</div>
                  <div style={{ fontSize: 12.5, color: "var(--text-muted)" }}>{insightTeaser(f.details, 96)}</div>
                  <AgentInsightCta agent="gemel" style={{ marginTop: 4 }} />
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div style={{ ...cardBox, marginBottom: 18 }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
          <span style={{ fontSize: 15.5, fontWeight: 800 }}>קופות במעקב ({funds.length})</span>
          <button onClick={() => setShowAddForm(v => !v)} style={{ ...btnGhost, padding: "7px 13px", fontSize: 13 }}>{showAddForm ? "ביטול" : "הוסף"}</button>
        </div>
        {showAddForm && (
          <div style={{ marginBottom: 12 }}>
            <input value={form.fundName} onChange={e => setForm(s => ({ ...s, fundName: e.target.value }))} placeholder="שם הקופה" style={addInput} />
            <select value={form.fundType} onChange={e => setForm(s => ({ ...s, fundType: e.target.value as GemelFundType }))} style={addInput}>
              {Object.entries(GEMEL_FUND_TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
            <button onClick={onSaveFund} disabled={saving || !form.fundName?.trim()} style={{ ...btnPrimary, width: "100%" }}>שמור</button>
          </div>
        )}
        {funds.map(f => (
          <div key={f.id} style={{ padding: "12px 0", borderBottom: "1px solid var(--hair)" }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <div>
                <div style={{ fontWeight: 800 }}>{f.fundName}</div>
                <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{GEMEL_FUND_TYPE_LABELS[f.fundType]}</div>
              </div>
              <button onClick={() => onDeleteFund(f.id)} style={{ background: "none", border: "none", color: "var(--danger)", cursor: "pointer" }}><Trash2 size={14} /></button>
            </div>
            <div style={{ fontWeight: 900, marginTop: 6 }}>{fmt(f.currentBalance)}</div>
          </div>
        ))}
      </div>

      <GemelMarketComparisonTable />
      {SHOW_LEGACY_GEMEL_LEADING_FUNDS && <GemelLeadingFundsTable />}
    </main>
  );
}

function StatCard({ Icon, label, value }: { Icon: LucideIcon; label: string; value: string }) {
  return (
    <div style={{ ...cardBox, padding: "16px 18px", display: "flex", gap: 13, alignItems: "center" }}>
      <span style={{ width: 40, height: 40, borderRadius: 11, background: "var(--butter-soft)", color: "var(--butter-ink)", display: "grid", placeItems: "center" }}><Icon size={19} /></span>
      <div>
        <div style={{ fontSize: 12, color: "var(--text-faint)" }}>{label}</div>
        <div style={{ fontSize: 18, fontWeight: 900 }}>{value}</div>
      </div>
    </div>
  );
}

const sectionTitle: React.CSSProperties = { fontSize: 13, fontWeight: 800, color: "var(--text-faint)", letterSpacing: ".06em", margin: "0 0 12px" };
const cardBox: React.CSSProperties = { background: "var(--card)", border: "1px solid var(--border-hair)", borderRadius: "var(--radius)", padding: "22px 24px", boxShadow: "var(--shadow-soft)" };
const btnPrimary: React.CSSProperties = { display: "inline-flex", alignItems: "center", gap: 8, padding: "11px 18px", borderRadius: "var(--r-pill)", border: "none", cursor: "pointer", fontWeight: 800, fontSize: 14, color: "#fff", background: "var(--butter-ink)" };
const btnGhost: React.CSSProperties = { display: "inline-flex", alignItems: "center", gap: 8, padding: "11px 18px", borderRadius: "var(--r-pill)", border: "1px solid var(--border-soft)", cursor: "pointer", fontWeight: 800, fontSize: 14, background: "var(--card)" };
const addInput: React.CSSProperties = { width: "100%", boxSizing: "border-box", padding: "10px 12px", borderRadius: "var(--r-sm)", border: "1px solid var(--border-soft)", marginBottom: 8 };
