import { useState, useEffect } from "react";
import {
  AlertTriangle, AlertCircle, Info, ChevronDown, ChevronUp,
  Zap, Clock, Target, Loader2,
} from "lucide-react";
import { getFinancialProblems } from "../api/copilot.api";
import type { FinancialProblem, AIFixPlan } from "../api/copilot.api";
import "./ProblemsFixWidget.css";

const SEVERITY_META: Record<string, { icon: React.ReactNode; label: string; className: string }> = {
  critical: { icon: <AlertTriangle size={16} />, label: "קריטי", className: "pf-severity-critical" },
  warning: { icon: <AlertCircle size={16} />, label: "אזהרה", className: "pf-severity-warning" },
  info: { icon: <Info size={16} />, label: "שיפור", className: "pf-severity-info" },
};

export default function ProblemsFixWidget() {
  const [problems, setProblems] = useState<FinancialProblem[]>([]);
  const [fixPlans, setFixPlans] = useState<AIFixPlan[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const result = await getFinancialProblems();
      if (result.ok && result.data.success) {
        setProblems(result.data.data.problems);
        setFixPlans(result.data.data.aiFixPlans);
      }
      setLoading(false);
    })();
  }, []);

  if (loading) {
    return (
      <div className="pf-loading">
        <Loader2 size={20} className="pf-spin" />
        <span>מזהה בעיות פיננסיות...</span>
      </div>
    );
  }

  if (problems.length === 0) {
    return (
      <div className="pf-all-good">
        <span className="pf-all-good-icon">🎉</span>
        <p>מצוין! לא זוהו בעיות פיננסיות. המצב הכלכלי שלך נראה תקין.</p>
      </div>
    );
  }

  const getPlan = (problemId: string) => fixPlans?.find(p => p.problemId === problemId);

  return (
    <div className="pf-widget">
      <div className="pf-summary">
        <Zap size={16} />
        <span>זוהו <strong>{problems.length} בעיות</strong> — לחץ על כל אחת לתוכנית תיקון</span>
      </div>

      <div className="pf-list">
        {problems.map(problem => {
          const meta = SEVERITY_META[problem.severity] || SEVERITY_META.info;
          const plan = getPlan(problem.id);
          const isExpanded = expandedId === problem.id;

          return (
            <div key={problem.id} className={`pf-card ${meta.className}`}>
              <button
                className="pf-card-header"
                onClick={() => setExpandedId(isExpanded ? null : problem.id)}
                type="button"
              >
                <span className="pf-card-severity">{meta.icon}</span>
                <div className="pf-card-text">
                  <h4>{problem.title}</h4>
                  <p>{problem.description}</p>
                </div>
                {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </button>

              {isExpanded && (
                <div className="pf-card-body">
                  <div className="pf-impact">
                    <Target size={14} />
                    <span>{problem.impact}</span>
                  </div>

                  {plan && (
                    <div className="pf-fix-plan">
                      <h5>
                        <Zap size={14} />
                        תוכנית תיקון AI
                      </h5>
                      <ol className="pf-steps">
                        {plan.steps.map((step, i) => (
                          <li key={i}>{step}</li>
                        ))}
                      </ol>
                      <div className="pf-plan-meta">
                        <span className="pf-timeframe">
                          <Clock size={12} />
                          {plan.timeframe}
                        </span>
                        <span className="pf-expected">
                          <Target size={12} />
                          {plan.expectedResult}
                        </span>
                      </div>
                    </div>
                  )}

                  {!plan && (
                    <p className="pf-no-plan">AI לא הצליח ליצור תוכנית — נסה שוב מאוחר יותר.</p>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
