import type { AccountAnalysis } from "../../api/financialAdvisory.types";
import AccountAnalysisPanel from "./AccountAnalysisPanel";

type Props = {
  accounts: AccountAnalysis[];
  accent?: "mint" | "butter";
};

export default function AccountAnalysisList({ accounts, accent = "mint" }: Props) {
  if (!accounts?.length) return null;

  return (
    <section style={{ marginTop: 24 }}>
      <h2 style={{ fontSize: 13, fontWeight: 800, color: "var(--text-faint)", letterSpacing: ".06em", margin: "0 2px 14px" }}>
        ניתוח לפי חשבון ({accounts.length})
      </h2>
      <p style={{ margin: "0 0 14px", fontSize: 13, color: "var(--text-muted)", lineHeight: 1.5 }}>
        לכל חשבון — שלושה ממדים: דמי ניהול, התאמת מסלול והשוואת שוק. הרחבו לראות את כל הראיות.
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {accounts.map(account => (
          <AccountAnalysisPanel key={account.accountId} account={account} accent={accent} />
        ))}
      </div>
    </section>
  );
}
