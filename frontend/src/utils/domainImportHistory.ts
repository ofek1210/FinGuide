/**
 * Compute savings delta from import history snapshots or last upload session.
 */
export function computeImportHistoryDelta<T extends Record<string, unknown>>(
  history: T[],
  field: keyof T,
  fallbackDelta: number | null,
): number | null {
  if (history.length >= 2) {
    const current = history[0][field];
    const previous = history[1][field];
    if (typeof current === "number" && typeof previous === "number") {
      return current - previous;
    }
  }
  return fallbackDelta;
}
