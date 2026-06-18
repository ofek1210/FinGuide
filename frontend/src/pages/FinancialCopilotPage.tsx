import { useState, useEffect, useCallback } from "react";
import {
  Target, TrendingUp, Wallet, FileText,
  ChevronDown, ChevronUp, Plus, Trash2, Shield, PiggyBank,
  AlertTriangle, CheckCircle2,
  Banknote, BarChart3, CircleDollarSign, Landmark,
  Download, MessageCircle,
} from "lucide-react";
import PrivateTopbar from "../components/PrivateTopbar";

import Loader from "../components/ui/Loader";
import {
  getCopilotAnalysis,
  updateCopilotProfile,
  upsertGoal,
  deleteGoal as deleteGoalApi,
  generateMonthlyReport,
} from "../api/copilot.api";
import type { CopilotAnalysis, RiskTolerance, CopilotGoal } from "../api/copilot.api";
import ProblemsFixWidget from "../components/ProblemsFixWidget";
import "./FinancialCopilotPage.css";

// ── Sub-components ────────────────────────────────────────────────────────────

const RISK_OPTIONS: { value: RiskTolerance; label: string; desc: string; icon: React.ReactNode; detail: string }[] = [
  { value: "low", label: "שמרני", desc: "העדפת ביטחון על תשואה", icon: <Shield size={18} />,
    detail: "מתאים למי שרוצה לשמור על הכסף ללא סיכון. ההשקעות יהיו בעיקר באג\"ח ופיקדונות (תשואה צפויה: 3%-5% בשנה)." },
  { value: "medium", label: "מאוזן", desc: "שילוב של צמיחה וביטחון", icon: <BarChart3 size={18} />,
    detail: "שילוב של מניות ואג\"ח — מתאים לרוב האנשים. צמיחה סבירה עם סיכון מתון (תשואה צפויה: 5%-8% בשנה)." },
  { value: "high", label: "אגרסיבי", desc: "מיקוד בצמיחה לטווח ארוך", icon: <TrendingUp size={18} />,
    detail: "דגש על מניות ונכסים בסיכון גבוה. מתאים לגיל צעיר ולמי שלא צריך את הכסף בקרוב (תשואה צפויה: 7%-12% בשנה)." },
];

const GOAL_TYPES = [
  { value: "emergency_fund", label: "קרן חירום" },
  { value: "retirement", label: "פנסיה / פרישה" },
  { value: "home_purchase", label: "רכישת דירה" },
  { value: "car", label: "רכב" },
  { value: "education", label: "לימודים" },
  { value: "travel", label: "טיול גדול" },
  { value: "other", label: "אחר" },
];

function SectionCard({ icon, title, badge, children }: { icon: React.ReactNode; title: string; badge?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="fc-card">
      <div className="fc-card-header">
        <div className="fc-card-header-left">
          <span className="fc-card-icon">{icon}</span>
          <h2 className="fc-card-title">{title}</h2>
        </div>
        {badge && <div className="fc-card-badge">{badge}</div>}
      </div>
      <div className="fc-card-body">{children}</div>
    </div>
  );
}

function RiskSelector({ current, onSave }: { current: RiskTolerance | null; onSave: (v: RiskTolerance) => void }) {
  const [selected, setSelected] = useState<RiskTolerance>(current ?? "medium");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    await onSave(selected);
    setSaving(false);
  };

  return (
    <div className="fc-risk-selector">
      <p className="fc-section-intro">
        פרופיל הסיכון שלך קובע איך המערכת ממליצה לך להשקיע את הכסף הפנוי.
        אין תשובה נכונה או לא נכונה — הבחירה תלויה בגיל שלך, במצב המשפחתי ובנוחות שלך עם תנודות בשוק.
      </p>
      <div className="fc-risk-options">
        {RISK_OPTIONS.map(opt => (
          <button
            key={opt.value}
            className={`fc-risk-btn${selected === opt.value ? " active" : ""}`}
            onClick={() => setSelected(opt.value)}
            type="button"
          >
            <span className="fc-risk-icon">{opt.icon}</span>
            <span className="fc-risk-label">{opt.label}</span>
            <span className="fc-risk-desc">{opt.desc}</span>
          </button>
        ))}
      </div>
      {/* Show detail for selected option */}
      <div className="fc-risk-detail">
        <span className="fc-risk-detail-icon">💡</span>
        <span>{RISK_OPTIONS.find(o => o.value === selected)?.detail}</span>
      </div>
      <button className="fc-btn-primary" onClick={handleSave} disabled={saving}>
        {saving ? "שומר..." : "שמור פרופיל"}
      </button>
    </div>
  );
}

