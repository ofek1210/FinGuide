import { useEffect, useState } from "react";
import { Sparkles, TrendingUp, Shield, FileText, PiggyBank } from "lucide-react";
import { getAIFinancialTips, type FinancialTip } from "../../api/ai.api";

const categoryIcons: Record<FinancialTip["category"], React.ReactNode> = {
  pension: <PiggyBank size={14} />,
  tax: <TrendingUp size={14} />,
  savings: <TrendingUp size={14} />,
  insurance: <Shield size={14} />,
  documents: <FileText size={14} />,
};

const priorityColors: Record<FinancialTip["priority"], string> = {
  high: "var(--figma-error)",
  medium: "var(--figma-warning)",
  low: "var(--figma-success)",
};

const priorityLabels: Record<FinancialTip["priority"], string> = {
  high: "חשוב",
  medium: "מומלץ",
  low: "לידיעה",
};

export default function DashboardAITipsCard() {
  const [tips, setTips] = useState<FinancialTip[]>([]);
  const [source, setSource] = useState<"claude" | "rule" | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    void getAIFinancialTips().then((res) => {
      if (res.success && res.data?.tips?.length) {
        setTips(res.data.tips);
        setSource(res.data.source);
      }
      setIsLoading(false);
    });
  }, []);

  if (isLoading) {
    return (
      <div className="dashboard-card ai-tips-card ai-tips-loading">
        <span className="ai-run-spinner" />
        <span>טוען טיפים...</span>
      </div>
    );
  }

  if (!tips.length) return null;

  return (
    <div className="dashboard-card ai-tips-card">
      <div className="ai-tips-header">
        <div className="ai-tips-title">
          <Sparkles size={16} />
          <span>טיפים חכמים מה-AI</span>
        </div>
        {source === "claude" && (
          <em className="ai-model source-claude">✦ Claude AI</em>
        )}
      </div>
      <ul className="ai-tips-list">
        {tips.map((tip, i) => (
          <li key={i} className="ai-tip-item">
            <div className="ai-tip-icon" style={{ color: priorityColors[tip.priority] }}>
              {categoryIcons[tip.category]}
            </div>
            <div className="ai-tip-body">
              <span
                className="ai-tip-priority"
                style={{ color: priorityColors[tip.priority] }}
              >
                {priorityLabels[tip.priority]}
              </span>
              <p className="ai-tip-text">{tip.tip}</p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
