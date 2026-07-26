import MarketComparisonShell from "../marketComparison/MarketComparisonShell";
import MarketComparisonSection from "../marketComparison/MarketComparisonSection";
import { getGemelMarketComparison, type GemelMarketProduct } from "../../api/marketComparison.api";

const fetchGemel = async (params: {
  risk: "low" | "medium" | "high";
  period: "12" | "36" | "5y" | "combined";
  product?: GemelMarketProduct;
}) => {
  if (!params.product) {
    return { success: false as const };
  }
  const data = await getGemelMarketComparison({
    product: params.product,
    risk: params.risk,
    period: params.period,
  });
  return data ? { success: true as const, data } : { success: false as const };
};

export default function GemelMarketComparisonTable() {
  return (
    <MarketComparisonSection accentSoft="var(--butter-soft)">
      <MarketComparisonShell
        productKey="gemel"
        accent="var(--butter-ink)"
        accentSoft="var(--butter-soft)"
        sourceLabel="גמל-נט, רשות שוק ההון"
        sourceShortLabel="גמל-נט"
        errorMessage="לא הצלחנו לטעון כרגע את נתוני ההשוואה מגמל-נט."
        fetcher={fetchGemel}
        showProductTabs
        defaultProduct="gemel"
      />
    </MarketComparisonSection>
  );
}