function ExpensesEditor({
  monthlyExpenses,
  monthlyDebts,
  onSave,
}: {
  monthlyExpenses: number | null;
  monthlyDebts: number | null;
  onSave: (expenses: number, debts: number) => Promise<void>;
}) {
  const [expenses, setExpenses] = useState(monthlyExpenses ?? 0);
  const [debts, setDebts] = useState(monthlyDebts ?? 0);
  const [saving, setSaving] = useState(false);
  const [open, setOpen] = useState(!monthlyExpenses && !monthlyDebts);

  const handleSave = async () => {
    setSaving(true);
    await onSave(expenses, debts);
    setSaving(false);
    setOpen(false);
  };

  return (
    <div className="fc-expenses-editor">
      <button
        type="button"
        className="fc-expenses-toggle"
        onClick={() => setOpen(o => !o)}
      >
        <span>✏️ עדכן הוצאות חודשיות</span>
        {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>
      {open && (
        <div className="fc-expenses-form">
          <label className="fc-expense-label">
            <span>הוצאות שוטפות (מזון, תחבורה, בידור...)</span>
            <div className="fc-input-wrap">
              <span className="fc-input-currency">₪</span>
              <input
                type="number"
                min={0}
                value={expenses || ""}
                onChange={e => setExpenses(Number(e.target.value))}
                placeholder="0"
                className="fc-input"
              />
            </div>
          </label>
          <label className="fc-expense-label">
            <span>הלוואות / קבועים (משכנתא, אשראי...)</span>
            <div className="fc-input-wrap">
              <span className="fc-input-currency">₪</span>
              <input
                type="number"
                min={0}
                value={debts || ""}
                onChange={e => setDebts(Number(e.target.value))}
                placeholder="0"
                className="fc-input"
              />
            </div>
          </label>
          <button
            type="button"
            className="fc-btn-primary"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? "שומר..." : "עדכן תקציב"}
          </button>
        </div>
      )}
    </div>
  );
}

