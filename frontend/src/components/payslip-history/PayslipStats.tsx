import { Calendar, TrendingUp, Wallet } from "lucide-react";
import PayslipStatCard from "./PayslipStatCard";

interface PayslipStatsProps {
  averageNet: string;
  averageGross: string;
  totalPayslips: string;
}

export default function PayslipStats({
  averageNet,
  averageGross,
  totalPayslips,
}: PayslipStatsProps) {
  return (
    <section className="payslip-stats">
      <PayslipStatCard
        icon={<Calendar />}
        label="ממוצע נטו"
        value={averageNet}
      />
      <PayslipStatCard
        icon={<TrendingUp />}
        label="ממוצע ברוטו"
        value={averageGross}
      />
      <PayslipStatCard
        icon={<Wallet />}
        label='סה"כ תלושים'
        value={totalPayslips}
      />
    </section>
  );
}
