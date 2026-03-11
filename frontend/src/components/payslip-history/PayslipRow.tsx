import { Download, FileText } from "lucide-react";
import type { PayslipHistoryItem } from "../../types/payslip";

interface PayslipRowProps {
  item: PayslipHistoryItem;
  netSalary: string;
  grossSalary: string;
  periodDate: string;
  onDownload: (item: PayslipHistoryItem) => void;
  onSelect?: (item: PayslipHistoryItem) => void;
  isDownloading?: boolean;
}

export default function PayslipRow({
  item,
  netSalary,
  grossSalary,
  periodDate,
  onDownload,
  onSelect,
  isDownloading = false,
}: PayslipRowProps) {
  const canDownload = Boolean(item.id) && !isDownloading;

  const handleDownload = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!canDownload) return;
    onDownload(item);
  };

  const handleRowClick = () => {
    onSelect?.(item);
  };

  return (
    <div
      className={`payslip-row ${onSelect ? "payslip-row-clickable" : ""}`}
      role={onSelect ? "button" : undefined}
      tabIndex={onSelect ? 0 : undefined}
      onClick={onSelect ? handleRowClick : undefined}
      onKeyDown={
        onSelect
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                handleRowClick();
              }
            }
          : undefined
      }
      aria-label={onSelect ? `צפייה בתלוש ${item.periodLabel}` : undefined}
    >
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
