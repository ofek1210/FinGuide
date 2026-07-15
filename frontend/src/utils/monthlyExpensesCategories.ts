export type ExpenseCategoryKey =
  | "rent"
  | "arnona"
  | "vaadBayit"
  | "clothing"
  | "food"
  | "restaurants"
  | "childcare"
  | "tvInternet"
  | "electricity"
  | "water";

export type MonthlyExpensesBreakdown = Partial<Record<ExpenseCategoryKey, number | null>>;

export const EXPENSE_CATEGORIES: Array<{
  key: ExpenseCategoryKey;
  label: string;
  color: string;
}> = [
  { key: "rent", label: "שכר דירה", color: "var(--lav-600)" },
  { key: "arnona", label: "ארנונה", color: "var(--peach-ink)" },
  { key: "vaadBayit", label: "ועד בית", color: "var(--mint-ink)" },
  { key: "clothing", label: "ביגוד", color: "var(--butter-ink)" },
  { key: "food", label: "מזון", color: "#6F8BE8" },
  { key: "restaurants", label: "מסעדות", color: "#E8789A" },
  { key: "childcare", label: "גנים/חינוך", color: "#9B7FE8" },
  { key: "tvInternet", label: "טלוויזיה ואינטרנט", color: "#4A9FD4" },
  { key: "electricity", label: "חשמל", color: "#F0B429" },
  { key: "water", label: "מים", color: "#5BB5C9" },
];

export function hasBreakdownData(breakdown: MonthlyExpensesBreakdown | null | undefined): boolean {
  if (!breakdown) return false;
  return EXPENSE_CATEGORIES.some((c) => Number(breakdown[c.key]) > 0);
}

export function sumBreakdown(
  values: Record<ExpenseCategoryKey, string>,
  other = "",
): number {
  let total = 0;
  for (const cat of EXPENSE_CATEGORIES) {
    const n = Number(values[cat.key]);
    if (Number.isFinite(n) && n > 0) total += n;
  }
  const otherN = Number(other);
  if (Number.isFinite(otherN) && otherN > 0) total += otherN;
  return total;
}

export function breakdownToPayload(
  values: Record<ExpenseCategoryKey, string>,
): MonthlyExpensesBreakdown {
  const payload: MonthlyExpensesBreakdown = {};
  for (const cat of EXPENSE_CATEGORIES) {
    const n = Number(values[cat.key]);
    payload[cat.key] = Number.isFinite(n) && n > 0 ? n : null;
  }
  return payload;
}
