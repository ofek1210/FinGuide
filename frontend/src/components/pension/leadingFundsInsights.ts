import type { PensionAnalysisData, PensionBenchmarkFundDTO, PensionFundDTO } from "../../api/pension.api";
import { isThreeCardAdvisory } from "../../api/financialAdvisory.types";
import type { FeeCardMetrics, MarketCardMetrics } from "../../api/financialAdvisory.types";

/* ============================================================
   leadingFundsInsights — turns the pension agent's analysis into
   annotations for the leading-funds market table.
   ============================================================ */

const KNOWN_BODIES = [
  "מנורה", "הראל", "מיטב", "הפניקס", "מגדל", "אלטשולר",
  "מור", "אינפיניטי", "סלייס", "כלל",
];

export function bodyToken(text: string | null | undefined): string | null {
  if (!text) return null;
  const clean = text.replace(/כללי/g, "");
  return KNOWN_BODIES.find(t => clean.includes(t)) ?? null;
}

export type LeadingFundsInsights = {
  current: {
    token: string;
    fundName: string;
    matchedTrackId: string | null;
    matchedTrackName: string | null;
    userFee: number | null;
    marketAvgFee: number | null;
    feeVsMarket: PensionBenchmarkFundDTO["feeVsMarket"];
    rankLabel: PensionBenchmarkFundDTO["rankLabel"];
    savingsToRetirement: number;
  } | null;
  advice: {
    shouldSwitch: boolean;
    savingsByRetirement: number;
    additionalMonthlyPension: number;
  } | null;
};

const FEE_LABELS: Record<string, string> = {
  excellent: "מצוינים",
  fair: "סבירים",
  above_market: "מעל ממוצע השוק",
  high: "גבוהים",
  unknown: "לא ידועים",
};

const RANK_LABELS: Record<string, string> = {
  above_average: "מעל הממוצע",
  average: "סביב הממוצע",
  below_average: "מתחת לממוצע",
  unknown: "לא דורג",
};

export const feeLabelHe = (v: string) => FEE_LABELS[v] ?? v;
export const rankLabelHe = (v: string) => RANK_LABELS[v] ?? v;

function toPct(fraction: number | null | undefined): number | null {
  if (fraction == null || Number.isNaN(fraction)) return null;
  const n = fraction <= 1 && fraction >= 0 ? fraction * 100 : fraction;
  return Math.round(n * 100) / 100;
}

function fromThreeCard(
  data: PensionAnalysisData,
  funds: PensionFundDTO[],
): LeadingFundsInsights | null {
  if (!isThreeCardAdvisory(data) || !funds.length) return null;

  const feeCard = data.recommendationCards.find(c => c.slot === "management_fees");
  const feeMetrics = (feeCard?.metrics ?? {}) as FeeCardMetrics;
  const marketMetrics = (marketCardMetrics(data));
  const focusFund = funds.find(f => f.id === feeCard?.accountId) ?? funds[0];
  const token = bodyToken(focusFund.provider ?? focusFund.fundName);
  if (!token) return null;

  const savingsByRetirement = (feeMetrics.estimatedAnnualSaving ?? 0) * 15;
  const feeVsMarket: PensionBenchmarkFundDTO["feeVsMarket"] =
    feeCard?.status === "high" ? "high"
      : feeCard?.status === "above_average" ? "above_market"
        : feeCard?.status === "competitive" ? "fair"
          : "unknown";

  const current = {
    token,
    fundName: focusFund.fundName,
    matchedTrackId: marketMetrics.fundId ?? null,
    matchedTrackName: marketMetrics.comparisonGroupLabel ?? null,
    userFee: toPct(feeMetrics.currentFeeBalancePct),
    marketAvgFee: toPct(feeMetrics.marketAverageFeeBalancePct),
    feeVsMarket,
    rankLabel: (marketMetrics.userRank ? "average" : "unknown") as PensionBenchmarkFundDTO["rankLabel"],
    savingsToRetirement: savingsByRetirement,
  };

  const advice = savingsByRetirement > 0
    ? { shouldSwitch: false, savingsByRetirement, additionalMonthlyPension: 0 }
    : null;

  return { current, advice };
}

function marketCardMetrics(data: PensionAnalysisData): MarketCardMetrics {
  const card = isThreeCardAdvisory(data)
    ? data.recommendationCards.find(c => c.slot === "market_comparison")
    : null;
  return (card?.metrics ?? {}) as MarketCardMetrics;
}

export function buildLeadingFundsInsights(
  data: PensionAnalysisData | null | undefined,
  funds: PensionFundDTO[],
): LeadingFundsInsights | null {
  if (!data || !funds.length) return null;
  if (isThreeCardAdvisory(data)) return fromThreeCard(data, funds);
  return null;
}
