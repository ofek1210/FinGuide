import type { GemelMarketProduct, MarketPeriod, MarketRiskLevel } from "../../api/marketComparison.api";

export const RISK_TABS: { id: MarketRiskLevel; label: string }[] = [
  { id: "low", label: "סיכון נמוך" },
  { id: "medium", label: "סיכון בינוני" },
  { id: "high", label: "סיכון גבוה" },
];

export const PERIOD_TABS: { id: MarketPeriod; label: string }[] = [
  { id: "12", label: "12 חודשים" },
  { id: "36", label: "3 שנים" },
  { id: "5y", label: "5 שנים" },
  { id: "combined", label: "דירוג משולב" },
];

export const GEMEL_PRODUCT_TABS: { id: GemelMarketProduct; label: string }[] = [
  { id: "gemel", label: "קופות גמל" },
  { id: "hishtalmut", label: "קרנות השתלמות" },
  { id: "investment_gemel", label: "גמל להשקעה" },
];

const GROUP_SUFFIX_LABELS: Record<string, string> = {
  equity: "מניות",
  general: "כללי",
  bonds: 'אג"ח ואשראי',
  sp500: "עוקב S&P 500",
  age_under_50: "מסלול לבני 50 ומטה",
  age_50_60: "מסלול לבני 50–60",
  age_over_60: "מסלול לבני 60 ומעלה",
  halacha: "מסלול הלכתי",
};

const PRODUCT_LABELS: Record<string, string> = {
  pension: "פנסיה",
  gemel: "קופות גמל",
  hishtalmut: "קרנות השתלמות",
  investment_gemel: "גמל להשקעה",
};

const ORDERED_SUFFIXES = [
  "age_under_50",
  "age_50_60",
  "age_over_60",
  "sp500",
  "equity",
  "bonds",
  "general",
  "halacha",
] as const;

export function extractComparisonGroupSuffix(comparisonGroup: string): string {
  if (!comparisonGroup || comparisonGroup === "unclassified") return comparisonGroup;
  for (const suffix of ORDERED_SUFFIXES) {
    if (comparisonGroup === suffix || comparisonGroup.endsWith(`_${suffix}`)) {
      return suffix;
    }
  }
  return comparisonGroup.split("_").slice(-1)[0] ?? comparisonGroup;
}

export function labelComparisonGroup(comparisonGroup: string): string {
  const suffix = extractComparisonGroupSuffix(comparisonGroup);
  return GROUP_SUFFIX_LABELS[suffix] ?? suffix.replace(/_/g, " ");
}

export function labelProduct(product: string): string {
  return PRODUCT_LABELS[product] ?? product;
}

export function buildRankingScopeSentence(product: string, comparisonGroup: string, risk: MarketRiskLevel): string {
  const productLabel = labelProduct(product);
  const groupLabel = labelComparisonGroup(comparisonGroup);
  const riskLabel = RISK_TABS.find((tab) => tab.id === risk)?.label ?? risk;
  return `המסלולים מדורגים מול מסלולי ${groupLabel} ב${productLabel} בלבד, ברמת ${riskLabel}.`;
}

export const RISK_TOOLTIP =
  "רמת הסיכון מסווגת לפי מאפייני המסלול והחשיפה הרשמית לנכסים, ולא לפי תשואות העבר.";

export const COMBINED_SCORE_TOOLTIP =
  "הציון מחושב לפי מיקום המסלול ביחס למסלולים דומים באותה קבוצת השוואה, תוך שקלול תשואות ל-12 חודשים, 3 שנים ו-5 שנים בהתאם לזמינות הנתונים.";

export const PARTIAL_HISTORY_TOOLTIP =
  "הציון חושב לפי תקופות הנתונים הזמינות למסלול. חלק מתקופות ההשוואה חסרות ולכן המשקלים הותאמו.";

export const FEE_TOOLTIP =
  "דמי הניהול מוצגים לצורך השוואה אך אינם נכללים בדירוג הביצועים הנוכחי.";
