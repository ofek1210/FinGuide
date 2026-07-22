import { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import type {
  GemelMarketProduct,
  MarketComparisonResponseDTO,
  MarketPeriod,
  MarketRiskLevel,
} from "../../api/marketComparison.api";
import MarketRiskSelector from "./MarketRiskSelector";
import MarketPeriodSelector from "./MarketPeriodSelector";
import ComparisonGroupSelector from "./ComparisonGroupSelector";
import MarketProductTabs from "./MarketProductTabs";
import MarketRankingTable from "./MarketRankingTable";
import MarketDataQualitySummary from "./MarketDataQualitySummary";
import MarketComparisonDisclaimer from "./MarketComparisonDisclaimer";
import { buildRankingScopeSentence } from "./marketComparisonLabels";
import { resolveMarketComparisonEmptyState } from "./marketComparisonEmptyStates";
import { useMarketComparisonQuery } from "./useMarketComparisonQuery";

type FetchParams = {
  risk: MarketRiskLevel;
  period: MarketPeriod;
  product?: GemelMarketProduct;
};

type Props = {
  productKey: string;
  accent: string;
  accentSoft: string;
  sourceLabel: string;
  sourceShortLabel: string;
  errorMessage: string;
  fetcher: (params: FetchParams) => Promise<{ success: boolean; data?: MarketComparisonResponseDTO }>;
  showProductTabs?: boolean;
  defaultProduct?: GemelMarketProduct;
};

const DEFAULT_RISK: MarketRiskLevel = "medium";
const DEFAULT_PERIOD: MarketPeriod = "5y";

export default function MarketComparisonShell({
  productKey,
  accent,
  accentSoft,
  sourceLabel,
  sourceShortLabel,
  errorMessage,
  fetcher,
  showProductTabs = false,
  defaultProduct = "gemel",
}: Props) {
  const [risk, setRisk] = useState<MarketRiskLevel>(DEFAULT_RISK);
  const [period, setPeriod] = useState<MarketPeriod>(DEFAULT_PERIOD);
  const [product, setProduct] = useState<GemelMarketProduct>(defaultProduct);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);

  const queryParams = useMemo(
    () => ({ risk, period, product: showProductTabs ? product : undefined }),
    [risk, period, product, showProductTabs],
  );

  const { data, loading, error, retry } = useMarketComparisonQuery(fetcher, queryParams);

  useEffect(() => {
    if (!data?.groups?.length) {
      setSelectedGroupId(null);
      return;
    }
    const exists = data.groups.some((g) => g.comparisonGroup === selectedGroupId);
    if (!selectedGroupId || !exists) {
      setSelectedGroupId(data.groups[0].comparisonGroup);
    }
  }, [data, selectedGroupId]);

  const activeProduct = showProductTabs ? product : productKey;
  const selectedGroup = data?.groups.find((g) => g.comparisonGroup === selectedGroupId) ?? data?.groups[0] ?? null;
  const emptyReason = resolveMarketComparisonEmptyState(data, selectedGroupId);

  return (
    <div aria-live="polite">
      {showProductTabs && (
        <MarketProductTabs value={product} onChange={setProduct} accent={accent} accentSoft={accentSoft} />
      )}

      <div style={{ display: "grid", gap: 16 }}>
        <MarketRiskSelector value={risk} onChange={setRisk} accent={accent} accentSoft={accentSoft} />
        <MarketPeriodSelector value={period} onChange={setPeriod} accent={accent} accentSoft={accentSoft} />
        {data?.groups?.length ? (
          <ComparisonGroupSelector
            groups={data.groups}
            value={selectedGroupId}
            onChange={setSelectedGroupId}
            accent={accent}
            accentSoft={accentSoft}
          />
        ) : null}
      </div>

      <div style={{ marginTop: 18 }}>
        <h3 style={{ margin: "0 0 6px", fontSize: 16, fontWeight: 900, color: "var(--text-strong)" }}>
          מסלולים מובילים בקבוצת ההשוואה
        </h3>
        {selectedGroup && (
          <>
            <p style={{ margin: "0 0 4px", fontSize: 13, color: "var(--text-muted)", lineHeight: 1.55 }}>
              {buildRankingScopeSentence(activeProduct, selectedGroup.comparisonGroup, risk)}
            </p>
            <p style={{ margin: 0, fontSize: 12.5, color: "var(--text-faint)" }}>
              הדירוג מוצג בתוך קבוצת המסלולים שנבחרה בלבד.
            </p>
          </>
        )}
      </div>

      {error && (
        <div style={{ marginTop: 16, padding: 16, borderRadius: 14, background: "rgba(214,69,69,.08)", color: "#C23B3B" }}>
          <p style={{ margin: "0 0 10px", fontWeight: 800 }}>{errorMessage}</p>
          <button type="button" onClick={retry} style={retryBtn}>
            נסה שוב
          </button>
        </div>
      )}

      {!error && loading && (
        <div style={{ marginTop: 20, padding: 24, textAlign: "center", color: "var(--text-muted)" }}>
          <Loader2 size={22} style={{ animation: "spin 1s linear infinite" }} />
          <p style={{ margin: "10px 0 0", fontSize: 14 }}>טוען נתוני השוואה…</p>
        </div>
      )}

      {!error && !loading && emptyReason && (
        <p style={{ marginTop: 20, padding: 16, borderRadius: 14, background: "var(--surface)", color: "var(--text-muted)", fontWeight: 700 }}>
          {emptyReason}
        </p>
      )}

      {!error && !loading && !emptyReason && selectedGroup && (
        <>
          <MarketRankingTable funds={selectedGroup.funds} period={period} accent={accent} />
          <MarketDataQualitySummary
            group={selectedGroup}
            dataQuality={data!.dataQuality}
            sourceShortLabel={sourceShortLabel}
          />
        </>
      )}

      <MarketComparisonDisclaimer sourceLabel={sourceLabel} />
    </div>
  );
}

const retryBtn: React.CSSProperties = {
  padding: "8px 14px",
  borderRadius: 10,
  border: "none",
  background: "#C23B3B",
  color: "#fff",
  fontWeight: 800,
  cursor: "pointer",
};
