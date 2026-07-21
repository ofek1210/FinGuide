/** Canonical three_card_v5 advisory contract — pension + gemel. */

export type RecommendationEngine = "three_card_v5" | "legacy_prioritizer" | string;

export type CardOutcome =
  | "actionable"
  | "monitoring"
  | "information_required"
  | "insufficient_data";

export type RecommendationCardType =
  | "management_fees"
  | "track_suitability"
  | "market_comparison";

export type CardIcon = "fees" | "track" | "market";

export type ConfidenceLevel = "high" | "medium" | "low" | "insufficient_data";

export type FeeComponentStatus =
  | "excellent"
  | "competitive"
  | "above_average"
  | "high"
  | "unknown";

export type TrackSuitabilityStatus =
  | "well_matched"
  | "too_conservative"
  | "provisional_conservative"
  | "too_aggressive"
  | "missing_profile"
  | "unknown";

export type MarketComparisonStatus =
  | "top_peer_group"
  | "above_peer_median"
  | "around_peer_median"
  | "below_peer_median"
  | "bottom_peer_group"
  | "insufficient_history"
  | "short_term_only"
  | "unmatched";

export type FeeCalculationInputs = {
  currentBalance?: number;
  annualDeposits?: number;
  userBalanceFeePct?: number;
  userDepositFeePct?: number;
  marketAvgBalancePct?: number;
  marketAvgDepositPct?: number;
  peerBalanceSampleSize?: number;
  peerDepositSampleSize?: number;
};

export type FeeCardMetrics = {
  fundName?: string;
  accountId?: string;
  depositFeeStatus?: FeeComponentStatus;
  balanceFeeStatus?: FeeComponentStatus;
  estimatedAnnualCost?: number;
  estimatedAnnualSaving?: number;
  calculationInputs?: FeeCalculationInputs;
  currentFeeBalancePct?: number;
  currentFeeDepositPct?: number;
  marketAverageFeeBalancePct?: number;
  potentialAnnualSavingIls?: number;
  comparisonGroup?: string;
};

export type SuitableRiskRange = {
  min?: string;
  max?: string;
  explanationHe?: string;
  productKind?: string;
};

export type SuitabilityCardMetrics = {
  fundName?: string;
  accountId?: string;
  fundRiskLevel?: string;
  userRiskLevel?: string;
  suitableRiskRange?: SuitableRiskRange;
  horizonYears?: number | null;
  horizonSource?: string;
  productKind?: string;
  suitabilityBlockers?: string[];
};

export type MarketCardMetrics = {
  fundName?: string;
  accountId?: string;
  fundId?: string;
  comparisonGroup?: string;
  comparisonGroupLabel?: string;
  riskLevel?: string;
  userRank?: number;
  userCombinedScore?: number;
  userPercentile?: number;
  rankedRecordsInGroup?: number;
  rankingScope?: string;
  rankingFormula?: string;
  returnDivergence?: boolean;
  periodsUsed?: string[];
  comparisonDataDate?: string;
};

export type RecommendationCardMetrics =
  | FeeCardMetrics
  | SuitabilityCardMetrics
  | MarketCardMetrics;

export type MarketAlternative = {
  rank: number;
  fundId: string;
  fundName: string;
  managingCompany?: string | null;
  combinedScore?: number | null;
  managementFeeBalance?: number | null;
  reasons: string[];
};

export type PortfolioSelectionMeta = {
  selectedAccountId: string;
  selectedAccountLabel: string;
  priorityScore: number;
  otherAccounts?: Array<{
    accountId: string;
    accountLabel: string;
    priorityScore: number;
    reasonNotSelected: string;
  }>;
};

export type RecommendationCard = {
  id: string;
  slot: RecommendationCardType;
  icon: CardIcon;
  title: string;
  status: string;
  statusLabelHe: string;
  cardOutcome: CardOutcome;
  summary: string;
  recommendation: string;
  confidence: ConfidenceLevel;
  confidenceLabelHe: string;
  confidenceScore: number;
  why: string;
  accountId?: string;
  accountLabel?: string;
  metrics?: RecommendationCardMetrics;
  alternatives?: MarketAlternative[];
  alternativesLabelHe?: string;
  productType?: string;
  portfolioSelection?: PortfolioSelectionMeta;
};

export type AccountAnalysis = {
  accountId: string;
  accountLabel: string;
  fundName: string;
  productType: string;
  currentBalance?: number | null;
  cards: RecommendationCard[];
};

export type PrimaryRecommendation = {
  insightId: string;
  title: string;
  explanation: string;
  whyItMatters?: string;
  nextStep?: string;
  cardSlot?: RecommendationCardType;
  cardStatus?: string;
  confidence?: ConfidenceLevel;
  confidenceLabelHe?: string;
  financialImpact?: {
    amount?: number | null;
    currency?: string;
    period?: "annual" | "retirement" | string;
  } | null;
  evidence?: Record<string, unknown> | null;
};

export type AdvisoryMarketData = {
  source: string;
  sourceLabel?: string;
  latestReportPeriod?: string | null;
  lastSyncedAt?: string | null;
  isStale?: boolean;
  fundCount?: number;
  warnings?: string[];
};

export type AdvisoryDataQuality = {
  uploadValid?: boolean;
  matchConfidence?: number | null;
  missingFields?: string[];
  warnings?: string[];
};

export type AdvisoryMissingDataItem = {
  field: string;
  message: string;
};

export type AdvisoryLlmMeta = {
  used: boolean;
  provider?: string | null;
  fallbackUsed?: boolean;
  reason?: string | null;
  summary?: string | null;
};

export type ThreeCardMeta = {
  engineVersion?: string;
  accountCount?: number;
  cardCount?: number;
  moreFindingsCount?: number;
  portfolioSelection?: PortfolioSelectionMeta[];
};

/** Shared envelope returned when recommendationEngine === three_card_v5 */
export type ThreeCardAdvisoryData = {
  recommendationEngine: RecommendationEngine;
  analysisId?: string;
  generatedAt?: string;
  ruleVersion?: string;
  productType?: string;
  recommendationCards: RecommendationCard[];
  primaryRecommendations?: PrimaryRecommendation[];
  accountAnalyses: AccountAnalysis[];
  threeCardMeta?: ThreeCardMeta | null;
  marketData?: AdvisoryMarketData | null;
  dataQuality?: AdvisoryDataQuality | null;
  missingData?: AdvisoryMissingDataItem[];
  llm?: AdvisoryLlmMeta | null;
  disclaimer?: string | null;
  productDisclaimer?: string | null;
};

export function isThreeCardAdvisory(
  data: { recommendationEngine?: string; recommendationCards?: unknown[] } | null | undefined,
): data is ThreeCardAdvisoryData {
  return (
    data?.recommendationEngine === "three_card_v5"
    && Array.isArray(data.recommendationCards)
    && data.recommendationCards.length > 0
  );
}
