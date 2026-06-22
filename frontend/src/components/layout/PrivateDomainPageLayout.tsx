import type { ReactNode } from "react";
import PrivateTopbar from "../PrivateTopbar";
import AppFooter from "../AppFooter";

type PrivateDomainPageLayoutProps = {
  children: ReactNode;
  maxWidth?: number;
};

export function PrivateDomainPageLayout({
  children,
  maxWidth = 860,
}: PrivateDomainPageLayoutProps) {
  return (
    <div style={{
      minHeight: "100vh",
      background: "var(--lg-bg, #FAF7FF)",
      color: "#1F1F1F",
      fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
    }}>
      <PrivateTopbar />
      <main style={{ maxWidth, margin: "0 auto", padding: "36px 24px 72px", direction: "rtl" }}>
        {children}
      </main>
      <AppFooter variant="private" />
    </div>
  );
}
