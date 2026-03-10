import { ArrowLeft, Sparkles } from "lucide-react";

interface PayslipHistoryHeaderProps {
  onBackToDashboard: () => void;
  /** Optional label for back button (e.g. "חזרה להיסטוריה" on detail page) */
  backLabel?: string;
}

export default function PayslipHistoryHeader({
  onBackToDashboard,
  backLabel = "חזרה ללוח הבקרה",
}: PayslipHistoryHeaderProps) {
  return (
    <header className="payslip-header">
      <div className="payslip-brand">
        <span className="payslip-brand-badge" aria-hidden="true">
          <Sparkles />
        </span>
        <span>FinGuide</span>
      </div>
      <button className="payslip-back" type="button" onClick={onBackToDashboard} aria-label={backLabel}>
        {backLabel}
        <ArrowLeft aria-hidden="true" />
      </button>
    </header>
  );
}
