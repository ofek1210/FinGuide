import type { MarketComparisonFundDTO, MarketPeriod } from "../../api/marketComparison.api";

export function fmtPct(val: number | null | undefined, digits = 2): string {
  if (val == null || Number.isNaN(val)) return "לא זמין";
  return `${val.toFixed(digits)}%`;
}

export function fmtScore(val: number | null | undefined): string {
  if (val == null || Number.isNaN(val)) return "לא זמין";
  return `${val.toFixed(1)} / 100`;
}

export function fmtAssets(millions: number | null | undefined): string {
  if (millions == null || Number.isNaN(millions)) return "לא זמין";
  if (millions >= 1000) return `₪${(millions / 1000).toFixed(1)}B`;
  return `₪${Math.round(millions).toLocaleString("en-US")}M`;
}

export function fmtReportPeriod(period: number | null | undefined): string | null {
  if (period == null) return null;
  const s = String(period);
  if (s.length === 6) return `${s.slice(4, 6)}/${s.slice(0, 4)}`;
  return s;
}

export function hasPartialCombinedWeights(fund: MarketComparisonFundDTO): boolean {
  const weights = fund.effectiveWeights ?? {};
  const keys = Object.keys(weights);
  return keys.length > 0 && keys.length < 3;
}

export function selectedPeriodColumnLabel(period: MarketPeriod): string {
  switch (period) {
    case "12":
      return "תשואה ב-12 חודשים";
    case "36":
      return "תשואה שנתית ממוצעת ל-3 שנים";
    case "5y":
      return "תשואה שנתית ממוצעת ל-5 שנים";
    case "combined":
      return "ציון ביצועים משולב";
    default:
      return "תשואה";
  }
}

export function formatSelectedPeriodValue(fund: MarketComparisonFundDTO, period: MarketPeriod): string {
  if (fund.rankingStatus === "insufficient_history") {
    return "אין היסטוריה מספקת לדירוג";
  }
  if (period === "combined") return fmtScore(fund.rankingScore);
  if (period === "12") return fmtPct(fund.return12Months);
  if (period === "36") return fmtPct(fund.return36MonthsAnnualized);
  if (period === "5y") return fmtPct(fund.return5YearsAnnualized);
  return "לא זמין";
}
