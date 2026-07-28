import { useCallback, useSyncExternalStore } from "react";

/**
 * מעקב אחרי media query — לרספונסיביות ברכיבים שמסוגננים ב-inline styles.
 * שימוש: const isMobile = useMediaQuery("(max-width: 640px)");
 */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      const mql = window.matchMedia(query);
      mql.addEventListener("change", onStoreChange);
      return () => mql.removeEventListener("change", onStoreChange);
    },
    [query],
  );

  const getSnapshot = useCallback(() => window.matchMedia(query).matches, [query]);

  return useSyncExternalStore(subscribe, getSnapshot, () => false);
}
