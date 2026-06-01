import { ArrowLeft } from "lucide-react";

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
    <div className="payslip-subheader">
      <button
        className="payslip-back"
        type="button"
        onClick={onBackToDashboard}
        aria-label={backLabel}
      >
        <ArrowLeft aria-hidden="true" />
        {backLabel}
      </button>
    </div>
  );
}
