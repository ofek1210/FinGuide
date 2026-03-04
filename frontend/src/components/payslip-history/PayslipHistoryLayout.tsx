import type { ReactNode } from "react";
import AppFooter from "../AppFooter";
import PayslipHistoryHeader from "./PayslipHistoryHeader";

interface PayslipHistoryLayoutProps {
  children: ReactNode;
  onBackToDashboard: () => void;
  /** Optional label for back button (e.g. "חזרה להיסטוריה" on detail page) */
  backLabel?: string;
}

export default function PayslipHistoryLayout({
  children,
  onBackToDashboard,
  backLabel,
}: PayslipHistoryLayoutProps) {
  return (
    <div className="payslip-page" dir="rtl">
      <PayslipHistoryHeader onBackToDashboard={onBackToDashboard} backLabel={backLabel} />
      <main className="payslip-main">{children}</main>
      <AppFooter variant="private" />
    </div>
  );
}
