import { Fragment, useState } from "react";
import { ChevronDown } from "lucide-react";
import {
  COMBINED_SCORE_TOOLTIP,
  FEE_TOOLTIP,
  PARTIAL_HISTORY_TOOLTIP,
} from "./marketComparisonLabels";
import {
  fmtAssets,
  fmtPct,
  formatSelectedPeriodValue,
  hasPartialCombinedWeights,
  selectedPeriodColumnLabel,
} from "./marketComparisonFormatters";
import MarketFundDetails from "./MarketFundDetails";
import { MarketFundCardSummary } from "./MarketFundDetails";
import type { MarketComparisonFundDTO, MarketPeriod } from "../../api/marketComparison.api";

type Props = {
  funds: MarketComparisonFundDTO[];
  period: MarketPeriod;
  accent: string;
};

const th: React.CSSProperties = {
  textAlign: "right",
  padding: "10px 12px",
  fontSize: 12,
  fontWeight: 800,
  color: "var(--text-faint)",
  whiteSpace: "nowrap",
};

const td: React.CSSProperties = {
  padding: "12px",
  fontSize: 13.5,
  borderTop: "1px solid var(--hair)",
  verticalAlign: "top",
};

export default function MarketRankingTable({ funds, period, accent }: Props) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const selectedLabel = selectedPeriodColumnLabel(period);

  return (
    <>
      <div className="mc-desktop-table" style={{ overflowX: "auto", marginTop: 12 }}>
        <table style={{ width: "100%", minWidth: 720, borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={th}>מקום</th>
              <th style={th}>שם המסלול</th>
              <th style={th}>חברה מנהלת</th>
              <th style={th} title={period === "combined" ? COMBINED_SCORE_TOOLTIP : undefined}>
                {selectedLabel}
              </th>
              <th style={th}>תשואה שנתית ממוצעת ל-3 שנים</th>
              <th style={th}>תשואה שנתית ממוצעת ל-5 שנים</th>
              <th style={th} title={FEE_TOOLTIP}>דמי ניהול</th>
              <th style={th}>נכסים מנוהלים</th>
              <th style={th} aria-hidden />
            </tr>
          </thead>
          <tbody>
            {funds.map((fund) => {
              const partial = period === "combined" && hasPartialCombinedWeights(fund);
              const open = expanded === fund.fundId;
              const rankCell =
                fund.rankingStatus === "insufficient_history" || fund.rank == null
                  ? "אין היסטוריה מספקת לדירוג"
                  : fund.rank;

              return (
                <Fragment key={fund.fundId}>
                  <tr>
                    <td style={{ ...td, fontWeight: 900, color: accent }}>{rankCell}</td>
                    <td style={{ ...td, fontWeight: 800, maxWidth: 220 }}>{fund.fundName}</td>
                    <td style={td}>{fund.managingCompany}</td>
                    <td style={td}>
                      {formatSelectedPeriodValue(fund, period)}
                      {partial && (
                        <span
                          style={{ display: "block", fontSize: 11, color: "var(--butter-ink)", marginTop: 4 }}
                          title={PARTIAL_HISTORY_TOOLTIP}
                        >
                          חישוב חלקי
                        </span>
                      )}
                    </td>
                    <td style={td}>{fmtPct(fund.return36MonthsAnnualized)}</td>
                    <td style={td}>{fmtPct(fund.return5YearsAnnualized)}</td>
                    <td style={td} title={FEE_TOOLTIP}>{fmtPct(fund.managementFeeBalance)}</td>
                    <td style={td}>{fmtAssets(fund.assetsUnderManagement)}</td>
                    <td style={td}>
                      <button
                        type="button"
                        aria-expanded={open}
                        aria-label="פרטים נוספים"
                        onClick={() => setExpanded(open ? null : fund.fundId)}
                        style={{ border: "none", background: "transparent", cursor: "pointer", color: "var(--text-muted)" }}
                      >
                        <ChevronDown size={16} style={{ transform: open ? "rotate(180deg)" : undefined }} />
                      </button>
                    </td>
                  </tr>
                  {open && (
                    <tr>
                      <td colSpan={9} style={{ ...td, background: "var(--surface-2, var(--surface))" }}>
                        <MarketFundDetails fund={fund} period={period} />
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="mc-mobile-cards" style={{ display: "none", flexDirection: "column", gap: 10, marginTop: 12 }}>
        {funds.map((fund) => (
          <MarketFundCardSummary key={fund.fundId} fund={fund} period={period} />
        ))}
      </div>

      <style>{`
        @media (max-width: 768px) {
          .mc-desktop-table { display: none !important; }
          .mc-mobile-cards { display: flex !important; }
        }
      `}</style>
    </>
  );
}
