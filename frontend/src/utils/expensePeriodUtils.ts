import type { MonthlyExpensePeriodEntry } from "../api/copilot.api";

export function currentPeriodKey(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export function formatPeriodLabel(period: string): string {
  const [year, month] = period.split("-").map(Number);
  if (!year || !month) return period;
  return new Intl.DateTimeFormat("he-IL", { month: "long", year: "numeric" }).format(
    new Date(year, month - 1, 1),
  );
}

export function sortPeriodsDesc(periods: string[]): string[] {
  return [...periods].sort((a, b) => b.localeCompare(a));
}

export function buildPeriodOptions(
  byPeriod: Record<string, MonthlyExpensePeriodEntry> | null | undefined,
  payslipsByPeriod: Record<string, { netSalary?: number | null }> | null | undefined,
): string[] {
  const set = new Set<string>([currentPeriodKey()]);
  for (const key of Object.keys(byPeriod || {})) set.add(key);
  for (const key of Object.keys(payslipsByPeriod || {})) set.add(key);
  return sortPeriodsDesc([...set]);
}

export function defaultPeriodKey(
  payslipsByPeriod: Record<string, unknown> | null | undefined,
  byPeriod: Record<string, unknown> | null | undefined,
): string {
  const payslipKeys = sortPeriodsDesc(Object.keys(payslipsByPeriod || {}));
  if (payslipKeys.length > 0) return payslipKeys[0];
  const expenseKeys = sortPeriodsDesc(Object.keys(byPeriod || {}));
  if (expenseKeys.length > 0) return expenseKeys[0];
  return currentPeriodKey();
}

export function shiftPeriod(period: string, delta: number): string {
  const [year, month] = period.split("-").map(Number);
  if (!year || !month) return period;
  const d = new Date(year, month - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
