import { COMBINED_SCORE_TOOLTIP, FEE_TOOLTIP, PARTIAL_HISTORY_TOOLTIP } from "./marketComparisonLabels";
import {
  fmtAssets,
  fmtPct,
  fmtScore,
  formatSelectedPeriodValue,
  hasPartialCombinedWeights,
  selectedPeriodColumnLabel,
} from "./marketComparisonFormatters";
import type { MarketComparisonFundDTO, MarketPeriod } from "../../api/marketComparison.api";

type Props = {
  fund: MarketComparisonFundDTO;
  period: MarketPeriod;
};

export default function MarketFundDetails({ fund, period }: Props) {
  const partial = period === "combined" && hasPartialCombinedWeights(fund);

  return (
    <div style={{ padding: "12px 0 4px", fontSize: 13, color: "var(--text-muted)", lineHeight: 1.7 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10 }}>
        <div>
          <strong>תשואה ב-12 חודשים:</strong> {fmtPct(fund.return12Months)}
        </div>
        <div>
          <strong>תשואה שנתית ממוצעת ל-3 שנים:</strong> {fmtPct(fund.return36MonthsAnnualized)}
        </div>
        <div>
          <strong>תשואה שנתית ממוצעת ל-5 שנים:</strong> {fmtPct(fund.return5YearsAnnualized)}
        </div>
        <div title={FEE_TOOLTIP}>
          <strong>דמי ניהול מהפקדה:</strong> {fmtPct(fund.managementFeeDeposit)}
        </div>
        <div>
          <strong>נכסים מנוהלים:</strong> {fmtAssets(fund.assetsUnderManagement)}
        </div>
      </div>
      {period === "combined" && fund.rankingScore != null && (
        <p style={{ margin: "10px 0 0", fontSize: 12 }} title={COMBINED_SCORE_TOOLTIP}>
          ציון משולב: {fmtScore(fund.rankingScore)}
          {partial && (
            <span style={{ marginInlineStart: 8, color: "var(--butter-ink)" }} title={PARTIAL_HISTORY_TOOLTIP}>
              · חישוב חלקי
            </span>
          )}
        </p>
      )}
    </div>
  );
}

export function MarketFundCardSummary({
  fund,
  period,
}: {
  fund: MarketComparisonFundDTO;
  period: MarketPeriod;
}) {
  const partial = period === "combined" && hasPartialCombinedWeights(fund);
  const rankLabel =
    fund.rankingStatus === "insufficient_history" || fund.rank == null
      ? "—"
      : `#${fund.rank}`;

  return (
    <article
      style={{
        border: "1.5px solid var(--hair)",
        borderRadius: 16,
        padding: "14px 16px",
        background: "var(--surface)",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start" }}>
        <div>
          <div style={{ fontSize: 12, fontWeight: 900, color: "var(--text-faint)" }}>{rankLabel}</div>
          <div style={{ fontWeight: 900, fontSize: 15, color: "var(--text-strong)", marginTop: 4 }}>{fund.fundName}</div>
          <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 2 }}>{fund.managingCompany}</div>
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 12, fontSize: 13 }}>
        <div>
          <div style={{ color: "var(--text-faint)", fontSize: 11, fontWeight: 700 }}>{selectedPeriodColumnLabel(period)}</div>
          <div style={{ fontWeight: 800, marginTop: 2 }}>
            {formatSelectedPeriodValue(fund, period)}
            {partial && (
              <span style={{ marginInlineStart: 6, fontSize: 11, color: "var(--butter-ink)" }} title={PARTIAL_HISTORY_TOOLTIP}>
                חישוב חלקי
              </span>
            )}
          </div>
        </div>
        <div title={FEE_TOOLTIP}>
          <div style={{ color: "var(--text-faint)", fontSize: 11, fontWeight: 700 }}>דמי ניהול</div>
          <div style={{ fontWeight: 800, marginTop: 2 }}>{fmtPct(fund.managementFeeBalance)}</div>
        </div>
        <div style={{ gridColumn: "1 / -1" }}>
          <div style={{ color: "var(--text-faint)", fontSize: 11, fontWeight: 700 }}>נכסים מנוהלים</div>
          <div style={{ fontWeight: 800, marginTop: 2 }}>{fmtAssets(fund.assetsUnderManagement)}</div>
        </div>
      </div>
      <details style={{ marginTop: 10 }}>
        <summary style={{ cursor: "pointer", fontWeight: 800, fontSize: 13, color: "var(--text-muted)" }}>
          פרטים נוספים
        </summary>
        <MarketFundDetails fund={fund} period={period} />
      </details>
    </article>
  );
}
