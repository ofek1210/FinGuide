import { ArrowUpRight } from "lucide-react";
import type { PayslipHistoryItem } from "../../types/payslip";
import { formatCurrencyILS, formatShortDate } from "../../utils/formatters";
import Loader from "../ui/Loader";
import "./DashboardPayslipHistoryCard.css";

interface DashboardPayslipHistoryCardProps {
  items: PayslipHistoryItem[];
  isLoading: boolean;
  error: string | null;
  onRetry: () => void;
  onViewAll: () => void;
}

export default function DashboardPayslipHistoryCard({
  items,
  isLoading,
  error,
  onRetry,
  onViewAll,
}: DashboardPayslipHistoryCardProps) {
  if (isLoading) {
    return (
      <article className="dashboard-card payslip-history-card">
        <div className="payslip-history-state">
          <Loader />
          <span>טוענים היסטוריית תלושים...</span>
        </div>
      </article>
    );
  }

  if (error) {
    return (
      <article className="dashboard-card payslip-history-card">
        <div className="payslip-history-state is-error">
          <span>{error}</span>
          <button type="button" onClick={onRetry}>
            נסו שוב
          </button>
        </div>
      </article>
    );
  }

  if (items.length === 0) {
    return (
      <article className="dashboard-card payslip-history-card">
        <div className="payslip-history-state">
          <span>אין עדיין תלושים להצגה.</span>
          <button type="button" onClick={onViewAll}>
            מעבר להיסטוריה
          </button>
        </div>
      </article>
    );
  }

  return (
    <article className="dashboard-card payslip-history-card">
      <div className="payslip-history-header">
        <div>
          <h3>היסטוריית תלושים</h3>
          <p>הצצה לתלושים האחרונים שלך</p>
        </div>
        <button className="payslip-history-link" type="button" onClick={onViewAll}>
          לכל התלושים
          <ArrowUpRight aria-hidden="true" />
        </button>
      </div>

      <div className="payslip-history-list">
        {items.map((item) => (
          <div key={item.id} className="payslip-history-row">
            <div className="payslip-history-period">
              <span>{item.periodLabel}</span>
              <span className="payslip-history-date">
                {formatShortDate(item.periodDate)}
              </span>
              {item.isLatest ? <span className="payslip-history-latest">אחרון</span> : null}
            </div>
            <div className="payslip-history-amounts">
              <span className="payslip-history-net">
                {formatCurrencyILS(item.netSalary)}
              </span>
              <span className="payslip-history-gross">
                {formatCurrencyILS(item.grossSalary)}
              </span>
            </div>
          </div>
        ))}
      </div>
    </article>
  );
}
