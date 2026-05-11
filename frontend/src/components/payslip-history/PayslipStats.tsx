import { Calendar, TrendingUp, Wallet } from "lucide-react";
import PayslipStatCard from "./PayslipStatCard";

interface PayslipStatsProps {
  selectedYear?: number | null;
  averageNet: string;
  averageGross: string;
  totalPayslips: string;
  coveragePercent?: number;
}

export default function PayslipStats({
  selectedYear,
  averageNet,
  averageGross,
  totalPayslips,
  coveragePercent = 0,
}: PayslipStatsProps) {
  return (
    <section className="payslip-stats">
      <PayslipStatCard
        icon={<Calendar />}
        label={selectedYear ? `ממוצע נטו (${selectedYear})` : "ממוצע נטו"}
        value={averageNet}
      />
      <PayslipStatCard
        icon={<TrendingUp />}
        label={selectedYear ? `ממוצע ברוטו (${selectedYear})` : "ממוצע ברוטו"}
        value={averageGross}
      />
      <PayslipStatCard
        icon={<Wallet />}
        label="כיסוי חודשי"
        value={`${coveragePercent}% (${totalPayslips})`}
      />
    </section>
  );
}
