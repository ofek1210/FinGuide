import { ArrowLeft, Sparkles } from "lucide-react";

interface PayslipHistoryHeaderProps {
  onBackToDashboard: () => void;
}

export default function PayslipHistoryHeader({
  onBackToDashboard,
}: PayslipHistoryHeaderProps) {
  return (
    <header className="payslip-header">
      <div className="payslip-brand">
        <span className="payslip-brand-badge" aria-hidden="true">
          <Sparkles />
        </span>
        <span>FinGuide</span>
      </div>
      <button className="payslip-back" type="button" onClick={onBackToDashboard}>
        חזרה ללוח הבקרה
        <ArrowLeft aria-hidden="true" />
      </button>
    </header>
  );
}
