/** Legacy Finq pension leaderboard — dev-only via VITE_SHOW_FINQ_LEADING_FUNDS=true */
export const SHOW_FINQ_LEADING_FUNDS = import.meta.env.VITE_SHOW_FINQ_LEADING_FUNDS === "true";

/** Pre–Step 4 Gemel classification table — dev-only via VITE_SHOW_LEGACY_GEMEL_LEADING_FUNDS=true */
export const SHOW_LEGACY_GEMEL_LEADING_FUNDS =
  import.meta.env.VITE_SHOW_LEGACY_GEMEL_LEADING_FUNDS === "true";
