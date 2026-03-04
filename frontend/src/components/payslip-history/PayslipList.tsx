import type { PayslipHistoryItem } from "../../types/payslip";
import PayslipRow from "./PayslipRow";

interface PayslipListProps {
  items: PayslipHistoryItem[];
  onDownload: (item: PayslipHistoryItem) => void;
  onSelect?: (item: PayslipHistoryItem) => void;
  formatCurrency: (value: number) => string;
  formatDate: (value: string) => string;
}

export default function PayslipList({
  items,
  onDownload,
  onSelect,
  formatCurrency,
  formatDate,
}: PayslipListProps) {
  return (
    <section className="payslip-list">
      <div className="payslip-list-header">
        <h2>כל התלושים</h2>
      </div>
      <div className="payslip-list-body">
        {items.map((item) => (
          <PayslipRow
            key={item.id}
            item={item}
            netSalary={formatCurrency(item.netSalary)}
            grossSalary={formatCurrency(item.grossSalary)}
            periodDate={formatDate(item.periodDate)}
            onDownload={onDownload}
            onSelect={onSelect}
          />
        ))}
      </div>
    </section>
  );
}
