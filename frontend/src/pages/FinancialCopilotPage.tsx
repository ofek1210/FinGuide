import { useState, useEffect, useCallback } from "react";
import { BotMessageSquare, Target, TrendingUp, Wallet, FileText, ChevronDown, ChevronUp, Plus, Trash2 } from "lucide-react";
import PrivateTopbar from "../components/PrivateTopbar";
import PlanTabBar from "../components/tabs/PlanTabBar";
import Loader from "../components/ui/Loader";
import {
  getCopilotAnalysis,
  updateCopilotProfile,
  upsertGoal,
  deleteGoal as deleteGoalApi,
  generateMonthlyReport,
} from "../api/copilot.api";
import type { CopilotAnalysis, RiskTolerance, CopilotGoal } from "../api/copilot.api";

// ── Sub-components ────────────────────────────────────────────────────────────

const RISK_OPTIONS: { value: RiskTolerance; label: string; desc: string }[] = [
  { value: "low", label: "שמרני", desc: "העדפת ביטחון על תשואה" },
  { value: "medium", label: "מאוזן", desc: "שילוב של צמיחה וביטחון" },
  { value: "high", label: "אגרסיבי", desc: "מיקוד בצמיחה לטווח ארוך" },
];

const GOAL_TYPES = [
  { value: "emergency_fund", label: "קרן חירום" },
  { value: "pension", label: "פנסיה" },
  { value: "housing", label: "רכישת דירה" },
  { value: "car", label: "רכב" },
  { value: "education", label: "לימודים" },
  { value: "travel", label: "טיול גדול" },
  { value: "other", label: "אחר" },
];

function SectionCard({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="copilot-section-card">
      <div className="copilot-section-card-header">
        <span className="copilot-section-icon">{icon}</span>
        <h2 className="copilot-section-title">{title}</h2>
      </div>
      <div className="copilot-section-body">{children}</div>
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
    <div className="copilot-risk-selector">
      <div className="copilot-risk-options">
        {RISK_OPTIONS.map(opt => (
          <button
            key={opt.value}
            className={`copilot-risk-btn${selected === opt.value ? " active" : ""}`}
            onClick={() => setSelected(opt.value)}
            type="button"
          >
            <span className="copilot-risk-btn-label">{opt.label}</span>
            <span className="copilot-risk-btn-desc">{opt.desc}</span>
          </button>
        ))}
      </div>
      <button className="copilot-save-btn" onClick={handleSave} disabled={saving}>
        {saving ? "שומר..." : "שמור פרופיל"}
      </button>
    </div>
  );
}

