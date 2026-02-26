import { Download, FileText } from "lucide-react";
import type { PayslipHistoryItem } from "../../types/payslip";

interface PayslipRowProps {
  item: PayslipHistoryItem;
  netSalary: string;
  grossSalary: string;
  periodDate: string;
  onDownload: (item: PayslipHistoryItem) => void;
}

export default function PayslipRow({
  item,
  netSalary,
  grossSalary,
  periodDate,
  onDownload,
}: PayslipRowProps) {
  const canDownload = Boolean(item.downloadUrl);

  const handleDownload = () => {
    if (!canDownload) return;
    onDownload(item);
  };

  return (
    <div className="payslip-row">
      <div className="payslip-row-icon" aria-hidden="true">
        <FileText />
      </div>
      <div className="payslip-row-details">
        <div className="payslip-row-title">
          <span>{item.periodLabel}</span>
          {item.isLatest ? <span className="payslip-latest">אחרון</span> : null}
        </div>
        <span className="payslip-row-date">{periodDate}</span>
      </div>
      <div className="payslip-row-amounts">
        <div>
          <span>שכר נטו</span>
          <strong>{netSalary}</strong>
        </div>
        <div>
          <span>שכר ברוטו</span>
          <strong>{grossSalary}</strong>
        </div>
      </div>
      <button
        className="payslip-row-download"
        type="button"
        onClick={handleDownload}
        disabled={!canDownload}
        aria-label={`הורדת ${item.periodLabel}`}
      >
        <Download aria-hidden="true" />
      </button>
    </div>
  );
}