function BudgetWidget({
  analysis,
  profile,
  onSaveExpenses,
}: {
  analysis: CopilotAnalysis["budgetAnalysis"];
  profile: CopilotAnalysis["profile"];
  onSaveExpenses: (expenses: number, debts: number) => Promise<void>;
}) {
  const expensesEditor = (
    <ExpensesEditor
      monthlyExpenses={profile.monthlyExpenses}
      monthlyDebts={profile.monthlyDebts}
      onSave={onSaveExpenses}
    />
  );

  if (!analysis.available) {
    return (
      <>
        <p className="fc-empty-note">{analysis.reason ?? "אין נתונים"}</p>
        {expensesEditor}
      </>
    );
  }
  const { breakdown, health, savingsRate, monthlyFreeFlow, recommendations, ideal } = analysis;

  const DONUT_ITEMS = breakdown ? [
    { label: "קבוע", pct: breakdown.fixed.pct, amount: breakdown.fixed.amount, color: "#F472B6" },
    { label: "הוצאות", pct: breakdown.discretionary.pct, amount: breakdown.discretionary.amount, color: "#FBBF24" },
    { label: "חיסכון", pct: breakdown.savings.pct, amount: breakdown.savings.amount, color: "#34D399" },
  ] : [];

  // Build conic-gradient for donut
  let cumPct = 0;
  const gradientStops = DONUT_ITEMS.map(item => {
    const start = cumPct;
    cumPct += item.pct;
    return `${item.color} ${start}% ${cumPct}%`;
  }).join(", ");

  return (
    <div className="fc-budget">
      <p className="fc-section-intro">
        ניתוח התקציב מחשב כמה מהשכר נטו הולך להוצאות קבועות, הוצאות משתנות וחיסכון.
        <strong> תזרים חופשי</strong> — זה הסכום שנשאר לך בסוף החודש אחרי כל ההוצאות וההלוואות.
      </p>

      {/* KPI row */}
      <div className="fc-budget-kpis">
        <div className="fc-kpi">
          <span className="fc-kpi-label">תזרים חופשי</span>
          <span className="fc-kpi-value fc-green">₪{(monthlyFreeFlow ?? 0).toLocaleString("he-IL")}</span>
        </div>
        <div className="fc-kpi">
          <span className="fc-kpi-label">שיעור חיסכון</span>
          <span className="fc-kpi-value">{savingsRate}</span>
        </div>
        <div className="fc-kpi">
          <span className="fc-kpi-label">מצב בריאות</span>
          <span className="fc-kpi-value" style={{ color: health?.color }}>{health?.label ?? "—"}</span>
        </div>
      </div>

      {/* Donut + breakdown */}
      {breakdown && (
        <div className="fc-budget-visual">
          <div className="fc-donut-container">
            <div
              className="fc-donut"
              style={{ background: `conic-gradient(${gradientStops})` }}
            >
              <div className="fc-donut-hole">
                <span className="fc-donut-center-val">₪{(monthlyFreeFlow ?? 0).toLocaleString("he-IL")}</span>
                <span className="fc-donut-center-label">חופשי</span>
              </div>
            </div>
          </div>
          <div className="fc-budget-legend">
            {DONUT_ITEMS.map(item => (
              <div key={item.label} className="fc-legend-item">
                <span className="fc-legend-dot" style={{ background: item.color }} />
                <span className="fc-legend-label">{item.label}</span>
                <span className="fc-legend-pct">{item.pct}%</span>
                <span className="fc-legend-amount">₪{item.amount.toLocaleString("he-IL")}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {ideal && (
        <div className="fc-budget-ideal">
          <div className="fc-budget-ideal-header">
            <span className="fc-budget-ideal-label">📐 כלל 50/30/20</span>
            <span className="fc-budget-ideal-explain">50% צרכים, 30% רצונות, 20% חיסכון — כלל אצבע לתקציב בריא</span>
          </div>
          <div className="fc-budget-ideal-values">
            <span>₪{ideal.needs.toLocaleString("he-IL")} צרכים</span>
            <span className="fc-budget-ideal-sep">·</span>
            <span>₪{ideal.wants.toLocaleString("he-IL")} רצונות</span>
            <span className="fc-budget-ideal-sep">·</span>
            <span>₪{ideal.savings.toLocaleString("he-IL")} חיסכון</span>
          </div>
        </div>
      )}

      {recommendations && recommendations.length > 0 && (
        <div className="fc-recs">
          {recommendations.map((r, i) => (
            <div key={i} className={`fc-rec fc-rec-${r.priority}`}>
              {r.priority === "high" ? <AlertTriangle size={15} /> : <CheckCircle2 size={15} />}
              <div>
                <strong>{r.title}</strong>
                <span>{r.description}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {expensesEditor}
    </div>
  );
}

function InvestmentWidget({ recs }: { recs: CopilotAnalysis["investmentRecs"] }) {
  if (!recs?.riskProfile) return <p className="fc-empty-note">אין המלצות — הגדר פרופיל סיכון תחילה</p>;

  const ALLOC_COLORS = ["#818CF8", "#34D399", "#FBBF24", "#F472B6", "#60A5FA", "#A78BFA"];

  return (
    <div className="fc-invest">
      <p className="fc-section-intro">
        על בסיס פרופיל הסיכון שלך והתזרים החופשי, המערכת ממליצה על
        <strong> חלוקת השקעות</strong> (כמה אחוז לכל סוג נכס).
        התחזית מחשבת כמה הכסף שלך יצמח לאורך שנים עם ריבית דריבית.
      </p>

      {/* KPI summary */}
      <div className="fc-invest-kpis">
        <div className="fc-kpi fc-kpi-bordered">
          <CircleDollarSign size={16} className="fc-kpi-icon" />
          <div>
            <span className="fc-kpi-label">השקעה חודשית</span>
            <span className="fc-kpi-value">₪{(recs.recommendedMonthlyInvestment ?? 0).toLocaleString("he-IL")}</span>
          </div>
        </div>
        <div className="fc-kpi fc-kpi-bordered">
          <TrendingUp size={16} className="fc-kpi-icon" />
          <div>
            <span className="fc-kpi-label">תשואה צפויה</span>
            <span className="fc-kpi-value">{recs.expectedAnnualReturn}</span>
          </div>
        </div>
        <div className="fc-kpi fc-kpi-bordered">
          <BarChart3 size={16} className="fc-kpi-icon" />
          <div>
            <span className="fc-kpi-label">פרופיל</span>
            <span className="fc-kpi-value">{recs.riskLabel}</span>
          </div>
        </div>
      </div>

      {/* Allocation bars */}
      {recs.allocation && recs.allocation.length > 0 && (
        <div className="fc-alloc">
          <div className="fc-alloc-bar">
            {recs.allocation.map((a, i) => (
              <div
                key={i}
                className="fc-alloc-segment"
                style={{ width: `${a.pct}%`, background: ALLOC_COLORS[i % ALLOC_COLORS.length] }}
                title={`${a.category}: ${a.pct}%`}
              />
            ))}
          </div>
          <div className="fc-alloc-legend">
            {recs.allocation.map((a, i) => (
              <div key={i} className="fc-alloc-legend-item">
                <span className="fc-legend-dot" style={{ background: ALLOC_COLORS[i % ALLOC_COLORS.length] }} />
                <span>{a.category}</span>
                <strong>{a.pct}%</strong>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Suggestions */}
      {recs.suggestions?.length > 0 && (
        <div className="fc-recs">
          {recs.suggestions.map((s, i) => (
            <div key={i} className={`fc-rec fc-rec-${s.priority}`}>
              <Landmark size={15} />
              <div>
                <strong>{s.title}</strong>
                <span>{s.description}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Wealth projections */}
      {recs.projections?.length > 0 && (
        <div className="fc-projections">
          <div className="fc-projections-header">
            <div className="fc-projections-label">📈 תחזית צבירה</div>
            <span className="fc-projections-explain">כמה יהיה לך אם תשקיע ₪{(recs.recommendedMonthlyInvestment ?? 0).toLocaleString("he-IL")}/חודש בתשואה ממוצעת</span>
          </div>
          <div className="fc-projections-grid">
            {recs.projections.map((p, i) => {
              const maxVal = Math.max(...recs.projections.map(x => x.projected));
              return (
                <div key={i} className="fc-proj-col">
                  <span className="fc-proj-amount">₪{Math.round(p.projected).toLocaleString("he-IL")}</span>
                  <div className="fc-proj-bar-container">
                    <div
                      className="fc-proj-bar"
                      style={{ height: `${Math.max((p.projected / maxVal) * 100, 8)}%` }}
                    />
                  </div>
                  <span className="fc-proj-years">{p.years} שנים</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function GoalsWidget({
  goals,
  onAdd,
  onDelete,
}: {
  goals: CopilotGoal[];
  onAdd: (g: Omit<CopilotGoal, "id" | "progressPct">) => void;
  onDelete: (id: string) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ type: "emergency_fund", label: "", targetAmount: "", currentAmount: "" });

  const submit = () => {
    if (!form.targetAmount) return;
    onAdd({
      type: form.type,
      label: form.label || GOAL_TYPES.find(g => g.value === form.type)?.label || form.type,
      targetAmount: Number(form.targetAmount),
      currentAmount: Number(form.currentAmount) || 0,
      priority: 3,
    });
    setAdding(false);
    setForm({ type: "emergency_fund", label: "", targetAmount: "", currentAmount: "" });
  };

  return (
    <div className="fc-goals">
      <p className="fc-section-intro">
        הגדר יעדים פיננסיים ועקוב אחרי ההתקדמות שלך.
        למשל: קרן חירום (3-6 חודשי הוצאות), מקדמה לדירה, או חיסכון ללימודים.
        עדכן את הסכום הנוכחי כדי לראות כמה נשאר.
      </p>
      {goals.length === 0 && !adding && (
        <p className="fc-empty-note">אין יעדים פיננסיים. הוסף יעד ראשון!</p>
      )}
      {goals.map(g => {
        const pctColor = g.progressPct >= 75 ? "#34D399" : g.progressPct >= 30 ? "#FBBF24" : "#F87171";
        return (
          <div key={g.id} className="fc-goal-item">
            <div className="fc-goal-header">
              <div className="fc-goal-info">
                <span className="fc-goal-label">{g.label}</span>
                <span className="fc-goal-meta">
                  ₪{(g.currentAmount || 0).toLocaleString("he-IL")} / ₪{(g.targetAmount || 0).toLocaleString("he-IL")}
                </span>
              </div>
              <div className="fc-goal-actions">
                <span className="fc-goal-pct" style={{ color: pctColor }}>{g.progressPct}%</span>
                <button className="fc-goal-del" onClick={() => onDelete(g.id)} title="מחק יעד">
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
            <div className="fc-goal-track">
              <div className="fc-goal-fill" style={{ width: `${g.progressPct}%`, background: pctColor }} />
            </div>
          </div>
        );
      })}

      {adding ? (
        <div className="fc-goal-form">
          <select value={form.type} onChange={e => setForm(p => ({ ...p, type: e.target.value }))}>
            {GOAL_TYPES.map(g => <option key={g.value} value={g.value}>{g.label}</option>)}
          </select>
          <input placeholder="שם (אופציונלי)" value={form.label} onChange={e => setForm(p => ({ ...p, label: e.target.value }))} />
          <input type="number" placeholder="יעד ₪" value={form.targetAmount} onChange={e => setForm(p => ({ ...p, targetAmount: e.target.value }))} />
          <input type="number" placeholder="נוכחי ₪" value={form.currentAmount} onChange={e => setForm(p => ({ ...p, currentAmount: e.target.value }))} />
          <div className="fc-goal-form-actions">
            <button onClick={submit} className="fc-btn-primary">הוסף</button>
            <button onClick={() => setAdding(false)} className="fc-btn-secondary">ביטול</button>
          </div>
        </div>
      ) : (
        <button className="fc-add-goal-btn" onClick={() => setAdding(true)}>
          <Plus size={15} /> הוסף יעד
        </button>
      )}
    </div>
  );
}

function MonthlyReportWidget() {
  const [report, setReport] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generate = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await generateMonthlyReport();
      if (result.ok && result.data.success) {
        setReport(result.data.data.report);
        setExpanded(true);
      } else {
        setError("לא הצלחנו ליצור את הדוח");
      }
    } catch {
      setError("שגיאה בעת יצירת הדוח");
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadPdf = () => {
    if (!report) return;
    const html = markdownToHtml(report);
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(`<!DOCTYPE html>
<html dir="rtl" lang="he">
<head><meta charset="utf-8"><title>FinGuide — דוח חודשי</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 700px; margin: 40px auto; padding: 0 24px; color: #1e293b; line-height: 1.7; font-size: 14px; }
  h1 { font-size: 22px; border-bottom: 2px solid #818CF8; padding-bottom: 8px; }
  h3 { font-size: 16px; color: #334155; margin-top: 20px; }
  h4 { font-size: 14px; color: #475569; }
  ul { padding-right: 20px; }
  li { margin-bottom: 4px; }
  strong { color: #1e293b; }
  .footer { margin-top: 40px; padding-top: 16px; border-top: 1px solid #e2e8f0; font-size: 11px; color: #94a3b8; text-align: center; }
</style></head>
<body>
  <h1>📊 FinGuide — דוח פיננסי חודשי</h1>
  <p style="color:#64748b;font-size:12px;">נוצר: ${new Date().toLocaleDateString("he-IL")}</p>
  ${html}
  <div class="footer">⚠️ דוח זה נוצר אוטומטית ואינו מהווה ייעוץ פיננסי מקצועי.</div>
</body></html>`);
    win.document.close();
    setTimeout(() => { win.print(); }, 400);
  };

  const handleShareWhatsApp = () => {
    if (!report) return;
    // Clean markdown for plain text
    const plainText = report
      .replace(/^##+ /gm, "")
      .replace(/\*\*(.+?)\*\*/g, "*$1*")
      .replace(/^- /gm, "• ");
    const header = `📊 *FinGuide — דוח פיננסי חודשי*\n📅 ${new Date().toLocaleDateString("he-IL")}\n\n`;
    const footer = "\n\n⚠️ _דוח זה נוצר אוטומטית ואינו מהווה ייעוץ פיננסי מקצועי._";
    const fullText = header + plainText + footer;

    // Use Web Share API if available, otherwise WhatsApp API URL
    if (navigator.share) {
      navigator.share({ title: "FinGuide — דוח חודשי", text: fullText }).catch(() => {
        const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(fullText)}`;
        window.open(url, "_blank", "noopener,noreferrer");
      });
    } else {
      const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(fullText)}`;
      window.open(url, "_blank", "noopener,noreferrer");
    }
  };

  return (
    <div className="fc-report">
      {!report ? (
        <div className="fc-report-empty">
          <FileText size={28} className="fc-report-icon" />
          <p className="fc-section-intro">
            הדוח החודשי הוא סיכום AI מותאם אישית שכולל: ניתוח שכר ומיסים, מצב הפנסיה והביטוח, המלצות לחיסכון ושיפור — הכל בעברית פשוטה.
          </p>
          {error && <p className="fc-error">{error}</p>}
          <button className="fc-btn-accent" onClick={generate} disabled={loading}>
            {loading ? "יוצר דוח..." : "צור דוח חודשי"}
          </button>
        </div>
      ) : (
        <div className="fc-report-content">
          <div className="fc-report-actions">
            <button className="fc-report-toggle" onClick={() => setExpanded(e => !e)}>
              {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              {expanded ? "סגור דוח" : "הצג דוח"}
            </button>
            <div className="fc-report-share-btns">
              <button className="fc-share-btn fc-share-wa" onClick={handleShareWhatsApp} title="שלח בוואטסאפ">
                <MessageCircle size={15} />
                <span>שלח בוואטסאפ</span>
              </button>
              <button className="fc-share-btn fc-share-pdf" onClick={handleDownloadPdf} title="הורד כ-PDF">
                <Download size={15} />
                <span>הורד PDF</span>
              </button>
            </div>
          </div>
          {expanded && (
            <div
              className="fc-report-body"
              dangerouslySetInnerHTML={{ __html: markdownToHtml(report) }}
            />
          )}
          <button className="fc-btn-accent secondary" onClick={generate} disabled={loading}>
            {loading ? "יוצר..." : "צור דוח חדש"}
          </button>
        </div>
      )}
    </div>
  );
}

function markdownToHtml(md: string): string {
  return md
    .replace(/^## (.+)$/gm, "<h3>$1</h3>")
    .replace(/^### (.+)$/gm, "<h4>$1</h4>")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/^- (.+)$/gm, "<li>$1</li>")
    .replace(/(<li>.*<\/li>)/s, "<ul>$1</ul>")
    .replace(/\n{2,}/g, "</p><p>")
    .replace(/^(?!<[hul])(.+)$/gm, "<p>$1</p>")
    .replace(/<p><\/p>/g, "");
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function FinancialCopilotPage() {
  const [data, setData] = useState<CopilotAnalysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const result = await getCopilotAnalysis();
    if (result.ok && result.data.success) {
      setData(result.data.data);
    } else {
      setError("שגיאה בטעינת ניתוח הקופילוט");
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSaveRisk = async (riskTolerance: RiskTolerance) => {
    await updateCopilotProfile({ riskTolerance });
    await load();
  };

  const handleAddGoal = async (g: Omit<CopilotGoal, "id" | "progressPct">) => {
    await upsertGoal({ ...g, targetAmount: g.targetAmount ?? undefined });
    await load();
  };

  const handleDeleteGoal = async (id: string) => {
    await deleteGoalApi(id);
    setData(prev => prev ? { ...prev, goals: prev.goals.filter(g => g.id !== id) } : prev);
  };

  if (loading) return (
    <div className="dashboard-page" dir="rtl">
      <div className="dashboard-shell">
        <PrivateTopbar />
        <div className="fc-loading"><Loader /></div>
      </div>
    </div>
  );

  if (error) return (
    <div className="dashboard-page" dir="rtl">
      <div className="dashboard-shell">
        <PrivateTopbar />
        <div className="fc-error-page"><p>{error}</p></div>
      </div>
    </div>
  );

  const hs = data?.healthScore;
  const netSalary = data?.payslip?.netSalary;
  const grossSalary = data?.payslip?.grossSalary;

  return (
    <div className="dashboard-page fc-page" dir="rtl">
      <div className="dashboard-shell">
        <PrivateTopbar />

        {/* ── Hero header ── */}
        <header className="fc-header">
          <div className="fc-header-content">
            <div className="fc-header-text">
              <h1 className="fc-title">מרכז תכנון פיננסי</h1>
              <p className="fc-subtitle">כאן תוכל/י לראות את התמונה הפיננסית המלאה שלך — תקציב, חיסכון, השקעות ויעדים. כל הנתונים מחושבים מתלושי השכר שהעלית.</p>
            </div>
            {hs && (
              <div className="fc-score-ring" title={hs.label ?? ""}>
                <svg viewBox="0 0 100 100" className="fc-score-svg">
                  <circle cx="50" cy="50" r="42" className="fc-score-track" />
                  <circle
                    cx="50" cy="50" r="42"
                    className="fc-score-fill"
                    style={{
                      strokeDasharray: `${(hs.score / 100) * 264} 264`,
                      stroke: hs.score >= 70 ? "#34D399" : hs.score >= 40 ? "#FBBF24" : "#F87171",
                    }}
                  />
                </svg>
                <div className="fc-score-inner">
                  <span className="fc-score-num">{hs.score}</span>
                  <span className="fc-score-label">{hs.label}</span>
                </div>
              </div>
            )}
          </div>
          {hs && (
            <p className="fc-score-explain">
              <strong>ציון {hs.score}/100</strong> — הציון מורכב משלמות מסמכים, יציבות שכר, מוכנות מס, עקביות פנסיה ומודעות ביטוחית. העלה עוד מסמכים ומלא את הפרופיל כדי להעלות אותו.
            </p>
          )}

          {/* Quick summary strip */}
          {(grossSalary || netSalary) && (
            <div className="fc-summary-strip">
              {grossSalary && (
                <div className="fc-strip-item" title="השכר לפני ניכויים (מס, ביטוח לאומי, פנסיה)">
                  <Banknote size={16} />
                  <span className="fc-strip-label">ברוטו</span>
                  <span className="fc-strip-value">₪{grossSalary.toLocaleString("he-IL")}</span>
                  <span className="fc-strip-hint">לפני ניכויים</span>
                </div>
              )}
              {netSalary && (
                <div className="fc-strip-item" title="מה שנכנס לחשבון הבנק בפועל">
                  <Wallet size={16} />
                  <span className="fc-strip-label">נטו</span>
                  <span className="fc-strip-value">₪{netSalary.toLocaleString("he-IL")}</span>
                  <span className="fc-strip-hint">לחשבון הבנק</span>
                </div>
              )}
              {data?.budgetAnalysis.monthlyFreeFlow != null && (
                <div className="fc-strip-item" title="נטו פחות כל ההוצאות וההלוואות — מה שנשאר לחיסכון או הנאה">
                  <PiggyBank size={16} />
                  <span className="fc-strip-label">תזרים חופשי</span>
                  <span className="fc-strip-value fc-green">₪{data.budgetAnalysis.monthlyFreeFlow.toLocaleString("he-IL")}</span>
                  <span className="fc-strip-hint">אחרי הוצאות</span>
                </div>
              )}
              {data?.goals.length > 0 && (
                <div className="fc-strip-item">
                  <Target size={16} />
                  <span className="fc-strip-label">יעדים</span>
                  <span className="fc-strip-value">{data.goals.length} פעילים</span>
                </div>
              )}
            </div>
          )}
        </header>

        <main className="fc-main">
          {/* AI Problem Solver — detect & fix financial issues */}
          <SectionCard
            icon={<AlertTriangle size={20} />}
            title="בעיות פיננסיות + תוכנית תיקון"
            badge={<span className="fc-badge fc-badge-ai">AI</span>}
          >
            <ProblemsFixWidget />
          </SectionCard>

          {/* Top row: Budget + Investment side by side on large screens */}
          <div className="fc-grid-2">
            <SectionCard icon={<TrendingUp size={20} />} title="ניתוח תקציב"
              badge={data?.budgetAnalysis.health && (
                <span className="fc-badge" style={{ color: data.budgetAnalysis.health.color, borderColor: data.budgetAnalysis.health.color }}>
                  {data.budgetAnalysis.health.label}
                </span>
              )}>
              {data && (
                <BudgetWidget
                  analysis={data.budgetAnalysis}
                  profile={data.profile}
                  onSaveExpenses={async (expenses, debts) => {
                    await updateCopilotProfile({ monthlyExpenses: expenses, monthlyDebts: debts });
                    await load();
                  }}
                />
              )}
            </SectionCard>

            <SectionCard icon={<BarChart3 size={20} />} title="השקעות ותחזיות"
              badge={data?.investmentRecs?.riskLabel && (
                <span className="fc-badge fc-badge-purple">{data.investmentRecs.riskLabel}</span>
              )}>
              {data && <InvestmentWidget recs={data.investmentRecs} />}
            </SectionCard>
          </div>

          {/* Bottom row: Risk + Goals + Report */}
          <div className="fc-grid-3">
            <SectionCard icon={<Shield size={20} />} title="פרופיל סיכון">
              <RiskSelector current={data?.profile.riskTolerance ?? null} onSave={handleSaveRisk} />
            </SectionCard>

            <SectionCard icon={<Target size={20} />} title="יעדים פיננסיים"
              badge={data?.goals.length ? <span className="fc-badge fc-badge-muted">{data.goals.length} יעדים</span> : undefined}>
              {data && (
                <GoalsWidget
                  goals={data.goals}
                  onAdd={handleAddGoal}
                  onDelete={handleDeleteGoal}
                />
              )}
            </SectionCard>

            <SectionCard icon={<FileText size={20} />} title="דוח חודשי AI">
              <MonthlyReportWidget />
            </SectionCard>
          </div>
        </main>

        <footer className="dashboard-mini-footer">
          <span>© 2026 FinGuide</span>
        </footer>
      </div>
    </div>
  );
}
