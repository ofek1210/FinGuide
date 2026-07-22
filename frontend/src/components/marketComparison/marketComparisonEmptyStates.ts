import type { MarketComparisonResponseDTO } from "../../api/marketComparison.api";

export function resolveMarketComparisonEmptyState(
  data: MarketComparisonResponseDTO | null,
  selectedGroupId: string | null,
): string | null {
  if (!data) return null;
  if (!data.groups?.length) {
    return "לא נמצאו קבוצות השוואה מתאימות לסינון שנבחר.";
  }
  const group = data.groups.find((g) => g.comparisonGroup === selectedGroupId) ?? data.groups[0];
  if (!group) return "לא נמצאו קבוצות השוואה מתאימות לסינון שנבחר.";
  if (group.funds.length === 0) {
    if (group.eligibleRecords > 0) {
      return "אין מספיק נתוני תשואה לתקופה שנבחרה בקבוצת מסלולים זו.";
    }
    return "לא נמצאו מסלולים שניתן לדרג לפי הנתונים הזמינים.";
  }
  return null;
}
