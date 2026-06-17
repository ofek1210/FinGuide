import type { ReactNode } from "react";
import AppFooter from "../AppFooter";
import PrivateTopbar from "../PrivateTopbar";
import PayslipHistoryHeader from "./PayslipHistoryHeader";
import DocsTabBar from "../tabs/DocsTabBar";

interface PayslipHistoryLayoutProps {
  children: ReactNode;
  onBackToDashboard?: () => void;
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
      <PrivateTopbar />
      <DocsTabBar />
      {onBackToDashboard ? (
        <PayslipHistoryHeader onBackToDashboard={onBackToDashboard} backLabel={backLabel} />
      ) : null}
      <main className="payslip-main">{children}</main>
      <AppFooter variant="private" />
    </div>
  );
}
