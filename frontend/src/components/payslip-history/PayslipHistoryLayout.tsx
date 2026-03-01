import type { ReactNode } from "react";
import PayslipHistoryHeader from "./PayslipHistoryHeader";

interface PayslipHistoryLayoutProps {
  children: ReactNode;
  onBackToDashboard: () => void;
}

export default function PayslipHistoryLayout({
  children,
  onBackToDashboard,
}: PayslipHistoryLayoutProps) {
  return (
    <div className="payslip-page" dir="rtl">
      <PayslipHistoryHeader onBackToDashboard={onBackToDashboard} />
      <main className="payslip-main">{children}</main>
    </div>
  );
}