function BudgetWidget({ analysis }: { analysis: CopilotAnalysis["budgetAnalysis"] }) {
  if (!analysis.available) {
    return <p className="copilot-empty-note">{analysis.reason ?? "אין נתונים"}</p>;
  }
  const { breakdown, health, savingsRate, monthlyFreeFlow, recommendations, ideal } = analysis;
  return (
    <div className="copilot-budget">
      <div className="copilot-budget-header">
        <div className="copilot-budget-health" style={{ borderColor: health?.color }}>
          <span style={{ color: health?.color }}>{health?.label}</span>
          <span className="copilot-budget-rate">{savingsRate} חיסכון</span>
        </div>
        <div className="copilot-budget-flow">
          <span className="copilot-budget-flow-label">תזרים חופשי</span>
          <span className="copilot-budget-flow-val">₪{(monthlyFreeFlow ?? 0).toLocaleString("he-IL")}</span>
        </div>
      </div>

      <div className="copilot-budget-bars">
        {breakdown && (
          <>
            <BudgetBar label="קבוע (הלוואות)" pct={breakdown.fixed.pct} amount={breakdown.fixed.amount} color="var(--rapyd-pink)" />
            <BudgetBar label="הוצאות שיקול דעת" pct={breakdown.discretionary.pct} amount={breakdown.discretionary.amount} color="var(--rapyd-yellow)" />
            <BudgetBar label="חיסכון" pct={breakdown.savings.pct} amount={breakdown.savings.amount} color="var(--rapyd-mint)" />
          </>
        )}
        {ideal && (
          <p className="copilot-budget-ideal">
            יעד אידאלי: ₪{ideal.needs.toLocaleString("he-IL")} צרכים · ₪{ideal.wants.toLocaleString("he-IL")} רצונות · ₪{ideal.savings.toLocaleString("he-IL")} חיסכון
          </p>
        )}
      </div>

      {recommendations && recommendations.length > 0 && (
        <ul className="copilot-budget-recs">
          {recommendations.map((r, i) => (
            <li key={i} className={`copilot-budget-rec priority-${r.priority}`}>
              <strong>{r.title}</strong>
              <span>{r.description}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function BudgetBar({ label, pct, amount, color }: { label: string; pct: number; amount: number; color: string }) {
  return (
    <div className="copilot-bar-row">
      <span className="copilot-bar-label">{label}</span>
      <div className="copilot-bar-track">
        <div className="copilot-bar-fill" style={{ width: `${Math.min(pct, 100)}%`, background: color }} />
      </div>
      <span className="copilot-bar-val">{pct}% · ₪{amount.toLocaleString("he-IL")}</span>
    </div>
  );
}

function InvestmentWidget({ recs }: { recs: CopilotAnalysis["investmentRecs"] }) {
  if (!recs?.riskProfile) return <p className="copilot-empty-note">אין המלצות — הגדר פרופיל סיכון תחילה</p>;
  return (
    <div className="copilot-invest">
      <div className="copilot-invest-summary">
        <div>
          <span className="copilot-invest-label">פרופיל</span>
          <span className="copilot-invest-val">{recs.riskLabel}</span>
        </div>
        <div>
          <span className="copilot-invest-label">תשואה שנתית צפויה</span>
          <span className="copilot-invest-val">{recs.expectedAnnualReturn}</span>
        </div>
        <div>
          <span className="copilot-invest-label">השקעה חודשית מומלצת</span>
          <span className="copilot-invest-val">₪{(recs.recommendedMonthlyInvestment ?? 0).toLocaleString("he-IL")}</span>
        </div>
      </div>

      <div className="copilot-invest-allocation">
        {recs.allocation?.map((a, i) => (
          <div key={i} className="copilot-alloc-item">
            <span>{a.category}</span>
            <strong>{a.pct}%</strong>
          </div>
        ))}
      </div>

      {recs.suggestions?.length > 0 && (
        <ul className="copilot-invest-suggestions">
          {recs.suggestions.map((s, i) => (
            <li key={i} className={`copilot-invest-suggestion priority-${s.priority}`}>
              <strong>{s.title}</strong>
              <span>{s.description}</span>
            </li>
          ))}
        </ul>
      )}

      {recs.projections?.length > 0 && (
        <div className="copilot-projections">
          <p className="copilot-projections-title">תחזית עושר</p>
          <div className="copilot-projections-row">
            {recs.projections.map((p, i) => (
              <div key={i} className="copilot-proj-item">
                <span className="copilot-proj-years">{p.years} שנים</span>
                <span className="copilot-proj-amount">₪{Math.round(p.projected).toLocaleString("he-IL")}</span>
              </div>
            ))}
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
    <div className="copilot-goals">
      {goals.length === 0 && !adding && (
        <p className="copilot-empty-note">אין יעדים פיננסיים. הוסף יעד ראשון!</p>
      )}
      {goals.map(g => (
        <div key={g.id} className="copilot-goal-item">
          <div className="copilot-goal-info">
            <span className="copilot-goal-label">{g.label}</span>
            <span className="copilot-goal-meta">
              ₪{(g.currentAmount || 0).toLocaleString("he-IL")} / ₪{(g.targetAmount || 0).toLocaleString("he-IL")}
            </span>
          </div>
          <div className="copilot-goal-progress-track">
            <div className="copilot-goal-progress-fill" style={{ width: `${g.progressPct}%` }} />
          </div>
          <div className="copilot-goal-actions">
            <span className="copilot-goal-pct">{g.progressPct}%</span>
            <button className="copilot-goal-del" onClick={() => onDelete(g.id)} title="מחק יעד">
              <Trash2 size={14} />
            </button>
          </div>
        </div>
      ))}

      {adding ? (
        <div className="copilot-goal-form">
          <select value={form.type} onChange={e => setForm(p => ({ ...p, type: e.target.value }))}>
            {GOAL_TYPES.map(g => <option key={g.value} value={g.value}>{g.label}</option>)}
          </select>
          <input placeholder="שם (אופציונלי)" value={form.label} onChange={e => setForm(p => ({ ...p, label: e.target.value }))} />
          <input type="number" placeholder="יעד ₪" value={form.targetAmount} onChange={e => setForm(p => ({ ...p, targetAmount: e.target.value }))} />
          <input type="number" placeholder="נוכחי ₪" value={form.currentAmount} onChange={e => setForm(p => ({ ...p, currentAmount: e.target.value }))} />
          <div className="copilot-goal-form-actions">
            <button onClick={submit} className="copilot-save-btn">הוסף</button>
            <button onClick={() => setAdding(false)} className="copilot-cancel-btn">ביטול</button>
          </div>
        </div>
      ) : (
        <button className="copilot-add-goal-btn" onClick={() => setAdding(true)}>
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

  return (
    <div className="copilot-report">
      {!report ? (
        <div className="copilot-report-empty">
          <p>צור דוח פיננסי חודשי מותאם אישית עם ניתוח מעמיק של מצבך הפיננסי.</p>
          {error && <p className="copilot-error">{error}</p>}
          <button className="copilot-generate-btn" onClick={generate} disabled={loading}>
            {loading ? "יוצר דוח..." : "צור דוח חודשי"}
          </button>
        </div>
      ) : (
        <div className="copilot-report-content">
          <button className="copilot-report-toggle" onClick={() => setExpanded(e => !e)}>
            {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            {expanded ? "סגור דוח" : "הצג דוח"}
          </button>
          {expanded && (
            <div
              className="copilot-report-body"
              dangerouslySetInnerHTML={{ __html: markdownToHtml(report) }}
            />
          )}
          <button className="copilot-generate-btn secondary" onClick={generate} disabled={loading}>
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
    await upsertGoal(g);
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
        <div className="copilot-loading"><Loader /></div>
      </div>
    </div>
  );

  if (error) return (
    <div className="dashboard-page" dir="rtl">
      <div className="dashboard-shell">
        <PrivateTopbar />
        <div className="copilot-error-page"><p>{error}</p></div>
      </div>
    </div>
  );

  const hs = data?.healthScore;

  return (
    <div className="dashboard-page financial-copilot-page" dir="rtl">
      <div className="dashboard-shell">
        <PrivateTopbar />
        <PlanTabBar />

        <header className="copilot-page-header">
          <div className="copilot-page-header-inner">
            <BotMessageSquare size={32} className="copilot-page-header-icon" />
            <div>
              <h1>קופילוט פיננסי AI</h1>
              <p>ניתוח מעמיק, המלצות אישיות ותכנון פיננסי חכם</p>
            </div>
          </div>
          {hs && (
            <div className="copilot-health-badge" title={hs.label ?? ""}>
              <span className="copilot-health-score">{hs.score}</span>
              <span className="copilot-health-label">{hs.label}</span>
            </div>
          )}
        </header>

        <main className="copilot-main">
          <div className="copilot-grid">
            <SectionCard icon={<Wallet size={20} />} title="פרופיל סיכון">
              <RiskSelector current={data?.profile.riskTolerance ?? null} onSave={handleSaveRisk} />
            </SectionCard>

            <SectionCard icon={<TrendingUp size={20} />} title="ניתוח תקציב">
              {data && <BudgetWidget analysis={data.budgetAnalysis} />}
            </SectionCard>

            <SectionCard icon={<TrendingUp size={20} />} title="המלצות השקעה">
              {data && <InvestmentWidget recs={data.investmentRecs} />}
            </SectionCard>

            <SectionCard icon={<Target size={20} />} title="יעדים פיננסיים">
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
