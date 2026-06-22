export const FUND_TYPE_LABELS: Record<string, string> = {
  pension_comprehensive: "פנסיה מקיפה",
  pension_old: "פנסיה ותיקה",
  managers_insurance: "ביטוח מנהלים",
  provident_fund: "קופת גמל",
  study_fund: "קרן השתלמות",
  other: "אחר",
};

export const RANK_BADGE: Record<string, { label: string; color: string; bg: string }> = {
  above_average: { label: "מעל ממוצע", color: "#059669", bg: "rgba(5,150,105,0.12)" },
  average: { label: "ממוצע", color: "#D97706", bg: "rgba(217,119,6,0.12)" },
  below_average: { label: "מתחת לממוצע", color: "#DC2626", bg: "rgba(220,38,38,0.10)" },
  unknown: { label: "לא מזוהה", color: "#7C6FA0", bg: "rgba(124,111,160,0.12)" },
};

export const FEE_STATUS_BADGE: Record<string, { label: string; color: string }> = {
  excellent: { label: "מצוין", color: "#059669" },
  fair: { label: "הוגן", color: "#059669" },
  above_market: { label: "מעל השוק", color: "#DC2626" },
  high: { label: "גבוה מאוד", color: "#DC2626" },
  unknown: { label: "לא ידוע", color: "#7C6FA0" },
};

export { HEALTH_STATUS_ICON } from "./healthDisplay";

export const UPLOAD_PROGRESS_STEPS = [
  "מפרסר דוח...",
  "מתאים מול השוק...",
  "מחשב שורה תחתונה...",
];
