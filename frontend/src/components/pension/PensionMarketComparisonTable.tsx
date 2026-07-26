import MarketComparisonShell from "../marketComparison/MarketComparisonShell";
import MarketComparisonSection from "../marketComparison/MarketComparisonSection";
import { getPensionMarketComparison } from "../../api/marketComparison.api";

const fetchPension = async (params: { risk: "low" | "medium" | "high"; period: "12" | "36" | "5y" | "combined" }) => {
  const data = await getPensionMarketComparison(params);
  return data ? { success: true as const, data } : { success: false as const };
};

export default function PensionMarketComparisonTable() {
  return (
    <MarketComparisonSection accentSoft="var(--mint-soft)">
      <MarketComparisonShell
        productKey="pension"
        accent="var(--mint-ink)"
        accentSoft="var(--mint-soft)"
        sourceLabel="פנסיה-נט, רשות שוק ההון"
        sourceShortLabel="פנסיה-נט"
        errorMessage="לא הצלחנו לטעון כרגע את נתוני ההשוואה מפנסיה-נט."
        fetcher={fetchPension}
      />
    </MarketComparisonSection>
  );
}
