import type { PensionAnalysisData, PensionBenchmarkFundDTO, PensionFundDTO } from "../../api/pension.api";

/* ============================================================
   leadingFundsInsights — turns the pension agent's analysis into
   annotations for the leading-funds market table: which row is
   the user's current fund, whether the agent recommends a switch,
   and the ₪ numbers that justify it. Pure logic, unit-testable.
   ============================================================ */

/** Managing-body tokens as they appear in the Finq table's managingBody. */
const KNOWN_BODIES = [
  "מנורה", "הראל", "מיטב", "הפניקס", "מגדל", "אלטשולר",
  "מור", "אינפיניטי", "סלייס", "כלל",
];

/** Extract the managing-body token from any fund/provider/track string. */
export function bodyToken(text: string | null | undefined): string | null {
  if (!text) return null;
  // "כלל" is a substring of "כללי" (general track) — mask it first.
  const clean = text.replace(/כללי/g, "");
  return KNOWN_BODIES.find(t => clean.includes(t)) ?? null;
}

export type LeadingFundsInsights = {
  /** The user's current pension fund, as the agent benchmarked it. */
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
  /** The agent's switch advice — present only when it found real money on the table. */
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

/** Benchmark fees arrive as fractions (0.009 = 0.9%) — convert to clean percent. */
function toPct(fraction: number | null | undefined): number | null {
  if (fraction == null || Number.isNaN(fraction)) return null;
  return Math.round(fraction * 10000) / 100;
}

/**
 * Build table annotations from the agent's analysis.
 * Picks the user's active pension fund with the biggest fee problem
 * (that's where the agent's switch advice points).
 */
export function buildLeadingFundsInsights(
  data: PensionAnalysisData | null | undefined,
  funds: PensionFundDTO[],
): LeadingFundsInsights | null {
  const benchFunds = data?.benchmark?.funds ?? [];
  if (!benchFunds.length && !funds.length) return null;

  // Rank benchmark entries: fee problems first, then biggest savings.
  const FEE_SEVERITY: Record<string, number> = { high: 0, above_market: 1, fair: 2, excellent: 3, unknown: 4 };
  const focus = [...benchFunds]
    .filter(b => bodyToken(b.provider ?? b.fundName))
    .sort(
      (a, b) =>
        (FEE_SEVERITY[a.feeVsMarket] ?? 5) - (FEE_SEVERITY[b.feeVsMarket] ?? 5) ||
        b.potentialSavingsToRetirement - a.potentialSavingsToRetirement,
    )[0];

  let current: LeadingFundsInsights["current"] = null;
  if (focus) {
    const token = bodyToken(focus.provider ?? focus.fundName);
    if (token) {
      current = {
        token,
        fundName: focus.fundName,
        matchedTrackId: focus.matchedTrack?.id ?? null,
        matchedTrackName: focus.matchedTrack?.name ?? null,
        userFee: toPct(focus.userFee),
        marketAvgFee: toPct(focus.marketAvgFee),
        feeVsMarket: focus.feeVsMarket,
        rankLabel: focus.rankLabel,
        savingsToRetirement: focus.potentialSavingsToRetirement ?? 0,
      };
    }
  }

  const savingsByRetirement =
    data?.benchmark?.summary?.totalPotentialSavings ??
    data?.projection?.mgmtFeeSavings?.savingsByRetirement ??
    0;
  const additionalMonthlyPension = data?.projection?.mgmtFeeSavings?.additionalMonthlyPension ?? 0;

  const shouldSwitch =
    !!current &&
    (current.feeVsMarket === "high" ||
      current.feeVsMarket === "above_market" ||
      current.rankLabel === "below_average") &&
    savingsByRetirement > 0;

  const advice = savingsByRetirement > 0 || additionalMonthlyPension > 0
    ? { shouldSwitch, savingsByRetirement, additionalMonthlyPension }
    : null;

  if (!current && !advice) return null;
  return { current, advice };
}
