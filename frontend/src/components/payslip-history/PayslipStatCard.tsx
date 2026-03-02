import type { ReactNode } from "react";

interface PayslipStatCardProps {
  icon: ReactNode;
  label: string;
  value: string;
}

export default function PayslipStatCard({
  icon,
  label,
  value,
}: PayslipStatCardProps) {
  return (
    <div className="payslip-stat-card">
      <div className="payslip-stat-icon" aria-hidden="true">
        {icon}
      </div>
      <div className="payslip-stat-label">{label}</div>
      <div className="payslip-stat-value">{value}</div>
    </div>
  );
}
