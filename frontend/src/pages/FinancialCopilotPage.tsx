import PrivateTopbar from "../components/PrivateTopbar";

export default function FinancialCopilotPage() {
  return (
    <div style={{ minHeight: "100vh", background: "var(--rapyd-bg)", direction: "rtl" }}>
      <PrivateTopbar />
      <main style={{ maxWidth: 800, margin: "0 auto", padding: "60px 24px", textAlign: "center" }}>
        <h1 style={{ color: "var(--rapyd-text)", marginBottom: 12 }}>Financial Copilot</h1>
        <p style={{ color: "var(--rapyd-text-muted)" }}>בקרוב — צ'אט AI רב-סוכן עם streaming</p>
      </main>
    </div>
  );
}
